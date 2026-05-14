import { supabase } from './supabase'
import type { Notice, NoticeSeverity } from '../types'

// ---------- Reads ----------

/** All notices in the project, including inactive — admin view. */
export async function listNotices(projectId: string): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('project_id', projectId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Notice[]
}

/**
 * Active notices only — what shows in the banner. RLS returns admin's active
 * notices for admin, and only is_active=true ones for testers. So this query
 * is safe to call from any authenticated user.
 */
export async function listActiveNotices(projectId: string): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('severity', { ascending: false }) // critical first
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Notice[]
}

// ---------- Writes ----------

export interface CreateNoticeInput {
  project_id: string
  body: string
  severity: NoticeSeverity
  is_active?: boolean
}

export async function createNotice(
  input: CreateNoticeInput,
  createdBy: string,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .insert({
      project_id: input.project_id,
      body: input.body.trim(),
      severity: input.severity,
      is_active: input.is_active ?? true,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as Notice | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export interface UpdateNoticeInput {
  body?: string
  severity?: NoticeSeverity
  is_active?: boolean
}

export async function updateNotice(id: string, patch: UpdateNoticeInput): Promise<void> {
  const normalized: Partial<Notice> = {}
  if (typeof patch.body === 'string') normalized.body = patch.body.trim()
  if (patch.severity) normalized.severity = patch.severity
  if (typeof patch.is_active === 'boolean') normalized.is_active = patch.is_active

  const { error } = await supabase.from('notices').update(normalized).eq('id', id)
  if (error) throw error
}

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) throw error
}
