import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Bug,
  ImageIcon,
  MessageSquare,
  Check,
  X as XIcon,
  Send,
  Pencil,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import {
  BugStatusBadge,
  BugSeverityBadge,
} from '../../components/StatusBadge'
import { listAllBugsForTesters } from '../../lib/bugs'
import type { BugReportPublicWithTester } from '../../lib/bugs'
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

type ViewFilter = 'all' | 'mine'
type StatusFilter = BugStatus | 'all'

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All statuses',
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function TesterBugs() {
  const { tester, project, rolesLoading, effectiveIsAdmin } = useAuth()
  const [bugs, setBugs] = useState<BugReportPublicWithTester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listAllBugsForTesters(project.id)
      setBugs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bugs')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (!bugs) return null
    return bugs.filter((b) => {
      if (viewFilter === 'mine' && (!tester || b.tester_id !== tester.id)) return false
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      return true
    })
  }, [bugs, viewFilter, statusFilter, tester])

  if (rolesLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (effectiveIsAdmin || !project) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            This page lists bug reports for testers. As the project owner, use{' '}
            <Link to="/admin/bugs" className="text-blue-600 hover:underline">
              Bug Triage
            </Link>{' '}
            for the admin view.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PreviewModeBanner />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bug Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            All bugs from across the tester pool. Click a bug to read details and join the
            discussion — confirm if you can reproduce it, or note that you can't.
          </p>
        </div>
        <Link
          to="/report-bug"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg whitespace-nowrap"
        >
          <Bug className="w-4 h-4" />
          Report a bug
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {bugs && bugs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewFilter('all')}
              className={[
                'px-3 py-1.5 text-xs font-medium',
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              All bugs
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('mine')}
              className={[
                'px-3 py-1.5 text-xs font-medium border-l border-gray-300',
                viewFilter === 'mine'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              Mine only
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="status-filter"
              className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{STATUS_FILTER_LABEL.all}</option>
              {BUG_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_FILTER_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {bugs === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : bugs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Bug className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No bugs reported yet.</p>
          <Link
            to="/report-bug"
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Bug className="w-4 h-4" />
            Be the first to report one
          </Link>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No bugs match these filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((bug) => (
            <BugCard
              key={bug.id}
              bug={bug}
              expanded={expanded === bug.id}
              onToggle={() => setExpanded(expanded === bug.id ? null : bug.id)}
              isOwn={!!tester && bug.tester_id === tester.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================================
// Bug card with comments
// =====================================================================

interface BugCardProps {
  bug: BugReportPublicWithTester
  expanded: boolean
  onToggle: () => void
  isOwn: boolean
}

function BugCard({ bug, expanded, onToggle, isOwn }: BugCardProps) {
  return (
    <article
      className={`bg-white border rounded-xl overflow-hidden ${
        isOwn ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-gray-50/60 flex items-start gap-3"
      >
        <div className="mt-0.5 text-gray-400">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{bug.title}</span>
            <BugSeverityBadge severity={bug.severity} />
            <BugStatusBadge status={bug.status} />
            {isOwn && (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-full">
                Yours
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span>{BUG_CATEGORY_LABEL[bug.category]}</span>
            <span className="text-gray-300">·</span>
            <span>
              by{' '}
              <span className="font-medium text-gray-700">
                {bug.tester?.name ?? 'Unknown'}
              </span>
            </span>
            <span className="text-gray-300">·</span>
            <span>{formatDistanceToNow(new Date(bug.submitted_at), { addSuffix: true })}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">
          <BugDetailsSection bug={bug} />
          <BugCommentsSection bugId={bug.id} />
        </div>
      )}
    </article>
  )
}

// ---------- Bug details (read-only) ----------

function BugDetailsSection({ bug }: { bug: BugReportPublicWithTester }) {
  return (
    <>
      <Section title="Description">
        <p className="whitespace-pre-wrap text-sm text-gray-700">{bug.description}</p>
      </Section>

      {bug.steps_to_reproduce && (
        <Section title="Steps to reproduce">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 font-mono leading-relaxed">
            {bug.steps_to_reproduce}
          </pre>
        </Section>
      )}

      <Section title="Reporter's setup">
        <ul className="text-xs text-gray-700 space-y-1">
          <li>
            <span className="text-gray-500">OS:</span>{' '}
            {bug.os ? (bug.os === 'macos' ? 'macOS' : 'Windows') : '—'}
            {bug.os_version ? ` ${bug.os_version}` : ''}
          </li>
          <li>
            <span className="text-gray-500">Helm version:</span>{' '}
            {bug.helm_version || '—'}
          </li>
          <li>
            <span className="text-gray-500">Calm-mode:</span>{' '}
            {[
              bug.calm_mode_state.focus_mode && 'focus',
              bug.calm_mode_state.reduce_motion && 'reduce-motion',
              bug.calm_mode_state.auto_skip && 'auto-skip',
            ]
              .filter(Boolean)
              .join(', ') || 'none on'}
            {bug.calm_mode_state.theme && bug.calm_mode_state.theme !== 'default' && (
              <span className="text-gray-500"> · theme: {bug.calm_mode_state.theme}</span>
            )}
          </li>
        </ul>
      </Section>

      <BugAttachmentsSection bugId={bug.id} />
    </>
  )
}

function BugAttachmentsSection({ bugId }: { bugId: string }) {
  const [attachments, setAttachments] = useState<BugAttachment[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    listBugAttachments(bugId)
      .then(async (rows) => {
        if (cancelled) return
        setAttachments(rows)
        const entries = await Promise.all(
          rows.map(async (a) => {
            try {
              const url = await getAttachmentUrl(a.storage_path)
              return [a.id, url] as const
            } catch {
              return [a.id, ''] as const
            }
          }),
        )
        if (!cancelled) setUrls(Object.fromEntries(entries))
      })
      .catch((err) => {
        console.warn('[TesterBugs] Failed to load attachments', err)
        if (!cancelled) setAttachments([])
      })
    return () => {
      cancelled = true
    }
  }, [bugId])

  return (
    <Section title="Screenshots">
      {attachments === null ? (
        <LoadingSpinner size="sm" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-500">No screenshots attached.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {attachments.map((a) => {
            const url = urls[a.id]
            return (
              <a
                key={a.id}
                href={url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square bg-gray-100 border border-gray-200 rounded-lg overflow-hidden hover:opacity-80"
              >
                {url ? (
                  <img src={url} alt={a.filename} className="w-full h-full object-cover" />
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
    </Section>
  )
}

// ---------- Comments section ----------

function BugCommentsSection({ bugId }: { bugId: string }) {
  const { tester, isAdmin, user, project } = useAuth()
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
      // Clear the loading state so the error banner becomes visible rather
      // than leaving the spinner running forever.
      setComments([])
    }
  }, [bugId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canPost = !!user && (!!tester || isAdmin)
  const previewOnly = isAdmin && !tester // admin in preview-as-tester has no tester row

  // ---------- Templated quick actions ----------

  function envBlurb() {
    if (!tester) return ''
    const os = tester.os === 'macos' ? 'macOS' : tester.os === 'windows' ? 'Windows' : ''
    const osv = tester.os_version ? ` ${tester.os_version}` : ''
    const hv = tester.helm_version ? `, Helm ${tester.helm_version}` : ''
    return os ? `${os}${osv}${hv}` : (tester.helm_version ? `Helm ${tester.helm_version}` : '')
  }

  function applyReproTemplate() {
    const env = envBlurb()
    setDraft(`✓ I can reproduce this${env ? ` on ${env}` : ''}.` + (env ? '\n\n' : ' '))
  }

  function applyNoReproTemplate() {
    const env = envBlurb()
    setDraft(
      `✗ I can't reproduce this${env ? ` on ${env}` : ''} — followed the steps and didn't see it.` +
        (env ? '\n\n' : ' '),
    )
  }

  async function handlePost() {
    setError(null)
    if (!draft.trim()) return setError('Comment is empty.')
    if (!user) return setError('Not signed in.')

    setPosting(true)
    try {
      await createComment(
        {
          bug_id: bugId,
          tester_id: tester?.id ?? null,
          body: draft,
        },
        user.id,
      )
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
    <Section title="Discussion" icon={MessageSquare}>
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
        <p className="text-xs text-gray-500 italic mb-3">
          No comments yet. Be the first to weigh in.
        </p>
      ) : (
        <ul className="space-y-3 mb-3">
          {comments.map((c) => {
            const isMine = !!user && c.author_user_id === user.id
            const isAdminAuthored = c.author_user_id === adminUserId
            const authorName = isAdminAuthored
              ? 'Admin'
              : c.tester?.name ?? 'Unknown'
            const edited = c.updated_at !== c.created_at

            if (editingId === c.id) {
              return (
                <li key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
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
              <li key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
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
                  {isMine && (
                    <div className="flex items-center gap-1">
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
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
              </li>
            )
          })}
        </ul>
      )}

      {/* Compose */}
      {canPost && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              type="button"
              onClick={applyReproTemplate}
              disabled={posting || previewOnly}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 rounded border border-green-200"
            >
              <Check className="w-3 h-3" />
              I can reproduce
            </button>
            <button
              type="button"
              onClick={applyNoReproTemplate}
              disabled={posting || previewOnly}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 rounded border border-gray-300"
            >
              <XIcon className="w-3 h-3" />
              I can't reproduce
            </button>
            <span className="text-[11px] text-gray-400 self-center">
              Buttons pre-fill the box; you can edit before posting.
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={posting || previewOnly}
            rows={3}
            placeholder={
              previewOnly
                ? 'Disabled in preview mode.'
                : 'Add a comment — note your OS, Helm version, whether you can reproduce, anything that helps.'
            }
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handlePost}
              disabled={posting || previewOnly || !draft.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded"
            >
              {posting ? <LoadingSpinner size="sm" className="border-white" /> : <Send className="w-3.5 h-3.5" />}
              Post comment
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

// ---------- Section helper ----------

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </div>
      {children}
    </div>
  )
}
