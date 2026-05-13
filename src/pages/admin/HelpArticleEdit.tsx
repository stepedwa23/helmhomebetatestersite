import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Full-screen help-article editor. Registered OUTSIDE the Layout in App.tsx
 * so the editor toolbar can be fixed without colliding with the Layout header.
 */
export default function AdminHelpArticleEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/help')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </button>
        <div className="ml-auto text-xs text-gray-500">
          {id === 'new' ? 'New article' : `Article #${id?.slice(0, 8)}`}
        </div>
      </div>

      <main className="pt-14 flex-1 p-6 md:p-8">
        <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">
            Article editor (placeholder). TipTap toolbar (bold, italic, headings, lists, links,
            images, code blocks), title + slug + category + pinned flag, save button.
          </p>
        </div>
      </main>
    </div>
  )
}
