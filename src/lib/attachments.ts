import { supabase } from './supabase'
import type { BugAttachment } from '../types'

const BUCKET = 'bug-attachments'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export class AttachmentError extends Error {}

export async function uploadBugAttachment(
  bugId: string,
  file: File,
): Promise<BugAttachment> {
  if (file.size > MAX_BYTES) {
    throw new AttachmentError('File is larger than 5 MB.')
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    throw new AttachmentError(
      `Unsupported file type "${file.type}". Allowed: ${ALLOWED_MIME.join(', ')}.`,
    )
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${bugId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadErr) throw uploadErr

  const { data, error } = await supabase
    .from('bug_attachments')
    .insert({
      bug_id: bugId,
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('*')
  if (error) throw error

  return (data?.[0] as BugAttachment) ?? Promise.reject(new Error('Insert returned no row'))
}

export async function listBugAttachments(bugId: string): Promise<BugAttachment[]> {
  const { data, error } = await supabase
    .from('bug_attachments')
    .select('*')
    .eq('bug_id', bugId)
    .order('uploaded_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as BugAttachment[]
}

/** Generate a short-lived signed URL for viewing an attachment in the UI. */
export async function getAttachmentUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
