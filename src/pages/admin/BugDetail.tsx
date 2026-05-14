import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ImageIcon,
  Save,
  CheckCircle2,
  MessageSquare,
  Send,
  Trash2,
  Pencil,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
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
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from '../../lib/bugComments'
import type { BugCommentWithAuthor } from '../../lib/bugComments'
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

              {/* Cross-tester discussion */}
              <Card title="Discussion (visible to testers)">
                <AdminCommentsPanel bugId={bug.id} />
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

// ---------- Admin comments panel ----------

function AdminCommentsPanel({ bugId }: { bugId: string }) {
  const { user, project } = useAuth()
  const [comments, setComments] = useState<BugCommentWithAuthor[] | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const refresh = useCallback(async () => {
    try {
      const rows = await listComments(bugId)
      setComments(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments')
      setComments([])
    }
  }, [bugId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handlePost() {
    setError(null)
    if (!draft.trim() || !user) return
    setPosting(true)
    try {
      // Admin posts → tester_id is null. RLS allows admin to insert with null tester_id.
      await createComment({ bug_id: bugId, tester_id: null, body: draft }, user.id)
      setDraft('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  async function handleSaveEdit(commentId: string) {
    if (!editDraft.trim()) return
    try {
      await updateComment(commentId, editDraft)
      setEditingId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment')
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteComment(commentId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  const adminUserId = project?.owner_id

  return (
    <div>
      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {comments === null ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500 italic mb-3">No comments yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {comments.map((c) => {
            const isMine = c.author_user_id === user?.id
            const isAdminAuthored = c.author_user_id === adminUserId
            const authorName = isAdminAuthored
              ? 'Admin (you)'
              : c.tester?.name ?? 'Unknown'
            const edited = c.updated_at !== c.created_at

            if (editingId === c.id) {
              return (
                <li key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    autoFocus
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(c.id)}
                      className="px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded"
                    >
                      Save
                    </button>
                  </div>
                </li>
              )
            }

            return (
              <li key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-gray-900">{authorName}</span>
                    {isAdminAuthored && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium uppercase tracking-wide">
                        Admin
                      </span>
                    )}
                    <span className="text-gray-500">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      {edited && <span className="ml-1 text-gray-400 italic">(edited)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditDraft(c.body)
                        }}
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        aria-label="Edit comment"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {/* Admin can delete anyone's comment via RLS. */}
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </li>
            )
          })}
        </ul>
      )}

      {/* Compose */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={posting}
          rows={3}
          placeholder="Reply as Admin. Testers will see your message in the bug's discussion."
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-white"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Visible to all testers in this project.
          </span>
          <button
            type="button"
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded"
          >
            {posting ? <LoadingSpinner size="sm" className="border-white" /> : <Send className="w-3.5 h-3.5" />}
            Post comment
          </button>
        </div>
      </div>
    </div>
  )
}
