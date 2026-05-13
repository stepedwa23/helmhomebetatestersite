import { useEffect, useState } from 'react'
import Modal from '../Modal'
import LoadingSpinner from '../LoadingSpinner'
import { listTesters } from '../../lib/testers'
import {
  listCycleTesters,
  assignTesterToCycle,
  removeTesterFromCycle,
} from '../../lib/cycles'
import type { Tester, TestCycle } from '../../types'
import { TesterStatusBadge } from '../StatusBadge'

interface AssignTestersModalProps {
  open: boolean
  cycle: TestCycle | null
  onClose: () => void
  onSaved: () => void
}

export default function AssignTestersModal({
  open,
  cycle,
  onClose,
  onSaved,
}: AssignTestersModalProps) {
  const [testers, setTesters] = useState<Tester[] | null>(null)
  const [initialSet, setInitialSet] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Load testers + existing assignments whenever a new cycle is opened.
  useEffect(() => {
    if (!open || !cycle) return
    let cancelled = false
    setError(null)
    setTesters(null)
    ;(async () => {
      try {
        const [allTesters, currentAssignments] = await Promise.all([
          listTesters(cycle.project_id),
          listCycleTesters(cycle.id),
        ])
        if (cancelled) return
        const assignedIds = new Set(currentAssignments.map((a) => a.tester_id))
        setTesters(allTesters)
        setInitialSet(assignedIds)
        setSelected(new Set(assignedIds))
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load testers')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, cycle])

  function toggle(testerId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(testerId)) next.delete(testerId)
      else next.add(testerId)
      return next
    })
  }

  async function handleSave() {
    if (!cycle) return
    setError(null)
    setSaving(true)
    try {
      // Diff: anything in selected but not initial → add. Anything in initial but not selected → remove.
      const toAdd: string[] = []
      const toRemove: string[] = []
      selected.forEach((id) => {
        if (!initialSet.has(id)) toAdd.push(id)
      })
      initialSet.forEach((id) => {
        if (!selected.has(id)) toRemove.push(id)
      })

      // Fire in parallel — these are independent rows.
      await Promise.all([
        ...toAdd.map((id) => assignTesterToCycle(cycle.id, id)),
        ...toRemove.map((id) => removeTesterFromCycle(cycle.id, id)),
      ])

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments')
    } finally {
      setSaving(false)
    }
  }

  const activeTesters = testers?.filter((t) => t.status === 'active') ?? []
  const otherTesters = testers?.filter((t) => t.status !== 'active') ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cycle ? `Assign testers to "${cycle.name}"` : 'Assign testers'}
      description="Pick the testers who should participate in this cycle. Inactive testers are shown but greyed out by default."
      size="lg"
    >
      {testers === null ? (
        <div className="py-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : testers.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">
          No testers in this project yet. Add testers first, then come back to assign them.
        </p>
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto -mx-1 px-1 divide-y divide-gray-100">
            {activeTesters.map((t) => (
              <TesterRow
                key={t.id}
                tester={t}
                checked={selected.has(t.id)}
                onToggle={() => toggle(t.id)}
              />
            ))}
            {otherTesters.length > 0 && (
              <div className="pt-3 mt-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">
                  Inactive / Invited
                </div>
                {otherTesters.map((t) => (
                  <TesterRow
                    key={t.id}
                    tester={t}
                    checked={selected.has(t.id)}
                    onToggle={() => toggle(t.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              {selected.size} of {testers.length} selected
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
              >
                {saving && <LoadingSpinner size="sm" className="border-white" />}
                Save assignments
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

// ---------- Row ----------

interface TesterRowProps {
  tester: Tester
  checked: boolean
  onToggle: () => void
}

function TesterRow({ tester, checked, onToggle }: TesterRowProps) {
  return (
    <label className="flex items-center gap-3 py-2 px-1 cursor-pointer hover:bg-gray-50 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{tester.name}</div>
        <div className="text-xs text-gray-500 truncate">{tester.email}</div>
      </div>
      <TesterStatusBadge status={tester.status} />
    </label>
  )
}
