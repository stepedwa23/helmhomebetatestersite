import { supabase } from './supabase'
import type { HelpArticle, TipTapDoc } from '../types'

// ---------- Reads ----------

export async function listArticles(projectId: string): Promise<HelpArticle[]> {
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('project_id', projectId)
    .order('is_pinned', { ascending: false })
    .order('order_index', { ascending: true })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as HelpArticle[]
}

export async function getArticleBySlug(
  projectId: string,
  slug: string,
): Promise<HelpArticle | null> {
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as HelpArticle | undefined) ?? null
}

export async function getArticle(id: string): Promise<HelpArticle | null> {
  const { data, error } = await supabase
    .from('help_articles')
    .select('*')
    .eq('id', id)
    .limit(1)
  if (error) throw error
  return (data?.[0] as HelpArticle | undefined) ?? null
}

// ---------- Writes ----------

export interface CreateArticleInput {
  project_id: string
  title: string
  slug: string
  body: TipTapDoc
  category?: string | null
  is_pinned?: boolean
  order_index?: number
}

export async function createArticle(
  input: CreateArticleInput,
  createdBy: string,
): Promise<HelpArticle> {
  const { data, error } = await supabase
    .from('help_articles')
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      slug: input.slug.trim(),
      body: input.body ?? null,
      category: input.category?.trim() || null,
      is_pinned: input.is_pinned ?? false,
      order_index: input.order_index ?? 0,
      created_by: createdBy,
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as HelpArticle | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export interface UpdateArticleInput {
  title?: string
  slug?: string
  body?: TipTapDoc
  category?: string | null
  is_pinned?: boolean
  order_index?: number
}

export async function updateArticle(id: string, patch: UpdateArticleInput): Promise<void> {
  const normalized: Partial<HelpArticle> = {}
  if (typeof patch.title === 'string') normalized.title = patch.title.trim()
  if (typeof patch.slug === 'string') normalized.slug = patch.slug.trim()
  if ('body' in patch) normalized.body = patch.body ?? null
  if ('category' in patch) normalized.category = patch.category?.trim() || null
  if (typeof patch.is_pinned === 'boolean') normalized.is_pinned = patch.is_pinned
  if (typeof patch.order_index === 'number') normalized.order_index = patch.order_index

  const { error } = await supabase.from('help_articles').update(normalized).eq('id', id)
  if (error) throw error
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('help_articles').delete().eq('id', id)
  if (error) throw error
}

// ---------- Helpers ----------

/**
 * Generate a URL-safe slug from a title. Lowercase, alphanumerics + hyphens.
 * Caps at 60 chars to keep URLs readable. Caller can still hand-edit afterward.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
