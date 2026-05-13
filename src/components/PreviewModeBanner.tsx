import { Eye, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Banner shown at the top of tester-facing pages when the admin is in
 * preview-as-tester mode. Renders nothing for actual testers or when preview
 * is off — so pages can include it unconditionally.
 */
export default function PreviewModeBanner() {
  const { isAdmin, previewAsTester, setPreviewAsTester } = useAuth()
  if (!isAdmin || !previewAsTester) return null

  return (
    <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <Eye className="w-4 h-4 mt-0.5 text-amber-700 flex-shrink-0" />
      <div className="flex-1">
        <div className="font-medium text-amber-900">Preview mode</div>
        <div className="text-xs text-amber-800 mt-0.5">
          You're seeing what a tester sees. Submissions and edits are disabled — you
          don't have a tester row to act as.
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPreviewAsTester(false)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 rounded"
      >
        <X className="w-3.5 h-3.5" />
        Exit preview
      </button>
    </div>
  )
}
