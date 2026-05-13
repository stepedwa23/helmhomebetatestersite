import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import {
  listDownloads,
  uploadDownload,
  deleteDownload,
  DownloadUploadError,
} from '../../lib/appDownloads'
import {
  ACTIVE_PLATFORMS,
  APP_PLATFORM_LABEL,
  type AppDownload,
  type AppPlatform,
  type AppVersion,
} from '../../types'

interface ManageDownloadsModalProps {
  open: boolean
  version: AppVersion | null
  userId: string
  onClose: () => void
  onChange?: () => void
}

export default function ManageDownloadsModal({
  open,
  version,
  userId,
  onClose,
  onChange,
}: ManageDownloadsModalProps) {
  const [downloads, setDownloads] = useState<AppDownload[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!version) return
    setLoadError(null)
    try {
      const rows = await listDownloads(version.id)
      setDownloads(rows)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load downloads')
    }
  }, [version])

  useEffect(() => {
    if (!open || !version) return
    setDownloads(null)
    refresh()
  }, [open, version, refresh])

  function byPlatform(platform: AppPlatform): AppDownload | null {
    return downloads?.find((d) => d.platform === platform) ?? null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={version ? `Downloads — ${version.version}` : 'Downloads'}
      description="Upload an installer for each platform. Replacing a file removes the previous one. Testers see these on their dashboard."
      size="lg"
    >
      {loadError && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {loadError}
        </div>
      )}

      {downloads === null && !loadError ? (
        <div className="py-6 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-3">
          {ACTIVE_PLATFORMS.map((platform) => (
            <PlatformSlot
              key={platform}
              platform={platform}
              download={byPlatform(platform)}
              versionId={version?.id ?? ''}
              userId={userId}
              onChanged={async () => {
                await refresh()
                onChange?.()
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

// ---------- Per-platform slot ----------

interface PlatformSlotProps {
  platform: AppPlatform
  download: AppDownload | null
  versionId: string
  userId: string
  onChanged: () => void | Promise<void>
}

function PlatformSlot({ platform, download, versionId, userId, onChanged }: PlatformSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setSuccess(false)
    setBusy(true)
    try {
      await uploadDownload(versionId, platform, file, userId)
      setSuccess(true)
      await onChanged()
      // Briefly show success state, then clear.
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      if (err instanceof DownloadUploadError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!download) return
    if (!confirm(`Remove ${download.filename}?`)) return
    setError(null)
    setBusy(true)
    try {
      await deleteDownload(download.id)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">
            {APP_PLATFORM_LABEL[platform]}
          </div>
          {download ? (
            <div className="mt-1 text-xs text-gray-500 truncate">
              <FileDown className="w-3 h-3 inline mr-1" />
              {download.filename}
              <span className="text-gray-300 mx-1">·</span>
              {formatBytes(download.size_bytes)}
              <span className="text-gray-300 mx-1">·</span>
              uploaded {format(new Date(download.uploaded_at), 'MMM d, yyyy')}
            </div>
          ) : (
            <div className="mt-1 text-xs text-gray-400 italic">No file uploaded yet</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
          >
            {busy ? (
              <LoadingSpinner size="sm" className="border-white" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {download ? 'Replace' : 'Upload'}
          </button>
          {download && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              aria-label="Delete download"
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && !error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Uploaded.</span>
        </div>
      )}
    </div>
  )
}

// ---------- helpers ----------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
