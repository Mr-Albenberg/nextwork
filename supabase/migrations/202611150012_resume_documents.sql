-- Reaffirm private original-document storage. Application access is defined by migration 010.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('account-resumes','account-resumes',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
('application-resumes','application-resumes',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Personal accounts own resume files" on storage.objects;
create policy "Personal accounts own resume files" on storage.objects for all to authenticated
using(bucket_id='account-resumes' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal')
with check(bucket_id='account-resumes' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal');
notify pgrst,'reload schema';
commit;
