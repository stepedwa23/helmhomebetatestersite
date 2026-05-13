import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { ImagePlus, X, AlertCircle } from 'lucide-react'

const MAX_FILES = 5
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

interface AttachmentUploaderProps {
  /** Currently-selected files. Controlled from the parent so the form owns submission lifecycle. */
  files: File[]
  onChange: (next: File[]) => void
  disabled?: boolean
}

/**
 * Pre-submit attachment picker. Shows thumbnails of selected images and lets
 * the tester remove any before they hit Submit. Validates size + MIME client-side
 * (the server enforces the same via bug_attachments CHECK constraints + storage policy).
 *
 * Files aren't uploaded here — the parent form calls uploadBugAttachment() after
 * the bug row is inserted, so each upload has a real bug_id to attach to.
 */
export default function AttachmentUploader({
  files,
  onChange,
  disabled = false,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build preview URLs and revoke them when files change / unmount.
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  function validateAndAdd(incoming: File[]) {
    setError(null)
    const accepted: File[] = []
    for (const f of incoming) {
      if (!ALLOWED_MIME.includes(f.type as (typeof ALLOWED_MIME)[number])) {
        setError(`"${f.name}" is not a supported image type. PNG, JPEG, WebP, or GIF only.`)
        continue
      }
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is larger than 5 MB.`)
        continue
      }
      accepted.push(f)
    }
    if (files.length + accepted.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} attachments. Remove some to add more.`)
      onChange([...files, ...accepted].slice(0, MAX_FILES))
      return
    }
    if (accepted.length > 0) {
      onChange([...files, ...accepted])
    }
  }

  function onFilesPicked(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    validateAndAdd(incoming)
    // Reset the input so picking the same file twice in a row still fires onChange.
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const incoming = Array.from(e.dataTransfer.files)
    validateAndAdd(incoming)
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
  }

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  const canAddMore = !disabled && files.length < MAX_FILES

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => canAddMore && inputRef.current?.click()}
        role="button"
        tabIndex={canAddMore ? 0 : -1}
        onKeyDown={(e) => {
          if (canAddMore && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={[
          'flex items-center justify-center gap-3 px-4 py-6 border-2 border-dashed rounded-lg transition-colors',
          canAddMore ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100',
        ].join(' ')}
      >
        <ImagePlus className="w-5 h-5 text-gray-500" />
        <div className="text-sm">
          <div className="text-gray-700 font-medium">
            {canAddMore
              ? 'Drop screenshots here, or click to choose'
              : `Maximum ${MAX_FILES} screenshots reached`}
          </div>
          <div className="text-xs text-gray-500">
            PNG, JPEG, WebP, or GIF · up to 5 MB each · {files.length}/{MAX_FILES} selected
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME.join(',')}
          multiple
          onChange={onFilesPicked}
          className="hidden"
          disabled={!canAddMore}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="relative group aspect-square bg-gray-100 border border-gray-200 rounded-lg overflow-hidden"
            >
              {previews[i] && (
                <img
                  src={previews[i]}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity disabled:cursor-not-allowed"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/50 text-white text-[10px] truncate">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
