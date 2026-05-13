import { supabase } from './supabase'
import type { TestCycle, CycleTester, CycleStatus } from '../types'

// ---------- Reads ----------

export async function listCycles(projectId: string): Promise<TestCycle[]> {
  const { data, error } = await supabase
    .from('test_cycles')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TestCycle[]
}

export async function getCycle(id: string): Promise<TestCycle | null> {
  const { data, error } = await supabase
    .from('test_cycles')
    .select('*')
    .eq('id', id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as TestCycle | undefined) ?? null
}

// ---------- Writes ----------

export interface CreateCycleInput {
  project_id: string
  name: string
  build_version?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: CycleStatus
  notes?: string | null
}

export async function createCycle(input: CreateCycleInput, createdBy: string): Promise<TestCycle> {
  const { data, error } = await supabase
    .from('test_cycles')
    .insert({
      project_id: input.project_id,
      name: input.name.trim(),
      build_version: input.build_version?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status ?? 'planned',
      notes: input.notes?.trim() || null,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as TestCycle | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export interface UpdateCycleInput {
  name?: string
  build_version?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: CycleStatus
  notes?: string | null
}

export async function updateCycle(id: string, patch: UpdateCycleInput): Promise<void> {
  // Normalize string inputs.
  const normalized: Partial<TestCycle> = { ...patch }
  if (typeof patch.name === 'string') normalized.name = patch.name.trim()
  if (typeof patch.build_version === 'string')
    normalized.build_version = patch.build_version.trim() || null
  if (typeof patch.notes === 'string') normalized.notes = patch.notes.trim() || null
  if (patch.start_date === '') normalized.start_date = null
  if (patch.end_date === '') normalized.end_date = null

  const { error } = await supabase.from('test_cycles').update(normalized).eq('id', id)
  if (error) throw error
}

export async function deleteCycle(id: string): Promise<void> {
  // ON DELETE CASCADE on cycle_testers in schema.sql cleans up assignments.
  // Bug reports keep their cycle_id reference NULL'd (ON DELETE SET NULL).
  const { error } = await supabase.from('test_cycles').delete().eq('id', id)
  if (error) throw error
}

// ---------- Assignments (junction table) ----------

export async function listCycleTesters(cycleId: string): Promise<CycleTester[]> {
  const { data, error } = await supabase
    .from('cycle_testers')
    .select('*')
    .eq('cycle_id', cycleId)
  if (error) throw error
  return (data ?? []) as CycleTester[]
}

/**
 * All cycles a given tester is assigned to, joined through cycle_testers.
 * Used by the tester feedback page to scope the cycle picker.
 *
 * Supabase's inferred type for the nested `cycle:test_cycles(*)` join is
 * `any[]` (because it doesn't distinguish to-one vs to-many from a string
 * select). At runtime it's a single object for to-one FKs, so we cast
 * through `unknown` to the actual shape and treat the field as either an
 * object or an array defensively.
 */
export async function listCyclesForTester(testerId: string): Promise<TestCycle[]> {
  const { data, error } = await supabase
    .from('cycle_testers')
    .select('cycle:test_cycles(*)')
    .eq('tester_id', testerId)
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    cycle: TestCycle | TestCycle[] | null
  }>
  const cycles = rows
    .map((r) => (Array.isArray(r.cycle) ? r.cycle[0] : r.cycle))
    .filter((c): c is TestCycle => !!c)

  cycles.sort((a, b) => {
    const aDate = a.start_date ?? a.created_at
    const bDate = b.start_date ?? b.created_at
    return bDate.localeCompare(aDate)
  })
  return cycles
}

/**
 * Fetch every cycle_testers row across all cycles in a project in ONE query.
 * The list view uses this to show "n testers assigned" per cycle without
 * making N round-trips. Returns rows grouped by cycle_id on the caller side.
 *
 * RLS scopes this to assignments the current user can see — admins see all,
 * testers see only their own. For the admin list view, that's the full set.
 */
export async function listAllCycleAssignments(
  projectId: string,
): Promise<CycleTester[]> {
  // We can't filter on `cycle.project_id` directly from cycle_testers because
  // the FK is just to test_cycles.id. So we join: select all cycle_testers
  // whose cycle_id matches a cycle in this project.
  const { data, error } = await supabase
    .from('cycle_testers')
    .select('cycle_id, tester_id, assigned_at, cycle:test_cycles!inner(project_id)')
    .eq('cycle.project_id', projectId)
  if (error) throw error
  // The select includes a joined `cycle` object; strip it before returning.
  return ((data ?? []) as Array<CycleTester & { cycle?: unknown }>).map(
    ({ cycle: _ignore, ...rest }) => rest,
  ) as CycleTester[]
}

export async function assignTesterToCycle(cycleId: string, testerId: string): Promise<void> {
  const { error } = await supabase
    .from('cycle_testers')
    .insert({ cycle_id: cycleId, tester_id: testerId })
  if (error) throw error
}

export async function removeTesterFromCycle(cycleId: string, testerId: string): Promise<void> {
  const { error } = await supabase
    .from('cycle_testers')
    .delete()
    .eq('cycle_id', cycleId)
    .eq('tester_id', testerId)
  if (error) throw error
}
