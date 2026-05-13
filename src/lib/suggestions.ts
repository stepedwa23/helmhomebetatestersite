import { supabase } from './supabase'
import type { Suggestion, SuggestionPublic, SuggestionStatus } from '../types'

// ---------- Admin reads (full table — includes admin_notes) ----------

export async function listSuggestionsAdmin(projectId: string): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Suggestion[]
}

export async function getSuggestionAdmin(id: string): Promise<Suggestion | null> {
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', id)
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as Suggestion | undefined) ?? null
}

export async function updateSuggestionStatus(
  id: string,
  status: SuggestionStatus,
): Promise<void> {
  const { error } = await supabase.from('suggestions').update({ status }).eq('id', id)
  if (error) throw error
}

export async function updateSuggestionAdminNotes(
  id: string,
  admin_notes: string,
): Promise<void> {
  const { error } = await supabase
    .from('suggestions')
    .update({ admin_notes })
    .eq('id', id)
  if (error) throw error
}

// ---------- Tester reads (suggestions_public view — no admin_notes) ----------
// All testers in the project can see all suggestions (public to testers).

export async function listSuggestionsForTesters(projectId: string): Promise<SuggestionPublic[]> {
  const { data, error } = await supabase
    .from('suggestions_public')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SuggestionPublic[]
}

// ---------- Tester submit ----------

export interface SubmitSuggestionInput {
  project_id: string
  tester_id: string
  title: string
  description: string
}

export async function submitSuggestion(input: SubmitSuggestionInput): Promise<Suggestion> {
  const { data, error } = await supabase
    .from('suggestions')
    .insert({ ...input, status: 'new' satisfies SuggestionStatus })
    .select('*')
  if (error) throw error

  const row = (data?.[0] as Suggestion | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')

  void supabase.functions.invoke('notify-suggestion-submitted', {
    body: { suggestion_id: row.id },
  })

  return row
}
