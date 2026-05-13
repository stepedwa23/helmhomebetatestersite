import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareText, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { listFeedbackWithTester, deleteFeedback } from '../../lib/feedback'
import type { FeedbackWithTester } from '../../lib/feedback'

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'OK',
  4: 'Good',
  5: 'Excellent',
}

export default function AdminFeedback() {
  const { project } = useAuth()
  const [items, setItems] = useState<FeedbackWithTester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ratingFilter, setRatingFilter] = useState<'all' | number>('all')
  const [cycleFilter, setCycleFilter] = useState<'all' | string>('all')
  const [selected, setSelected] = useState<FeedbackWithTester | null>(null)
  const [deleting, setDeleting] = useState<FeedbackWithTester | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listFeedbackWithTester(project.id)
      setItems(rows)
      // Keep selected modal in sync if its row still exists.
      setSelected((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  // List of cycles seen in feedback, for the cycle filter.
  const cycleOptions = useMemo(() => {
    if (!items) return []
    const map = new Map<string, string>()
    for (const f of items) {
      if (f.cycle) map.set(f.cycle.id, f.cycle.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return null
    return items.filter((f) => {
      if (ratingFilter !== 'all' && f.rating !== ratingFilter) return false
      if (cycleFilter !== 'all') {
        if (cycleFilter === 'none' && f.cycle_id !== null) return false
        if (cycleFilter !== 'none' && f.cycle?.id !== cycleFilter) return false
      }
      return true
    })
  }, [items, ratingFilter, cycleFilter])

  if (!project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteFeedback(deleting.id)
    if (selected?.id === deleting.id) setSelected(null)
    setDeleting(null)
    await refresh()
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Feedback</h1>
          <p className="mt-1 text-sm text-gray-500">
            Qualitative feedback from testers — rating + free-text comments. Sorted newest
            first. Click a row to read the full comment.
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Rating
            </label>
            <select
              value={ratingFilter}
              onChange={(e) =>
                setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} — {RATING_LABELS[n]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Cycle
            </label>
            <select
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="none">General (no cycle)</option>
              {cycleOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {(ratingFilter !== 'all' || cycleFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setRatingFilter('all')
                setCycleFilter('all')
              }}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {items === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <MessageSquareText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No feedback yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Testers' submissions will appear here as they come in.
          </p>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No feedback matches these filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Rating</th>
                <th className="text-left px-4 py-3">Tester</th>
                <th className="text-left px-4 py-3">Cycle</th>
                <th className="text-left px-4 py-3">Comments</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered?.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className="hover:bg-gray-50/60 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <RatingPill rating={f.rating} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {f.tester ? (
                      <>
                        <div className="font-medium text-gray-800">{f.tester.name}</div>
                        <div className="text-gray-500 truncate">{f.tester.email}</div>
                      </>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {f.cycle ? (
                      <>
                        <div className="font-medium text-gray-800 truncate max-w-[12rem]">
                          {f.cycle.name}
                        </div>
                        {f.cycle.build_version && (
                          <div className="text-gray-500">{f.cycle.build_version}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500 italic">General</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs max-w-md">
                    {f.comments ? (
                      <p className="truncate">{f.comments}</p>
                    ) : (
                      <span className="text-gray-300 italic">(no comments)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(f.submitted_at), { addSuffix: true })}
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
        title={selected ? `Feedback from ${selected.tester?.name ?? 'a tester'}` : 'Feedback'}
        size="lg"
      >
        {selected && (
          <FeedbackDetail
            feedback={selected}
            onDeleteClick={() => setDeleting(selected)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete feedback?"
        message={
          deleting
            ? `Permanently remove this ${deleting.rating}/5 feedback from ${deleting.tester?.name ?? 'this tester'}? This cannot be undone.`
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

// ---------- Detail ----------

function FeedbackDetail({
  feedback,
  onDeleteClick,
}: {
  feedback: FeedbackWithTester
  onDeleteClick: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <RatingPill rating={feedback.rating} />
        <span className="text-xs text-gray-500">
          Submitted {format(new Date(feedback.submitted_at), "MMM d, yyyy 'at' h:mm a")}
        </span>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          From
        </div>
        <div className="text-sm text-gray-700">
          {feedback.tester?.name ?? 'Unknown tester'}{' '}
          {feedback.tester?.email && (
            <a
              href={`mailto:${feedback.tester.email}`}
              className="text-blue-600 hover:underline"
            >
              ({feedback.tester.email})
            </a>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Cycle
        </div>
        <div className="text-sm text-gray-700">
          {feedback.cycle ? (
            <>
              {feedback.cycle.name}
              {feedback.cycle.build_version && (
                <span className="text-gray-500"> · build {feedback.cycle.build_version}</span>
              )}
            </>
          ) : (
            <span className="italic text-gray-500">General beta feedback (no cycle)</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Comments
        </div>
        {feedback.comments ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback.comments}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No comments provided.</p>
        )}
      </div>

      <div className="pt-3 border-t border-gray-100 flex justify-end">
        <button
          type="button"
          onClick={onDeleteClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete feedback
        </button>
      </div>
    </div>
  )
}

// ---------- helpers ----------

function RatingPill({ rating }: { rating: number }) {
  const tone = rating >= 4 ? 'green' : rating >= 3 ? 'amber' : 'red'
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700 ring-green-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ring-1 ring-inset ${colors[tone]}`}
    >
      {rating}/5
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-75">
        {RATING_LABELS[rating]}
      </span>
    </span>
  )
}

function Dash() {
  return <span className="text-gray-300">—</span>
}
