import { useState, type FormEvent } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import TipTapEditor from '../editor/TipTapEditor'
import type { TipTapDoc } from '../../types'

export interface VersionFormValues {
  version: string
  release_date: string
  patch_notes: TipTapDoc
  is_current: boolean
}

const EMPTY_VALUES: VersionFormValues = {
  version: '',
  release_date: '',
  patch_notes: null,
  is_current: false,
}

interface VersionFormProps {
  initial?: Partial<VersionFormValues>
  submitLabel: string
  onSubmit: (values: VersionFormValues) => Promise<void>
  onCancel: () => void
  /** When editing, whether this row is currently the "current" beta — affects help text. */
  currentlyMarkedCurrent?: boolean
}

export default function VersionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  currentlyMarkedCurrent = false,
}: VersionFormProps) {
  const [values, setValues] = useState<VersionFormValues>({ ...EMPTY_VALUES, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof VersionFormValues>(key: K, v: VersionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.version.trim()) return setError('Version is required.')

    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save version.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Version" htmlFor="v-version">
          <input
            id="v-version"
            type="text"
            value={values.version}
            onChange={(e) => set('version', e.target.value)}
            placeholder="e.g. 0.3.0"
            className={inputClass}
            autoFocus
            required
          />
        </Field>
        <Field label="Release date" htmlFor="v-date">
          <input
            id="v-date"
            type="date"
            value={values.release_date}
            onChange={(e) => set('release_date', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Patch notes" htmlFor="v-notes">
        <TipTapEditor
          initial={values.patch_notes}
          onChange={(doc) => set('patch_notes', doc)}
          placeholder="What changed? Use headings, lists, and bold to make this easy to skim."
        />
      </Field>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={values.is_current}
          onChange={(e) => set('is_current', e.target.checked)}
          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">
            This is the current beta version
          </span>
          <span className="block text-xs text-gray-500">
            {currentlyMarkedCurrent
              ? 'Already marked current. Unchecking will leave testers with no current version banner until you mark another.'
              : 'Marking this current will automatically unmark any previous current version. The tester dashboard shows whatever is marked current.'}
          </span>
        </span>
      </label>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
        >
          {busy && <LoadingSpinner size="sm" className="border-white" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

// ---------- helpers ----------

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
