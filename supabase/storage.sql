-- =====================================================================
-- Storage bucket: bug-attachments
--
-- Run AFTER schema.sql, and AFTER creating the bucket itself in the
-- Supabase Dashboard (Storage → New bucket → name "bug-attachments",
-- Public bucket: OFF).
-- =====================================================================

-- Allow authenticated users to upload (INSERT) to bug-attachments.
-- The bug_attachments table CHECK constraints + the app code enforce size
-- and MIME limits before we even hit Storage.
drop policy if exists "bug_attachments upload" on storage.objects;
create policy "bug_attachments upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'bug-attachments');

-- Allow authenticated users to SELECT only attachments tied to bugs they own
-- (testers see their own) or bugs in projects they admin.
drop policy if exists "bug_attachments select" on storage.objects;
create policy "bug_attachments select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bug-attachments'
  and exists (
    select 1
    from bug_attachments ba
    join bug_reports br on br.id = ba.bug_id
    where ba.storage_path = storage.objects.name
      and (
        is_project_admin(br.project_id)
        or br.tester_id = current_tester_in(br.project_id)
      )
  )
);

-- Allow admins to DELETE attachments in their projects.
drop policy if exists "bug_attachments delete (admin)" on storage.objects;
create policy "bug_attachments delete (admin)"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'bug-attachments'
  and exists (
    select 1
    from bug_attachments ba
    join bug_reports br on br.id = ba.bug_id
    where ba.storage_path = storage.objects.name
      and is_project_admin(br.project_id)
  )
);
