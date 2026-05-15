import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Bug,
  Lightbulb,
  BookOpen,
  Download as DownloadIcon,
  Users,
  ArrowRight,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import PreviewModeBanner from '../components/PreviewModeBanner'
import TipTapView from '../components/editor/TipTapView'
import {
  BugSeverityBadge,
  BugStatusBadge,
  SuggestionStatusBadge,
  CycleStatusBadge,
} from '../components/StatusBadge'
import { getCurrentVersion } from '../lib/appVersions'
import { listDownloads, getDownloadUrl, recordDownload } from '../lib/appDownloads'
import { listTesters } from '../lib/testers'
import { listBugsWithTester } from '../lib/bugs'
import type { BugReportWithTester } from '../lib/bugs'
import { listSuggestionsAdminWithTester } from '../lib/suggestions'
import type { SuggestionWithTester } from '../lib/suggestions'
import { listCycles } from '../lib/cycles'
import {
  ACTIVE_PLATFORMS,
  APP_PLATFORM_LABEL,
  type AppDownload,
  type AppPlatform,
  type AppVersion,
  type Tester,
  type TestCycle,
  type BugSeverity,
} from '../types'

export default function Dashboard() {
  const { effectiveIsAdmin, tester, project, rolesLoading } = useAuth()

  if (effectiveIsAdmin) {
    return <AdminDashboard projectId={project?.id ?? null} rolesLoading={rolesLoading} />
  }

  return (
    <TesterDashboard
      tester={tester}
      projectId={project?.id ?? null}
      rolesLoading={rolesLoading}
    />
  )
}

// =====================================================================
// Admin Dashboard
// =====================================================================

interface AdminDashboardProps {
  projectId: string | null
  rolesLoading: boolean
}

function AdminDashboard({ projectId, rolesLoading }: AdminDashboardProps) {
  const [testers, setTesters] = useState<Tester[] | null>(null)
  const [bugs, setBugs] = useState<BugReportWithTester[] | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionWithTester[] | null>(null)
  const [cycles, setCycles] = useState<TestCycle[] | null>(null)
  const [version, setVersion] = useState<AppVersion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setError(null)
    try {
      const [t, b, s, c, v] = await Promise.all([
        listTesters(projectId),
        listBugsWithTester(projectId),
        listSuggestionsAdminWithTester(projectId),
        listCycles(projectId),
        getCurrentVersion(projectId),
      ])
      setTesters(t)
      setBugs(b)
      setSuggestions(s)
      setCycles(c)
      setVersion(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    }
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ---------- Derived counts ----------
  const counts = useMemo(() => {
    if (!testers || !bugs || !suggestions || !cycles) return null

    const activeTesters = testers.filter((t) => t.status === 'active').length
    const invitedTesters = testers.filter((t) => t.status === 'invited').length

    const liveBugs = bugs.filter((b) => b.status === 'open' || b.status === 'in_progress')
    const bugsBySeverity: Record<BugSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const b of liveBugs) bugsBySeverity[b.severity]++

    const pendingSuggestions = suggestions.filter(
      (s) => s.status === 'new' || s.status === 'under_review',
    ).length

    const activeCycle = cycles.find((c) => c.status === 'active') ?? null

    return {
      activeTesters,
      invitedTesters,
      totalTesters: testers.length,
      liveBugsTotal: liveBugs.length,
      bugsBySeverity,
      pendingSuggestions,
      totalSuggestions: suggestions.length,
      activeCycle,
    }
  }, [testers, bugs, suggestions, cycles])

  // ---------- Recent activity feed ----------
  const recentActivity = useMemo(() => {
    if (!bugs || !suggestions) return null
    type Item =
      | { kind: 'bug'; row: BugReportWithTester }
      | { kind: 'suggestion'; row: SuggestionWithTester }
    const items: Item[] = [
      ...bugs.map((row) => ({ kind: 'bug' as const, row })),
      ...suggestions.map((row) => ({ kind: 'suggestion' as const, row })),
    ]
    items.sort(
      (a, b) =>
        new Date(b.row.submitted_at).getTime() - new Date(a.row.submitted_at).getTime(),
    )
    return items.slice(0, 10)
  }, [bugs, suggestions])

  // ---------- Render ----------
  if (rolesLoading || !projectId) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const loading = !counts || !recentActivity

  // First-time empty state: no testers, no bugs, no suggestions, no cycles.
  const isEmpty =
    !!counts &&
    counts.totalTesters === 0 &&
    bugs?.length === 0 &&
    suggestions?.length === 0 &&
    cycles?.length === 0

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          What needs your attention today.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : isEmpty ? (
        <GettingStartedEmptyState />
      ) : (
        <div className="space-y-6">
          <StatCardGrid counts={counts!} />
          {counts!.activeCycle && (
            <ActiveCycleCard
              cycle={counts!.activeCycle}
              bugs={bugs ?? []}
              testerCount={counts!.totalTesters}
            />
          )}
          {version && <CurrentVersionCard version={version} />}
          <RecentActivityList items={recentActivity!} />
        </div>
      )}
    </div>
  )
}

// ---------- Empty state ----------

function GettingStartedEmptyState() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8">
      <h2 className="text-lg font-semibold text-gray-900">Getting started</h2>
      <p className="mt-1 text-sm text-gray-500">
        You haven't set anything up yet. The fastest path:
      </p>
      <ol className="mt-4 space-y-3 text-sm text-gray-700">
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            1
          </span>
          <span>
            <Link to="/admin/testers" className="text-blue-600 hover:underline font-medium">
              Add your first tester
            </Link>{' '}
            and send them an invite email.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            2
          </span>
          <span>
            <Link to="/admin/patch-notes" className="text-blue-600 hover:underline font-medium">
              Publish a beta version
            </Link>{' '}
            with patch notes and per-platform installer downloads.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            3
          </span>
          <span>
            <Link to="/admin/cycles" className="text-blue-600 hover:underline font-medium">
              Create a test cycle
            </Link>{' '}
            and assign your testers to it — gives bugs and feedback a context to live in.
          </span>
        </li>
      </ol>
    </div>
  )
}

// ---------- Stat cards ----------

interface DashboardCounts {
  activeTesters: number
  invitedTesters: number
  totalTesters: number
  liveBugsTotal: number
  bugsBySeverity: Record<BugSeverity, number>
  pendingSuggestions: number
  totalSuggestions: number
  activeCycle: TestCycle | null
}

interface StatCardGridProps {
  counts: DashboardCounts
}

function StatCardGrid({ counts }: StatCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        icon={Users}
        label="Active testers"
        value={counts.activeTesters}
        sublabel={
          counts.invitedTesters > 0
            ? `${counts.invitedTesters} invited (not yet active)`
            : counts.totalTesters > counts.activeTesters
              ? `${counts.totalTesters - counts.activeTesters} inactive`
              : "everyone's active"
        }
        to="/admin/testers"
        tone="blue"
      />

      <StatCard
        icon={Bug}
        label="Open bugs"
        value={counts.liveBugsTotal}
        sublabel={
          counts.bugsBySeverity.critical > 0
            ? `${counts.bugsBySeverity.critical} critical, ${counts.bugsBySeverity.high} high`
            : counts.bugsBySeverity.high > 0
              ? `${counts.bugsBySeverity.high} high severity`
              : counts.liveBugsTotal > 0
                ? 'nothing critical'
                : 'no open bugs'
        }
        to="/admin/bugs"
        tone={counts.bugsBySeverity.critical > 0 ? 'red' : 'green'}
      />

      <StatCard
        icon={Lightbulb}
        label="Pending suggestions"
        value={counts.pendingSuggestions}
        sublabel={
          counts.totalSuggestions > 0
            ? `${counts.totalSuggestions} total submitted`
            : 'none yet'
        }
        to="/admin/suggestions"
        tone="amber"
      />

      <StatCard
        icon={Calendar}
        label="Active cycle"
        value={counts.activeCycle ? 1 : 0}
        sublabel={counts.activeCycle ? counts.activeCycle.name : 'none in progress'}
        to="/admin/cycles"
        tone="purple"
      />
    </div>
  )
}

type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple'

const TONE_BG: Record<StatTone, string> = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  purple: 'bg-purple-50 text-purple-700',
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  to,
  tone,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: number
  sublabel: string
  to: string
  tone: StatTone
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </div>
        <div className={`p-1.5 rounded-lg ${TONE_BG[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500 truncate">{sublabel}</div>
    </Link>
  )
}

// ---------- Active cycle card ----------

function ActiveCycleCard({
  cycle,
  bugs,
  testerCount,
}: {
  cycle: TestCycle
  bugs: BugReportWithTester[]
  testerCount: number
}) {
  const cycleBugs = bugs.filter((b) => b.cycle_id === cycle.id)
  const openInCycle = cycleBugs.filter(
    (b) => b.status === 'open' || b.status === 'in_progress',
  ).length

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Active test cycle
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">{cycle.name}</h2>
            <CycleStatusBadge status={cycle.status} />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {cycle.build_version && `Build ${cycle.build_version} · `}
            {formatDateRange(cycle.start_date, cycle.end_date)}
          </div>
        </div>
        <Link
          to="/admin/cycles"
          className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
        >
          Manage cycles →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <CycleMetric label="Testers in project" value={testerCount} />
        <CycleMetric label="Bugs filed in cycle" value={cycleBugs.length} />
        <CycleMetric label="Open in cycle" value={openInCycle} />
      </div>

      {cycle.notes && (
        <p className="mt-3 text-xs text-gray-600 italic line-clamp-2">{cycle.notes}</p>
      )}
    </section>
  )
}

function CycleMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'no dates set'
  const s = start ? format(new Date(start), 'MMM d, yyyy') : '?'
  const e = end ? format(new Date(end), 'MMM d, yyyy') : '?'
  return `${s} → ${e}`
}

// ---------- Current version card ----------

function CurrentVersionCard({ version }: { version: AppVersion }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Current beta
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">{version.version}</h2>
            {version.release_date && (
              <span className="text-xs text-gray-500">
                Released {format(new Date(version.release_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/admin/patch-notes"
          className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
        >
          Manage patch notes →
        </Link>
      </div>
    </section>
  )
}

// ---------- Recent activity feed ----------

type ActivityItem =
  | { kind: 'bug'; row: BugReportWithTester }
  | { kind: 'suggestion'; row: SuggestionWithTester }

function RecentActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <header className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
        <span className="text-xs text-gray-500">
          {items.length === 0 ? 'nothing yet' : `last ${items.length}`}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500">
          No submissions yet. Your testers' bug reports and suggestions appear here as they
          come in.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <ActivityRow key={`${item.kind}-${item.row.id}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.kind === 'bug') {
    const b = item.row
    return (
      <li>
        <Link
          to={`/admin/bugs/${b.id}`}
          className="block px-5 py-3 hover:bg-gray-50/60 transition-colors"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <Bug className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">{b.title}</span>
                  <BugSeverityBadge severity={b.severity} />
                  <BugStatusBadge status={b.status} />
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {b.tester?.name ?? 'Unknown tester'} ·{' '}
                  {formatDistanceToNow(new Date(b.submitted_at), { addSuffix: true })}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
          </div>
        </Link>
      </li>
    )
  }

  const s = item.row
  return (
    <li>
      <Link
        to="/admin/suggestions"
        className="block px-5 py-3 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lightbulb className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 truncate">{s.title}</span>
                <SuggestionStatusBadge status={s.status} />
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {s.tester?.name ?? 'Unknown tester'} ·{' '}
                {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
        </div>
      </Link>
    </li>
  )
}

// =====================================================================
// Tester Dashboard (existing)
// =====================================================================

interface TesterDashboardProps {
  tester: Tester | null
  projectId: string | null
  rolesLoading: boolean
}

function TesterDashboard({ tester, projectId, rolesLoading }: TesterDashboardProps) {
  const [version, setVersion] = useState<AppVersion | null | undefined>(undefined)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<AppDownload[]>([])
  const [downloadAck, setDownloadAck] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setVersionError(null)
    getCurrentVersion(projectId)
      .then(async (v) => {
        if (cancelled) return
        setVersion(v)
        if (v) {
          try {
            const dl = await listDownloads(v.id)
            if (!cancelled) setDownloads(dl)
          } catch (err) {
            console.warn('[Dashboard] Failed to load downloads', err)
            if (!cancelled) setDownloads([])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setVersionError(err instanceof Error ? err.message : 'Failed to load')
          setVersion(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const detectedPlatform = useDetectedPlatform(tester?.os ?? null)

  if (rolesLoading || !projectId) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const firstName = tester?.name.split(' ')[0]

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          The latest from the Helm beta — and quick links to where you can help.
        </p>
      </header>

      {/* Current version banner */}
      {version === undefined ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center mb-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : version ? (
        <section className="mb-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl overflow-hidden">
          <div className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-100">
              Current beta
            </div>
            <div className="mt-1 flex items-baseline gap-3 flex-wrap">
              <h2 className="text-2xl font-semibold">Version {version.version}</h2>
              {version.release_date && (
                <span className="inline-flex items-center gap-1 text-sm text-blue-100">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(version.release_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white px-6 py-5">
            <TipTapView
              content={version.patch_notes}
              emptyText="No patch notes for this version yet."
            />
          </div>
        </section>
      ) : (
        <section className="mb-6 bg-white border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">
            {versionError
              ? `Couldn't load the current version (${versionError}).`
              : 'No current beta version has been published yet.'}
          </p>
        </section>
      )}

      {/* Downloads */}
      {version && downloads.length > 0 && (
        <section className="mb-6 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h3 className="text-base font-semibold text-gray-900">
              Download Helm v{version.version}
            </h3>
            {detectedPlatform && (
              <span className="text-xs text-gray-500">
                Looks like you're on {APP_PLATFORM_LABEL[detectedPlatform]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ACTIVE_PLATFORMS.map((p) => {
              const dl = downloads.find((d) => d.platform === p)
              return (
                <DownloadButton
                  key={p}
                  platform={p}
                  download={dl ?? null}
                  versionId={version.id}
                  tester={tester}
                  projectId={projectId}
                  highlighted={detectedPlatform === p}
                  onTracked={setDownloadAck}
                />
              )
            })}
          </div>
          {downloadAck && (
            <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
              <span>{downloadAck}</span>
              <button
                type="button"
                onClick={() => setDownloadAck(null)}
                className="text-green-700 hover:text-green-900"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Help shape this beta
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink
            to="/report-bug"
            icon={Bug}
            title="Report a bug"
            description="Something broken? Let me know."
          />
          <QuickLink
            to="/suggestions"
            icon={Lightbulb}
            title="Suggest something"
            description="Ideas for what's next."
          />
          <QuickLink
            to="/help"
            icon={BookOpen}
            title="Help library"
            description="Guides and references."
          />
        </div>
      </section>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <Icon className="w-5 h-5 text-blue-600 mb-2" />
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="mt-0.5 text-xs text-gray-500">{description}</div>
    </Link>
  )
}

// ---------- Download button + OS detection ----------

interface DownloadButtonProps {
  platform: AppPlatform
  download: AppDownload | null
  versionId: string
  tester: Tester | null
  projectId: string
  highlighted: boolean
  /** Called with an acknowledgement string when tracking succeeds. */
  onTracked?: (message: string) => void
}

function DownloadButton({
  platform,
  download,
  versionId,
  tester,
  projectId,
  highlighted,
  onTracked,
}: DownloadButtonProps) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const available = !!download

  async function handleClick() {
    if (!download) return
    setErr(null)
    setBusy(true)
    try {
      // Track the download + auto-assign to active cycle. Best-effort: a
      // failure here doesn't block the actual download (RLS error, network blip,
      // etc.). For testers we have a tester id; for admin without a tester row,
      // we skip tracking entirely.
      if (tester) {
        try {
          const result = await recordDownload({
            version_id: versionId,
            tester_id: tester.id,
            platform,
            project_id: projectId,
          })
          if (onTracked) {
            if (result.assignedToCycle) {
              onTracked(
                `Recorded — you're now in the "${result.assignedToCycle.name}" test cycle.`,
              )
            } else if (result.activeCycle) {
              onTracked(
                `Recorded — already in the "${result.activeCycle.name}" cycle.`,
              )
            } else {
              onTracked('Download recorded.')
            }
          }
        } catch (trackErr) {
          console.warn('[DownloadButton] tracking failed', trackErr)
        }
      }

      const url = await getDownloadUrl(download.storage_path, 300)
      window.location.href = url
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setTimeout(() => setBusy(false), 800)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!available || busy}
      className={[
        'text-left rounded-xl p-4 border transition-all',
        available
          ? highlighted
            ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700 shadow-sm'
            : 'bg-white border-gray-200 text-gray-900 hover:border-blue-300 hover:shadow-sm'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <DownloadIcon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-semibold">{APP_PLATFORM_LABEL[platform]}</span>
      </div>
      <div className={`mt-1 text-xs ${highlighted && available ? 'text-blue-100' : 'text-gray-500'}`}>
        {available ? (
          <>
            <span className="truncate inline-block max-w-full">{download!.filename}</span>
            <br />
            <span>{formatBytes(download!.size_bytes)}</span>
          </>
        ) : (
          'Not available yet'
        )}
      </div>
      {err && (
        <div className="mt-2 text-xs text-red-100 bg-red-700/80 rounded px-2 py-1">{err}</div>
      )}
    </button>
  )
}

function useDetectedPlatform(testerOs: Tester['os']): AppPlatform | null {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (testerOs === 'macos' || /Macintosh|Mac OS X/.test(ua)) {
    return 'macos_arm64'
  }
  if (testerOs === 'windows' || /Windows/.test(ua)) {
    if (/ARM64|aarch64/i.test(ua)) return 'windows_arm64'
    return 'windows_x64'
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
