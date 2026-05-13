-- =====================================================================
-- Migration 001 — app_downloads
--
-- Adds per-platform installer downloads attached to app_versions. The admin
-- uploads binaries through the React app; testers see download buttons on
-- their dashboard for the current beta version.
--
-- Run in the Supabase SQL editor AFTER schema.sql has been applied.
-- Then create the `app-downloads` Storage bucket via the dashboard (public OFF),
-- and run the storage policies block at the bottom of this file.
-- =====================================================================

-- Platform enum. We include both macOS architectures for forward compat even
-- though Stephen currently only ships arm64 — adding macos_x64 later is then
-- a UI-only change, not a migration.
do $$ begin
  create type app_platform as enum (
    'macos_arm64',
    'macos_x64',
    'windows_x64',
    'windows_arm64'
  );
exception when duplicate_object then null; end $$;

create table if not exists app_downloads (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references app_versions(id) on delete cascade,
  platform      app_platform not null,
  filename      text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint not null,
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid not null references auth.users(id),
  unique (version_id, platform)
);

create index if not exists app_downloads_version_idx on app_downloads(version_id);

alter table app_downloads enable row level security;

-- Admin: full access to downloads attached to versions in projects they own.
drop policy if exists app_downloads_admin_all on app_downloads;
create policy app_downloads_admin_all on app_downloads
  for all
  using (
    exists (
      select 1 from app_versions v
      where v.id = app_downloads.version_id
        and is_project_admin(v.project_id)
    )
  )
  with check (
    exists (
      select 1 from app_versions v
      where v.id = app_downloads.version_id
        and is_project_admin(v.project_id)
    )
  );

-- Testers in the project can SELECT downloads for any version in that project.
drop policy if exists app_downloads_tester_select on app_downloads;
create policy app_downloads_tester_select on app_downloads
  for select
  using (
    exists (
      select 1 from app_versions v
      where v.id = app_downloads.version_id
        and current_tester_in(v.project_id) is not null
    )
  );

-- =====================================================================
-- Storage policies for the `app-downloads` bucket.
--
-- Run this block AFTER creating the bucket via the dashboard:
--   Storage → New bucket → name "app-downloads"
--   Public bucket: OFF
--   File size limit: 200 MB (or higher if your installers exceed it)
--   Allowed MIME types: leave blank to allow anything (we validate client-side)
-- =====================================================================

-- Admin can INSERT files (uploads) into the bucket.
-- Tester INSERT is denied — they only consume downloads, never upload binaries.
drop policy if exists "app_downloads admin upload" on storage.objects;
create policy "app_downloads admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'app-downloads'
  -- Best-effort admin check at upload time. The DB-level check on the
  -- app_downloads INSERT row is the real security boundary.
  and exists (
    select 1 from projects p
    where p.owner_id = auth.uid()
  )
);

-- Both admin and tester can SELECT (read) files via signed URLs, but only
-- when there's a matching app_downloads row visible to them under RLS.
drop policy if exists "app_downloads select" on storage.objects;
create policy "app_downloads select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'app-downloads'
  and exists (
    select 1
    from app_downloads d
    join app_versions v on v.id = d.version_id
    where d.storage_path = storage.objects.name
      and (
        is_project_admin(v.project_id)
        or current_tester_in(v.project_id) is not null
      )
  )
);

-- Admin can DELETE / UPDATE files (replace/remove uploads).
drop policy if exists "app_downloads admin delete" on storage.objects;
create policy "app_downloads admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'app-downloads'
  and exists (
    select 1
    from app_downloads d
    join app_versions v on v.id = d.version_id
    where d.storage_path = storage.objects.name
      and is_project_admin(v.project_id)
  )
);

drop policy if exists "app_downloads admin update" on storage.objects;
create policy "app_downloads admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'app-downloads'
  and exists (
    select 1
    from app_downloads d
    join app_versions v on v.id = d.version_id
    where d.storage_path = storage.objects.name
      and is_project_admin(v.project_id)
  )
)
with check (
  bucket_id = 'app-downloads'
  and exists (
    select 1
    from app_downloads d
    join app_versions v on v.id = d.version_id
    where d.storage_path = storage.objects.name
      and is_project_admin(v.project_id)
  )
);
