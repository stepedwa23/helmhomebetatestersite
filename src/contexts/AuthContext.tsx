import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Project, Tester } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  // Tester profile for the signed-in user (null if admin or not yet matched).
  tester: Tester | null
  // True if the signed-in user is the project owner.
  isAdmin: boolean
  // Active project (single-project UI in v1 — first project the user can see).
  project: Project | null
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [tester, setTester] = useState<Tester | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load the user's project + tester profile (if any).
  // RLS scopes this to rows the user can actually see, so we don't need to filter.
  //
  // We surface query errors via console.error instead of swallowing them,
  // because a silent RLS rejection (or stale-JWT 401) is otherwise impossible
  // to diagnose — the user just appears as a tester with no clue why.
  async function loadUserContext(currentSession: Session | null) {
    if (!currentSession?.user) {
      setProject(null)
      setTester(null)
      setIsAdmin(false)
      return
    }

    // 1. Active project — admin owns it, testers see only theirs via RLS.
    // Avoid .maybeSingle()/.single() — use limit(1) + array index (reference-project lesson).
    const { data: projectRows, error: projectErr } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)

    if (projectErr) {
      console.error('[AuthContext] projects query failed', projectErr)
    }
    if (!projectRows?.length) {
      console.warn('[AuthContext] No project rows visible to user', {
        user_id: currentSession.user.id,
        email: currentSession.user.email,
      })
    }

    const activeProject = (projectRows?.[0] as Project | undefined) ?? null
    setProject(activeProject)

    // 2. Admin if user owns the project.
    const userIsAdmin = !!activeProject && activeProject.owner_id === currentSession.user.id
    console.info('[AuthContext] role check', {
      user_id: currentSession.user.id,
      email: currentSession.user.email,
      project_id: activeProject?.id,
      project_owner_id: activeProject?.owner_id,
      is_admin: userIsAdmin,
    })
    setIsAdmin(userIsAdmin)

    // 3. Tester record for this user (only if not admin — admins typically aren't testers).
    if (!userIsAdmin) {
      const { data: testerRows, error: testerErr } = await supabase
        .from('testers')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (testerErr) {
        console.error('[AuthContext] testers query failed', testerErr)
      }

      setTester((testerRows?.[0] as Tester | undefined) ?? null)
    } else {
      setTester(null)
    }
  }

  useEffect(() => {
    let mounted = true

    // Initial load.
    // Errors are caught + logged so we get diagnostic signal in console, but
    // we no longer impose a hard timeout — if a request genuinely hangs in
    // production, we want to see that explicitly rather than masking it as
    // a "timeout." The setLoading(false) in finally still fires whenever
    // the awaits settle naturally.
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        await loadUserContext(data.session)
      } catch (err) {
        console.error('[AuthContext] initial load failed', err)
        if (mounted) {
          setSession(null)
          setTester(null)
          setProject(null)
          setIsAdmin(false)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        try {
          await loadUserContext(newSession)
        } catch (err) {
          console.error('AuthContext refresh failed', err)
        }
      },
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refresh() {
    await loadUserContext(session)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      tester,
      isAdmin,
      project,
      signOut,
      refresh,
    }),
    [session, loading, tester, isAdmin, project],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
