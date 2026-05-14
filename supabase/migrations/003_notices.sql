-- =====================================================================
-- Migration 003 — notices
--
-- Project-wide notice banners (e.g., "App will be down for maintenance Sunday",
-- "v0.4 has a known issue with calendar sync"). Admin posts them; everyone in
-- the project (admin + active testers) sees the active ones at the top of
-- every page in the Layout.
--
-- Run in the Supabase SQL editor AFTER schema.sql.
-- =====================================================================

do $$ begin
  create type notice_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

create table if not exists notices (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  body       text not null,
  severity   notice_severity not null default 'info',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create index if not exists notices_project_active_idx
  on notices(project_id, is_active);

drop trigger if exists notices_set_updated_at on notices;
create trigger notices_set_updated_at
  before update on notices
  for each row
  execute function set_updated_at();

alter table notices enable row level security;

-- Admin: full access (manage all notices for projects they own).
drop policy if exists notices_admin_all on notices;
create policy notices_admin_all on notices
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Testers in the project: SELECT only ACTIVE notices. They never see
-- deactivated/old notices, which is important for "draft" notices admin
-- prepares but hasn't switched on yet.
drop policy if exists notices_tester_select_active on notices;
create policy notices_tester_select_active on notices
  for select
  using (
    is_active = true
    and current_tester_in(project_id) is not null
  );
