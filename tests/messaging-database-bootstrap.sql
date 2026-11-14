-- Roles already exist from the main CI database.
-- Local/CI PostgreSQL only: stand-ins for Supabase's existing auth schema and roles.


create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
