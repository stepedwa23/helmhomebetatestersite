import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Star } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmDialog from '../../components/ConfirmDialog'
import TipTapEditor from '../../components/editor/TipTapEditor'
import {
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  slugify,
} from '../../lib/helpArticles'
import type { HelpArticle, TipTapDoc } from '../../types'

export default function AdminHelpArticleEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, project } = useAuth()

  const isNew = !id || id === 'new'

  // Form state
  const [loading, setLoading] = useState(!isNew)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [category, setCategory] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [body, setBody] = useState<TipTapDoc>(null)

  // Loaded record (for existing edits) — used to detect "is this a real edit"
  const [original, setOriginal] = useState<HelpArticle | null>(null)

  // Submit state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Auto-suggest slug from title until the user manually edits the slug.
  useEffect(() => {
    if (!slugTouched && isNew) {
      setSlug(slugify(title))
    }
  }, [title, slugTouched, isNew])

  // Load article for existing edit.
  const load = useCallback(async () => {
    if (isNew || !id) return
    setError(null)
    try {
      const a = await getArticle(id)
      if (!a) {
        setError('Article not found.')
        setLoading(false)
        return
      }
      setOriginal(a)
      setTitle(a.title)
      setSlug(a.slug)
      setCategory(a.category ?? '')
      setIsPinned(a.is_pinned)
      setOrderIndex(a.order_index)
      setBody(a.body)
      setSlugTouched(true) // existing article — never auto-overwrite the slug
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article')
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    load()
  }, [load])

  if (!project || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  async function handleSave(closeAfter: boolean) {
    setError(null)
    if (!title.trim()) return setError('Title is required.')
    if (!slug.trim()) return setError('Slug is required.')

    setSaving(true)
    try {
      if (isNew) {
        const created = await createArticle(
          {
            project_id: project!.id,
            title,
            slug,
            body,
            category: category || null,
            is_pinned: isPinned,
            order_index: orderIndex,
          },
          user!.id,
        )
        if (closeAfter) {
          navigate('/admin/help')
        } else {
          // Stay on the same screen but switch the URL to the new id
          // so subsequent saves are updates, not duplicates.
          navigate(`/admin/help/${created.id}/edit`, { replace: true })
          setOriginal(created)
        }
      } else {
        await updateArticle(id!, {
          title,
          slug,
          body,
          category: category || null,
          is_pinned: isPinned,
          order_index: orderIndex,
        })
        if (closeAfter) navigate('/admin/help')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id || isNew) return
    setDeleting(true)
    try {
      await deleteArticle(id)
      navigate('/admin/help')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete article')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

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

        <div className="ml-auto flex items-center gap-2">
          {original && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 rounded-lg"
          >
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
          >
            Save &amp; close
          </button>
        </div>
      </div>

      <main className="pt-14 flex-1 p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Title + slug */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <Field label="Title" htmlFor="ha-title">
                  <input
                    id="ha-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. How to install Helm on macOS"
                    className={inputClass + ' text-lg font-semibold'}
                    autoFocus={isNew}
                  />
                </Field>

                <Field
                  label="URL slug"
                  htmlFor="ha-slug"
                  hint="The address bar suffix testers will see: /help/<slug>. Lowercase letters, numbers, and hyphens."
                >
                  <input
                    id="ha-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value)
                      setSlugTouched(true)
                    }}
                    placeholder="how-to-install-helm-on-macos"
                    className={inputClass + ' font-mono text-sm'}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Category" htmlFor="ha-cat" hint="Optional. Articles group by category in the tester view.">
                    <input
                      id="ha-cat"
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Getting started"
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Order"
                    htmlFor="ha-order"
                    hint="Lower numbers appear first."
                  >
                    <input
                      id="ha-order"
                      type="number"
                      value={orderIndex}
                      onChange={(e) => setOrderIndex(Number(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Pinned" htmlFor="ha-pin">
                    <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                      <input
                        id="ha-pin"
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5" />
                        Pin to top
                      </span>
                    </label>
                  </Field>
                </div>
              </div>

              {/* Body editor */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Body
                  </h2>
                </div>
                <div className="p-3">
                  <TipTapEditor
                    initial={body}
                    onChange={setBody}
                    placeholder="Write the article — headings, lists, links, and images all work."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete article?"
        message={
          original
            ? `Permanently remove "${original.title}"? Testers won't see it anymore. This cannot be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

// ---------- helpers ----------

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
