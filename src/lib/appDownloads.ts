import { supabase } from './supabase'
import type { AppDownload, AppPlatform } from '../types'

const BUCKET = 'app-downloads'

// 200 MB ceiling. Bumps the Supabase free-tier default of 50 MB — set the
// bucket's file size limit to match (or higher) via the dashboard.
const MAX_BYTES = 200 * 1024 * 1024

// Permissive list. Tauri produces .dmg / .app.zip on mac and .msi / .exe on
// Windows. We accept the umbrella .zip and .tar.gz too in case Stephen packages
// the build that way for some reason.
const ALLOWED_EXTENSIONS = [
  'dmg',
  'pkg',
  'app',
  'zip',
  'tar.gz',
  'tgz',
  'msi',
  'exe',
  'msix',
  'appx',
] as const

export class DownloadUploadError extends Error {}

export async function listDownloads(versionId: string): Promise<AppDownload[]> {
  const { data, error } = await supabase
    .from('app_downloads')
    .select('*')
    .eq('version_id', versionId)
    .order('platform', { ascending: true })
  if (error) throw error
  return (data ?? []) as AppDownload[]
}

/**
 * Upload a new installer for (version, platform). If a download already exists
 * for that pair, the old storage object is removed first, then the new file is
 * uploaded and the DB row is updated.
 *
 * The Storage layout: `<version_id>/<platform>/<unique>-<filename>`
 *   - prefixed by version_id so deleting a version cleans up via folder listing
 *   - includes a UUID so two uploads of the same filename don't collide
 */
export async function uploadDownload(
  versionId: string,
  platform: AppPlatform,
  file: File,
  uploadedBy: string,
): Promise<AppDownload> {
  // Client-side validation. Server-side enforcement lives in the bucket's
  // file_size_limit + the app_downloads INSERT RLS.
  if (file.size > MAX_BYTES) {
    throw new DownloadUploadError(
      `File is larger than ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    )
  }
  const ext = extractExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new DownloadUploadError(
      `Unsupported file type ".${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    )
  }

  // If a download already exists for this (version, platform), capture its
  // old storage_path so we can remove it after the new upload succeeds.
  const { data: existingRows } = await supabase
    .from('app_downloads')
    .select('id, storage_path')
    .eq('version_id', versionId)
    .eq('platform', platform)
    .limit(1)
  const existing = existingRows?.[0] as { id: string; storage_path: string } | undefined

  const path = `${versionId}/${platform}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadErr) throw uploadErr

  try {
    let row: AppDownload | null = null
    if (existing) {
      // UPDATE the existing row with new file info.
      const { data, error } = await supabase
        .from('app_downloads')
        .update({
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: uploadedBy,
        })
        .eq('id', existing.id)
        .select('*')
      if (error) throw error
      row = (data?.[0] as AppDownload | undefined) ?? null
    } else {
      // INSERT a new row.
      const { data, error } = await supabase
        .from('app_downloads')
        .insert({
          version_id: versionId,
          platform,
          filename: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          uploaded_by: uploadedBy,
        })
        .select('*')
      if (error) throw error
      row = (data?.[0] as AppDownload | undefined) ?? null
    }

    if (!row) throw new Error('Insert/update returned no row')

    // Now that the DB is updated, remove the old storage object if there was one.
    // If this fails we just log — the row is right; the orphan can be cleaned later.
    if (existing) {
      const { error: removeErr } = await supabase.storage
        .from(BUCKET)
        .remove([existing.storage_path])
      if (removeErr) {
        console.warn('[appDownloads] Old file removal failed', removeErr)
      }
    }

    return row
  } catch (err) {
    // DB insert/update failed AFTER the file uploaded. Roll back the file so
    // we don't accumulate orphans.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw err
  }
}

export async function deleteDownload(id: string): Promise<void> {
  // Look up the storage_path first so we can remove the file after the row.
  const { data: rows, error: lookupErr } = await supabase
    .from('app_downloads')
    .select('storage_path')
    .eq('id', id)
    .limit(1)
  if (lookupErr) throw lookupErr
  const path = (rows?.[0] as { storage_path: string } | undefined)?.storage_path

  const { error } = await supabase.from('app_downloads').delete().eq('id', id)
  if (error) throw error

  // Best-effort file cleanup. RLS may reject this for non-admins, but we don't
  // surface that — the row is gone, which is what the user cares about.
  if (path) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove([path])
    if (removeErr) console.warn('[appDownloads] File removal failed', removeErr)
  }
}

export async function getDownloadUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, { download: true })
  if (error) throw error
  return data.signedUrl
}

// ---------- helpers ----------

function extractExtension(filename: string): string {
  // Handle .tar.gz specially since extname only catches the last segment.
  const lower = filename.toLowerCase()
  if (lower.endsWith('.tar.gz')) return 'tar.gz'
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot + 1) : ''
}

function sanitizeFilename(name: string): string {
  // Keep it human-readable but safe for URLs.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}
