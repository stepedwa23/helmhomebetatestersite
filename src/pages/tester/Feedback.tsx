import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, MessageSquareText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import { submitFeedback, listMyFeedback } from '../../lib/feedback'
import { listCyclesForTester } from '../../lib/cycles'
import type { Feedback as FeedbackRow, TestCycle } from '../../types'

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'OK',
  4: 'Good',
  5: 'Excellent',
}

export default function Feedback() {
  const { tester, project, rolesLoading, effectiveIsAdmin } = useAuth()

  const [cycles, setCycles] = useState<TestCycle[]>([])
  const [history, setHistory] = useState<FeedbackRow[] | null>(null)

  // Form
  const [rating, setRating] = useState<number | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const interactionsDisabled = !tester

  // Load cycles + history.
  const refresh = useCallback(async () => {
    if (!tester) {
      setHistory([])
      setCycles([])
      return
    }
    try {
      const [c, h] = await Promise.all([
        listCyclesForTester(tester.id),
        listMyFeedback(tester.id),
      ])
      setCycles(c)
      setHistory(h)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    }
  }, [tester])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (rolesLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // True admin (not previewing) — show the redirect notice.
  if (effectiveIsAdmin || !project) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            This page lets testers leave qualitative feedback on the beta. As the project
            owner, visit{' '}
            <a href="/admin/feedback" className="text-blue-600 hover:underline">
              Feedback in the admin sidebar
            </a>{' '}
            to read what your testers have submitted.
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (rating === null) return setError('Please pick a rating.')
    if (!tester) return setError('No tester profile — cannot submit.')

    setSubmitting(true)
    try {
      await submitFeedback({
        project_id: project!.id,
        tester_id: tester.id,
        cycle_id: cycleId || null,
        rating,
        comments: comments.trim() || null,
      })
      setSubmitted(true)
      setRating(null)
      setCycleId('')
      setComments('')
      await refresh()
      // Auto-clear the success message after a few seconds so the form is reusable.
      setTimeout(() => setSubmitted(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PreviewModeBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Feedback</h1>
        <p className="mt-1 text-sm text-gray-500">
          How is the beta going? Leave a rating and any notes — about a specific test cycle
          or just the experience overall.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 mb-8"
      >
        {/* Rating */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Overall rating
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = rating === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  disabled={interactionsDisabled || submitting}
                  className={[
                    'rounded-lg border px-2 py-3 text-center transition-colors',
                    selected
                      ? 'bg-blue-600 border-blue-700 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50',
                    interactionsDisabled || submitting
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                  ].join(' ')}
                  aria-pressed={selected}
                >
                  <div className="text-lg font-semibold">{n}</div>
                  <div
                    className={`text-[10px] uppercase tracking-wide ${selected ? 'text-blue-100' : 'text-gray-500'}`}
                  >
                    {RATING_LABELS[n]}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cycle */}
        <div>
          <label
            htmlFor="fb-cycle"
            className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
          >
            About a specific cycle?
          </label>
          <select
            id="fb-cycle"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            disabled={interactionsDisabled || submitting}
            className={inputClass}
          >
            <option value="">— General feedback on the beta —</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.build_version ? ` (build ${c.build_version})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Optional. Pick a cycle if your feedback is about a specific round of testing.
          </p>
        </div>

        {/* Comments */}
        <div>
          <label
            htmlFor="fb-comments"
            className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
          >
            Comments
          </label>
          <textarea
            id="fb-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={interactionsDisabled || submitting}
            rows={5}
            placeholder="What's working well, what's not, anything else you'd like the team to know."
            className={`${inputClass} resize-y`}
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional but very helpful — context-rich text is more useful to triage than a
            number alone.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {submitted && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Thanks for the feedback.</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting || interactionsDisabled}
            title={interactionsDisabled ? 'Disabled in preview mode.' : undefined}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
          >
            {submitting && <LoadingSpinner size="sm" className="border-white" />}
            {interactionsDisabled ? 'Submit (preview)' : 'Submit feedback'}
          </button>
        </div>
      </form>

      {/* History */}
      <section>
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          <MessageSquareText className="w-3.5 h-3.5" />
          Your previous feedback
        </h2>
        {history === null ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center">
            <LoadingSpinner size="sm" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
            Nothing here yet — submit the form above and it'll show up.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((f) => {
              const cycleName = cycles.find((c) => c.id === f.cycle_id)?.name
              return (
                <li
                  key={f.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <RatingPill rating={f.rating} />
                      <span className="text-xs text-gray-500">
                        {cycleName ?? 'General beta feedback'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(f.submitted_at), { addSuffix: true })}
                    </span>
                  </div>
                  {f.comments && (
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {f.comments}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---------- Helpers ----------

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function RatingPill({ rating }: { rating: number }) {
  const tone =
    rating >= 4 ? 'green' : rating >= 3 ? 'amber' : 'red'
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
