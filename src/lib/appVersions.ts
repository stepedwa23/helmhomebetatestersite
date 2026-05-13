import { supabase } from './supabase'
import type { AppVersion, TipTapDoc } from '../types'

export async function listVersions(projectId: string): Promise<AppVersion[]> {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('release_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as AppVersion[]
}

/** Returns the row marked is_current=true for the project (the current beta). */
export async function getCurrentVersion(projectId: string): Promise<AppVersion | null> {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .order('release_date', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as AppVersion | undefined) ?? null
}

export interface CreateVersionInput {
  project_id: string
  version: string
  release_date?: string | null
  patch_notes: TipTapDoc
  is_current?: boolean
}

export async function createVersion(
  input: CreateVersionInput,
  createdBy: string,
): Promise<AppVersion> {
  // The schema enforces "one is_current per project" via a partial unique index.
  // If you mark a new version as current, the SQL trigger flips the previous one off.
  const { data, error } = await supabase
    .from('app_versions')
    .insert({
      project_id: input.project_id,
      version: input.version.trim(),
      release_date: input.release_date || null,
      patch_notes: input.patch_notes ?? null,
      is_current: input.is_current ?? false,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as AppVersion | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function updateVersion(id: string, patch: Partial<AppVersion>): Promise<void> {
  const { error } = await supabase.from('app_versions').update(patch).eq('id', id)
  if (error) throw error
}

export async function setVersionCurrent(id: string): Promise<void> {
  // The DB trigger handles flipping the previous current off, but doing it
  // here too keeps the UI honest if the trigger ever misfires.
  const { error } = await supabase
    .from('app_versions')
    .update({ is_current: true })
    .eq('id', id)
  if (error) throw error
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('app_versions').delete().eq('id', id)
  if (error) throw error
}
