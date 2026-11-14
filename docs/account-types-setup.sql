-- Fixed account types. Run after the accounts, organizations, and account updates migrations.
begin;
-- Preserve established hiring accounts; existing candidates remain personal.
-- User-editable metadata is deliberately ignored when classifying existing accounts.
update auth.users u set raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object(
 'nextwork_account_type',case when exists(select 1 from public.organizations o where o.owner_id=u.id) then 'organization' else 'personal' end
) where coalesce(u.raw_app_meta_data->>'nextwork_account_type','') not in ('personal','organization');
create or replace function public.fix_nextwork_account_type() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('nextwork_account_type',case when new.raw_user_meta_data->>'account_kind'='organization' then 'organization' else 'personal' end);
 else
  new.raw_app_meta_data:=coalesce(new.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('nextwork_account_type',coalesce(old.raw_app_meta_data->>'nextwork_account_type','personal'));
 end if;
 return new;
end $$;
revoke all on function public.fix_nextwork_account_type() from public,anon,authenticated;
drop trigger if exists nextwork_account_type on auth.users;
create trigger nextwork_account_type before insert or update on auth.users for each row execute function public.fix_nextwork_account_type();
create or replace function public.my_account_kind() returns text language sql stable security definer set search_path='' as $$
 select raw_app_meta_data->>'nextwork_account_type' from auth.users where id=(select auth.uid());
$$;
revoke all on function public.my_account_kind() from public,anon;
grant execute on function public.my_account_kind() to authenticated;
create or replace function public.owns_organization(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.my_account_kind()='organization' and exists(select 1 from public.organizations where id=org and owner_id=(select auth.uid()));
$$;
drop policy if exists "Create own organization" on public.organizations;
create policy "Create own organization" on public.organizations for insert to authenticated with check(owner_id=(select auth.uid()) and public.my_account_kind()='organization');
drop policy if exists "Edit own organization" on public.organizations;
create policy "Edit own organization" on public.organizations for update to authenticated using(public.owns_organization(id)) with check(owner_id=(select auth.uid()) and public.my_account_kind()='organization');
drop policy if exists "Applicants submit as themselves" on public.organization_applications;
create policy "Applicants submit as themselves" on public.organization_applications for insert to authenticated with check(public.my_account_kind()='personal' and applicant_id=(select auth.uid()) and status='submitted' and exists(select 1 from public.organization_listings l where l.id=listing_id and l.status='published' and not public.owns_organization(l.organization_id)));
-- Retain historical candidate data but remove hiring accounts' access to candidate workspaces.
drop policy if exists "Users own their workspace" on public.account_workspaces;
create policy "Users own their workspace" on public.account_workspaces for all to authenticated using(user_id=(select auth.uid()) and public.my_account_kind()='personal') with check(user_id=(select auth.uid()) and public.my_account_kind()='personal');
commit;
