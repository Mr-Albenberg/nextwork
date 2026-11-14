-- The caller can delete only their own authenticated account. No user ID is accepted.
begin;
alter table public.account_workspaces add column if not exists extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras)='object' and octet_length(extras::text)<=2000000);
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare member uuid := auth.uid();
begin
  if member is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from auth.users where id = member;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
commit;
