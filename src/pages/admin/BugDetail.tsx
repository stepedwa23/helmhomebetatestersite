import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ImageIcon, Save, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  BugStatusBadge,
  BugSeverityBadge,
} from '../../components/StatusBadge'
import {
  getBugWithTester,
  updateBugStatus,
  updateBugTriageNotes,
} from '../../lib/bugs'
import type { BugReportWithTester } from '../../lib/bugs'
import { listBugAttachments, getAttachmentUrl } from '../../lib/attachments'
import type { BugAttachment, BugStatus } from '../../types'
import { BUG_CATEGORY_LABEL, BUG_STATUS_OPTIONS } from '../../types'

const STATUS_LABEL: Record<BugStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function AdminBugDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bug, setBug] = useState<BugReportWithTester | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<BugAttachment[] | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})

  // Triage-notes draft state — debounce-on-blur autosave.
  const [notesDraft, setNotesDraft] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null)

  // Status update state.
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const row = await getBugWithTester(id)
      setBug(row)
      const initialNotes = row?.triage_notes ?? ''
      setNotesDraft(initialNotes)
      setSavedNotes(initialNotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bug')
    }
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Load attachments + signed URLs after bug loads.
  useEffect(() => {
    if (!bug) return
    let cancelled = false
    listBugAttachments(bug.id)
      .then(async (rows) => {
        if (cancelled) return
        setAttachments(rows)
        const entries = await Promise.all(
          rows.map(async (a) => {
            try {
              const url = await getAttachmentUrl(a.storage_path, 600)
              return [a.id, url] as const
            } catch {
              return [a.id, ''] as const
            }
          }),
        )
        if (cancelled) return
        setAttachmentUrls(Object.fromEntries(entries))
      })
      .catch((err) => {
        console.warn('[BugDetail] Failed to load attachments', err)
        if (!cancelled) setAttachments([])
      })
    return () => {
      cancelled = true
    }
  }, [bug])

  async function saveNotes() {
    if (!bug) return
    if (notesDraft === savedNotes) return
    setSavingNotes(true)
    try {
      await updateBugTriageNotes(bug.id, notesDraft)
      setSavedNotes(notesDraft)
      setNotesSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleStatusChange(next: BugStatus) {
    if (!bug) return
    if (next === bug.status) return
    setUpdatingStatus(true)
    try {
      await updateBugStatus(bug.id, next)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/bugs')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to triage
        </button>
        {bug && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500">Bug #{bug.id.slice(0, 8)}</span>
          </div>
        )}
      </div>

      <main className="pt-14 flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {!bug && !error && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}

          {bug && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-start gap-3 flex-wrap">
                  <h1 className="text-xl font-semibold text-gray-900 flex-1 min-w-0">
                    {bug.title}
                  </h1>
                  <BugSeverityBadge severity={bug.severity} />
                  <BugStatusBadge status={bug.status} />
                </div>
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  <span>{BUG_CATEGORY_LABEL[bug.category]}</span>
                  <span className="text-gray-300">·</span>
                  <span>
                    Submitted {format(new Date(bug.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  {bug.tester && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>
                        by <span className="font-medium text-gray-700">{bug.tester.name}</span>{' '}
                        <a
                          href={`mailto:${bug.tester.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          ({bug.tester.email})
                        </a>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <Card title="Description">
                <p className="whitespace-pre-wrap text-sm text-gray-700">{bug.description}</p>
              </Card>

              {bug.steps_to_reproduce && (
                <Card title="Steps to reproduce">
                  <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono leading-relaxed">
                    {bug.steps_to_reproduce}
                  </pre>
                </Card>
              )}

              {/* Environment */}
              <Card title="Environment">
                <dl className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <Row label="OS">
                    {bug.os
                      ? bug.os === 'macos'
                        ? 'macOS'
                        : 'Windows'
                      : '—'}
                    {bug.os_version ? ` ${bug.os_version}` : ''}
                  </Row>
                  <Row label="Helm version">{bug.helm_version || '—'}</Row>
                  <Row label="Focus mode">{bug.calm_mode_state.focus_mode ? 'On' : 'Off'}</Row>
                  <Row label="Reduce motion">
                    {bug.calm_mode_state.reduce_motion ? 'On' : 'Off'}
                  </Row>
                  <Row label="Auto-skip stale">
                    {bug.calm_mode_state.auto_skip ? 'On' : 'Off'}
                  </Row>
                  <Row label="Theme">{bug.calm_mode_state.theme || 'default'}</Row>
                </dl>
              </Card>

              {/* Attachments */}
              <Card title="Screenshots">
                {attachments === null ? (
                  <LoadingSpinner size="sm" />
                ) : attachments.length === 0 ? (
                  <p className="text-xs text-gray-500">None attached.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {attachments.map((a) => {
                      const url = attachmentUrls[a.id]
                      return (
                        <a
                          key={a.id}
                          href={url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="block aspect-square bg-gray-100 border border-gray-200 rounded-lg overflow-hidden hover:opacity-80"
                          title={a.filename}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt={a.filename}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </a>
                      )
                    })}
                  </div>
                )}
              </Card>

              {/* Status control (admin-only) */}
              <Card title="Status">
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={bug.status}
                    onChange={(e) => handleStatusChange(e.target.value as BugStatus)}
                    disabled={updatingStatus}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BUG_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {updatingStatus && <LoadingSpinner size="sm" />}
                  {bug.resolved_at && (
                    <span className="text-xs text-gray-500">
                      Resolved {format(new Date(bug.resolved_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </Card>

              {/* Triage notes (admin-only) */}
              <Card
                title="Triage notes"
                titleSuffix={
                  savingNotes ? (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <LoadingSpinner size="sm" /> Saving…
                    </span>
                  ) : notesSavedAt && notesDraft === savedNotes ? (
                    <span className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                  ) : notesDraft !== savedNotes ? (
                    <span className="text-xs text-amber-700">Unsaved changes</span>
                  ) : null
                }
              >
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Private to admins — testers can't see this. Notes on triage, repro attempts, suspected root cause, follow-up items, etc."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={savingNotes || notesDraft === savedNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 rounded-lg"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save now
                  </button>
                  <span className="text-xs text-gray-400">Autosaves when you click out.</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ---------- Helpers ----------

function Card({
  title,
  titleSuffix,
  children,
}: {
  title: string
  titleSuffix?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <header className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h2>
        {titleSuffix}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-gray-500 text-xs whitespace-nowrap">{label}:</dt>
      <dd className="text-gray-700">{children}</dd>
    </div>
  )
}
