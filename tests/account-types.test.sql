\set ON_ERROR_STOP on
-- Auth signup defaults to personal, even if the supplied app metadata claims otherwise.
insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values
 ('30000000-0000-0000-0000-000000000001','{}','{"nextwork_account_type":"organization"}'),
 ('30000000-0000-0000-0000-000000000002','{"account_kind":"organization"}','{}');
-- Attempts to change either metadata field after signup cannot convert a personal identity.
update auth.users set raw_user_meta_data='{"account_kind":"organization"}',raw_app_meta_data='{"nextwork_account_type":"organization"}' where id='30000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000001';
do $$ begin
 if public.my_account_kind()<>'personal' then raise exception 'Personal identity converted';end if;
 begin
  insert into public.organizations(owner_id,name) values(auth.uid(),'Unauthorized company');
  raise exception 'Personal account created an organization';
 exception when insufficient_privilege then null;end;
end $$;
insert into public.account_workspaces(user_id) values(auth.uid());
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000002';
insert into public.organizations(owner_id,name) values(auth.uid(),'Dedicated hiring team');
do $$ begin
 if public.my_account_kind()<>'organization' then raise exception 'Organization signup failed';end if;
 begin
  insert into public.account_workspaces(user_id) values(auth.uid());
  raise exception 'Hiring account created personal workspace';
 exception when insufficient_privilege then null;end;
end $$;
-- Hiring identities cannot apply even to another organization's published listing.
reset role;
insert into auth.users(id,raw_user_meta_data) values('30000000-0000-0000-0000-000000000003','{"account_kind":"organization"}');
set role authenticated;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
insert into public.organizations(owner_id,name) values(auth.uid(),'Second hiring team') returning id as org_id \gset
insert into public.organization_listings(organization_id,title,field,kind,description,skills,budget,duration,status) values(:'org_id','Useful paid project','Development','Contract project',repeat('Real project scope and deliverables. ',3),array['React'],1000,'2 weeks','published') returning id as listing_id \gset
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000002';
select set_config('nextwork.test_listing',:'listing_id',false);
do $$ begin
 begin
  insert into public.organization_applications(listing_id,applicant_id,profile,introduction) values(current_setting('nextwork.test_listing')::bigint,auth.uid(),'{}',repeat('Relevant introduction. ',3));
  raise exception 'Organization submitted candidate application';
 exception when insufficient_privilege then null;end;
end $$;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000001';
insert into public.organization_applications(listing_id,applicant_id,profile,introduction) values(:'listing_id',auth.uid(),'{}',repeat('Relevant introduction. ',3));
reset role;
