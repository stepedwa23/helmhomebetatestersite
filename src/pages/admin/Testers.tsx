import { useEffect, useState, useCallback } from 'react'
import {
  UserPlus,
  Mail,
  Pencil,
  Trash2,
  MoreHorizontal,
  CircleSlash,
  CircleCheck,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import {
  listTesters,
  createTester,
  updateTester,
  updateTesterStatus,
  deleteTester,
  sendInvite,
} from '../../lib/testers'
import type { Tester } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { TesterStatusBadge } from '../../components/StatusBadge'
import TesterForm, { type TesterFormValues } from '../../components/testers/TesterForm'

export default function AdminTesters() {
  const { user, project } = useAuth()
  const [testers, setTesters] = useState<Tester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Tester | null>(null)
  const [deleting, setDeleting] = useState<Tester | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listTesters(project.id)
      setTesters(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load testers')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Close any open row-menu when clicking elsewhere.
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

  async function handleAdd(values: TesterFormValues) {
    await createTester(
      {
        project_id: project!.id,
        name: values.name,
        email: values.email,
        os: values.os || null,
        os_version: values.os_version || null,
        helm_version: values.helm_version || null,
        household_profile: values.household_profile || null,
        notes: values.notes || null,
      },
      user!.id,
    )
    setShowAdd(false)
    await refresh()
  }

  async function handleEdit(values: TesterFormValues) {
    if (!editing) return
    await updateTester(editing.id, {
      name: values.name,
      email: values.email,
      os: values.os || null,
      os_version: values.os_version || null,
      helm_version: values.helm_version || null,
      household_profile: values.household_profile || null,
      notes: values.notes || null,
    })
    setEditing(null)
    await refresh()
  }

  async function handleSendInvite(t: Tester) {
    setActionMessage(null)
    try {
      await sendInvite(t.id)
      setActionMessage(`Invite sent to ${t.email}.`)
      await refresh()
    } catch (err) {
      setActionMessage(
        err instanceof Error
          ? `Could not send invite: ${err.message}`
          : 'Could not send invite.',
      )
    }
  }

  async function handleToggleStatus(t: Tester) {
    const next = t.status === 'inactive' ? 'active' : 'inactive'
    await updateTesterStatus(t.id, next)
    await refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteTester(deleting.id)
    setDeleting(null)
    await refresh()
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Testers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the roster. Add testers first, then send their invite email
            when you're ready.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <UserPlus className="w-4 h-4" />
          Add tester
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="mb-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {testers === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : testers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-600">No testers yet.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <UserPlus className="w-4 h-4" />
            Add your first tester
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          {/* No overflow-hidden here — would clip the row action dropdown. */}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Tester</th>
                <th className="text-left px-4 py-3">OS</th>
                <th className="text-left px-4 py-3">Helm</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Invited</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {testers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500 truncate">{t.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {t.os ? <OsLabel os={t.os} version={t.os_version} /> : <Dash />}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{t.helm_version || <Dash />}</td>
                  <td className="px-4 py-3">
                    <TesterStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {t.invited_at
                      ? formatDistanceToNow(new Date(t.invited_at), { addSuffix: true })
                      : <Dash />}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === t.id ? null : t.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Tester actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === t.id && (
                      <RowMenu
                        tester={t}
                        onSendInvite={() => {
                          setOpenMenu(null)
                          handleSendInvite(t)
                        }}
                        onEdit={() => {
                          setOpenMenu(null)
                          setEditing(t)
                        }}
                        onToggleStatus={() => {
                          setOpenMenu(null)
                          handleToggleStatus(t)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(t)
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
        title="Add tester"
        description="Create the tester row now. You can send the invite email afterwards."
        size="lg"
      >
        <TesterForm
          submitLabel="Add tester"
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit tester"
        size="lg"
      >
        {editing && (
          <TesterForm
            submitLabel="Save changes"
            initial={{
              name: editing.name,
              email: editing.email,
              os: editing.os ?? '',
              os_version: editing.os_version ?? '',
              helm_version: editing.helm_version ?? '',
              household_profile: editing.household_profile ?? '',
              notes: editing.notes ?? '',
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete tester?"
        message={
          deleting
            ? `This permanently removes ${deleting.name} (${deleting.email}) and any of their bug reports, feedback, and suggestions. This cannot be undone.`
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

interface RowMenuProps {
  tester: Tester
  onSendInvite: () => void
  onEdit: () => void
  onToggleStatus: () => void
  onDelete: () => void
}

function RowMenu({
  tester,
  onSendInvite,
  onEdit,
  onToggleStatus,
  onDelete,
}: RowMenuProps) {
  const ToggleIcon = tester.status === 'inactive' ? CircleCheck : CircleSlash
  const toggleLabel = tester.status === 'inactive' ? 'Mark active' : 'Mark inactive'

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Mail} label="Send invite email" onClick={onSendInvite} />
      <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
      <MenuItem icon={ToggleIcon} label={toggleLabel} onClick={onToggleStatus} />
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

// ---------- Tiny helpers ----------

function Dash() {
  return <span className="text-gray-300">—</span>
}

function OsLabel({ os, version }: { os: 'macos' | 'windows'; version: string | null }) {
  const label = os === 'macos' ? 'macOS' : 'Windows'
  return (
    <span>
      {label}
      {version && <span className="text-gray-400"> {version}</span>}
    </span>
  )
}
