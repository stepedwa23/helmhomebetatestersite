import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Full-screen bug detail view with its own fixed toolbar.
 * Registered OUTSIDE the Layout in App.tsx so the toolbar doesn't overlay
 * the Layout header (reference-project lesson).
 */
export default function AdminBugDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/bugs')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to triage
        </button>
        <div className="ml-auto text-xs text-gray-500">Bug #{id?.slice(0, 8)}</div>
      </div>

      <main className="pt-14 flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">
            Bug detail view (placeholder). Title, full description, attachments, OS/version,
            calm-mode state, triage notes, status controls.
          </p>
        </div>
      </main>
    </div>
  )
}
