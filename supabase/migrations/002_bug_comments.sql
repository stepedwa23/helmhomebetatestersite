-- =====================================================================
-- Migration 002 — bug_comments + tester bug visibility
--
-- Two related changes:
--   1. Add bug_comments table for cross-tester discussion ("I can repro on
--      Windows", "doesn't happen for me on macOS 14", etc.) plus admin replies.
--   2. Switch tester bug visibility from "own only" to "all bugs in project".
--      The tester-facing view bug_reports_public already excludes triage_notes,
--      so admin-private triage stays hidden.
--
-- Run in the Supabase SQL editor AFTER schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- bug_comments table
-- ---------------------------------------------------------------------

create table if not exists bug_comments (
  id              uuid primary key default gen_random_uuid(),
  bug_id          uuid not null references bug_reports(id) on delete cascade,
  -- tester_id is nullable: null when the author is the project admin (who
  -- doesn't have a testers row). Set to the author's testers row when posted
  -- by a tester. Makes join-on-display simple.
  tester_id       uuid references testers(id) on delete set null,
  author_user_id  uuid not null references auth.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bug_comments_bug_idx
  on bug_comments(bug_id, created_at);

drop trigger if exists bug_comments_set_updated_at on bug_comments;
create trigger bug_comments_set_updated_at
  before update on bug_comments
  for each row
  execute function set_updated_at();

alter table bug_comments enable row level security;

-- ---------------------------------------------------------------------
-- bug_comments RLS
-- ---------------------------------------------------------------------

-- Admin: full access to comments on bugs in their projects.
drop policy if exists bug_comments_admin_all on bug_comments;
create policy bug_comments_admin_all on bug_comments
  for all
  using (
    exists (
      select 1 from bug_reports b
      where b.id = bug_comments.bug_id
        and is_project_admin(b.project_id)
    )
  )
  with check (
    exists (
      select 1 from bug_reports b
      where b.id = bug_comments.bug_id
        and is_project_admin(b.project_id)
    )
  );

-- Tester SELECT: any comment on any bug in their project.
drop policy if exists bug_comments_tester_select on bug_comments;
create policy bug_comments_tester_select on bug_comments
  for select
  using (
    exists (
      select 1 from bug_reports b
      where b.id = bug_comments.bug_id
        and current_tester_in(b.project_id) is not null
    )
  );

-- Tester INSERT: must use their own auth uid AND their own tester_id.
-- Admin INSERT (covered by bug_comments_admin_all above) sends tester_id null.
-- This policy enforces tester correctness so a tester can't impersonate another.
drop policy if exists bug_comments_tester_insert on bug_comments;
create policy bug_comments_tester_insert on bug_comments
  for insert
  with check (
    author_user_id = auth.uid()
    and tester_id is not null
    and exists (
      select 1 from bug_reports b
      where b.id = bug_comments.bug_id
        and tester_id = current_tester_in(b.project_id)
    )
  );

-- Tester UPDATE: only their own comments.
drop policy if exists bug_comments_tester_update_own on bug_comments;
create policy bug_comments_tester_update_own on bug_comments
  for update
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

-- Tester DELETE: only their own comments. (Admin can delete anyone's via
-- the admin_all policy above.)
drop policy if exists bug_comments_tester_delete_own on bug_comments;
create policy bug_comments_tester_delete_own on bug_comments
  for delete
  using (author_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Change bug_reports tester visibility from "own only" to "all in project"
-- ---------------------------------------------------------------------
-- Testers were previously scoped to their own submissions for SELECT. To enable
-- cross-tester reproduction discussion we now show all bugs in the project.
-- triage_notes stays admin-only via the bug_reports_public view, which the
-- tester client code reads from.

drop policy if exists bug_reports_tester_select_own on bug_reports;
drop policy if exists bug_reports_tester_select_all on bug_reports;

create policy bug_reports_tester_select_all on bug_reports
  for select
  using (current_tester_in(project_id) is not null);

-- Tester INSERT policy is unchanged: each tester can only INSERT bugs
-- attributed to their own tester_id. No need to re-create.
