import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Mail, Send } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import { sendMessage } from '../../lib/messages'

export default function Contact() {
  const { tester, project, rolesLoading, isAdmin, previewAsTester } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (rolesLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            We couldn't find your project. Please refresh, or contact the project owner
            if this keeps happening.
          </p>
        </div>
      </div>
    )
  }

  // Need a real tester row to send. Admins without a tester row (and
  // admin-previewing-as-tester with no row) can't attribute a message.
  if (!tester) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-semibold text-gray-900">Contact the team</h1>
          <p className="mt-2 text-sm text-gray-600">
            {isAdmin
              ? 'You\'re signed in as an admin without a tester profile — messages need a tester row to attribute to. Visit "Report a Bug" first to create your tester profile.'
              : "We couldn't load your tester profile. Try refreshing — if it keeps happening, ask the project owner to check your invite."}
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!subject.trim()) return setError('Please add a short subject.')
    if (!body.trim()) return setError('Please write a message.')
    setSubmitting(true)
    try {
      await sendMessage({
        project_id: project!.id,
        tester_id: tester!.id,
        subject,
        body,
      })
      setSent(true)
      setSubject('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <PreviewModeBanner />
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-900">Message sent</h1>
          <p className="mt-2 text-sm text-gray-600">
            We'll see it in our inbox and reply to {tester.email} directly. Usually
            within a day or two.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSent(false)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              <Send className="w-4 h-4" />
              Send another
            </button>
            <Link
              to="/dashboard"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PreviewModeBanner />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Contact the team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Got a question or want to chat about the beta directly? Drop a message and
          we'll reply to {tester.email}. For specific bugs, use the bug report form so
          things stay organized.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
      >
        <div>
          <label
            htmlFor="msg-subject"
            className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
          >
            Subject
          </label>
          <input
            id="msg-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Quick question about the next test cycle"
            disabled={submitting || previewAsTester}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        <div>
          <label
            htmlFor="msg-body"
            className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
          >
            Message
          </label>
          <textarea
            id="msg-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write whatever's on your mind — context, questions, scheduling, feedback that doesn't fit a form."
            disabled={submitting || previewAsTester}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 resize-y"
          />
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || previewAsTester}
            title={
              previewAsTester
                ? 'Disabled in preview mode — would send a real message.'
                : undefined
            }
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
          >
            {submitting ? (
              <LoadingSpinner size="sm" className="border-white" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {previewAsTester ? 'Send disabled (preview)' : 'Send message'}
          </button>
        </div>
      </form>
    </div>
  )
}
