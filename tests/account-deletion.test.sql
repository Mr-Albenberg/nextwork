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
-- Organization owners can delete their account even when their listings have received applications.
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
insert into public.organizations(id,owner_id,name) values('10000000-0000-0000-0000-000000000003',auth.uid(),'Deletion Test Company');
insert into public.organization_listings(organization_id,title,field,kind,description,skills,budget,duration,status)
values('10000000-0000-0000-0000-000000000003','A project to remove','Development','Contract project',repeat('A complete project description. ',3),array['React'],500,'2 weeks','published') returning id as deleted_listing \gset
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.organization_applications(id,listing_id,applicant_id,profile,introduction) values('20000000-0000-0000-0000-000000000003',:deleted_listing,auth.uid(),'{"name":"Remaining user"}',repeat('A useful introduction. ',3));
insert into public.application_messages(application_id,sender_id,body) values('20000000-0000-0000-0000-000000000003',auth.uid(),'A message about the project');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.delete_my_account();
reset role;
do $$ begin
  if exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000003') then raise exception 'Organization owner was not deleted';end if;
  if exists(select 1 from public.organizations where id='10000000-0000-0000-0000-000000000003') then raise exception 'Organization was not removed';end if;
  if exists(select 1 from public.organization_applications where id='20000000-0000-0000-0000-000000000003') then raise exception 'Received application was not removed';end if;
  if not exists(select 1 from public.organizations where id='10000000-0000-0000-0000-000000000001') then raise exception 'Another organization was removed';end if;
end $$;
select 'Self-deletion removes only the caller and cascades their private data; anonymous deletion is denied' as result;
