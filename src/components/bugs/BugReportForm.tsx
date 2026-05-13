import { useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
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
  /** Called with the result summary after a submit attempt. */
  onSubmitted: (result: SubmitResult) => void
  /** When true, the submit button is disabled (e.g. admin preview mode). */
  disabled?: boolean
}

export interface SubmitResult {
  submittedIds: string[]
  failed: Array<{ index: number; title: string; error: string }>
}

interface BugEntryDraft {
  /** Stable local id so React keys + remove operations work cleanly. */
  id: string
  title: string
  category: BugCategory | ''
  severity: BugSeverity | ''
  description: string
  steps: string
  files: File[]
}

function blankEntry(): BugEntryDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    category: '',
    severity: '',
    description: '',
    steps: '',
    files: [],
  }
}

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

const STEPS_PLACEHOLDER = '1. Open Helm\n2. ...\n3. Bug occurs'

export default function BugReportForm({
  tester,
  projectId,
  onSubmitted,
  disabled = false,
}: BugReportFormProps) {
  // ---------- Per-entry state ----------
  const [entries, setEntries] = useState<BugEntryDraft[]>([blankEntry()])

  // ---------- Shared environment (filled once per batch) ----------
  const [helmVersion, setHelmVersion] = useState(tester.helm_version ?? '')
  const [os, setOs] = useState<OS | ''>(tester.os ?? '')
  const [osVersion, setOsVersion] = useState(tester.os_version ?? '')
  const [calmMode, setCalmMode] = useState<CalmModeState>(
    tester.calm_mode_state ?? DEFAULT_CALM_MODE_STATE,
  )

  // ---------- Cycle ----------
  const [cycles, setCycles] = useState<TestCycle[]>([])
  const [cycleId, setCycleId] = useState<string>('')

  // ---------- Submit state ----------
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        console.warn('[BugReportForm] Failed to load cycles', err)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  function addEntry() {
    setEntries((prev) => [...prev, blankEntry()])
  }

  function removeEntry(id: string) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)))
  }

  function updateEntry(id: string, patch: Partial<BugEntryDraft>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Per-entry validation. We fail fast on the first invalid entry so the
    // user sees a single clear message rather than a wall of errors.
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const label = `Bug #${i + 1}`
      if (!entry.title.trim()) return setError(`${label}: please give it a short title.`)
      if (!entry.category) return setError(`${label}: please choose a category.`)
      if (!entry.severity) return setError(`${label}: please choose a severity.`)
      if (!entry.description.trim())
        return setError(`${label}: please describe what happened.`)
    }

    setSubmitting(true)
    const submittedIds: string[] = []
    const failed: SubmitResult['failed'] = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        const bug = await submitBug({
          project_id: projectId,
          tester_id: tester.id,
          cycle_id: cycleId || null,
          title: entry.title.trim(),
          description: entry.description.trim(),
          steps_to_reproduce: entry.steps.trim() || null,
          severity: entry.severity as BugSeverity,
          category: entry.category as BugCategory,
          helm_version: helmVersion.trim() || null,
          os: os || null,
          os_version: osVersion.trim() || null,
          calm_mode_state: calmMode,
        })

        // Per-bug attachments. We log but don't roll back the bug if an
        // attachment fails — partial submissions are still useful.
        for (const file of entry.files) {
          try {
            await uploadBugAttachment(bug.id, file)
          } catch (err) {
            console.error(`[BugReportForm] Attachment failed on bug ${bug.id}`, err)
          }
        }

        submittedIds.push(bug.id)
      } catch (err) {
        failed.push({
          index: i + 1,
          title: entry.title || `Bug #${i + 1}`,
          error: err instanceof Error ? err.message : 'Submission failed',
        })
      }
    }

    setSubmitting(false)
    onSubmitted({ submittedIds, failed })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bug entries — repeatable */}
      <div className="space-y-4">
        {entries.map((entry, idx) => (
          <BugEntryCard
            key={entry.id}
            entry={entry}
            index={idx}
            canRemove={entries.length > 1}
            disabled={submitting}
            onChange={(patch) => updateEntry(entry.id, patch)}
            onRemove={() => removeEntry(entry.id)}
          />
        ))}

        <button
          type="button"
          onClick={addEntry}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-300 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add another bug
        </button>
      </div>

      {/* Shared environment */}
      <Section
        title="Your setup at the time"
        description="Filled once for the whole batch. Pre-filled from your tester profile — edit if anything was different when these bugs happened."
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

        <fieldset className="mt-4 border border-gray-200 rounded-lg p-4">
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
            <div>
              <label
                htmlFor="bug-theme"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
              >
                Theme
              </label>
              <input
                id="bug-theme"
                type="text"
                value={calmMode.theme}
                onChange={(e) => setCalmMode({ ...calmMode, theme: e.target.value })}
                placeholder="default"
                className={inputClass}
              />
            </div>
          </div>
        </fieldset>
      </Section>

      {/* Shared cycle */}
      {cycles.length > 0 && (
        <Section
          title="Which test cycle?"
          description="Optional — applies to all bugs in this batch."
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
          disabled={submitting || disabled}
          title={disabled ? 'Disabled in preview mode — no tester row to attribute to.' : undefined}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-lg flex items-center gap-2"
        >
          {submitting && <LoadingSpinner size="sm" className="border-white" />}
          {disabled
            ? 'Submit disabled (preview)'
            : entries.length === 1
              ? 'Submit bug report'
              : `Submit ${entries.length} bug reports`}
        </button>
      </div>
    </form>
  )
}

// ---------- Per-entry card ----------

interface BugEntryCardProps {
  entry: BugEntryDraft
  index: number
  canRemove: boolean
  disabled: boolean
  onChange: (patch: Partial<BugEntryDraft>) => void
  onRemove: () => void
}

function BugEntryCard({
  entry,
  index,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: BugEntryCardProps) {
  const idPrefix = `bug-${entry.id}`

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <header className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Bug #{index + 1}
          </span>
          <h2 className="text-sm font-semibold text-gray-900">What happened?</h2>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove Bug #${index + 1}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded px-2 py-1 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </header>

      <div className="p-5 space-y-3">
        <Field label="Short title" htmlFor={`${idPrefix}-title`}>
          <input
            id={`${idPrefix}-title`}
            type="text"
            value={entry.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Chore wizard crashes when I pick laundry"
            className={inputClass}
            autoFocus={index === 0}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" htmlFor={`${idPrefix}-cat`}>
            <select
              id={`${idPrefix}-cat`}
              value={entry.category}
              onChange={(e) => onChange({ category: e.target.value as BugCategory | '' })}
              className={inputClass}
            >
              <option value="">Select…</option>
              {BUG_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {BUG_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Severity" htmlFor={`${idPrefix}-sev`}>
            <select
              id={`${idPrefix}-sev`}
              value={entry.severity}
              onChange={(e) => onChange({ severity: e.target.value as BugSeverity | '' })}
              className={inputClass}
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
          htmlFor={`${idPrefix}-desc`}
          hint="What happened, where in the app, what you expected vs. what actually happened."
        >
          <textarea
            id={`${idPrefix}-desc`}
            value={entry.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={DESCRIPTION_PLACEHOLDER}
            rows={5}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Field
          label="Steps to reproduce"
          htmlFor={`${idPrefix}-steps`}
          hint="Optional but very helpful — what should we do to see it ourselves?"
        >
          <textarea
            id={`${idPrefix}-steps`}
            value={entry.steps}
            onChange={(e) => onChange({ steps: e.target.value })}
            placeholder={STEPS_PLACEHOLDER}
            rows={4}
            className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
          />
        </Field>

        <Field
          label="Screenshots"
          htmlFor={`${idPrefix}-files`}
          hint="Drag in up to 5 screenshots, 5 MB each. PNG, JPEG, WebP, or GIF."
        >
          <AttachmentUploader
            files={entry.files}
            onChange={(files) => onChange({ files })}
            disabled={disabled}
          />
        </Field>
      </div>
    </section>
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

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <header className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
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
