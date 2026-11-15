-- Application lifecycle: decision notes, reapplying, and resume files shared with the hiring organization.
-- Run after migrations 001–004 (accounts, organizations, account updates, account types).
begin;
alter table public.organization_applications
  add column if not exists decision_note text not null default '' check (length(decision_note) <= 2000),
  add column if not exists decided_at timestamptz,
  add column if not exists attempt integer not null default 1 check (attempt between 1 and 5),
  add column if not exists reapplied_at timestamptz,
  add column if not exists resume_file jsonb check (resume_file is null or (jsonb_typeof(resume_file) = 'object' and octet_length(resume_file::text) <= 1000));

-- New applications always start clean; decisions, attempts and files are set only through the functions below.
drop policy if exists "Applicants submit as themselves" on public.organization_applications;
create policy "Applicants submit as themselves" on public.organization_applications for insert to authenticated with check(
  public.my_account_kind() = 'personal' and applicant_id = (select auth.uid()) and status = 'submitted'
  and decision_note = '' and decided_at is null and attempt = 1 and reapplied_at is null and resume_file is null
  and exists(select 1 from public.organization_listings l where l.id = listing_id and l.status = 'published' and not public.owns_organization(l.organization_id))
);

-- Organization decision with an optional note the applicant can read.
create or replace function public.decide_organization_application(app uuid, decision text, note text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if decision not in ('submitted', 'shortlisted', 'accepted', 'declined') then raise exception 'Invalid decision'; end if;
  if length(coalesce(note, '')) > 2000 then raise exception 'Decision note is too long'; end if;
  update public.organization_applications a
     set status = decision,
         decision_note = btrim(coalesce(note, '')),
         decided_at = case when decision in ('accepted', 'declined') then now() else null end,
         updated_at = now()
    from public.organization_listings l, public.organizations o
   where a.id = app and a.listing_id = l.id and l.organization_id = o.id
     and public.owns_organization(o.id) and a.status <> 'withdrawn';
  if not found then raise exception 'Application unavailable or access denied'; end if;
end $$;

-- Applicants may resubmit a declined or withdrawn application to a listing that is still published.
create or replace function public.reapply_organization_application(app uuid, new_profile jsonb, new_resume text, new_introduction text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if public.my_account_kind() is distinct from 'personal' then raise exception 'A personal account is required' using errcode = '42501'; end if;
  update public.organization_applications a
     set status = 'submitted', profile = new_profile, resume = coalesce(new_resume, ''), introduction = new_introduction,
         resume_file = null, decision_note = '', decided_at = null, attempt = a.attempt + 1, reapplied_at = now(), updated_at = now()
    from public.organization_listings l
   where a.id = app and a.applicant_id = (select auth.uid()) and a.status in ('declined', 'withdrawn') and a.attempt < 5
     and l.id = a.listing_id and l.status = 'published';
  if not found then raise exception 'This application cannot be resubmitted'; end if;
  return app;
end $$;

-- Private resume files copied from the applicant's account into the application.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('application-resumes', 'application-resumes', false, 5242880, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.application_file_allowed(object_name text, writing boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare app uuid;
begin
  if object_name is null or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9-]+\.(pdf|docx|txt)$' then return false; end if;
  app := split_part(object_name, '/', 1)::uuid;
  if writing then
    return public.my_account_kind() = 'personal' and exists(
      select 1 from public.organization_applications where id = app and applicant_id = (select auth.uid()) and status = 'submitted');
  end if;
  return public.can_read_application(app);
end $$;
revoke all on function public.application_file_allowed(text, boolean) from public, anon;
grant execute on function public.application_file_allowed(text, boolean) to authenticated;

drop policy if exists "Application participants read resume files" on storage.objects;
create policy "Application participants read resume files" on storage.objects for select to authenticated
  using (bucket_id = 'application-resumes' and public.application_file_allowed(name, false));
drop policy if exists "Applicants add resume files" on storage.objects;
create policy "Applicants add resume files" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-resumes' and public.application_file_allowed(name, true));
drop policy if exists "Applicants remove resume files" on storage.objects;
create policy "Applicants remove resume files" on storage.objects for delete to authenticated
  using (bucket_id = 'application-resumes' and public.application_file_allowed(name, true));

create or replace function public.attach_application_resume(app uuid, file jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(file) <> 'object' or coalesce(file->>'path', '') not like app::text || '/%'
     or not public.application_file_allowed(file->>'path', true)
     or length(coalesce(file->>'name', '')) not between 1 and 200
     or coalesce(file->>'size', '') !~ '^[0-9]{1,8}$' then
    raise exception 'Invalid resume file';
  end if;
  update public.organization_applications
     set resume_file = jsonb_build_object('name', file->>'name', 'size', (file->>'size')::integer, 'path', file->>'path', 'type', left(coalesce(file->>'type', ''), 120)),
         updated_at = now()
   where id = app and applicant_id = (select auth.uid()) and status = 'submitted';
  if not found then raise exception 'Application unavailable or access denied'; end if;
end $$;

revoke all on function public.decide_organization_application(uuid, text, text), public.reapply_organization_application(uuid, jsonb, text, text), public.attach_application_resume(uuid, jsonb) from public, anon;
grant execute on function public.decide_organization_application(uuid, text, text), public.reapply_organization_application(uuid, jsonb, text, text), public.attach_application_resume(uuid, jsonb) to authenticated;
commit;
