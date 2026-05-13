import { supabase } from './supabase'
import type { Feedback } from '../types'

// ---------- Reads ----------

export async function listFeedback(projectId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Feedback[]
}

export async function listMyFeedback(testerId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('tester_id', testerId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Feedback[]
}

/** Feedback joined with submitter + cycle info, for the admin table view. */
export interface FeedbackWithTester extends Feedback {
  tester: { id: string; name: string; email: string } | null
  cycle: { id: string; name: string; build_version: string | null } | null
}

export async function listFeedbackWithTester(
  projectId: string,
): Promise<FeedbackWithTester[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select(`
      *,
      tester:testers(id, name, email),
      cycle:test_cycles(id, name, build_version)
    `)
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FeedbackWithTester[]
}

// ---------- Writes ----------

export interface SubmitFeedbackInput {
  project_id: string
  tester_id: string
  cycle_id?: string | null
  rating: number
  comments?: string | null
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<Feedback> {
  const { data, error } = await supabase
    .from('feedback')
    .insert(input)
    .select('*')
  if (error) throw error

  const row = (data?.[0] as Feedback | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')

  // Fire the ack + admin alert (deployed Edge Function).
  void supabase.functions.invoke('notify-feedback-submitted', {
    body: { feedback_id: row.id },
  })

  return row
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) throw error
}
