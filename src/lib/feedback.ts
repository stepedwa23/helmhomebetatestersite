import { supabase } from './supabase'
import type { Feedback } from '../types'

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

  void supabase.functions.invoke('notify-feedback-submitted', {
    body: { feedback_id: row.id },
  })

  return row
}
