-- Nextwork's first backend: one private workspace per authenticated user.
-- Application entries are drafts against the sample catalog, not employer submissions.
begin;
create table if not exists public.account_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 25000),
  saved_projects integer[] not null default '{}' check (cardinality(saved_projects) <= 1000),
  application_drafts jsonb not null default '[]'::jsonb check (jsonb_typeof(application_drafts) = 'array' and jsonb_array_length(application_drafts) <= 100 and octet_length(application_drafts::text) <= 4000000),
  resume text not null default '' check (char_length(resume) <= 30000),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.account_workspaces enable row level security;
revoke all on public.account_workspaces from anon, authenticated;
grant select, insert, update, delete on public.account_workspaces to authenticated;
drop policy if exists "Users own their workspace" on public.account_workspaces;
create policy "Users own their workspace" on public.account_workspaces for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.stamp_workspace() returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.stamp_workspace() from public, anon, authenticated;
drop trigger if exists stamp_workspace on public.account_workspaces;
create trigger stamp_workspace before insert or update on public.account_workspaces for each row execute function public.stamp_workspace();

-- Durable per-user AI budget. Clients cannot read, change, or reset the counter.
create table if not exists public.resume_review_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  reviews integer not null default 0,
  primary key (user_id, hour_start)
);
alter table public.resume_review_usage enable row level security;
revoke all on public.resume_review_usage from public, anon, authenticated;
create or replace function public.consume_resume_review() returns boolean
language plpgsql security definer set search_path = '' as $$
declare count_used integer; member uuid := auth.uid();
begin
  if member is null then raise exception 'Authentication required'; end if;
  delete from public.resume_review_usage where user_id=member and hour_start < date_trunc('hour', now()) - interval '1 day';
  insert into public.resume_review_usage (user_id, hour_start, reviews)
  values (member, date_trunc('hour', now()), 1)
  on conflict (user_id, hour_start) do update set reviews = public.resume_review_usage.reviews + 1
    where public.resume_review_usage.reviews < 10
  returning reviews into count_used;
  return count_used is not null;
end;
$$;
revoke all on function public.consume_resume_review() from public, anon;
grant execute on function public.consume_resume_review() to authenticated;
commit;
