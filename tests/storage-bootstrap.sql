-- Test-only stand-in for Supabase Storage; never run this in a real Supabase project.
do $$ begin create role service_role nologin bypassrls;exception when duplicate_object then null;end $$;
grant usage on schema public,auth to service_role;
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb default '{}',unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant all on storage.objects,storage.buckets to service_role;
grant select,insert,update,delete on storage.objects to authenticated;
