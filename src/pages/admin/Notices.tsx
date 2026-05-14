import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Megaphone,
  Eye,
  EyeOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/StatusBadge'
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
} from '../../lib/notices'
import type { Notice, NoticeSeverity } from '../../types'
import { NOTICE_SEVERITY_OPTIONS, NOTICE_SEVERITY_LABEL } from '../../types'

const SEVERITY_TONE: Record<NoticeSeverity, 'blue' | 'amber' | 'red'> = {
  info: 'blue',
  warning: 'amber',
  critical: 'red',
}

export default function AdminNotices() {
  const { user, project } = useAuth()
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState<Notice | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listNotices(project.id)
      setNotices(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notices')
      // Set to empty array so the loading spinner clears and the error banner
      // becomes the visible feedback. Otherwise spinner shows forever.
      setNotices([])
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

  async function toggleActive(n: Notice) {
    try {
      await updateNotice(n.id, { is_active: !n.is_active })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notice')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteNotice(deleting.id)
      setDeleting(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notice')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Site-wide banners that appear at the top of every page for testers (and
            you). Use for outages, known issues, important reminders. Active notices show
            in order: critical first, then warning, then info.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New notice
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {notices === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Megaphone className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No notices yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Create one when there's something all testers should see at the top of every page.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Body</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notices.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 max-w-md">
                    <p className="text-gray-900 truncate">{n.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={SEVERITY_TONE[n.severity]}>
                      {NOTICE_SEVERITY_LABEL[n.severity]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {n.is_active ? (
                      <Badge tone="green">Showing</Badge>
                    ) : (
                      <Badge tone="gray">Hidden</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === n.id ? null : n.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Notice actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === n.id && (
                      <RowMenu
                        notice={n}
                        onEdit={() => {
                          setOpenMenu(null)
                          setEditing(n)
                        }}
                        onToggleActive={() => {
                          setOpenMenu(null)
                          toggleActive(n)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(n)
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
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="New notice"
        size="lg"
      >
        <NoticeForm
          submitLabel="Create notice"
          onSubmit={async (values) => {
            await createNotice(
              {
                project_id: project!.id,
                body: values.body,
                severity: values.severity,
                is_active: values.is_active,
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
        title="Edit notice"
        size="lg"
      >
        {editing && (
          <NoticeForm
            submitLabel="Save changes"
            initial={{
              body: editing.body,
              severity: editing.severity,
              is_active: editing.is_active,
            }}
            onSubmit={async (values) => {
              await updateNotice(editing.id, values)
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
        title="Delete notice?"
        message={
          deleting
            ? `Permanently remove this notice? If you just want to stop showing it, use "Hide" instead.`
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
  notice,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  notice: Notice
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
      <MenuItem
        icon={notice.is_active ? EyeOff : Eye}
        label={notice.is_active ? 'Hide' : 'Show'}
        onClick={onToggleActive}
      />
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

interface NoticeFormValues {
  body: string
  severity: NoticeSeverity
  is_active: boolean
}

const EMPTY_FORM: NoticeFormValues = {
  body: '',
  severity: 'info',
  is_active: true,
}

interface NoticeFormProps {
  initial?: Partial<NoticeFormValues>
  submitLabel: string
  onSubmit: (values: NoticeFormValues) => Promise<void>
  onCancel: () => void
}

function NoticeForm({ initial, submitLabel, onSubmit, onCancel }: NoticeFormProps) {
  const [values, setValues] = useState<NoticeFormValues>({ ...EMPTY_FORM, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof NoticeFormValues>(key: K, v: NoticeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.body.trim()) return setError('Body is required.')
    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notice.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="n-body"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
        >
          Body
        </label>
        <textarea
          id="n-body"
          value={values.body}
          onChange={(e) => set('body', e.target.value)}
          rows={3}
          placeholder="e.g. Helm v0.3.0 has a known issue with the daily digest on Windows — fix coming in 0.3.1."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-500">
          Keep it short and specific. Shows at the top of every page for everyone in the
          project.
        </p>
      </div>

      <div>
        <label
          htmlFor="n-sev"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
        >
          Severity
        </label>
        <select
          id="n-sev"
          value={values.severity}
          onChange={(e) => set('severity', e.target.value as NoticeSeverity)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {NOTICE_SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {NOTICE_SEVERITY_LABEL[s]} — {severityHint(s)}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">Show this notice now</span>
          <span className="block text-xs text-gray-500">
            Uncheck to save as a draft. You can flip it on later from the row menu.
          </span>
        </span>
      </label>

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

function severityHint(s: NoticeSeverity): string {
  switch (s) {
    case 'info':
      return 'blue, FYI tone'
    case 'warning':
      return 'amber, heads-up tone'
    case 'critical':
      return 'red, must-read tone'
  }
}
