import { useEffect, useState, type FormEvent } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import AttachmentUploader from './AttachmentUploader'
import { submitBug } from '../../lib/bugs'
import { uploadBugAttachment } from '../../lib/attachments'
import { listCycles } from '../../lib/cycles'
import {
  BUG_CATEGORY_OPTIONS,
  BUG_CATEGORY_LABEL,
  BUG_SEVERITY_OPTIONS,
  OS_OPTIONS,
  DEFAULT_CALM_MODE_STATE,
  type BugCategory,
  type BugSeverity,
  type CalmModeState,
  type OS,
  type Tester,
  type TestCycle,
} from '../../types'

interface BugReportFormProps {
  tester: Tester
  projectId: string
  onSubmitted: (bugId: string) => void
}

// Descriptive severity labels match Stephen's old HTML form — tester-friendly,
// not abstract. Stored as our 4-level enum.
const SEVERITY_LABEL: Record<BugSeverity, string> = {
  critical: 'Critical — crashes the app or causes data loss',
  high: 'High — blocks me from using a key feature',
  medium: 'Medium — annoying but workable',
  low: 'Low — minor cosmetic / cleanup',
}

const OS_LABEL: Record<OS, string> = {
  macos: 'macOS',
  windows: 'Windows',
}

const DESCRIPTION_PLACEHOLDER =
  'What happened, where in the app, what you expected to happen, and what actually happened. Include anything else that might help us reproduce or understand the bug.'

const STEPS_PLACEHOLDER =
  '1. Open Helm\n2. ...\n3. Bug occurs'

export default function BugReportForm({
  tester,
  projectId,
  onSubmitted,
}: BugReportFormProps) {
  // Core fields
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<BugCategory | ''>('')
  const [severity, setSeverity] = useState<BugSeverity | ''>('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')

  // Context — pre-filled from tester profile, editable.
  const [helmVersion, setHelmVersion] = useState(tester.helm_version ?? '')
  const [os, setOs] = useState<OS | ''>(tester.os ?? '')
  const [osVersion, setOsVersion] = useState(tester.os_version ?? '')
  const [calmMode, setCalmMode] = useState<CalmModeState>(
    tester.calm_mode_state ?? DEFAULT_CALM_MODE_STATE,
  )

  // Cycle
  const [cycles, setCycles] = useState<TestCycle[]>([])
  const [cycleId, setCycleId] = useState<string>('')

  // Attachments
  const [files, setFiles] = useState<File[]>([])

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load active cycles for the dropdown. Auto-select if there's exactly one active.
  useEffect(() => {
    let cancelled = false
    listCycles(projectId)
      .then((rows) => {
        if (cancelled) return
        const active = rows.filter((c) => c.status === 'active')
        const candidates = active.length > 0 ? active : rows
        setCycles(candidates)
        if (active.length === 1) setCycleId(active[0].id)
      })
      .catch((err) => {
        // Non-fatal — cycle is optional. Log but don't block the form.
        console.warn('[BugReportForm] Failed to load cycles', err)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Please give the bug a short title.')
    if (!category) return setError('Please choose a category.')
    if (!severity) return setError('Please choose a severity.')
    if (!description.trim()) return setError('Please describe what happened.')

    setSubmitting(true)
    try {
      const bug = await submitBug({
        project_id: projectId,
        tester_id: tester.id,
        cycle_id: cycleId || null,
        title: title.trim(),
        description: description.trim(),
        steps_to_reproduce: steps.trim() || null,
        severity,
        category,
        helm_version: helmVersion.trim() || null,
        os: os || null,
        os_version: osVersion.trim() || null,
        calm_mode_state: calmMode,
      })

      // Upload attachments sequentially after the row exists. Each failure is
      // surfaced but doesn't roll back the bug — the report is still useful
      // without screenshots, and the admin can ask the tester to re-upload.
      const attachmentErrors: string[] = []
      for (const file of files) {
        try {
          await uploadBugAttachment(bug.id, file)
        } catch (err) {
          attachmentErrors.push(
            `${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`,
          )
        }
      }

      if (attachmentErrors.length > 0) {
        // Bug submitted, but some attachments failed. Surface this and still
        // call onSubmitted so the user sees the success state for the report.
        console.error('[BugReportForm] Attachment errors', attachmentErrors)
      }

      onSubmitted(bug.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the bug report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1 — What happened */}
      <Section title="What happened?" number={1}>
        <Field label="Short title" htmlFor="bug-title">
          <input
            id="bug-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chore wizard crashes when I pick laundry"
            className={inputClass}
            autoFocus
            required
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" htmlFor="bug-cat">
            <select
              id="bug-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as BugCategory | '')}
              className={inputClass}
              required
            >
              <option value="">Select…</option>
              {BUG_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {BUG_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Severity" htmlFor="bug-sev">
            <select
              id="bug-sev"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as BugSeverity | '')}
              className={inputClass}
              required
            >
              <option value="">Select…</option>
              {BUG_SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="bug-desc"
          hint="What happened, where in the app, what you expected vs. what actually happened."
        >
          <textarea
            id="bug-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={DESCRIPTION_PLACEHOLDER}
            rows={5}
            className={`${inputClass} resize-y`}
            required
          />
        </Field>

        <Field
          label="Steps to reproduce"
          htmlFor="bug-steps"
          hint="Optional but very helpful — what should we do to see it ourselves?"
        >
          <textarea
            id="bug-steps"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={STEPS_PLACEHOLDER}
            rows={4}
            className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
          />
        </Field>
      </Section>

      {/* Section 2 — Environment */}
      <Section
        title="Your setup at the time"
        number={2}
        description="Pre-filled from your tester profile. Edit if anything was different when the bug happened."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Helm version" htmlFor="bug-hv">
            <input
              id="bug-hv"
              type="text"
              value={helmVersion}
              onChange={(e) => setHelmVersion(e.target.value)}
              placeholder="e.g. 0.3.0"
              className={inputClass}
            />
          </Field>

          <Field label="OS" htmlFor="bug-os">
            <select
              id="bug-os"
              value={os}
              onChange={(e) => setOs(e.target.value as OS | '')}
              className={inputClass}
            >
              <option value="">—</option>
              {OS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {OS_LABEL[o]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="OS version" htmlFor="bug-osv">
            <input
              id="bug-osv"
              type="text"
              value={osVersion}
              onChange={(e) => setOsVersion(e.target.value)}
              placeholder="e.g. 14 Sonoma"
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Calm-mode toggles
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
            <CalmToggle
              label="Focus mode"
              checked={calmMode.focus_mode}
              onChange={(v) => setCalmMode({ ...calmMode, focus_mode: v })}
            />
            <CalmToggle
              label="Reduce motion"
              checked={calmMode.reduce_motion}
              onChange={(v) => setCalmMode({ ...calmMode, reduce_motion: v })}
            />
            <CalmToggle
              label="Auto-skip stale"
              checked={calmMode.auto_skip}
              onChange={(v) => setCalmMode({ ...calmMode, auto_skip: v })}
            />
            <Field label="Theme" htmlFor="bug-theme" compact>
              <input
                id="bug-theme"
                type="text"
                value={calmMode.theme}
                onChange={(e) => setCalmMode({ ...calmMode, theme: e.target.value })}
                placeholder="default"
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>
      </Section>

      {/* Section 3 — Cycle (optional) */}
      {cycles.length > 0 && (
        <Section
          title="Which test cycle?"
          number={3}
          description="Optional — link this bug to a specific testing round."
        >
          <Field label="Cycle" htmlFor="bug-cycle">
            <select
              id="bug-cycle"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Not tied to a cycle —</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.build_version ? ` (build ${c.build_version})` : ''}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {/* Section 4 — Screenshots */}
      <Section
        title="Screenshots"
        number={cycles.length > 0 ? 4 : 3}
        description="Drag in up to 5 screenshots, 5 MB each. PNG, JPEG, WebP, or GIF."
      >
        <AttachmentUploader files={files} onChange={setFiles} disabled={submitting} />
      </Section>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
        >
          {submitting && <LoadingSpinner size="sm" className="border-white" />}
          Submit bug report
        </button>
      </div>
    </form>
  )
}

// ---------- Helpers / sub-components ----------

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({
  label,
  htmlFor,
  hint,
  compact = false,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={compact ? '' : 'mb-3 last:mb-0'}>
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

function Section({
  title,
  number,
  description,
  children,
}: {
  title: string
  number: number
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <header className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Step {number}
          </span>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function CalmToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
