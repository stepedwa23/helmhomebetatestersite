import { supabase } from './supabase'
import type { TesterMessage, TesterMessageStatus } from '../types'

export interface TesterMessageWithTester extends TesterMessage {
  tester: { id: string; name: string; email: string } | null
}

// ---------- Reads ----------

/** Admin view: all messages in the project, newest first. */
export async function listMessagesAdmin(
  projectId: string,
): Promise<TesterMessageWithTester[]> {
  const { data, error } = await supabase
    .from('tester_messages')
    .select('*, tester:testers(id, name, email)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  // PostgREST returns the joined relation as an array even when it's 1:1.
  return (data ?? []).map((row) => {
    const r = row as unknown as TesterMessage & {
      tester: TesterMessageWithTester['tester'] | TesterMessageWithTester['tester'][] | null
    }
    const tester = Array.isArray(r.tester) ? (r.tester[0] ?? null) : r.tester
    return { ...r, tester }
  })
}

/** Tester view: their own messages. */
export async function listMessagesForTester(
  testerId: string,
): Promise<TesterMessage[]> {
  const { data, error } = await supabase
    .from('tester_messages')
    .select('*')
    .eq('tester_id', testerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TesterMessage[]
}

// ---------- Writes ----------

export interface SendMessageInput {
  project_id: string
  tester_id: string
  subject: string
  body: string
}

/**
 * Tester-side: insert the message row, then fire-and-forget the edge function
 * that emails the admin. We do the DB insert first so:
 *   1. Admin has a record even if the email send fails.
 *   2. Email send failures don't make the tester think their message vanished.
 */
export async function sendMessage(input: SendMessageInput): Promise<TesterMessage> {
  const { data, error } = await supabase
    .from('tester_messages')
    .insert({
      project_id: input.project_id,
      tester_id: input.tester_id,
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select('*')
  if (error) throw error
  const row = (data?.[0] as TesterMessage | undefined) ?? null
  if (!row) throw new Error('Insert returned no row')

  // Fire-and-forget email notification. We don't await — the row is already
  // persisted and visible in the admin inbox. If email fails (Resend down,
  // missing config), admin still sees the message on the next page load.
  void supabase.functions
    .invoke('notify-tester-message', { body: { message_id: row.id } })
    .catch((err) => {
      console.warn('[sendMessage] notify-tester-message failed (non-fatal)', err)
    })

  return row
}

/** Admin: update message status (e.g. mark replied, archive). */
export async function updateMessageStatus(
  id: string,
  status: TesterMessageStatus,
): Promise<void> {
  const patch: { status: TesterMessageStatus; replied_at?: string | null } = { status }
  if (status === 'replied') patch.replied_at = new Date().toISOString()
  if (status === 'new') patch.replied_at = null
  const { error } = await supabase.from('tester_messages').update(patch).eq('id', id)
  if (error) throw error
}

/** Admin: permanent delete. */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('tester_messages').delete().eq('id', id)
  if (error) throw error
}
