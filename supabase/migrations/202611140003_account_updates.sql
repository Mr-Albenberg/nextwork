-- The caller can delete only their own authenticated account. No user ID is accepted.
begin;
alter table public.account_workspaces add column if not exists extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras)='object' and octet_length(extras::text)<=2000000);
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare member uuid := auth.uid();
begin
  if member is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Organization data must be removed before its non-cascading foreign keys.
  -- Dynamic SQL keeps this compatible when the optional organization schema is absent.
  if to_regclass('public.organizations') is not null then
    execute 'delete from public.application_messages where sender_id=$1 or application_id in (select a.id from public.organization_applications a join public.organization_listings l on l.id=a.listing_id join public.organizations o on o.id=l.organization_id where a.applicant_id=$1 or o.owner_id=$1)' using member;
    execute 'delete from public.organization_applications where applicant_id=$1 or listing_id in (select l.id from public.organization_listings l join public.organizations o on o.id=l.organization_id where o.owner_id=$1)' using member;
    execute 'delete from public.organization_listings where organization_id in (select id from public.organizations where owner_id=$1)' using member;
    execute 'delete from public.organizations where owner_id=$1' using member;
  end if;
  delete from auth.users where id = member;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
commit;
