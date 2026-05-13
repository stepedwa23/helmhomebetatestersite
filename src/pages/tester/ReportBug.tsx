import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Bug } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import BugReportForm from '../../components/bugs/BugReportForm'

export default function ReportBug() {
  const { tester, project, rolesLoading, isAdmin } = useAuth()
  const [submittedBugId, setSubmittedBugId] = useState<string | null>(null)

  // Wait for role data — we need the tester's profile to prefill OS / calm-mode etc.
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

  // Admins seeing this page: show a preview-only notice. The form needs a tester
  // profile to attribute the bug to — admins don't have one.
  if (isAdmin || !tester) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Report a bug</h1>
          <p className="mt-2 text-sm text-gray-500">
            This page is for testers to submit bug reports. As the project owner, you
            don't have a tester profile to attribute a bug to. To preview the form, sign
            in as one of your testers (you can create a test tester from the Testers
            page).
          </p>
        </div>
      </div>
    )
  }

  if (submittedBugId) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-900">Bug submitted</h1>
          <p className="mt-2 text-sm text-gray-600">
            Thanks for taking the time. We'll review it and update the status as we
            triage.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSubmittedBugId(null)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              <Bug className="w-4 h-4" />
              Report another bug
            </button>
            <Link
              to="/my-submissions"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              View my submissions
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Report a bug</h1>
        <p className="mt-1 text-sm text-gray-500">
          The more detail the better. Steps to reproduce and screenshots are the most
          useful — but anything helps.
        </p>
      </div>

      <BugReportForm
        tester={tester}
        projectId={project.id}
        onSubmitted={setSubmittedBugId}
      />
    </div>
  )
}
