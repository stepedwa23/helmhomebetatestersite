import { useState } from 'react'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Set true for destructive actions (red confirm button). */
  destructive?: boolean
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    setBusy(true)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmClass = destructive
    ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-gray-600">{message}</p>

      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className={`px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${confirmClass}`}
        >
          {busy && <LoadingSpinner size="sm" className="border-white" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
