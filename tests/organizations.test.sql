\set ON_ERROR_STOP on
insert into auth.users values('00000000-0000-0000-0000-000000000003');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.organizations(id,owner_id,name) values('10000000-0000-0000-0000-000000000001',auth.uid(),'Test Startup');
insert into public.organization_listings(organization_id,title,field,kind,description,skills,requirements,deliverables,budget,duration,status)
values('10000000-0000-0000-0000-000000000001','Accessible React contract','Development','Contract project',repeat('A useful paid development project. ',3),array['React','Testing'],array['Build accessible components'],'A tested dashboard',1000,'2 weeks','published') returning id as listing_id \gset
insert into public.organization_listings(organization_id,title,field,kind,description,skills,budget,duration,status)
values('10000000-0000-0000-0000-000000000001','Private draft contract','Development','Contract project',repeat('A private draft project. ',3),array['React'],1000,'2 weeks','draft');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select count(*) from public.organization_listings)<>1 then raise exception 'Draft leaked to applicant';end if;
 begin
 insert into public.organization_listings(organization_id,title,field,kind,description,skills,budget,duration) values('10000000-0000-0000-0000-000000000001','Spoof listing','Development','Contract project',repeat('Unauthorized project. ',3),array['React'],1000,'2 weeks');
 raise exception 'Applicant published for another organization'; exception when insufficient_privilege then null; end;
end $$;
insert into public.organization_applications(id,listing_id,applicant_id,profile,resume,introduction)
values('20000000-0000-0000-0000-000000000001',:listing_id,auth.uid(),'{"name":"Applicant","email":"applicant@example.com"}','Private resume',repeat('Relevant introduction. ',3));
do $$ begin
 begin
 update public.organization_applications set status='accepted';raise exception 'Applicant changed own decision';exception when insufficient_privilege then null;end;
 begin
 perform public.review_organization_application('20000000-0000-0000-0000-000000000001','accepted');raise exception 'Applicant accepted themselves';exception when raise_exception then if sqlerrm='Applicant accepted themselves' then raise;end if;end;
end $$;
insert into public.application_messages(application_id,sender_id,body) values('20000000-0000-0000-0000-000000000001',auth.uid(),'Private applicant message');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$ begin
 if (select count(*) from public.organization_applications)<>0 then raise exception 'Unrelated user can read resumes';end if;
 if (select count(*) from public.application_messages)<>0 then raise exception 'Unrelated user can read messages';end if;
 begin
 insert into public.application_messages(application_id,sender_id,body) values('20000000-0000-0000-0000-000000000001',auth.uid(),'Attack');raise exception 'Unrelated user contacted applicant';exception when insufficient_privilege then null;end;
 begin
 perform public.review_organization_application('20000000-0000-0000-0000-000000000001','accepted');raise exception 'Unrelated user accepted applicant';exception when raise_exception then if sqlerrm='Unrelated user accepted applicant' then raise;end if;end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.review_organization_application('20000000-0000-0000-0000-000000000001','accepted');
do $$ begin
 if (select status from public.organization_applications limit 1)<>'accepted' then raise exception 'Owner decision failed';end if;
 if (select count(*) from public.application_messages)<>1 then raise exception 'Owner cannot read applicant message';end if;
end $$;
insert into public.application_messages(application_id,sender_id,body) values('20000000-0000-0000-0000-000000000001',auth.uid(),'Let us discuss the project.');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select status from public.organization_applications limit 1)<>'accepted' then raise exception 'Applicant cannot see decision';end if;
 if (select count(*) from public.application_messages)<>2 then raise exception 'Applicant cannot read organization reply';end if;
end $$;
select public.withdraw_organization_application('20000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$ begin
 begin
 perform public.review_organization_application('20000000-0000-0000-0000-000000000001','accepted');raise exception 'Owner changed withdrawn application';exception when raise_exception then if sqlerrm='Owner changed withdrawn application' then raise;end if;end;
end $$;
reset role;
set role anon;
do $$ begin
 if (select count(*) from public.organization_listings)<>1 then raise exception 'Anonymous draft exposure';end if;
 begin
 perform count(*) from public.organization_applications;raise exception 'Anonymous application access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Organization ownership, publication, decisions, applicant privacy and message RLS passed' as result;
