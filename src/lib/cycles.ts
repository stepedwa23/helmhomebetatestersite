import { supabase } from './supabase'
import type { TestCycle, CycleTester, CycleStatus } from '../types'

export async function listCycles(projectId: string): Promise<TestCycle[]> {
  const { data, error } = await supabase
    .from('test_cycles')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: false, nullsFirst: false })
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

export interface CreateCycleInput {
  project_id: string
  name: string
  build_version?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: CycleStatus
  notes?: string | null
}

export async function createCycle(input: CreateCycleInput): Promise<TestCycle> {
  const { data, error } = await supabase
    .from('test_cycles')
    .insert(input)
    .select('*')
  if (error) throw error
  return (data?.[0] as TestCycle) ?? Promise.reject(new Error('Insert returned no row'))
}

export async function updateCycle(id: string, patch: Partial<TestCycle>): Promise<void> {
  const { error } = await supabase.from('test_cycles').update(patch).eq('id', id)
  if (error) throw error
}

export async function listCycleTesters(cycleId: string): Promise<CycleTester[]> {
  const { data, error } = await supabase
    .from('cycle_testers')
    .select('*')
    .eq('cycle_id', cycleId)
  if (error) throw error
  return (data ?? []) as CycleTester[]
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
