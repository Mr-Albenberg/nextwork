-- Private deliverables for personal project trackers.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','image/webp','application/zip'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Personal accounts own project files" on storage.objects;
create policy "Personal accounts own project files" on storage.objects for all to authenticated
using(bucket_id='project-files' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal')
with check(bucket_id='project-files' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal' and name ~ '^[^/]+/project-[a-zA-Z0-9-]+/[a-zA-Z0-9-]+\.[a-z0-9]+$');
commit;
