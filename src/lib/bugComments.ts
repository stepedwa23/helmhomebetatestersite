import { supabase } from './supabase'
import type { BugComment } from '../types'

/** Comment joined with author tester (null for admin-authored). */
export interface BugCommentWithAuthor extends BugComment {
  tester: { id: string; name: string; email: string } | null
}

export async function listComments(bugId: string): Promise<BugCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('bug_comments')
    .select('*, tester:testers(id, name, email)')
    .eq('bug_id', bugId)
    .order('created_at', { ascending: true })
  if (error) throw error
  // Defensive against Supabase's join-type inference returning array vs object.
  return ((data ?? []) as unknown as Array<
    BugComment & { tester: BugCommentWithAuthor['tester'] | BugCommentWithAuthor['tester'][] | null }
  >).map((row) => ({
    ...row,
    tester: Array.isArray(row.tester) ? row.tester[0] ?? null : row.tester,
  }))
}

export interface CreateCommentInput {
  bug_id: string
  /** Null when posted by admin. The author's testers row id when posted by a tester. */
  tester_id: string | null
  body: string
}

export async function createComment(
  input: CreateCommentInput,
  authorUserId: string,
): Promise<BugComment> {
  const { data, error } = await supabase
    .from('bug_comments')
    .insert({
      bug_id: input.bug_id,
      tester_id: input.tester_id,
      author_user_id: authorUserId,
      body: input.body.trim(),
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as BugComment | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function updateComment(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('bug_comments')
    .update({ body: body.trim() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('bug_comments').delete().eq('id', id)
  if (error) throw error
}
