import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Bug, AlertTriangle, UserPlus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import BugReportForm, {
  type SubmitResult,
} from '../../components/bugs/BugReportForm'
import type { Tester } from '../../types'
import { DEFAULT_CALM_MODE_STATE } from '../../types'
import { createSelfTesterProfile } from '../../lib/testers'

export default function ReportBug() {
  const { tester, project, rolesLoading, isAdmin, previewAsTester, user, refresh } =
    useAuth()
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  if (rolesLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            We couldn't find your project. Please refresh, or contact the project owner if
            this keeps happening.
          </p>
        </div>
      </div>
    )
  }

  // No tester row attached to this user. Two sub-cases:
  //   1. Admin without a self-tester-profile yet → show "Create my tester profile"
  //   2. Tester whose row got deleted / not yet linked → show "contact owner" notice
  //
  // Admin in preview-as-tester mode uses a synthetic tester object for the form
  // (handled below) and never lands here.
  if (!tester && !(isAdmin && previewAsTester)) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Report a bug</h1>
          {isAdmin ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                You don't have a tester profile yet. Create one so your own bug reports
                (and any suggestions or feedback you file) are attributed to you in the
                project.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                We'll create a row using your auth email and a default name —{' '}
                you can rename it later from the Testers admin page.
              </p>
              {profileError && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {profileError}
                </div>
              )}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user?.email) {
                      setProfileError('No email on your auth account — refresh and try again.')
                      return
                    }
                    setProfileError(null)
                    setCreatingProfile(true)
                    try {
                      const defaultName =
                        user.user_metadata?.full_name?.toString() ||
                        user.email.split('@')[0] ||
                        'Admin'
                      await createSelfTesterProfile({
                        project_id: project.id,
                        user_id: user.id,
                        email: user.email,
                        name: defaultName,
                      })
                      await refresh()
                    } catch (err) {
                      setProfileError(
                        err instanceof Error ? err.message : 'Could not create profile.',
                      )
                    } finally {
                      setCreatingProfile(false)
                    }
                  }}
                  disabled={creatingProfile}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
                >
                  {creatingProfile ? (
                    <LoadingSpinner size="sm" className="border-white" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Create my tester profile
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              We couldn't load your tester profile. Try refreshing — if it keeps
              happening, ask the project owner to check your invite.
            </p>
          )}
        </div>
      </div>
    )
  }

  // Resolve which tester object to use. Real tester for normal flow, synthetic
  // for admin-in-preview-as-tester (so the form's prefill works without crashing).
  const effectiveTester: Tester =
    tester ?? buildSyntheticTester(project.id)

  // ---------- Success / partial-success screen ----------
  if (result) {
    const { submittedIds, failed } = result
    const submittedCount = submittedIds.length
    const allFailed = submittedCount === 0 && failed.length > 0
    const anyFailed = failed.length > 0

    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <PreviewModeBanner />

        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          {allFailed ? (
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          )}

          <h1 className="text-xl font-semibold text-gray-900">
            {allFailed
              ? 'Submission failed'
              : submittedCount === 1
                ? 'Bug submitted'
                : `${submittedCount} bugs submitted`}
          </h1>

          {submittedCount > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Thanks for taking the time. We'll triage and update statuses from here.
            </p>
          )}

          {anyFailed && (
            <div className="mt-4 text-left bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                {failed.length === 1
                  ? '1 bug did not submit:'
                  : `${failed.length} bugs did not submit:`}
              </div>
              <ul className="mt-2 text-xs text-amber-900 list-disc pl-5 space-y-1">
                {failed.map((f) => (
                  <li key={f.index}>
                    <span className="font-medium">{f.title}</span>: {f.error}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800">
                You can try submitting them again — the ones that already succeeded won't
                be duplicated as long as you only re-enter the failed ones.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              <Bug className="w-4 h-4" />
              Report more bugs
            </button>
            <Link
              to={isAdmin ? '/admin/bugs' : '/bugs'}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {isAdmin ? 'Open Bug Triage' : 'View my submissions'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ---------- Form ----------
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Report a bug</h1>
        <p className="mt-1 text-sm text-gray-500">
          The more detail the better. Add as many bugs as you've got in one batch — the
          environment fields fill in once for the whole submission.
        </p>
      </div>

      <BugReportForm
        tester={effectiveTester}
        projectId={project.id}
        onSubmitted={setResult}
        disabled={previewAsTester}
      />
    </div>
  )
}

function buildSyntheticTester(projectId: string): Tester {
  return {
    id: '',
    project_id: projectId,
    user_id: null,
    name: 'Preview tester',
    email: '',
    os: null,
    os_version: null,
    helm_version: null,
    calm_mode_state: DEFAULT_CALM_MODE_STATE,
    household_profile: null,
    status: 'active',
    notes: null,
    invited_at: null,
    joined_at: null,
    created_at: new Date(0).toISOString(),
    created_by: '',
  }
}
