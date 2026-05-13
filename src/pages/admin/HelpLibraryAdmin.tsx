import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Star,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/StatusBadge'
import {
  listArticles,
  updateArticle,
  deleteArticle,
} from '../../lib/helpArticles'
import type { HelpArticle } from '../../types'

export default function AdminHelpLibrary() {
  const { project } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<HelpArticle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<HelpArticle | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listArticles(project.id)
      setArticles(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!openMenu) return
    function onClick() {
      setOpenMenu(null)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [openMenu])

  if (!project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function togglePin(article: HelpArticle) {
    try {
      await updateArticle(article.id, { is_pinned: !article.is_pinned })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update article')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteArticle(deleting.id)
      setDeleting(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete article')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Help Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Articles your testers can browse. Pinned articles appear first; the rest sort
            by category and order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/help/new/edit')}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New article
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {articles === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No articles yet.</p>
          <button
            type="button"
            onClick={() => navigate('/admin/help/new/edit')}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Write your first article
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Article</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Pinned</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/admin/help/${a.id}/edit`)}
                  className="hover:bg-gray-50/60 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.title}</div>
                    <div className="text-xs text-gray-500 font-mono">/help/{a.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {a.category || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.is_pinned ? (
                      <Badge tone="amber" className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Pinned
                      </Badge>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{a.order_index}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === a.id ? null : a.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Article actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === a.id && (
                      <RowMenu
                        article={a}
                        onEdit={() => {
                          setOpenMenu(null)
                          navigate(`/admin/help/${a.id}/edit`)
                        }}
                        onTogglePin={() => {
                          setOpenMenu(null)
                          togglePin(a)
                        }}
                        onViewLive={() => {
                          setOpenMenu(null)
                          navigate(`/help/${a.slug}`)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(a)
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete article?"
        message={
          deleting
            ? `Permanently remove "${deleting.title}"? Testers won't see it anymore. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

// ---------- Row menu ----------

function RowMenu({
  article,
  onEdit,
  onTogglePin,
  onViewLive,
  onDelete,
}: {
  article: HelpArticle
  onEdit: () => void
  onTogglePin: () => void
  onViewLive: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
      <MenuItem
        icon={Star}
        label={article.is_pinned ? 'Unpin' : 'Pin to top'}
        onClick={onTogglePin}
      />
      <MenuItem icon={ExternalLink} label="View as tester" onClick={onViewLive} />
      <div className="my-1 border-t border-gray-100" />
      <MenuItem
        icon={Trash2}
        label="Delete"
        onClick={onDelete}
        className="text-red-600 hover:bg-red-50"
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  className = 'text-gray-700 hover:bg-gray-50',
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 ${className}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  )
}
