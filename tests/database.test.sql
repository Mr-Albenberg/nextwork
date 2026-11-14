\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.account_workspaces (user_id, profile, resume, version)
values (auth.uid(), '{"name":"Alice"}', 'Private resume', 999);
do $$ begin
  if (select version from public.account_workspaces where user_id=auth.uid()) <> 1 then raise exception 'Insert version must be server-assigned'; end if;
end $$;
update public.account_workspaces set version=999, profile='{"name":"Alice updated"}' where user_id=auth.uid();
do $$ begin
  if (select version from public.account_workspaces where user_id=auth.uid()) <> 2 then raise exception 'Update version must increment once'; end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare touched integer; begin
  if (select count(*) from public.account_workspaces) <> 0 then raise exception 'Cross-user read leaked data'; end if;
  update public.account_workspaces set resume='attacker' where user_id='00000000-0000-0000-0000-000000000001';
  get diagnostics touched=row_count;
  if touched <> 0 then raise exception 'Cross-user update succeeded'; end if;
  delete from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000001';
  get diagnostics touched=row_count;
  if touched <> 0 then raise exception 'Cross-user delete succeeded'; end if;
  begin
    insert into public.account_workspaces(user_id) values ('00000000-0000-0000-0000-000000000001');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.account_workspaces (user_id) values (auth.uid());
do $$ begin
  begin
    update public.account_workspaces set resume=repeat('x',30001) where user_id=auth.uid();
    raise exception 'Oversized resume accepted';
  exception when check_violation then null; end;
  begin
    update public.account_workspaces set profile='[]' where user_id=auth.uid();
    raise exception 'Invalid profile accepted';
  exception when check_violation then null; end;
  for i in 1..10 loop
    if not public.consume_resume_review() then raise exception 'Valid quota request rejected'; end if;
  end loop;
  if public.consume_resume_review() then raise exception 'Eleventh review accepted'; end if;
  begin
    delete from public.resume_review_usage;
    raise exception 'User can reset quota';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if not public.consume_resume_review() then raise exception 'Users share quota'; end if;
  if (select resume from public.account_workspaces where user_id=auth.uid()) <> 'Private resume' then raise exception 'Private data changed'; end if;
end $$;
set role anon;
reset request.jwt.claim.sub;
do $$ begin
  begin
    perform * from public.account_workspaces;
    raise exception 'Anonymous read succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_resume_review();
    raise exception 'Anonymous quota request succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Workspace RLS, version conflicts, validation, anonymous denial and durable per-user quota passed' as result;
