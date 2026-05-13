import { supabase } from './supabase'
import type { HelpArticle, TipTapDoc } from '../types'

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

export interface CreateArticleInput {
  project_id: string
  title: string
  slug: string
  body: TipTapDoc
  category?: string | null
  is_pinned?: boolean
  order_index?: number
}

export async function createArticle(input: CreateArticleInput): Promise<HelpArticle> {
  const { data, error } = await supabase
    .from('help_articles')
    .insert(input)
    .select('*')
  if (error) throw error
  return (data?.[0] as HelpArticle) ?? Promise.reject(new Error('Insert returned no row'))
}

export async function updateArticle(id: string, patch: Partial<HelpArticle>): Promise<void> {
  const { error } = await supabase.from('help_articles').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from('help_articles').delete().eq('id', id)
  if (error) throw error
}
