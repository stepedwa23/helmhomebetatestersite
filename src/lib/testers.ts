import { supabase } from './supabase'
import type { Tester, TesterStatus, OS, HouseholdProfile } from '../types'

// ---------- Reads ----------

export async function listTesters(projectId: string): Promise<Tester[]> {
  const { data, error } = await supabase
    .from('testers')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tester[]
}

export async function getTester(id: string): Promise<Tester | null> {
  const { data, error } = await supabase
    .from('testers')
    .select('*')
    .eq('id', id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as Tester | undefined) ?? null
}

// ---------- Writes ----------

export interface CreateTesterInput {
  project_id: string
  name: string
  email: string
  os?: OS | null
  os_version?: string | null
  helm_version?: string | null
  household_profile?: HouseholdProfile | null
  notes?: string | null
}

/**
 * Directly INSERT a tester row from the admin client. RLS allows this because
 * the admin policy on `testers` covers all operations for the project owner.
 *
 * `user_id` is left null; it gets populated by the `link-tester-account`
 * Edge Function the first time the tester signs in via their invite link.
 *
 * `created_by` defaults to the calling auth user (passed in by the caller).
 */
export async function createTester(input: CreateTesterInput, createdBy: string): Promise<Tester> {
  const { data, error } = await supabase
    .from('testers')
    .insert({
      project_id: input.project_id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      os: input.os ?? null,
      os_version: input.os_version?.trim() || null,
      helm_version: input.helm_version?.trim() || null,
      household_profile: input.household_profile ?? null,
      notes: input.notes?.trim() || null,
      status: 'invited' satisfies TesterStatus,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as Tester | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export interface UpdateTesterInput {
  name?: string
  email?: string
  os?: OS | null
  os_version?: string | null
  helm_version?: string | null
  household_profile?: HouseholdProfile | null
  notes?: string | null
  status?: TesterStatus
}

export async function updateTester(id: string, patch: UpdateTesterInput): Promise<void> {
  // Normalize string inputs the same way createTester does.
  const normalized: Partial<Tester> = { ...patch }
  if (typeof patch.name === 'string') normalized.name = patch.name.trim()
  if (typeof patch.email === 'string') normalized.email = patch.email.trim().toLowerCase()
  if (typeof patch.os_version === 'string') normalized.os_version = patch.os_version.trim() || null
  if (typeof patch.helm_version === 'string') normalized.helm_version = patch.helm_version.trim() || null
  if (typeof patch.notes === 'string') normalized.notes = patch.notes.trim() || null

  const { error } = await supabase.from('testers').update(normalized).eq('id', id)
  if (error) throw error
}

export async function updateTesterStatus(id: string, status: TesterStatus): Promise<void> {
  const { error } = await supabase.from('testers').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteTester(id: string): Promise<void> {
  // ON DELETE CASCADE on testers in schema.sql cleans up bug_reports,
  // cycle_testers, feedback, suggestions tied to this tester. Be sure.
  const { error } = await supabase.from('testers').delete().eq('id', id)
  if (error) throw error
}

// ---------- Invite (Edge Function) ----------

/**
 * Create a tester row for the CURRENT authenticated user — used by admin
 * to self-attach as a tester so they can submit bugs / suggestions / feedback
 * through the regular tester flow.
 *
 * Distinct from createTester (the invite flow), which sets user_id=null and
 * relies on link-tester-account to populate it after the invitee accepts.
 * Here we set user_id immediately and skip the invite entirely.
 *
 * RLS-wise this works because the project owner (admin) has full INSERT
 * permission on testers via the testers_admin_all policy.
 */
export async function createSelfTesterProfile(args: {
  project_id: string
  user_id: string
  email: string
  name: string
}): Promise<Tester> {
  const { data, error } = await supabase
    .from('testers')
    .insert({
      project_id: args.project_id,
      user_id: args.user_id,
      name: args.name.trim(),
      email: args.email.trim().toLowerCase(),
      status: 'active' satisfies TesterStatus,
      joined_at: new Date().toISOString(),
      created_by: args.user_id,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as Tester | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

/**
 * Trigger the Supabase Auth magic-link invite for an existing tester row.
 * Requires the `invite-tester` Edge Function to be deployed and Resend (or
 * Supabase's default SMTP) configured.
 *
 * The function looks up the tester by id, verifies the caller is the project
 * admin, sends `auth.admin.inviteUserByEmail`, and updates `invited_at`.
 *
 * If the function isn't deployed yet, this throws a clear error and the
 * tester row remains untouched.
 */
export async function sendInvite(testerId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-tester', {
    body: { tester_id: testerId },
  })
  if (error) throw error
}
