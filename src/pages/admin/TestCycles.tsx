import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Users,
  Play,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import {
  listCycles,
  createCycle,
  updateCycle,
  deleteCycle,
  listAllCycleAssignments,
} from '../../lib/cycles'
import type { TestCycle, CycleTester } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { CycleStatusBadge } from '../../components/StatusBadge'
import CycleForm, { type CycleFormValues } from '../../components/cycles/CycleForm'
import AssignTestersModal from '../../components/cycles/AssignTestersModal'

export default function AdminTestCycles() {
  const { user, project } = useAuth()
  const [cycles, setCycles] = useState<TestCycle[] | null>(null)
  const [assignments, setAssignments] = useState<CycleTester[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<TestCycle | null>(null)
  const [assigning, setAssigning] = useState<TestCycle | null>(null)
  const [deleting, setDeleting] = useState<TestCycle | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const [rows, assigns] = await Promise.all([
        listCycles(project.id),
        listAllCycleAssignments(project.id),
      ])
      setCycles(rows)
      setAssignments(assigns)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cycles')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Close row-menu on outside click.
  useEffect(() => {
    if (!openMenu) return
    function onClick() {
      setOpenMenu(null)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [openMenu])

  // Map cycle_id → assigned count for quick lookup in the table.
  const assignmentCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of assignments) m.set(a.cycle_id, (m.get(a.cycle_id) ?? 0) + 1)
    return m
  }, [assignments])

  if (!project || !user) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function handleAdd(values: CycleFormValues) {
    await createCycle(
      {
        project_id: project!.id,
        name: values.name,
        build_version: values.build_version || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        status: values.status,
        notes: values.notes || null,
      },
      user!.id,
    )
    setShowAdd(false)
    await refresh()
  }

  async function handleEdit(values: CycleFormValues) {
    if (!editing) return
    await updateCycle(editing.id, {
      name: values.name,
      build_version: values.build_version || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      status: values.status,
      notes: values.notes || null,
    })
    setEditing(null)
    await refresh()
  }

  async function handleQuickStatus(cycle: TestCycle, next: TestCycle['status']) {
    await updateCycle(cycle.id, { status: next })
    await refresh()
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteCycle(deleting.id)
    setDeleting(null)
    await refresh()
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Test cycles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define rounds of testing tied to a build. Assign testers from here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add cycle
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {cycles === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-600">No test cycles yet.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add your first cycle
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Cycle</th>
                <th className="text-left px-4 py-3">Build</th>
                <th className="text-left px-4 py-3">Dates</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Testers</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cycles.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.notes && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{c.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.build_version || <Dash />}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <DateRange start={c.start_date} end={c.end_date} />
                  </td>
                  <td className="px-4 py-3">
                    <CycleStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <button
                      type="button"
                      onClick={() => setAssigning(c)}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {assignmentCounts.get(c.id) ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenu(openMenu === c.id ? null : c.id)
                      }}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      aria-label="Cycle actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === c.id && (
                      <RowMenu
                        cycle={c}
                        onEdit={() => {
                          setOpenMenu(null)
                          setEditing(c)
                        }}
                        onAssign={() => {
                          setOpenMenu(null)
                          setAssigning(c)
                        }}
                        onQuickStatus={(next) => {
                          setOpenMenu(null)
                          handleQuickStatus(c, next)
                        }}
                        onDelete={() => {
                          setOpenMenu(null)
                          setDeleting(c)
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
        title="Add test cycle"
        size="lg"
      >
        <CycleForm
          submitLabel="Create cycle"
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit cycle" size="lg">
        {editing && (
          <CycleForm
            submitLabel="Save changes"
            initial={{
              name: editing.name,
              build_version: editing.build_version ?? '',
              start_date: editing.start_date ?? '',
              end_date: editing.end_date ?? '',
              status: editing.status,
              notes: editing.notes ?? '',
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Assign testers modal */}
      <AssignTestersModal
        open={!!assigning}
        cycle={assigning}
        onClose={() => setAssigning(null)}
        onSaved={refresh}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete cycle?"
        message={
          deleting
            ? `This permanently removes "${deleting.name}" and its tester assignments. Bug reports filed against this cycle will keep their data but lose the cycle reference. This cannot be undone.`
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
  cycle: TestCycle
  onEdit: () => void
  onAssign: () => void
  onQuickStatus: (next: TestCycle['status']) => void
  onDelete: () => void
}

function RowMenu({ cycle, onEdit, onAssign, onQuickStatus, onDelete }: RowMenuProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-2 top-full mt-1 z-10 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm text-left"
    >
      <MenuItem icon={Pencil} label="Edit cycle" onClick={onEdit} />
      <MenuItem icon={Users} label="Manage testers" onClick={onAssign} />
      <div className="my-1 border-t border-gray-100" />
      {cycle.status !== 'active' && (
        <MenuItem icon={Play} label="Mark active" onClick={() => onQuickStatus('active')} />
      )}
      {cycle.status !== 'completed' && (
        <MenuItem
          icon={CheckCircle2}
          label="Mark completed"
          onClick={() => onQuickStatus('completed')}
        />
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

// ---------- Tiny helpers ----------

function Dash() {
  return <span className="text-gray-300">—</span>
}

function DateRange({ start, end }: { start: string | null; end: string | null }) {
  if (!start && !end) return <Dash />
  const startStr = start ? format(new Date(start), 'MMM d, yyyy') : '?'
  const endStr = end ? format(new Date(end), 'MMM d, yyyy') : '?'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <Calendar className="w-3.5 h-3.5 text-gray-400" />
      <span>
        {startStr} <span className="text-gray-400">→</span> {endStr}
      </span>
    </span>
  )
}
