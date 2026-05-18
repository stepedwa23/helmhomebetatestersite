import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Map,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { RoadmapStatusBadge } from '../../components/StatusBadge'
import {
  listRoadmapItems,
  createRoadmapItem,
  updateRoadmapItem,
  deleteRoadmapItem,
} from '../../lib/roadmap'
import type { RoadmapItem, RoadmapStatus } from '../../types'
import { ROADMAP_STATUS_OPTIONS, ROADMAP_STATUS_LABEL } from '../../types'

export default function AdminRoadmap() {
  const { user, project } = useAuth()
  const [items, setItems] = useState<RoadmapItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<RoadmapItem | null>(null)
  const [deleting, setDeleting] = useState<RoadmapItem | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listRoadmapItems(project.id)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap')
      setItems([])
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

  if (!project || !user) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function moveItem(item: RoadmapItem, direction: 'up' | 'down') {
    if (!items) return
    const index = items.findIndex((i) => i.id === item.id)
    if (index < 0) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= items.length) return

    const other = items[swapIndex]
    // Swap sort_order values. If they collide (both default 1000), spread them
    // so the swap actually reorders the list.
    let a = item.sort_order
    let b = other.sort_order
    if (a === b) {
      a = index * 10
      b = swapIndex * 10
    }
    try {
      await Promise.all([
        updateRoadmapItem(item.id, { sort_order: b }),
        updateRoadmapItem(other.id, { sort_order: a }),
      ])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteRoadmapItem(deleting.id)
      setDeleting(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Roadmap</h1>
          <p className="mt-1 text-sm text-gray-500">
            What's being worked on next. Testers see this on their dashboard next to the
            current patch notes. Reorder with the up/down buttons — items at the top show
            first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New item
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {items === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Map className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No roadmap items yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Add what you're planning so testers know what's coming and can prioritize
            their feedback.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="w-20 px-2 py-3" />
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50/60">
                  <td className="px-2 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => moveItem(item, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(item, 'down')}
                        disabled={idx === items.length - 1}
                        className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <p className="text-gray-900 font-medium truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RoadmapStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === item.id ? null : item.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Item actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === item.id && (
                      <RowMenu
                        onEdit={() => {
                          setOpenMenu(null)
                          setEditing(item)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(item)
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

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New roadmap item" size="lg">
        <RoadmapForm
          submitLabel="Create item"
          onSubmit={async (values) => {
            await createRoadmapItem(
              {
                project_id: project!.id,
                title: values.title,
                description: values.description,
                status: values.status,
              },
              user!.id,
            )
            setShowAdd(false)
            await refresh()
          }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit roadmap item"
        size="lg"
      >
        {editing && (
          <RoadmapForm
            submitLabel="Save changes"
            initial={{
              title: editing.title,
              description: editing.description ?? '',
              status: editing.status,
            }}
            onSubmit={async (values) => {
              await updateRoadmapItem(editing.id, values)
              setEditing(null)
              await refresh()
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete roadmap item?"
        message={
          deleting
            ? `Permanently remove "${deleting.title}"? Testers will no longer see this item.`
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

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
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

// ---------- Form ----------

interface RoadmapFormValues {
  title: string
  description: string
  status: RoadmapStatus
}

const EMPTY_FORM: RoadmapFormValues = {
  title: '',
  description: '',
  status: 'planned',
}

interface RoadmapFormProps {
  initial?: Partial<RoadmapFormValues>
  submitLabel: string
  onSubmit: (values: RoadmapFormValues) => Promise<void>
  onCancel: () => void
}

function RoadmapForm({ initial, submitLabel, onSubmit, onCancel }: RoadmapFormProps) {
  const [values, setValues] = useState<RoadmapFormValues>({ ...EMPTY_FORM, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof RoadmapFormValues>(key: K, v: RoadmapFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.title.trim()) return setError('Title is required.')
    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="rm-title"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
        >
          Title
        </label>
        <input
          id="rm-title"
          type="text"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Calendar sync with Google Calendar"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
      </div>

      <div>
        <label
          htmlFor="rm-desc"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
        >
          Description <span className="font-normal lowercase text-gray-400">(optional)</span>
        </label>
        <textarea
          id="rm-desc"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="A sentence or two for testers — what it is, why you're doing it."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />
      </div>

      <div>
        <label
          htmlFor="rm-status"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
        >
          Status
        </label>
        <select
          id="rm-status"
          value={values.status}
          onChange={(e) => set('status', e.target.value as RoadmapStatus)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {ROADMAP_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ROADMAP_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
        >
          {busy && <LoadingSpinner size="sm" className="border-white" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
