\set ON_ERROR_STOP on
-- Decision notes, reapplying, and application resume files. Requires migrations 001–004 and 009 plus storage-bootstrap.sql.
begin;
insert into auth.users(id,raw_user_meta_data) values
('90000000-0000-0000-0000-000000000001','{"account_kind":"organization"}'),
('90000000-0000-0000-0000-000000000002','{}'),
('90000000-0000-0000-0000-000000000003','{}'),
('90000000-0000-0000-0000-000000000004','{"account_kind":"organization"}');
do $$ begin
 if (select public from storage.buckets where id='application-resumes') then raise exception 'Public application resume bucket';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000001';
insert into public.organizations(id,owner_id,name) values('91000000-0000-0000-0000-000000000001',auth.uid(),'Lifecycle Org');
insert into public.organization_listings(organization_id,title,field,kind,description,skills,budget,duration,status)
values('91000000-0000-0000-0000-000000000001','Lifecycle listing','Development','Contract project',repeat('A useful paid development project. ',3),array['React'],1000,'2 weeks','published') returning id as listing_id \gset
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000004';
insert into public.organizations(id,owner_id,name) values('91000000-0000-0000-0000-000000000002',auth.uid(),'Other Org');

-- Applicants cannot pre-fill decision fields.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000002';
do $$ begin
 begin
 insert into public.organization_applications(listing_id,applicant_id,profile,introduction,decision_note) select id,auth.uid(),'{"name":"A"}',repeat('Relevant introduction. ',3),'Accepted already' from public.organization_listings where title='Lifecycle listing';
 raise exception 'Applicant forged a decision note';exception when insufficient_privilege then null;end;
 begin
 insert into public.organization_applications(listing_id,applicant_id,profile,introduction,attempt) select id,auth.uid(),'{"name":"A"}',repeat('Relevant introduction. ',3),3 from public.organization_listings where title='Lifecycle listing';
 raise exception 'Applicant forged an attempt count';exception when insufficient_privilege then null;end;
end $$;
insert into public.organization_applications(id,listing_id,applicant_id,profile,resume,introduction)
values('92000000-0000-0000-0000-000000000001',:listing_id,auth.uid(),'{"name":"Applicant"}','Resume text',repeat('Relevant introduction. ',3));

-- Resume files: applicant may upload under their own application only, with a safe name.
insert into storage.objects(bucket_id,name) values('application-resumes','92000000-0000-0000-0000-000000000001/resume-1.pdf');
select public.attach_application_resume('92000000-0000-0000-0000-000000000001','{"name":"My resume.pdf","size":2048,"path":"92000000-0000-0000-0000-000000000001/resume-1.pdf","type":"application/pdf"}');
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('application-resumes','92000000-0000-0000-0000-000000000001/../escape.pdf');
 raise exception 'Unsafe path allowed';exception when insufficient_privilege then null;end;
 begin
 perform public.attach_application_resume('92000000-0000-0000-0000-000000000001','{"name":"x.pdf","size":1,"path":"90000000-0000-0000-0000-000000000002/resume.pdf"}');
 raise exception 'Foreign resume path attached';exception when raise_exception then if sqlerrm='Foreign resume path attached' then raise;end if;end;
 begin
 perform public.reapply_organization_application('92000000-0000-0000-0000-000000000001','{"name":"Applicant"}','',repeat('New introduction here. ',3));
 raise exception 'Reapplied while still submitted';exception when raise_exception then if sqlerrm='Reapplied while still submitted' then raise;end if;end;
end $$;

-- Another applicant cannot see or add files to this application.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000003';
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='application-resumes') then raise exception 'Resume file leaked to another applicant';end if;
 begin
 insert into storage.objects(bucket_id,name) values('application-resumes','92000000-0000-0000-0000-000000000001/forged.pdf');
 raise exception 'Cross-application upload allowed';exception when insufficient_privilege then null;end;
end $$;

-- Another organization cannot read or decide.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000004';
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='application-resumes') then raise exception 'Resume file leaked to another organization';end if;
 begin
 perform public.decide_organization_application('92000000-0000-0000-0000-000000000001','accepted','Hi');
 raise exception 'Other organization decided';exception when raise_exception then if sqlerrm='Other organization decided' then raise;end if;end;
end $$;

-- The hiring organization reads the file and declines with a note.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='application-resumes') then raise exception 'Organization cannot read resume file';end if;
 perform public.decide_organization_application('92000000-0000-0000-0000-000000000001','declined','Please reapply with a portfolio link.');
 begin
 insert into storage.objects(bucket_id,name) values('application-resumes','92000000-0000-0000-0000-000000000001/org.pdf');
 raise exception 'Organization uploaded applicant file';exception when insufficient_privilege then null;end;
end $$;

-- The applicant sees the note and reapplies; decision fields reset.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000002';
do $$ declare r record; begin
 select * into r from public.organization_applications where id='92000000-0000-0000-0000-000000000001';
 if r.status<>'declined' or r.decision_note<>'Please reapply with a portfolio link.' or r.decided_at is null then raise exception 'Decision note not visible';end if;
 perform public.reapply_organization_application(r.id,'{"name":"Applicant","portfolio":"https://example.com"}','New resume',repeat('Updated introduction. ',3));
 select * into r from public.organization_applications where id='92000000-0000-0000-0000-000000000001';
 if r.status<>'submitted' or r.attempt<>2 or r.decision_note<>'' or r.decided_at is not null or r.resume_file is not null or r.reapplied_at is null then raise exception 'Reapply did not reset the application';end if;
end $$;

-- Organizations cannot reapply; closed listings cannot be reapplied to.
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000001';
select public.decide_organization_application('92000000-0000-0000-0000-000000000001','declined','');
update public.organization_listings set status='closed' where title='Lifecycle listing';
set request.jwt.claim.sub='90000000-0000-0000-0000-000000000002';
do $$ begin
 begin
 perform public.reapply_organization_application('92000000-0000-0000-0000-000000000001','{"name":"Applicant"}','',repeat('Updated introduction. ',3));
 raise exception 'Reapplied to a closed listing';exception when raise_exception then if sqlerrm='Reapplied to a closed listing' then raise;end if;end;
end $$;
reset role;
rollback;
