-- =====================================================================
-- Helm Beta Tester Site — Supabase schema
--
-- Run this file ONCE in the Supabase SQL editor for a fresh project.
-- Idempotent where reasonable, but safest on an empty database.
--
-- Notes:
--   - All RLS policies have BOTH `USING` and `WITH CHECK` clauses
--     (without WITH CHECK, inserts/updates fail silently — reference-project lesson).
--   - Tester-facing views (bug_reports_public, suggestions_public) exclude admin-only
--     columns (triage_notes, admin_notes).
--   - Seeding the initial "Helm" project requires knowing your auth.users.id;
--     see the seed block at the bottom of this file.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------

do $$ begin
  create type os_kind as enum ('macos', 'windows');
exception when duplicate_object then null; end $$;

do $$ begin
  create type household_profile_kind as enum (
    'small_apartment', 'medium_home', 'large_home', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tester_status as enum ('invited', 'active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cycle_status as enum ('planned', 'active', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bug_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bug_category as enum (
    'crashes_install', 'scheduling', 'ui_visual', 'notifications',
    'performance', 'onboarding', 'accessibility', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type bug_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type suggestion_status as enum (
    'new', 'under_review', 'planned', 'declined', 'shipped'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Generic updated_at trigger.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Note: `is_project_admin` and `current_tester_in` are defined LOWER in this file,
-- right after the `testers` table is created. With `language sql` they are
-- parse-validated at CREATE time, so they must come after the tables they reference.

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  owner_id    uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

alter table projects enable row level security;

drop policy if exists projects_admin_all on projects;
create policy projects_admin_all on projects
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Note: `projects_tester_select` is defined LOWER in this file, after the
-- `testers` table exists (RLS policies that reference other relations are
-- parse-validated at CREATE POLICY time).

-- ---------------------------------------------------------------------
-- testers
-- ---------------------------------------------------------------------

create table if not exists testers (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  name              text not null,
  email             text not null,
  os                os_kind,
  os_version        text,
  helm_version      text,
  calm_mode_state   jsonb not null default '{"focus_mode":false,"reduce_motion":false,"auto_skip":false,"theme":"default"}'::jsonb,
  household_profile household_profile_kind,
  status            tester_status not null default 'invited',
  notes             text,
  invited_at        timestamptz default now(),
  joined_at         timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid not null references auth.users(id),
  unique (project_id, email)
);

create index if not exists testers_user_id_idx on testers(user_id);
create index if not exists testers_project_status_idx on testers(project_id, status);

-- ---------------------------------------------------------------------
-- Helper functions (defined here so the referenced tables exist).
-- These get called from RLS policies on testers and every downstream table.
-- ---------------------------------------------------------------------

-- True if the current auth user owns `project_id`.
create or replace function is_project_admin(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects p
    where p.id = p_project_id
      and p.owner_id = auth.uid()
  )
$$;

-- The tester row id for the current auth user within a project, or null.
create or replace function current_tester_in(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from testers t
  where t.project_id = p_project_id
    and t.user_id = auth.uid()
  limit 1
$$;

-- Testers can SELECT their own project (the one their tester row points to).
-- Defined here (not next to projects_admin_all) because it references the
-- testers table, which has to exist first.
drop policy if exists projects_tester_select on projects;
create policy projects_tester_select on projects
  for select
  using (
    exists (
      select 1 from testers t
      where t.project_id = projects.id
        and t.user_id = auth.uid()
    )
  );

alter table testers enable row level security;

drop policy if exists testers_admin_all on testers;
create policy testers_admin_all on testers
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Each tester can SELECT their own row.
drop policy if exists testers_self_select on testers;
create policy testers_self_select on testers
  for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- test_cycles
-- ---------------------------------------------------------------------

create table if not exists test_cycles (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  build_version text,
  start_date    date,
  end_date      date,
  status        cycle_status not null default 'planned',
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid not null references auth.users(id)
);

create index if not exists test_cycles_project_idx on test_cycles(project_id, start_date desc);

alter table test_cycles enable row level security;

drop policy if exists test_cycles_admin_all on test_cycles;
create policy test_cycles_admin_all on test_cycles
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Testers can SELECT cycles in their project (any cycle, useful context).
drop policy if exists test_cycles_tester_select on test_cycles;
create policy test_cycles_tester_select on test_cycles
  for select
  using (current_tester_in(project_id) is not null);

-- ---------------------------------------------------------------------
-- cycle_testers (junction)
-- ---------------------------------------------------------------------

create table if not exists cycle_testers (
  cycle_id     uuid not null references test_cycles(id) on delete cascade,
  tester_id    uuid not null references testers(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (cycle_id, tester_id)
);

alter table cycle_testers enable row level security;

drop policy if exists cycle_testers_admin_all on cycle_testers;
create policy cycle_testers_admin_all on cycle_testers
  for all
  using (
    exists (
      select 1 from test_cycles c
      where c.id = cycle_testers.cycle_id
        and is_project_admin(c.project_id)
    )
  )
  with check (
    exists (
      select 1 from test_cycles c
      where c.id = cycle_testers.cycle_id
        and is_project_admin(c.project_id)
    )
  );

drop policy if exists cycle_testers_self_select on cycle_testers;
create policy cycle_testers_self_select on cycle_testers
  for select
  using (
    exists (
      select 1 from testers t
      where t.id = cycle_testers.tester_id
        and t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- bug_reports
-- ---------------------------------------------------------------------

create table if not exists bug_reports (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  cycle_id            uuid references test_cycles(id) on delete set null,
  tester_id           uuid not null references testers(id) on delete cascade,
  title               text not null,
  description         text not null,
  steps_to_reproduce  text,
  severity            bug_severity not null default 'medium',
  category            bug_category not null default 'other',
  status              bug_status not null default 'open',
  helm_version        text,
  os                  os_kind,
  os_version          text,
  calm_mode_state     jsonb not null default '{"focus_mode":false,"reduce_motion":false,"auto_skip":false,"theme":"default"}'::jsonb,
  triage_notes        text,
  submitted_at        timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists bug_reports_project_idx on bug_reports(project_id, submitted_at desc);
create index if not exists bug_reports_tester_idx on bug_reports(tester_id, submitted_at desc);
create index if not exists bug_reports_status_idx on bug_reports(project_id, status);

alter table bug_reports enable row level security;

drop policy if exists bug_reports_admin_all on bug_reports;
create policy bug_reports_admin_all on bug_reports
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Tester INSERT: must use their own tester_id.
drop policy if exists bug_reports_tester_insert on bug_reports;
create policy bug_reports_tester_insert on bug_reports
  for insert
  with check (tester_id = current_tester_in(project_id));

-- Tester SELECT: only their own bugs (admin_notes/triage_notes are hidden via the public view).
drop policy if exists bug_reports_tester_select_own on bug_reports;
create policy bug_reports_tester_select_own on bug_reports
  for select
  using (tester_id = current_tester_in(project_id));

-- Public view for testers — excludes triage_notes.
create or replace view bug_reports_public
with (security_invoker = true) as
  select
    id, project_id, cycle_id, tester_id,
    title, description, steps_to_reproduce,
    severity, category, status,
    helm_version, os, os_version, calm_mode_state,
    submitted_at, resolved_at
  from bug_reports;

-- ---------------------------------------------------------------------
-- bug_attachments + Storage policies (separate file or dashboard for the bucket)
-- ---------------------------------------------------------------------

create table if not exists bug_attachments (
  id           uuid primary key default gen_random_uuid(),
  bug_id       uuid not null references bug_reports(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  uploaded_at  timestamptz not null default now(),
  check (size_bytes <= 5 * 1024 * 1024),
  check (mime_type in ('image/png','image/jpeg','image/webp','image/gif'))
);

create index if not exists bug_attachments_bug_idx on bug_attachments(bug_id);

alter table bug_attachments enable row level security;

drop policy if exists bug_attachments_admin_all on bug_attachments;
create policy bug_attachments_admin_all on bug_attachments
  for all
  using (
    exists (
      select 1 from bug_reports b
      where b.id = bug_attachments.bug_id
        and is_project_admin(b.project_id)
    )
  )
  with check (
    exists (
      select 1 from bug_reports b
      where b.id = bug_attachments.bug_id
        and is_project_admin(b.project_id)
    )
  );

drop policy if exists bug_attachments_tester_own on bug_attachments;
create policy bug_attachments_tester_own on bug_attachments
  for all
  using (
    exists (
      select 1 from bug_reports b
      where b.id = bug_attachments.bug_id
        and b.tester_id = current_tester_in(b.project_id)
    )
  )
  with check (
    exists (
      select 1 from bug_reports b
      where b.id = bug_attachments.bug_id
        and b.tester_id = current_tester_in(b.project_id)
    )
  );

-- ---------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------

create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  cycle_id      uuid references test_cycles(id) on delete set null,
  tester_id     uuid not null references testers(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comments      text,
  submitted_at  timestamptz not null default now()
);

create index if not exists feedback_project_idx on feedback(project_id, submitted_at desc);
create index if not exists feedback_tester_idx on feedback(tester_id, submitted_at desc);

alter table feedback enable row level security;

drop policy if exists feedback_admin_all on feedback;
create policy feedback_admin_all on feedback
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

drop policy if exists feedback_tester_insert on feedback;
create policy feedback_tester_insert on feedback
  for insert
  with check (tester_id = current_tester_in(project_id));

drop policy if exists feedback_tester_select_own on feedback;
create policy feedback_tester_select_own on feedback
  for select
  using (tester_id = current_tester_in(project_id));

-- ---------------------------------------------------------------------
-- app_versions
-- ---------------------------------------------------------------------

create table if not exists app_versions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  version       text not null,
  release_date  date,
  patch_notes   jsonb,
  is_current    boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid not null references auth.users(id)
);

-- Only one is_current=true per project.
create unique index if not exists app_versions_one_current_per_project
  on app_versions(project_id) where is_current;

create index if not exists app_versions_project_idx on app_versions(project_id, release_date desc);

-- When a row is set is_current=true, flip the previous current off.
create or replace function flip_previous_current_version() returns trigger
language plpgsql as $$
begin
  if new.is_current then
    update app_versions
       set is_current = false
     where project_id = new.project_id
       and id <> new.id
       and is_current;
  end if;
  return new;
end $$;

drop trigger if exists app_versions_flip_current on app_versions;
create trigger app_versions_flip_current
  before insert or update on app_versions
  for each row
  execute function flip_previous_current_version();

alter table app_versions enable row level security;

drop policy if exists app_versions_admin_all on app_versions;
create policy app_versions_admin_all on app_versions
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

drop policy if exists app_versions_tester_select on app_versions;
create policy app_versions_tester_select on app_versions
  for select
  using (current_tester_in(project_id) is not null);

-- ---------------------------------------------------------------------
-- help_articles
-- ---------------------------------------------------------------------

create table if not exists help_articles (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  title        text not null,
  slug         text not null,
  body         jsonb,
  category     text,
  is_pinned    boolean not null default false,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id),
  unique (project_id, slug)
);

create index if not exists help_articles_project_idx
  on help_articles(project_id, is_pinned desc, order_index, updated_at desc);

drop trigger if exists help_articles_set_updated_at on help_articles;
create trigger help_articles_set_updated_at
  before update on help_articles
  for each row
  execute function set_updated_at();

alter table help_articles enable row level security;

drop policy if exists help_articles_admin_all on help_articles;
create policy help_articles_admin_all on help_articles
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

drop policy if exists help_articles_tester_select on help_articles;
create policy help_articles_tester_select on help_articles
  for select
  using (current_tester_in(project_id) is not null);

-- ---------------------------------------------------------------------
-- suggestions
-- ---------------------------------------------------------------------

create table if not exists suggestions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  tester_id     uuid not null references testers(id) on delete cascade,
  title         text not null,
  description   text not null,
  status        suggestion_status not null default 'new',
  admin_notes   text,
  submitted_at  timestamptz not null default now()
);

create index if not exists suggestions_project_idx on suggestions(project_id, submitted_at desc);
create index if not exists suggestions_tester_idx on suggestions(tester_id, submitted_at desc);

alter table suggestions enable row level security;

drop policy if exists suggestions_admin_all on suggestions;
create policy suggestions_admin_all on suggestions
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Tester INSERT: must use their own tester_id.
drop policy if exists suggestions_tester_insert on suggestions;
create policy suggestions_tester_insert on suggestions
  for insert
  with check (tester_id = current_tester_in(project_id));

-- Tester SELECT: ALL suggestions in their project (public to testers).
drop policy if exists suggestions_tester_select_all on suggestions;
create policy suggestions_tester_select_all on suggestions
  for select
  using (current_tester_in(project_id) is not null);

-- Tester UPDATE: only their own, only while status='new'.
drop policy if exists suggestions_tester_update_own on suggestions;
create policy suggestions_tester_update_own on suggestions
  for update
  using (tester_id = current_tester_in(project_id) and status = 'new')
  with check (tester_id = current_tester_in(project_id) and status = 'new');

-- Public view — excludes admin_notes.
create or replace view suggestions_public
with (security_invoker = true) as
  select
    id, project_id, tester_id,
    title, description, status,
    submitted_at
  from suggestions;

-- ---------------------------------------------------------------------
-- SEED
-- ---------------------------------------------------------------------
-- After you create your admin auth user, run:
--
--   insert into projects (name, slug, description, owner_id)
--   values (
--     'Helm',
--     'helm',
--     'Tauri desktop home-maintenance app',
--     '<paste your auth.users.id here>'
--   );
--
-- Find your id with:  select id, email from auth.users;
