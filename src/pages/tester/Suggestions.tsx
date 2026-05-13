import { useCallback, useEffect, useState } from 'react'
import {
  Lightbulb,
  Plus,
  Pencil,
  User as UserIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import Modal from '../../components/Modal'
import PreviewModeBanner from '../../components/PreviewModeBanner'
import { SuggestionStatusBadge } from '../../components/StatusBadge'
import SuggestionForm, {
  type SuggestionFormValues,
} from '../../components/suggestions/SuggestionForm'
import {
  listSuggestionsForTesters,
  submitSuggestion,
  updateSuggestion,
} from '../../lib/suggestions'
import type { SuggestionPublic, SuggestionStatus } from '../../types'
import { SUGGESTION_STATUS_OPTIONS } from '../../types'

const STATUS_FILTER_LABEL: Record<SuggestionStatus | 'all', string> = {
  all: 'All statuses',
  new: 'New',
  under_review: 'Under review',
  planned: 'Planned',
  declined: 'Declined',
  shipped: 'Shipped',
}

export default function Suggestions() {
  const { tester, project, rolesLoading, effectiveIsAdmin } = useAuth()
  const [items, setItems] = useState<SuggestionPublic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<SuggestionPublic | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setError(null)
    try {
      const rows = await listSuggestionsForTesters(project.id)
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (rolesLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // True admin (not previewing) → redirect notice.
  if (effectiveIsAdmin || !project) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600">
            This page shows suggestions for the signed-in tester. As the project owner,
            visit{' '}
            <a href="/admin/suggestions" className="text-blue-600 hover:underline">
              Suggestions in the admin sidebar
            </a>{' '}
            to triage.
          </p>
        </div>
      </div>
    )
  }

  // From here: either a real tester or an admin in preview mode.
  // Real tester has a tester row; admin-in-preview does not.
  const interactionsDisabled = !tester

  async function handleAdd(values: SuggestionFormValues) {
    if (!tester) throw new Error('No tester profile — cannot submit.')
    await submitSuggestion({
      project_id: project!.id,
      tester_id: tester.id,
      title: values.title,
      description: values.description,
    })
    setShowAdd(false)
    await refresh()
  }

  async function handleEdit(values: SuggestionFormValues) {
    if (!editing) return
    if (!tester) throw new Error('No tester profile — cannot edit.')
    await updateSuggestion(editing.id, {
      title: values.title,
      description: values.description,
    })
    setEditing(null)
    await refresh()
  }

  const filtered =
    statusFilter === 'all'
      ? items
      : items?.filter((s) => s.status === statusFilter) ?? null

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PreviewModeBanner />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suggestions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ideas from across the tester pool. Everyone sees these — your name isn't shown
            to other testers. Submit anything you'd like to see in Helm.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={interactionsDisabled}
          title={interactionsDisabled ? 'Disabled in preview mode.' : undefined}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {interactionsDisabled ? 'Suggest (preview)' : 'Suggest something'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SuggestionStatus | 'all')}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{STATUS_FILTER_LABEL.all}</option>
            {SUGGESTION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_FILTER_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {items === null ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Lightbulb className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No suggestions yet — be the first.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Suggest something
          </button>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-600">No suggestions match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((s) => {
            const isOwn = !!tester && s.tester_id === tester.id
            const canEdit = isOwn && s.status === 'new' && !interactionsDisabled
            return (
              <article
                key={s.id}
                className={`bg-white border rounded-xl p-5 ${
                  isOwn ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                      <SuggestionStatusBadge status={s.status} />
                      {isOwn && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-full">
                          <UserIcon className="w-3 h-3" />
                          Yours
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Submitted{' '}
                      {formatDistanceToNow(new Date(s.submitted_at), { addSuffix: true })}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {s.description}
                </p>
                {isOwn && s.status !== 'new' && (
                  <div className="mt-3 text-xs text-gray-500 italic">
                    Locked for editing once moved past "new".
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* New suggestion modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Suggest something"
        description="Other testers will see your title and description. Your name stays private."
        size="lg"
      >
        <SuggestionForm
          submitLabel="Submit suggestion"
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* Edit own suggestion */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit your suggestion"
        description="Editing is only allowed while the status is 'new'."
        size="lg"
      >
        {editing && (
          <SuggestionForm
            submitLabel="Save changes"
            initial={{ title: editing.title, description: editing.description }}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

    </div>
  )
}
