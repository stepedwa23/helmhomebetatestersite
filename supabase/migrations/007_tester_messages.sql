-- =====================================================================
-- Migration 007 — tester_messages
--
-- Direct tester→admin channel for off-script communication that doesn't
-- fit a bug report, suggestion, or feedback (e.g. "I'm going to be
-- away," "can we hop on a call," general questions). Tester writes in
-- an in-app form; an Edge Function emails the admin via Resend with
-- Reply-To set to the tester's email so admin can reply naturally.
--
-- We persist the row primarily so admin has a "Messages" inbox page
-- to track what's outstanding — and so the system of record is the
-- site, not the admin's email client.
--
-- Run in the Supabase SQL editor AFTER earlier migrations.
-- =====================================================================

do $$ begin
  create type tester_message_status as enum ('new', 'replied', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists tester_messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  tester_id   uuid not null references testers(id) on delete cascade,
  subject     text not null,
  body        text not null,
  status      tester_message_status not null default 'new',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  replied_at  timestamptz
);

create index if not exists tester_messages_project_status_idx
  on tester_messages(project_id, status, created_at desc);
create index if not exists tester_messages_tester_idx
  on tester_messages(tester_id, created_at desc);

drop trigger if exists tester_messages_set_updated_at on tester_messages;
create trigger tester_messages_set_updated_at
  before update on tester_messages
  for each row
  execute function set_updated_at();

alter table tester_messages enable row level security;

-- Admin: full access on rows in projects they own.
drop policy if exists tester_messages_admin_all on tester_messages;
create policy tester_messages_admin_all on tester_messages
  for all
  using (is_project_admin(project_id))
  with check (is_project_admin(project_id));

-- Tester INSERT: can send their own messages only.
drop policy if exists tester_messages_tester_insert on tester_messages;
create policy tester_messages_tester_insert on tester_messages
  for insert
  with check (
    tester_id = current_tester_in(project_id)
  );

-- Tester SELECT: their own message history (so a future "My messages"
-- view can show what they've sent and the status).
drop policy if exists tester_messages_tester_select_own on tester_messages;
create policy tester_messages_tester_select_own on tester_messages
  for select
  using (
    tester_id = current_tester_in(project_id)
  );
