-- Private resume files; extracted text and processing results stay in the owner workspace.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('account-resumes','account-resumes',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Personal accounts own resume files" on storage.objects;
create policy "Personal accounts own resume files" on storage.objects for all to authenticated
using(bucket_id='account-resumes' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal')
with check(bucket_id='account-resumes' and split_part(name,'/',1)=(select auth.uid())::text and public.my_account_kind()='personal');
create or replace function public.fill_linkedin_profile(target uuid, fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_profile jsonb; result jsonb; changed boolean:=false;
begin
  select profile into current_profile from public.account_workspaces where user_id=target for update;
  if not found then raise exception 'Account workspace missing';end if;
  if nullif(btrim(current_profile->>'name'),'') is null and nullif(btrim(fields->>'name'),'') is not null then current_profile:=current_profile||jsonb_build_object('name',left(fields->>'name',300));changed:=true;end if;
  if nullif(btrim(current_profile->>'email'),'') is null and nullif(btrim(fields->>'email'),'') is not null then current_profile:=current_profile||jsonb_build_object('email',left(fields->>'email',300));changed:=true;end if;
  if nullif(btrim(current_profile->>'tagline'),'') is null and nullif(btrim(fields->>'tagline'),'') is not null then current_profile:=current_profile||jsonb_build_object('tagline',left(fields->>'tagline',300));changed:=true;end if;
  if nullif(btrim(current_profile->>'bio'),'') is null and nullif(btrim(fields->>'bio'),'') is not null then current_profile:=current_profile||jsonb_build_object('bio',left(fields->>'bio',2000));changed:=true;end if;
  if changed then update public.account_workspaces set profile=current_profile where user_id=target;end if;
  select jsonb_build_object('profile',profile,'version',version) into result from public.account_workspaces where user_id=target;
  return result;
end $$;
revoke all on function public.fill_linkedin_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fill_linkedin_profile(uuid,jsonb) to service_role;
commit;
