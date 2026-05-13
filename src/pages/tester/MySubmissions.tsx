import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Bug, ImageIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  BugStatusBadge,
  BugSeverityBadge,
} from '../../components/StatusBadge'
import { listMyBugs } from '../../lib/bugs'
import { listBugAttachments, getAttachmentUrl } from '../../lib/attachments'
import type { BugReportPublic, BugAttachment, BugStatus } from '../../types'
import { BUG_CATEGORY_LABEL, BUG_STATUS_OPTIONS } from '../../types'

const STATUS_FILTER_LABEL: Record<BugStatus | 'all', string> = {
  all: 'All statuses',
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function MySubmissions() {
  const { tester, rolesLoading, isAdmin } = useAuth()
  const [bugs, setBugs] = useState<BugReportPublic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!tester) return
    setError(null)
    try {
      const rows = await listMyBugs(tester.id)
      setBugs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
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

  if (isAdmin || !tester) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            This page shows submissions for the signed-in tester. As the project owner,
            visit Bug Triage to see all reports.
          </p>
        </div>
      </div>
    )
  }

  const filtered =
    statusFilter === 'all'
      ? bugs
      : bugs?.filter((b) => b.status === statusFilter) ?? null

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My submissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Bugs you've reported and their current status. Click a row to see the full details.
          </p>
        </div>
        <Link
          to="/report-bug"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
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
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="status-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BugStatus | 'all')}
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
      )}

      {bugs === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : bugs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Bug className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">You haven't reported any bugs yet.</p>
          <Link
            to="/report-bug"
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Bug className="w-4 h-4" />
            Report your first bug
          </Link>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No bugs match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((bug) => (
            <BugRow
              key={bug.id}
              bug={bug}
              expanded={expanded === bug.id}
              onToggle={() => setExpanded(expanded === bug.id ? null : bug.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Row ----------

interface BugRowProps {
  bug: BugReportPublic
  expanded: boolean
  onToggle: () => void
}

function BugRow({ bug, expanded, onToggle }: BugRowProps) {
  const [attachments, setAttachments] = useState<BugAttachment[] | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!expanded || attachments !== null) return
    let cancelled = false
    listBugAttachments(bug.id)
      .then(async (rows) => {
        if (cancelled) return
        setAttachments(rows)
        // Resolve signed URLs in parallel.
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
        if (cancelled) return
        setAttachmentUrls(Object.fromEntries(entries))
      })
      .catch((err) => {
        console.warn('[MySubmissions] Failed to load attachments', err)
        if (!cancelled) setAttachments([])
      })
    return () => {
      cancelled = true
    }
  }, [expanded, attachments, bug.id])

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
          </div>
          <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span>{BUG_CATEGORY_LABEL[bug.category]}</span>
            <span className="text-gray-300">·</span>
            <span>
              Submitted {formatDistanceToNow(new Date(bug.submitted_at), { addSuffix: true })}
            </span>
            {bug.helm_version && (
              <>
                <span className="text-gray-300">·</span>
                <span>Helm {bug.helm_version}</span>
              </>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">
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

          <Section title="Environment">
            <ul className="text-xs text-gray-700 space-y-1">
              <li>
                <span className="text-gray-500">OS:</span>{' '}
                {bug.os ? bug.os === 'macos' ? 'macOS' : 'Windows' : '—'}
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

          <Section title="Screenshots">
            {attachments === null ? (
              <LoadingSpinner size="sm" />
            ) : attachments.length === 0 ? (
              <p className="text-xs text-gray-500">No screenshots attached.</p>
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
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {title}
      </div>
      {children}
    </div>
  )
}
