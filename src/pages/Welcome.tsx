import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

/**
 * Post-invitation onboarding.
 *
 * Flow: admin invites a tester → Supabase Auth sends a magic-link email →
 * tester clicks → Supabase exchanges the URL token for a session in
 * `detectSessionInUrl` mode → they land here → we show a "set your password"
 * form, then redirect to /dashboard.
 *
 * The `link-tester-account` Edge Function (triggered on user signup) handles
 * matching the new auth user to the pending tester row by email.
 */
export default function Welcome() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authedEmail, setAuthedEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthedEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!authedEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-gray-900">Invite link expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            We couldn't verify your invitation. Ask the project owner to send a new invite,
            or sign in if you already have an account.
          </p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium"
          >
            Go to sign-in
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      // Link this new auth user to the pending tester row by email. Without
      // this, their testers.user_id stays null and RLS hides their project.
      const { error: linkErr } = await supabase.functions.invoke('link-tester-account')
      if (linkErr) {
        // Don't block — they can still sign in and an admin can link manually.
        console.warn('link-tester-account failed', linkErr)
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Welcome to Helm Beta</h1>
          <p className="mt-1 text-sm text-gray-500">Set a password for {authedEmail}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
        >
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Confirm
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          >
            {submitting ? <LoadingSpinner size="sm" className="border-white" /> : 'Set password and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
