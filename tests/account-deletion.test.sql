\set ON_ERROR_STOP on
set role anon;
do $$ begin
  begin
    perform public.delete_my_account();
    raise exception 'Anonymous deletion succeeded';
  exception when insufficient_privilege then null; end;
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select public.delete_my_account();
reset role;
do $$ begin
  if exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000002') then raise exception 'Account was not deleted'; end if;
  if exists(select 1 from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000002') then raise exception 'Workspace did not cascade'; end if;
  if exists(select 1 from public.resume_review_usage where user_id='00000000-0000-0000-0000-000000000002') then raise exception 'Quota did not cascade'; end if;
  if not exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000001') then raise exception 'Another user was deleted'; end if;
  if not exists(select 1 from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'Another workspace was deleted'; end if;
end $$;
select 'Self-deletion removes only the caller and cascades their private data; anonymous deletion is denied' as result;
