import type { ReactNode } from 'react'

export type BadgeTone =
  | 'gray'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'purple'

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
  green: 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-200',
  amber: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
  red: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
  blue: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
  purple: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

export default function Badge({ tone = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

// ---------- Status-specific helpers ----------

import type { TesterStatus, BugSeverity, BugStatus, SuggestionStatus } from '../types'

const TESTER_STATUS_TONE: Record<TesterStatus, BadgeTone> = {
  invited: 'amber',
  active: 'green',
  inactive: 'gray',
}

const TESTER_STATUS_LABEL: Record<TesterStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  inactive: 'Inactive',
}

export function TesterStatusBadge({ status }: { status: TesterStatus }) {
  return <Badge tone={TESTER_STATUS_TONE[status]}>{TESTER_STATUS_LABEL[status]}</Badge>
}

const BUG_SEVERITY_TONE: Record<BugSeverity, BadgeTone> = {
  low: 'gray',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
}

export function BugSeverityBadge({ severity }: { severity: BugSeverity }) {
  return (
    <Badge tone={BUG_SEVERITY_TONE[severity]}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  )
}

const BUG_STATUS_TONE: Record<BugStatus, BadgeTone> = {
  open: 'red',
  in_progress: 'amber',
  resolved: 'green',
  closed: 'gray',
}

const BUG_STATUS_LABEL: Record<BugStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function BugStatusBadge({ status }: { status: BugStatus }) {
  return <Badge tone={BUG_STATUS_TONE[status]}>{BUG_STATUS_LABEL[status]}</Badge>
}

const SUGGESTION_STATUS_TONE: Record<SuggestionStatus, BadgeTone> = {
  new: 'blue',
  under_review: 'amber',
  planned: 'purple',
  declined: 'gray',
  shipped: 'green',
}

const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'New',
  under_review: 'Under review',
  planned: 'Planned',
  declined: 'Declined',
  shipped: 'Shipped',
}

export function SuggestionStatusBadge({ status }: { status: SuggestionStatus }) {
  return <Badge tone={SUGGESTION_STATUS_TONE[status]}>{SUGGESTION_STATUS_LABEL[status]}</Badge>
}
