import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Project, Tester } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  // True while we're determining whether the user is signed in. False as soon
  // as we have a definitive answer from getSession (which reads localStorage,
  // does NOT hit the network). UI rendering is gated on this — and only this.
  loading: boolean
  // Tester profile for the signed-in user (null if admin or not yet matched).
  // Loads asynchronously after `loading` is false; may briefly be null.
  tester: Tester | null
  // True if the signed-in user is the project owner.
  // Loads asynchronously after `loading` is false; may briefly be false.
  isAdmin: boolean
  // Active project. Loads asynchronously after `loading` is false.
  project: Project | null
  // True while project/role/tester are loading in the background. Components
  // that depend on accurate role info (e.g. the role-conditional sidebar)
  // can read this to show a loading state.
  rolesLoading: boolean
  // True when the admin has opted into "view as a tester" mode. The underlying
  // auth user is still the admin; only the UI experience is switched.
  // Submissions/edits remain disabled since there's no real tester row to act as.
  previewAsTester: boolean
  setPreviewAsTester: (v: boolean) => void
  // Derived: whether to render admin chrome right now. `isAdmin && !previewAsTester`.
  // Use this instead of `isAdmin` in all UI-routing decisions.
  effectiveIsAdmin: boolean
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
  const [rolesLoading, setRolesLoading] = useState(false)
  const [previewAsTester, setPreviewAsTester] = useState(false)
  // Tracks whether we've completed the first project/tester load. Used to gate
  // the rolesLoading spinner so we only show it on initial load and after a
  // sign-out — not on background refetches that would unmount in-progress
  // forms (e.g. a bug report draft when the tab regains focus).
  const initialRoleLoadDone = useRef(false)

  // When the user is not actually an admin, force preview off so the flag
  // doesn't linger in a weird state if they sign in/out across role changes.
  useEffect(() => {
    if (!isAdmin && previewAsTester) setPreviewAsTester(false)
  }, [isAdmin, previewAsTester])

  const effectiveIsAdmin = isAdmin && !previewAsTester

  // Load the user's project + tester profile (if any).
  // RLS scopes this to rows the user can actually see, so we don't need to filter.
  //
  // IMPORTANT: this runs in the BACKGROUND — it is never awaited from the
  // useEffect that sets `loading`. UI rendering is unblocked the moment
  // getSession() resolves. If these queries hang or fail (e.g. RLS rejection,
  // network), the UI is still usable; only the role-dependent nav is delayed.
  //
  // We surface query errors via console.error instead of swallowing them,
  // because a silent RLS rejection (or stale-JWT 401) is otherwise impossible
  // to diagnose.
  //
  // We only flip `rolesLoading=true` when we don't yet have a project — i.e.
  // first load or after a sign-out. Subsequent refetches (USER_UPDATED, manual
  // refresh()) run silently. Without this, any rolesLoading bounce unmounts
  // every page that gates on rolesLoading, destroying in-progress form state
  // (bug report drafts especially).
  async function loadUserContext(currentSession: Session | null) {
    if (!currentSession?.user) {
      // Sign-out / no user: reset everything and re-arm the initial-load
      // gate so the next sign-in shows the loading spinner again.
      initialRoleLoadDone.current = false
      setProject(null)
      setTester(null)
      setIsAdmin(false)
      setRolesLoading(false)
      return
    }

    const showLoading = !initialRoleLoadDone.current
    if (showLoading) setRolesLoading(true)
    try {
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

      // 3. Tester record for this user.
      // We load this for EVERYONE (including admin) — admin can also be a
      // tester (using their own tester row to self-submit bugs / suggestions /
      // feedback). When admin has no tester row, this stays null and pages
      // that need a tester profile prompt them to create one.
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
    } finally {
      initialRoleLoadDone.current = true
      if (showLoading) setRolesLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    // Phase 1 — Fast auth check. getSession() reads localStorage, no network.
    // We set `loading=false` as soon as this resolves so the UI can render.
    //
    // Phase 2 — Role load (project + tester) runs in the background, NOT
    // awaited. If those queries are slow or hang, the UI is already rendered
    // and the user can sign in / navigate. `rolesLoading` lets nav components
    // show a skeleton until role info is determined.
    //
    // This mirrors the pattern in the consulting-app reference project:
    // AuthContext handles auth state only; data queries belong in pages or
    // run in the background.
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        // Fire-and-forget background role load. Never block UI on this.
        // The onAuthStateChange subscriber below may also fire INITIAL_SESSION,
        // which would trigger loadUserContext again — that's redundant but
        // harmless (same query, same result).
        loadUserContext(data.session).catch((err) =>
          console.error('[AuthContext] initial role load failed', err),
        )
      } catch (err) {
        console.error('[AuthContext] getSession failed', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        // Skip role refetch on TOKEN_REFRESHED — Supabase fires this when the
        // access token rotates (notably when the tab regains focus near token
        // expiry). The user identity is unchanged, so project/tester relations
        // can't have changed. Refetching here was unmounting in-progress forms
        // (bug report draft data loss when testers tabbed away to Helm and
        // back).
        if (event === 'TOKEN_REFRESHED') return
        // Fire and forget — never block the UI on this.
        loadUserContext(newSession).catch((err) =>
          console.error('[AuthContext] role load failed', err),
        )
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
      rolesLoading,
      previewAsTester,
      setPreviewAsTester,
      effectiveIsAdmin,
      signOut,
      refresh,
    }),
    [
      session,
      loading,
      tester,
      isAdmin,
      project,
      rolesLoading,
      previewAsTester,
      effectiveIsAdmin,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
