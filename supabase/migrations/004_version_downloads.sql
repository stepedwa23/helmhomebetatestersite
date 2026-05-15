-- =====================================================================
-- Migration 004 — version_downloads
--
-- Logs each download event for (version, tester, platform). Powers two things:
--   1. Admin sees who downloaded what (and when) per version.
--   2. The tester is auto-assigned to the currently-active cycle on download,
--      so the cycle's participant list reflects actual engagement.
--
-- Unique constraint on (version_id, tester_id, platform) collapses repeated
-- downloads to a single row whose `downloaded_at` is bumped on each re-click.
--
-- Run in the Supabase SQL editor AFTER schema.sql + migration 001.
-- =====================================================================

create table if not exists version_downloads (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references app_versions(id) on delete cascade,
  tester_id      uuid not null references testers(id) on delete cascade,
  platform       app_platform not null,
  downloaded_at  timestamptz not null default now(),
  unique (version_id, tester_id, platform)
);

create index if not exists version_downloads_version_idx
  on version_downloads(version_id, downloaded_at desc);
create index if not exists version_downloads_tester_idx
  on version_downloads(tester_id, downloaded_at desc);

alter table version_downloads enable row level security;

-- Admin: full access for downloads of versions in projects they own.
drop policy if exists version_downloads_admin_all on version_downloads;
create policy version_downloads_admin_all on version_downloads
  for all
  using (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and is_project_admin(v.project_id)
    )
  )
  with check (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and is_project_admin(v.project_id)
    )
  );

-- Tester INSERT: only their own download events.
drop policy if exists version_downloads_tester_insert on version_downloads;
create policy version_downloads_tester_insert on version_downloads
  for insert
  with check (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and tester_id = current_tester_in(v.project_id)
    )
  );

-- Tester UPDATE: the upsert on re-click updates downloaded_at. RLS allows
-- update of their own row only.
drop policy if exists version_downloads_tester_update_own on version_downloads;
create policy version_downloads_tester_update_own on version_downloads
  for update
  using (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and tester_id = current_tester_in(v.project_id)
    )
  )
  with check (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and tester_id = current_tester_in(v.project_id)
    )
  );

-- Tester SELECT: their own download log (for "your downloads" views, future).
drop policy if exists version_downloads_tester_select_own on version_downloads;
create policy version_downloads_tester_select_own on version_downloads
  for select
  using (
    exists (
      select 1 from app_versions v
      where v.id = version_downloads.version_id
        and tester_id = current_tester_in(v.project_id)
    )
  );

-- ---------------------------------------------------------------------
-- cycle_testers: allow testers to self-assign
-- ---------------------------------------------------------------------
-- The recordDownload helper auto-assigns the downloading tester to the
-- active cycle. That needs an INSERT permission on cycle_testers, but the
-- existing policy only allows admin. Adding a narrow self-assign policy:
-- a tester can insert themselves into any cycle in their project.
-- (Admin remains the gate for removals via cycle_testers_admin_all.)

drop policy if exists cycle_testers_tester_self_insert on cycle_testers;
create policy cycle_testers_tester_self_insert on cycle_testers
  for insert
  with check (
    -- Row's tester_id must be the caller's own tester row
    exists (
      select 1 from testers t
      where t.id = cycle_testers.tester_id
        and t.user_id = auth.uid()
    )
    -- And the target cycle must belong to the caller's project
    and exists (
      select 1 from test_cycles c
      where c.id = cycle_testers.cycle_id
        and current_tester_in(c.project_id) is not null
    )
  );
