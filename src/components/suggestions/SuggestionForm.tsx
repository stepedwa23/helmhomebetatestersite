import { useState, type FormEvent } from 'react'
import LoadingSpinner from '../LoadingSpinner'

export interface SuggestionFormValues {
  title: string
  description: string
}

const EMPTY_VALUES: SuggestionFormValues = {
  title: '',
  description: '',
}

interface SuggestionFormProps {
  initial?: Partial<SuggestionFormValues>
  submitLabel: string
  onSubmit: (values: SuggestionFormValues) => Promise<void>
  onCancel: () => void
}

export default function SuggestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: SuggestionFormProps) {
  const [values, setValues] = useState<SuggestionFormValues>({ ...EMPTY_VALUES, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SuggestionFormValues>(key: K, v: SuggestionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.title.trim()) return setError('Title is required.')
    if (!values.description.trim()) return setError('Please describe the suggestion.')

    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save suggestion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title" htmlFor="s-title" hint="Short and specific. Other testers see this.">
        <input
          id="s-title"
          type="text"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Bulk-skip overdue chores"
          className={inputClass}
          autoFocus
          required
        />
      </Field>

      <Field
        label="Description"
        htmlFor="s-desc"
        hint="What would you like to see, and how would it help? Other testers can read this too."
      >
        <textarea
          id="s-desc"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          rows={6}
          placeholder="Describe the suggestion. The more concrete, the easier it is to act on."
          className={`${inputClass} resize-y`}
          required
        />
      </Field>

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
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
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
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
