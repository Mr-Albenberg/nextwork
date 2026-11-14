\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('70000000-0000-0000-0000-000000000001'),('70000000-0000-0000-0000-000000000002');
insert into public.account_workspaces(user_id,profile) values('70000000-0000-0000-0000-000000000001','{"tagline":"Manual headline","bio":""}');
set role service_role;
select public.fill_linkedin_profile('70000000-0000-0000-0000-000000000001','{"tagline":"Imported headline","bio":"First description"}');
select public.fill_linkedin_profile('70000000-0000-0000-0000-000000000001','{"bio":"Second description"}');
reset role;
do $$ begin
 if (select profile->>'tagline' from public.account_workspaces where user_id='70000000-0000-0000-0000-000000000001')<>'Manual headline' then raise exception 'Manual headline overwritten';end if;
 if (select profile->>'bio' from public.account_workspaces where user_id='70000000-0000-0000-0000-000000000001')<>'First description' then raise exception 'First description overwritten';end if;
 if (select public from storage.buckets where id='account-resumes') then raise exception 'Resume bucket is public';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='70000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name) values('account-resumes','70000000-0000-0000-0000-000000000001/resume.txt');
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('account-resumes','70000000-0000-0000-0000-000000000002/forged.txt');
 raise exception 'Cross-account upload permitted';
 exception when insufficient_privilege then null;end;
end $$;
set request.jwt.claim.sub='70000000-0000-0000-0000-000000000002';
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='account-resumes') then raise exception 'Cross-account read permitted';end if;
 delete from storage.objects where bucket_id='account-resumes';
 if found then raise exception 'Cross-account delete permitted';end if;
end $$;
set request.jwt.claim.sub='70000000-0000-0000-0000-000000000001';
delete from storage.objects where bucket_id='account-resumes';
reset role;
rollback;
