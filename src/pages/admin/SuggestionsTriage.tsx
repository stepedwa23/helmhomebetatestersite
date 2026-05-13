import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Lightbulb,
  Trash2,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { SuggestionStatusBadge } from '../../components/StatusBadge'
import {
  listSuggestionsAdminWithTester,
  updateSuggestionStatus,
  updateSuggestionAdminNotes,
  deleteSuggestion,
} from '../../lib/suggestions'
import type { SuggestionWithTester } from '../../lib/suggestions'
import { SUGGESTION_STATUS_OPTIONS, type SuggestionStatus } from '../../types'

type AnyOf<T extends string> = T | 'all'

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'New',
  under_review: 'Under review',
  planned: 'Planned',
  declined: 'Declined',
  shipped: 'Shipped',
}

export default function AdminSuggestions() {
  const { project } = useAuth()
  const [items, setItems] = useState<SuggestionWithTester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AnyOf<SuggestionStatus>>('all')
  const [selected, setSelected] = useState<SuggestionWithTester | null>(null)
  const [deleting, setDeleting] = useState<SuggestionWithTester | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listSuggestionsAdminWithTester(project.id)
      setItems(rows)
      // Keep the open detail modal in sync with the latest data.
      setSelected((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (!items) return null
    return statusFilter === 'all' ? items : items.filter((s) => s.status === statusFilter)
  }, [items, statusFilter])

  if (!project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteSuggestion(deleting.id)
    setDeleting(null)
    if (selected?.id === deleting.id) setSelected(null)
    await refresh()
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suggestions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tester-submitted feature ideas. Sorted by most recent. Click a row to triage —
            update status, add private admin notes, or remove.
          </p>
        </div>
        {items && (
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {filtered ? `${filtered.length} of ${items.length}` : `${items.length}`}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AnyOf<SuggestionStatus>)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            {SUGGESTION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {items === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Lightbulb className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No suggestions yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            They'll appear here as your testers submit them.
          </p>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No suggestions match this filter.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Suggestion</th>
                <th className="text-left px-4 py-3">Tester</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered?.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="hover:bg-gray-50/60 cursor-pointer"
                >
                  <td className="px-4 py-3 max-w-md">
                    <div className="font-medium text-gray-900 truncate">{s.title}</div>
                    <div className="text-xs text-gray-500 truncate">{s.description}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {s.tester ? (
                      <>
                        <div className="font-medium text-gray-800">{s.tester.name}</div>
                        <div className="text-gray-500 truncate">{s.tester.email}</div>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SuggestionStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.title : 'Suggestion'}
        size="lg"
      >
        {selected && (
          <SuggestionDetail
            suggestion={selected}
            onChanged={refresh}
            onDeleteClick={() => setDeleting(selected)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete suggestion?"
        message={
          deleting
            ? `Permanently remove "${deleting.title}" from ${deleting.tester?.name ?? 'the tester'}? This cannot be undone.`
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

// ---------- Detail panel (inside the modal) ----------

interface SuggestionDetailProps {
  suggestion: SuggestionWithTester
  onChanged: () => Promise<void>
  onDeleteClick: () => void
}

function SuggestionDetail({ suggestion, onChanged, onDeleteClick }: SuggestionDetailProps) {
  const [notesDraft, setNotesDraft] = useState(suggestion.admin_notes ?? '')
  const [savedNotes, setSavedNotes] = useState(suggestion.admin_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset local draft state when a different suggestion is loaded.
  useEffect(() => {
    setNotesDraft(suggestion.admin_notes ?? '')
    setSavedNotes(suggestion.admin_notes ?? '')
    setNotesSaved(false)
  }, [suggestion.id, suggestion.admin_notes])

  async function saveNotes() {
    if (notesDraft === savedNotes) return
    setError(null)
    setSavingNotes(true)
    try {
      await updateSuggestionAdminNotes(suggestion.id, notesDraft)
      setSavedNotes(notesDraft)
      setNotesSaved(true)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleStatusChange(next: SuggestionStatus) {
    if (next === suggestion.status) return
    setError(null)
    setUpdatingStatus(true)
    try {
      await updateSuggestionStatus(suggestion.id, next)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span>
          From{' '}
          <span className="font-medium text-gray-700">{suggestion.tester?.name ?? '?'}</span>{' '}
          {suggestion.tester?.email && (
            <a
              href={`mailto:${suggestion.tester.email}`}
              className="text-blue-600 hover:underline"
            >
              ({suggestion.tester.email})
            </a>
          )}
        </span>
        <span className="text-gray-300">·</span>
        <span>
          {formatDistanceToNow(new Date(suggestion.submitted_at), { addSuffix: true })}
        </span>
      </div>

      {/* Description */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Description
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.description}</p>
      </div>

      {/* Status */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Status
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={suggestion.status}
            onChange={(e) => handleStatusChange(e.target.value as SuggestionStatus)}
            disabled={updatingStatus}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUGGESTION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {updatingStatus && <LoadingSpinner size="sm" />}
        </div>
        {suggestion.status === 'new' && (
          <p className="mt-1 text-xs text-gray-500">
            Tester can still edit while status is "new". Move to any other status to lock.
          </p>
        )}
      </div>

      {/* Admin notes */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Admin notes
          </div>
          {savingNotes ? (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <LoadingSpinner size="sm" /> Saving…
            </span>
          ) : notesSaved && notesDraft === savedNotes ? (
            <span className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          ) : notesDraft !== savedNotes ? (
            <span className="text-xs text-amber-700">Unsaved</span>
          ) : null}
        </div>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={saveNotes}
          rows={4}
          placeholder="Private to admins — testers never see this. Notes on relevance, roadmap fit, follow-up needed, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={saveNotes}
            disabled={savingNotes || notesDraft === savedNotes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 rounded-lg"
          >
            <Save className="w-3.5 h-3.5" />
            Save now
          </button>
          <span className="text-xs text-gray-400">Autosaves on blur.</span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Delete */}
      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onDeleteClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete suggestion
        </button>
        <span className="text-xs text-gray-400">
          Tester sees status changes but never these notes.
        </span>
      </div>
    </div>
  )
}
