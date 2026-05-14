import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Bug,
  ClipboardList,
  BookOpen,
  Lightbulb,
  Users,
  CalendarRange,
  MessageSquareText,
  FileText,
  Megaphone,
  LogOut,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { useAuth } from '../contexts/AuthContext'

const activeLinkClass =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white'
const inactiveLinkClass =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const TESTER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/report-bug', label: 'Report a Bug', icon: Bug },
  { to: '/bugs', label: 'Bug Reports', icon: ClipboardList },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/feedback', label: 'Feedback', icon: MessageSquareText },
  { to: '/help', label: 'Help Library', icon: BookOpen },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/notices', label: 'Notices', icon: Megaphone },
  { to: '/admin/testers', label: 'Testers', icon: Users },
  { to: '/admin/cycles', label: 'Test Cycles', icon: CalendarRange },
  { to: '/admin/bugs', label: 'Bug Triage', icon: Bug },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquareText },
  { to: '/admin/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/admin/patch-notes', label: 'Patch Notes', icon: FileText },
  { to: '/admin/help', label: 'Help Library', icon: BookOpen },
  // Settings is intentionally not in the nav — the page is still routed at
  // /admin/settings as a placeholder. Add `{ to: '/admin/settings', ... }`
  // back to this list when there's real content to put there.
]

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { isAdmin, effectiveIsAdmin, previewAsTester, setPreviewAsTester, signOut, tester } =
    useAuth()
  const navigate = useNavigate()
  const items = effectiveIsAdmin ? ADMIN_NAV : TESTER_NAV

  function togglePreview() {
    setPreviewAsTester(!previewAsTester)
    // Bounce to /dashboard so the user lands on a sensible page regardless of
    // whether the current route exists for both roles.
    navigate('/dashboard')
    onNavigate?.()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3">
        <div className="text-base font-semibold text-white">Helm Beta</div>
        <div className="mt-0.5 text-xs text-slate-400">
          {effectiveIsAdmin
            ? 'Admin console'
            : isAdmin
              ? 'Tester portal (preview)'
              : 'Tester portal'}
        </div>
      </div>

      {/* Preview-as-tester toggle. Admin only. */}
      {isAdmin && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={togglePreview}
            className={[
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              previewAsTester
                ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10',
            ].join(' ')}
          >
            {previewAsTester ? (
              <>
                <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Exit tester preview</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Preview as tester</span>
              </>
            )}
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? activeLinkClass : inactiveLinkClass)}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 pt-2 border-t border-white/10">
        {tester && !isAdmin && (
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-slate-400 truncate">{tester.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{tester.email}</div>
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>

    </div>
  )
}
