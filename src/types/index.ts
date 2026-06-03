// =====================================================================
// Shared types and constants for the Helm Beta Tester Site.
// All entity rows mirror the Supabase schema 1:1 (see supabase/schema.sql).
// =====================================================================

// ---------- Enums (kept in sync with Postgres ENUMs / CHECK constraints) ----------

export const OS_OPTIONS = ['macos', 'windows'] as const
export type OS = (typeof OS_OPTIONS)[number]

export const HOUSEHOLD_PROFILE_OPTIONS = [
  'small_apartment',
  'medium_home',
  'large_home',
  'other',
] as const
export type HouseholdProfile = (typeof HOUSEHOLD_PROFILE_OPTIONS)[number]

export const TESTER_STATUS_OPTIONS = ['invited', 'active', 'inactive'] as const
export type TesterStatus = (typeof TESTER_STATUS_OPTIONS)[number]

export const CYCLE_STATUS_OPTIONS = ['planned', 'active', 'completed'] as const
export type CycleStatus = (typeof CYCLE_STATUS_OPTIONS)[number]

export const BUG_SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const
export type BugSeverity = (typeof BUG_SEVERITY_OPTIONS)[number]

export const BUG_CATEGORY_OPTIONS = [
  'crashes_install',
  'scheduling',
  'ui_visual',
  'notifications',
  'performance',
  'onboarding',
  'accessibility',
  'other',
] as const
export type BugCategory = (typeof BUG_CATEGORY_OPTIONS)[number]

export const BUG_CATEGORY_LABEL: Record<BugCategory, string> = {
  crashes_install: 'Crashes / Install',
  scheduling: 'Scheduling',
  ui_visual: 'UI / Visual',
  notifications: 'Notifications',
  performance: 'Performance',
  onboarding: 'Onboarding',
  accessibility: 'Accessibility',
  other: 'Other',
}

export const BUG_STATUS_OPTIONS = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const
export type BugStatus = (typeof BUG_STATUS_OPTIONS)[number]

export const SUGGESTION_STATUS_OPTIONS = [
  'new',
  'under_review',
  'planned',
  'declined',
  'shipped',
] as const
export type SuggestionStatus = (typeof SUGGESTION_STATUS_OPTIONS)[number]

export const NOTICE_SEVERITY_OPTIONS = ['info', 'warning', 'critical'] as const
export type NoticeSeverity = (typeof NOTICE_SEVERITY_OPTIONS)[number]

export const NOTICE_SEVERITY_LABEL: Record<NoticeSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}

export const ROADMAP_STATUS_OPTIONS = ['planned', 'in_progress', 'shipped'] as const
export type RoadmapStatus = (typeof ROADMAP_STATUS_OPTIONS)[number]

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
}

export const TESTER_MESSAGE_STATUS_OPTIONS = ['new', 'replied', 'archived'] as const
export type TesterMessageStatus = (typeof TESTER_MESSAGE_STATUS_OPTIONS)[number]

export const TESTER_MESSAGE_STATUS_LABEL: Record<TesterMessageStatus, string> = {
  new: 'New',
  replied: 'Replied',
  archived: 'Archived',
}

export const APP_PLATFORM_OPTIONS = [
  'macos_arm64',
  'macos_x64',
  'windows_x64',
  'windows_arm64',
] as const
export type AppPlatform = (typeof APP_PLATFORM_OPTIONS)[number]

export const APP_PLATFORM_LABEL: Record<AppPlatform, string> = {
  macos_arm64: 'macOS (Apple Silicon)',
  macos_x64: 'macOS (Intel)',
  windows_x64: 'Windows (x64)',
  windows_arm64: 'Windows (ARM64)',
}

/**
 * Active platforms we ship Helm for. Locked from the spec at scaffold time —
 * tester dashboard renders a slot for each. To add macOS Intel later, just
 * append `'macos_x64'` here; the enum + schema already support it.
 */
export const ACTIVE_PLATFORMS: AppPlatform[] = [
  'macos_arm64',
  'windows_x64',
  'windows_arm64',
]

// ---------- Reusable shapes ----------

export interface CalmModeState {
  focus_mode: boolean
  reduce_motion: boolean
  auto_skip: boolean
  theme: string // e.g. "default" | "warm-low-contrast" | "cool-low-contrast"
}

export const DEFAULT_CALM_MODE_STATE: CalmModeState = {
  focus_mode: false,
  reduce_motion: false,
  auto_skip: false,
  theme: 'default',
}

// TipTap stores documents as a structured JSON tree. We don't constrain
// the shape here — TipTap's own types do that at the editor boundary.
export type TipTapDoc = Record<string, unknown> | null

// ---------- Entity row types ----------

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  created_at: string
}

export interface Tester {
  id: string
  project_id: string
  user_id: string | null
  name: string
  email: string
  os: OS | null
  os_version: string | null
  helm_version: string | null
  calm_mode_state: CalmModeState
  household_profile: HouseholdProfile | null
  status: TesterStatus
  notes: string | null
  invited_at: string | null
  joined_at: string | null
  created_at: string
  created_by: string
}

export interface TestCycle {
  id: string
  project_id: string
  name: string
  build_version: string | null
  start_date: string | null
  end_date: string | null
  status: CycleStatus
  notes: string | null
  created_at: string
  created_by: string
}

export interface CycleTester {
  cycle_id: string
  tester_id: string
  assigned_at: string
}

// Admin view of a bug — includes triage_notes.
export interface BugReport {
  id: string
  project_id: string
  cycle_id: string | null
  tester_id: string
  title: string
  description: string
  steps_to_reproduce: string | null
  severity: BugSeverity
  category: BugCategory
  status: BugStatus
  helm_version: string | null
  os: OS | null
  os_version: string | null
  calm_mode_state: CalmModeState
  triage_notes: string | null
  submitted_at: string
  resolved_at: string | null
}

// Tester-facing view — same shape minus triage_notes (DB view excludes it).
export type BugReportPublic = Omit<BugReport, 'triage_notes'>

export interface BugAttachment {
  id: string
  bug_id: string
  storage_path: string
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
}

export interface BugComment {
  id: string
  bug_id: string
  /** Null for admin-authored comments (admin doesn't have a tester row). */
  tester_id: string | null
  author_user_id: string
  body: string
  created_at: string
  updated_at: string
}

export interface Feedback {
  id: string
  project_id: string
  cycle_id: string | null
  tester_id: string
  rating: number // 1..5
  comments: string | null
  submitted_at: string
}

export interface AppVersion {
  id: string
  project_id: string
  version: string
  release_date: string | null
  patch_notes: TipTapDoc
  is_current: boolean
  created_at: string
  created_by: string
}

export interface AppDownload {
  id: string
  version_id: string
  platform: AppPlatform
  filename: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  uploaded_at: string
  uploaded_by: string
}

export interface HelpArticle {
  id: string
  project_id: string
  title: string
  slug: string
  body: TipTapDoc
  category: string | null
  is_pinned: boolean
  order_index: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface Notice {
  id: string
  project_id: string
  body: string
  severity: NoticeSeverity
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
}

export interface RoadmapItem {
  id: string
  project_id: string
  title: string
  /**
   * TipTap JSON document. Stored as jsonb. Null = no description. Pre-006
   * rows are migrated to a single-paragraph TipTap doc preserving the text.
   */
  description: TipTapDoc
  status: RoadmapStatus
  sort_order: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface TesterMessage {
  id: string
  project_id: string
  tester_id: string
  subject: string
  body: string
  status: TesterMessageStatus
  created_at: string
  updated_at: string
  replied_at: string | null
}

// Admin view — includes admin_notes.
export interface Suggestion {
  id: string
  project_id: string
  tester_id: string
  title: string
  description: string
  status: SuggestionStatus
  admin_notes: string | null
  submitted_at: string
}

// Tester-facing view (suggestions are project-public to testers, but admin_notes is hidden).
export type SuggestionPublic = Omit<Suggestion, 'admin_notes'>

// ---------- Auth helpers ----------

export interface AppUserContext {
  // The current tester record for the signed-in user (null if admin or unmatched).
  tester: Tester | null
  // True if the signed-in user is the project owner for the active project.
  isAdmin: boolean
  // The active project (single-project UI in v1).
  project: Project | null
}
