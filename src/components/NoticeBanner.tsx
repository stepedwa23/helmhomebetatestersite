import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Info, AlertTriangle, AlertOctagon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { listActiveNotices } from '../lib/notices'
import type { Notice, NoticeSeverity } from '../types'

/**
 * Project-wide notice banner. Renders at the top of Layout above the header
 * on every authenticated page. Stacks multiple active notices (critical first).
 *
 * RLS scopes the query:
 *   - Admin: sees all active notices in their project
 *   - Tester: sees active notices in their project
 *   - Unauthenticated: no rows (handled by the early return below for project = null)
 *
 * No per-user dismiss — admins toggle is_active=false when a notice is no
 * longer relevant. That's intentional for critical notices that must stay
 * visible.
 */
export default function NoticeBanner() {
  const { project, loading } = useAuth()
  const location = useLocation()
  const [notices, setNotices] = useState<Notice[]>([])

  // Refetch on every route change so admins see their newly-created notices
  // without a full page reload, and testers pick up updates as they navigate.
  // Cheap query (one row per active notice, scoped by RLS).
  useEffect(() => {
    if (!project) return
    let cancelled = false
    listActiveNotices(project.id)
      .then((rows) => {
        if (!cancelled) setNotices(rows)
      })
      .catch((err) => {
        console.warn('[NoticeBanner] Failed to load notices', err)
        if (!cancelled) setNotices([])
      })
    return () => {
      cancelled = true
    }
  }, [project, location.pathname])

  if (loading || !project || notices.length === 0) return null

  return (
    <div className="flex-shrink-0">
      {notices.map((n) => (
        <NoticeRow key={n.id} notice={n} />
      ))}
    </div>
  )
}

// ---------- Single notice row ----------

const SEVERITY_STYLES: Record<
  NoticeSeverity,
  { bg: string; text: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string }
> = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-900',
    icon: Info,
    label: 'Info',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-900',
    icon: AlertTriangle,
    label: 'Heads up',
  },
  critical: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-900',
    icon: AlertOctagon,
    label: 'Important',
  },
}

function NoticeRow({ notice }: { notice: Notice }) {
  const s = SEVERITY_STYLES[notice.severity]
  const Icon = s.icon
  return (
    <div className={`border-b ${s.bg}`}>
      <div className="px-4 md:px-6 py-2 flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.text}`} />
        <div className={`flex-1 min-w-0 text-sm ${s.text}`}>
          <span className="font-semibold mr-2">{s.label}:</span>
          <span className="whitespace-pre-wrap">{notice.body}</span>
        </div>
      </div>
    </div>
  )
}
