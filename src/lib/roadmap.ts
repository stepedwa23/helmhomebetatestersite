import { supabase } from './supabase'
import type { RoadmapItem, RoadmapStatus, TipTapDoc } from '../types'

// ---------- Reads ----------

/**
 * All roadmap items for the project, ordered the way the admin set them.
 * RLS scopes admin to their projects and testers to their (read-only) project.
 * Tester view + admin view fetch the same rows — RLS handles the gate.
 */
export async function listRoadmapItems(projectId: string): Promise<RoadmapItem[]> {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as RoadmapItem[]
}

// ---------- Writes (admin only — RLS enforces) ----------

export interface CreateRoadmapItemInput {
  project_id: string
  title: string
  description?: TipTapDoc
  status?: RoadmapStatus
  sort_order?: number
}

export async function createRoadmapItem(
  input: CreateRoadmapItemInput,
  createdBy: string,
): Promise<RoadmapItem> {
  const { data, error } = await supabase
    .from('roadmap_items')
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description ?? null,
      status: input.status ?? 'planned',
      sort_order: input.sort_order ?? 1000,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as RoadmapItem | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export interface UpdateRoadmapItemInput {
  title?: string
  description?: TipTapDoc
  status?: RoadmapStatus
  sort_order?: number
}

export async function updateRoadmapItem(
  id: string,
  patch: UpdateRoadmapItemInput,
): Promise<void> {
  const normalized: Partial<RoadmapItem> = {}
  if (typeof patch.title === 'string') normalized.title = patch.title.trim()
  if (patch.description !== undefined) {
    normalized.description = patch.description
  }
  if (patch.status) normalized.status = patch.status
  if (typeof patch.sort_order === 'number') normalized.sort_order = patch.sort_order

  const { error } = await supabase.from('roadmap_items').update(normalized).eq('id', id)
  if (error) throw error
}

export async function deleteRoadmapItem(id: string): Promise<void> {
  const { error } = await supabase.from('roadmap_items').delete().eq('id', id)
  if (error) throw error
}
