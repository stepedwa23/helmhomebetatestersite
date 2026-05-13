import { useState, type FormEvent } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import { CYCLE_STATUS_OPTIONS, type CycleStatus } from '../../types'

export interface CycleFormValues {
  name: string
  build_version: string
  start_date: string
  end_date: string
  status: CycleStatus
  notes: string
}

const EMPTY_VALUES: CycleFormValues = {
  name: '',
  build_version: '',
  start_date: '',
  end_date: '',
  status: 'planned',
  notes: '',
}

interface CycleFormProps {
  initial?: Partial<CycleFormValues>
  submitLabel: string
  onSubmit: (values: CycleFormValues) => Promise<void>
  onCancel: () => void
}

const STATUS_LABEL: Record<CycleStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
}

export default function CycleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: CycleFormProps) {
  const [values, setValues] = useState<CycleFormValues>({ ...EMPTY_VALUES, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof CycleFormValues>(key: K, value: CycleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!values.name.trim()) return setError('Name is required.')
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      return setError('End date must be on or after the start date.')
    }

    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save cycle.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name" htmlFor="c-name">
        <input
          id="c-name"
          type="text"
          autoFocus
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputClass}
          placeholder="e.g. v0.3.0 calm-mode batch"
          required
        />
      </Field>

      <Field label="Build version" htmlFor="c-bv">
        <input
          id="c-bv"
          type="text"
          value={values.build_version}
          onChange={(e) => set('build_version', e.target.value)}
          className={inputClass}
          placeholder="e.g. 0.3.0"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" htmlFor="c-start">
          <input
            id="c-start"
            type="date"
            value={values.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End date" htmlFor="c-end">
          <input
            id="c-end"
            type="date"
            value={values.end_date}
            onChange={(e) => set('end_date', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Status" htmlFor="c-status">
        <select
          id="c-status"
          value={values.status}
          onChange={(e) => set('status', e.target.value as CycleStatus)}
          className={inputClass}
        >
          {CYCLE_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes" htmlFor="c-notes">
        <textarea
          id="c-notes"
          rows={3}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputClass + ' resize-y'}
          placeholder="Anything testers should know about this cycle — focus areas, known issues, etc."
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

// ---------- Helpers ----------

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
