import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  BugStatusBadge,
  BugSeverityBadge,
} from '../../components/StatusBadge'
import { listBugsWithTester } from '../../lib/bugs'
import type { BugReportWithTester } from '../../lib/bugs'
import {
  BUG_CATEGORY_LABEL,
  BUG_CATEGORY_OPTIONS,
  BUG_SEVERITY_OPTIONS,
  BUG_STATUS_OPTIONS,
  type BugCategory,
  type BugSeverity,
  type BugStatus,
} from '../../types'

type AnyOf<T extends string> = T | 'all'

export default function AdminBugTriage() {
  const { project } = useAuth()
  const navigate = useNavigate()
  const [bugs, setBugs] = useState<BugReportWithTester[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState<AnyOf<BugSeverity>>('all')
  const [category, setCategory] = useState<AnyOf<BugCategory>>('all')
  const [status, setStatus] = useState<AnyOf<BugStatus>>('all')

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listBugsWithTester(project.id)
      setBugs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bug reports')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (!bugs) return null
    return bugs.filter(
      (b) =>
        (severity === 'all' || b.severity === severity) &&
        (category === 'all' || b.category === category) &&
        (status === 'all' || b.status === status),
    )
  }, [bugs, severity, category, status])

  // Sorted by severity (critical first) then submitted_at desc.
  const SEVERITY_RANK: Record<BugSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  const sorted = useMemo(() => {
    if (!filtered) return null
    return [...filtered].sort((a, b) => {
      const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sevDiff !== 0) return sevDiff
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })
  }, [filtered])

  if (!project) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const filterActive = severity !== 'all' || category !== 'all' || status !== 'all'

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bug triage</h1>
          <p className="mt-1 text-sm text-gray-500">
            All bug reports from your testers. Sorted by severity, then most recent.
          </p>
        </div>
        {bugs && (
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {filterActive ? `${sorted?.length ?? 0} of ${bugs.length}` : `${bugs.length} total`}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {bugs && bugs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FilterDropdown
            label="Severity"
            value={severity}
            onChange={(v) => setSeverity(v as AnyOf<BugSeverity>)}
            options={[
              { value: 'all', label: 'All severities' },
              ...BUG_SEVERITY_OPTIONS.map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
              })),
            ]}
          />
          <FilterDropdown
            label="Category"
            value={category}
            onChange={(v) => setCategory(v as AnyOf<BugCategory>)}
            options={[
              { value: 'all', label: 'All categories' },
              ...BUG_CATEGORY_OPTIONS.map((c) => ({
                value: c,
                label: BUG_CATEGORY_LABEL[c],
              })),
            ]}
          />
          <FilterDropdown
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as AnyOf<BugStatus>)}
            options={[
              { value: 'all', label: 'All statuses' },
              ...BUG_STATUS_OPTIONS.map((s) => ({
                value: s,
                label:
                  s === 'in_progress'
                    ? 'In progress'
                    : s.charAt(0).toUpperCase() + s.slice(1),
              })),
            ]}
          />
          {filterActive && (
            <button
              type="button"
              onClick={() => {
                setSeverity('all')
                setCategory('all')
                setStatus('all')
              }}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {bugs === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : bugs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Bug className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No bug reports yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            They'll show up here as your testers submit them.
          </p>
        </div>
      ) : sorted && sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No bugs match these filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Bug</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Tester</th>
                <th className="text-left px-4 py-3">Helm</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted?.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/admin/bugs/${b.id}`)}
                  className="hover:bg-gray-50/60 cursor-pointer"
                >
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium text-gray-900 truncate">{b.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <BugSeverityBadge severity={b.severity} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {BUG_CATEGORY_LABEL[b.category]}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {b.tester ? (
                      <div className="font-medium text-gray-800">{b.tester.name}</div>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.helm_version || <Dash />}</td>
                  <td className="px-4 py-3">
                    <BugStatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(b.submitted_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Helpers ----------

function FilterDropdown<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Dash() {
  return <span className="text-gray-300">—</span>
}
