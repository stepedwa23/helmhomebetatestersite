import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Star,
  FileText,
  Download,
  Mail,
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import {
  listVersions,
  createVersion,
  updateVersion,
  deleteVersion,
  setVersionCurrent,
  notifyVersion,
} from '../../lib/appVersions'
import { listDownloads, getDownloadCountsByVersion } from '../../lib/appDownloads'
import type { AppDownload, AppVersion } from '../../types'
import { ACTIVE_PLATFORMS } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Badge from '../../components/StatusBadge'
import VersionForm, {
  type VersionFormValues,
} from '../../components/versions/VersionForm'
import ManageDownloadsModal from '../../components/versions/ManageDownloadsModal'

export default function AdminPatchNotes() {
  const { user, project } = useAuth()
  const [versions, setVersions] = useState<AppVersion[] | null>(null)
  const [downloadsByVersion, setDownloadsByVersion] = useState<Record<string, AppDownload[]>>({})
  const [testerDownloadCounts, setTesterDownloadCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AppVersion | null>(null)
  const [deleting, setDeleting] = useState<AppVersion | null>(null)
  const [managing, setManaging] = useState<AppVersion | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [notifyStatus, setNotifyStatus] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listVersions(project.id)
      setVersions(rows)
      // Fetch per-version uploaded files + per-version tester-download counts
      // in parallel. Counts come from version_downloads (one row per tester+platform).
      const [downloadEntries, counts] = await Promise.all([
        Promise.all(rows.map(async (v) => [v.id, await listDownloads(v.id)] as const)),
        getDownloadCountsByVersion(project.id),
      ])
      setDownloadsByVersion(Object.fromEntries(downloadEntries))
      setTesterDownloadCounts(counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions')
    }
  }, [project])

  const activePlatformCount = useMemo(() => ACTIVE_PLATFORMS.length, [])

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

  async function handleAdd(values: VersionFormValues) {
    const created = await createVersion(
      {
        project_id: project!.id,
        version: values.version,
        release_date: values.release_date || null,
        patch_notes: values.patch_notes,
        is_current: values.is_current,
      },
      user!.id,
    )
    setShowAdd(false)
    await refresh()
    if (values.notify_testers) {
      await sendNotification(created.id, values.patch_notes)
    }
  }

  async function handleEdit(values: VersionFormValues) {
    if (!editing) return
    await updateVersion(editing.id, {
      version: values.version.trim(),
      release_date: values.release_date || null,
      patch_notes: values.patch_notes,
      is_current: values.is_current,
    })
    setEditing(null)
    await refresh()
    if (values.notify_testers) {
      await sendNotification(editing.id, values.patch_notes)
    }
  }

  async function sendNotification(versionId: string, patchNotes: AppVersion['patch_notes']) {
    setNotifyStatus(null)
    try {
      const result = await notifyVersion(versionId, patchNotes)
      const failed = result.failed.length
      setNotifyStatus(
        failed > 0
          ? `Notified ${result.sent} of ${result.total} testers. ${failed} failed — see browser console for details.`
          : result.total === 0
            ? 'No active testers to notify.'
            : `Notification sent to ${result.sent} tester${result.sent === 1 ? '' : 's'}.`,
      )
      if (failed > 0) {
        console.warn('[PatchNotes] Some notifications failed', result.failed)
      }
    } catch (err) {
      setNotifyStatus(
        err instanceof Error
          ? `Could not send notification: ${err.message}`
          : 'Could not send notification.',
      )
    }
  }

  async function handleNotifyFromRow(v: AppVersion) {
    await sendNotification(v.id, v.patch_notes)
  }

  async function handleMarkCurrent(v: AppVersion) {
    if (v.is_current) return
    await setVersionCurrent(v.id)
    await refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteVersion(deleting.id)
    setDeleting(null)
    await refresh()
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Patch notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            One version is marked <strong>current</strong> at a time — that's what testers
            see on their dashboard. Older versions stay listed for historical reference.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          New version
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {notifyStatus && (
        <div className="mb-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span>{notifyStatus}</span>
          <button
            type="button"
            onClick={() => setNotifyStatus(null)}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {versions === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : versions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No versions yet.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add your first version
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Version</th>
                <th className="text-left px-4 py-3">Release date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Downloads</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.version}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {v.release_date ? format(new Date(v.release_date), 'MMM d, yyyy') : <Dash />}
                  </td>
                  <td className="px-4 py-3">
                    {v.is_current ? (
                      <Badge tone="green" className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Current
                      </Badge>
                    ) : (
                      <Badge tone="gray">Archived</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setManaging(v)}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {(downloadsByVersion[v.id]?.length ?? 0)}/{activePlatformCount}
                    </button>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {testerDownloadCounts[v.id] ?? 0} tester
                      {(testerDownloadCounts[v.id] ?? 0) === 1 ? '' : 's'} downloaded
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(v.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === v.id ? null : v.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Version actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === v.id && (
                      <RowMenu
                        version={v}
                        onEdit={() => {
                          setOpenMenu(null)
                          setEditing(v)
                        }}
                        onManageDownloads={() => {
                          setOpenMenu(null)
                          setManaging(v)
                        }}
                        onNotify={() => {
                          setOpenMenu(null)
                          handleNotifyFromRow(v)
                        }}
                        onMarkCurrent={() => {
                          setOpenMenu(null)
                          handleMarkCurrent(v)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(v)
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
        title="New version"
        size="lg"
      >
        <VersionForm
          submitLabel="Create version"
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.version}` : 'Edit version'}
        size="lg"
      >
        {editing && (
          <VersionForm
            submitLabel="Save changes"
            initial={{
              version: editing.version,
              release_date: editing.release_date ?? '',
              patch_notes: editing.patch_notes,
              is_current: editing.is_current,
            }}
            currentlyMarkedCurrent={editing.is_current}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Manage downloads modal */}
      <ManageDownloadsModal
        open={!!managing}
        version={managing}
        userId={user.id}
        onClose={() => setManaging(null)}
        onChange={refresh}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete version?"
        message={
          deleting
            ? `This permanently removes version ${deleting.version} and its patch notes. This cannot be undone.${
                deleting.is_current
                  ? ' This is currently marked as the current beta — testers will see no current version banner until you mark another.'
                  : ''
              }`
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
  version,
  onEdit,
  onManageDownloads,
  onNotify,
  onMarkCurrent,
  onDelete,
}: {
  version: AppVersion
  onEdit: () => void
  onManageDownloads: () => void
  onNotify: () => void
  onMarkCurrent: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />
      <MenuItem icon={Download} label="Manage downloads" onClick={onManageDownloads} />
      <MenuItem icon={Mail} label="Notify testers" onClick={onNotify} />
      {!version.is_current && (
        <MenuItem icon={Star} label="Mark as current" onClick={onMarkCurrent} />
      )}
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

function Dash() {
  return <span className="text-gray-300">—</span>
}
