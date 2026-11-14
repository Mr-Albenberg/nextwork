begin;
create table if not exists public.profile_photos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  object_path text not null unique check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  source text not null check (source in ('upload','linkedin')),
  width integer not null check (width between 1 and 512),
  height integer not null check (height between 1 and 512),
  byte_size integer not null check (byte_size between 1 and 1048576),
  updated_at timestamptz not null default now()
);
create table if not exists public.profile_import_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  import_version integer not null default 0,
  consented_at timestamptz,
  attempted_at timestamptz,
  completed_at timestamptz,
  picture_ref text,
  photo_removed boolean not null default false
);
create table if not exists public.profile_photo_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  action text not null,
  count integer not null,
  primary key(user_id,hour_start,action)
);
alter table public.profile_photos enable row level security;
alter table public.profile_import_state enable row level security;
alter table public.profile_photo_limits enable row level security;
revoke all on public.profile_photos,public.profile_import_state,public.profile_photo_limits from public,anon,authenticated;
grant select on public.profile_photos to authenticated;
grant all on public.profile_photos,public.profile_import_state,public.profile_photo_limits to service_role;
create or replace function public.is_active_photo_member() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=(select auth.uid()) and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false);
$$;
revoke all on function public.is_active_photo_member() from public,anon;
grant execute on function public.is_active_photo_member() to authenticated;
drop policy if exists "Members see profile photo metadata" on public.profile_photos;
create policy "Members see profile photo metadata" on public.profile_photos for select to authenticated using (public.is_active_photo_member());

create or replace function public.consume_photo_action(action_name text) returns boolean
language plpgsql security definer set search_path='' as $$
declare member uuid:=auth.uid(); used integer; maximum integer;
begin
  if member is null or not public.is_active_photo_member() then return false; end if;
  maximum:=case action_name when 'staging' then 20 when 'process' then 10 when 'import' then 3 else 0 end;
  if maximum=0 then return false; end if;
  delete from public.profile_photo_limits where user_id=member and hour_start<date_trunc('hour',now())-interval '1 day';
  insert into public.profile_photo_limits(user_id,hour_start,action,count) values(member,date_trunc('hour',now()),action_name,1)
  on conflict(user_id,hour_start,action) do update set count=public.profile_photo_limits.count+1 where public.profile_photo_limits.count<maximum
  returning count into used;
  return used is not null;
end $$;
revoke all on function public.consume_photo_action(text) from public,anon;
grant execute on function public.consume_photo_action(text) to authenticated;

-- Only the trusted server can backfill, and this function never replaces nonblank values.
create or replace function public.fill_linkedin_profile(target uuid, fields jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_profile jsonb; result jsonb; changed boolean:=false;
begin
  select profile into current_profile from public.account_workspaces where user_id=target for update;
  if not found then raise exception 'Account workspace missing';end if;
  if nullif(btrim(current_profile->>'name'),'') is null and nullif(btrim(fields->>'name'),'') is not null then current_profile:=current_profile||jsonb_build_object('name',left(fields->>'name',300));changed:=true;end if;
  if nullif(btrim(current_profile->>'email'),'') is null and nullif(btrim(fields->>'email'),'') is not null then current_profile:=current_profile||jsonb_build_object('email',left(fields->>'email',300));changed:=true;end if;
  if changed then update public.account_workspaces set profile=current_profile where user_id=target;end if;
  select jsonb_build_object('profile',profile,'version',version) into result from public.account_workspaces where user_id=target;
  return result;
end $$;
revoke all on function public.fill_linkedin_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fill_linkedin_profile(uuid,jsonb) to service_role;

-- Atomic publication prevents an automatic import replacing a manual photo or undoing removal.
create or replace function public.commit_profile_photo(target uuid, photo jsonb, allow_replace boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare removed boolean; result jsonb;
begin
  insert into public.profile_import_state(user_id) values(target) on conflict(user_id) do nothing;
  select photo_removed into removed from public.profile_import_state where user_id=target for update;
  if removed and not allow_replace then return null;end if;
  insert into public.profile_photos(user_id,object_path,source,width,height,byte_size,updated_at)
  values(target,photo->>'object_path',photo->>'source',(photo->>'width')::integer,(photo->>'height')::integer,(photo->>'byte_size')::integer,now())
  on conflict(user_id) do update set object_path=excluded.object_path,source=excluded.source,width=excluded.width,height=excluded.height,byte_size=excluded.byte_size,updated_at=excluded.updated_at where allow_replace;
  if allow_replace then update public.profile_import_state set photo_removed=false where user_id=target;end if;
  select to_jsonb(p) into result from public.profile_photos p where user_id=target;
  return result;
end $$;
revoke all on function public.commit_profile_photo(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.commit_profile_photo(uuid,jsonb,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('profile-photo-staging','profile-photo-staging',false,8388608,array['image/png','image/jpeg']),
 ('profile-photos','profile-photos',false,1048576,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Stage own profile image" on storage.objects;
create policy "Stage own profile image" on storage.objects for insert to authenticated with check(public.is_active_photo_member() and bucket_id='profile-photo-staging' and name=(select auth.uid())::text||'/pending' and public.consume_photo_action('staging'));
drop policy if exists "Read own staged profile image" on storage.objects;
create policy "Read own staged profile image" on storage.objects for select to authenticated using(public.is_active_photo_member() and bucket_id='profile-photo-staging' and name=(select auth.uid())::text||'/pending');
drop policy if exists "Replace own staged profile image" on storage.objects;
create policy "Replace own staged profile image" on storage.objects for update to authenticated using(public.is_active_photo_member() and bucket_id='profile-photo-staging' and name=(select auth.uid())::text||'/pending') with check(public.is_active_photo_member() and bucket_id='profile-photo-staging' and name=(select auth.uid())::text||'/pending' and public.consume_photo_action('staging'));
drop policy if exists "Remove own staged profile image" on storage.objects;
create policy "Remove own staged profile image" on storage.objects for delete to authenticated using(public.is_active_photo_member() and bucket_id='profile-photo-staging' and name=(select auth.uid())::text||'/pending');
-- No browser write or read policy is granted for processed photos. The API authorizes members and signs short-lived read URLs.

do $$ begin
  if to_regprocedure('public.delete_account_records()') is null then
    alter function public.delete_my_account() rename to delete_account_records;
  end if;
end $$;
revoke all on function public.delete_account_records() from public,anon,authenticated;
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path='' as $$
declare member uuid:=auth.uid();
begin
  if member is null then raise exception 'Authentication required' using errcode='42501';end if;
  if exists(select 1 from public.profile_photos where user_id=member) or exists(select 1 from storage.objects where bucket_id in ('profile-photos','profile-photo-staging') and name like member::text||'/%') then
    raise exception 'PHOTO_CLEANUP_REQUIRED';
  end if;
  perform public.delete_account_records();
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
commit;
