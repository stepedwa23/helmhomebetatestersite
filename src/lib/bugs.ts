import { supabase } from './supabase'
import type {
  BugReport,
  BugReportPublic,
  BugSeverity,
  BugCategory,
  BugStatus,
  CalmModeState,
  OS,
} from '../types'

// ---------- Admin reads (bug_reports table — includes triage_notes) ----------

export async function listBugsAdmin(projectId: string): Promise<BugReport[]> {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BugReport[]
}

/** Bug joined with tester contact info, for the triage table view. */
export interface BugReportWithTester extends BugReport {
  tester: { id: string; name: string; email: string } | null
}

export async function listBugsWithTester(
  projectId: string,
): Promise<BugReportWithTester[]> {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*, tester:testers(id, name, email)')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BugReportWithTester[]
}

export async function getBugAdmin(id: string): Promise<BugReport | null> {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*')
    .eq('id', id)
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as BugReport | undefined) ?? null
}

export async function getBugWithTester(id: string): Promise<BugReportWithTester | null> {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*, tester:testers(id, name, email)')
    .eq('id', id)
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as BugReportWithTester | undefined) ?? null
}

export async function updateBugStatus(id: string, status: BugStatus): Promise<void> {
  const patch: Partial<BugReport> = { status }
  if (status === 'resolved' || status === 'closed') {
    patch.resolved_at = new Date().toISOString()
  }
  const { error } = await supabase.from('bug_reports').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateBugTriageNotes(id: string, triage_notes: string): Promise<void> {
  const { error } = await supabase
    .from('bug_reports')
    .update({ triage_notes })
    .eq('id', id)
  if (error) throw error
}

// ---------- Tester reads (bug_reports_public view — no triage_notes) ----------

export async function listMyBugs(testerId: string): Promise<BugReportPublic[]> {
  const { data, error } = await supabase
    .from('bug_reports_public')
    .select('*')
    .eq('tester_id', testerId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BugReportPublic[]
}

/**
 * All bugs in the project visible to the current tester. Backed by the
 * bug_reports_public view (which excludes admin-only triage_notes) plus the
 * updated bug_reports_tester_select_all RLS policy.
 *
 * Joined with the tester's name/email so the UI can show "submitted by X".
 */
export interface BugReportPublicWithTester extends BugReportPublic {
  tester: { id: string; name: string; email: string } | null
}

export async function listAllBugsForTesters(
  projectId: string,
): Promise<BugReportPublicWithTester[]> {
  const { data, error } = await supabase
    .from('bug_reports_public')
    .select('*, tester:testers(id, name, email)')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Array<
    BugReportPublic & {
      tester: BugReportPublicWithTester['tester'] | BugReportPublicWithTester['tester'][] | null
    }
  >).map((row) => ({
    ...row,
    tester: Array.isArray(row.tester) ? row.tester[0] ?? null : row.tester,
  }))
}

// ---------- Tester submit ----------

export interface SubmitBugInput {
  project_id: string
  tester_id: string
  cycle_id?: string | null
  title: string
  description: string
  steps_to_reproduce?: string | null
  severity: BugSeverity
  category: BugCategory
  helm_version?: string | null
  os?: OS | null
  os_version?: string | null
  calm_mode_state: CalmModeState
}

export async function submitBug(input: SubmitBugInput): Promise<BugReport> {
  const { data, error } = await supabase
    .from('bug_reports')
    .insert({ ...input, status: 'open' satisfies BugStatus })
    .select('*')
  if (error) throw error

  const bug = (data?.[0] as BugReport | undefined) ?? null
  if (!bug) throw new Error('Insert returned no row')

  // Fire-and-forget notification (ack to tester + admin alert via Resend).
  // We don't await — if the function errors, the bug is still filed; admin can re-run.
  void supabase.functions.invoke('notify-bug-submitted', { body: { bug_id: bug.id } })

  return bug
}
