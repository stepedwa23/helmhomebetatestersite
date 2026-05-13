import { useState, type FormEvent } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import {
  OS_OPTIONS,
  HOUSEHOLD_PROFILE_OPTIONS,
  type OS,
  type HouseholdProfile,
} from '../../types'

export interface TesterFormValues {
  name: string
  email: string
  os: OS | ''
  os_version: string
  helm_version: string
  household_profile: HouseholdProfile | ''
  notes: string
}

const EMPTY_VALUES: TesterFormValues = {
  name: '',
  email: '',
  os: '',
  os_version: '',
  helm_version: '',
  household_profile: '',
  notes: '',
}

interface TesterFormProps {
  initial?: Partial<TesterFormValues>
  submitLabel: string
  onSubmit: (values: TesterFormValues) => Promise<void>
  onCancel: () => void
}

const OS_LABEL: Record<OS, string> = {
  macos: 'macOS',
  windows: 'Windows',
}

const HOUSEHOLD_LABEL: Record<HouseholdProfile, string> = {
  small_apartment: 'Small apartment',
  medium_home: 'Medium home',
  large_home: 'Large home',
  other: 'Other',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function TesterForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: TesterFormProps) {
  const [values, setValues] = useState<TesterFormValues>({
    ...EMPTY_VALUES,
    ...initial,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof TesterFormValues>(key: K, value: TesterFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!values.name.trim()) return setError('Name is required.')
    if (!EMAIL_RE.test(values.email.trim())) return setError('Enter a valid email address.')

    setBusy(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tester.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name" htmlFor="t-name">
        <input
          id="t-name"
          type="text"
          autoFocus
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputClass}
          required
        />
      </Field>

      <Field label="Email" htmlFor="t-email">
        <input
          id="t-email"
          type="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          className={inputClass}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="OS" htmlFor="t-os">
          <select
            id="t-os"
            value={values.os}
            onChange={(e) => set('os', e.target.value as OS | '')}
            className={inputClass}
          >
            <option value="">—</option>
            {OS_OPTIONS.map((os) => (
              <option key={os} value={os}>
                {OS_LABEL[os]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="OS version" htmlFor="t-osv">
          <input
            id="t-osv"
            type="text"
            value={values.os_version}
            onChange={(e) => set('os_version', e.target.value)}
            placeholder="e.g. 15.2"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Helm version" htmlFor="t-hv">
          <input
            id="t-hv"
            type="text"
            value={values.helm_version}
            onChange={(e) => set('helm_version', e.target.value)}
            placeholder="e.g. 0.3.0"
            className={inputClass}
          />
        </Field>

        <Field label="Household" htmlFor="t-hh">
          <select
            id="t-hh"
            value={values.household_profile}
            onChange={(e) => set('household_profile', e.target.value as HouseholdProfile | '')}
            className={inputClass}
          >
            <option value="">—</option>
            {HOUSEHOLD_PROFILE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {HOUSEHOLD_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="t-notes">
        <textarea
          id="t-notes"
          rows={3}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputClass + ' resize-y'}
          placeholder="Anything useful: relationship, time zone, special interest in a feature, etc."
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
