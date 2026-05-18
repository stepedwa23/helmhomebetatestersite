-- =====================================================================
-- Migration 005 — roadmap_items
--
-- Public-facing "what's coming next" list shown to testers next to the
-- patch notes on the dashboard. Distinct from `suggestions` (which is the
-- tester wishlist) — these are items the admin has committed to or is
-- already working on.
--
-- Each item has a status (planned / in_progress / shipped) and a manual
-- sort_order so the admin can pin top-priority items to the top of the
-- list. Position is purely admin-controlled; we don't auto-sort by date
-- or status.
--
-- Run in the Supabase SQL editor AFTER schema.sql + earlier migrations.
-- =====================================================================

do $$ begin
  create type roadmap_status as enum ('planned', 'in_progress', 'shipped');
exception when duplicate_object then null; end $$;

create table if not exists roadmap_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  description text,
  status      roadmap_status not null default 'planned',
  -- Lower sort_order shows first. Admin reorders by editing the field.
  -- Defaults to 1000 so new items land near the bottom; admin can promote.
  sort_order  int not null default 1000,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id)
);

create index if not exists roadmap_items_project_sort_idx
  on roadmap_items(project_id, sort_order, created_at desc);

drop trigger if exists roadmap_items_set_updated_at on roadmap_items;
create trigger roadmap_items_set_updated_at
  before update on roadmap_items
  for each row
  execute function set_updated_at();

alter table roadmap_items enable row level security;

-- Admin: full access for projects they own.
drop policy if exists roadmap_items_admin_all on roadmap_items;
create policy roadmap_items_admin_all on roadmap_items
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Testers: read-only access to items in their project. Unlike notices, we
-- show ALL roadmap rows including 'shipped' — testers benefit from seeing
-- recent completions for context. Admin can delete items to hide them.
drop policy if exists roadmap_items_tester_select on roadmap_items;
create policy roadmap_items_tester_select on roadmap_items
  for select
  using (current_tester_in(project_id) is not null);
