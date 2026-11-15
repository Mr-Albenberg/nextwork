\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('80000000-0000-0000-0000-000000000001','{}'),
('80000000-0000-0000-0000-000000000002','{}'),
('80000000-0000-0000-0000-000000000003','{"account_kind":"organization"}');
do $$ begin
 if (select public from storage.buckets where id='project-files') then raise exception 'Public project bucket';end if;
 if (select file_size_limit from storage.buckets where id='project-files')<>10485760 then raise exception 'Wrong file limit';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='80000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name) values('project-files','80000000-0000-0000-0000-000000000001/project-test/file.txt');
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('project-files','80000000-0000-0000-0000-000000000002/project-test/forged.txt');
 raise exception 'Cross-account upload allowed';exception when insufficient_privilege then null;end;
 begin
 insert into storage.objects(bucket_id,name) values('project-files','80000000-0000-0000-0000-000000000001/project-test/../bad.txt');
 raise exception 'Invalid path allowed';exception when insufficient_privilege then null;end;
end $$;
set request.jwt.claim.sub='80000000-0000-0000-0000-000000000002';
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='project-files') then raise exception 'Cross-account files visible';end if;
 delete from storage.objects where bucket_id='project-files';
 if found then raise exception 'Cross-account deletion allowed';end if;
end $$;
set request.jwt.claim.sub='80000000-0000-0000-0000-000000000003';
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) values('project-files','80000000-0000-0000-0000-000000000003/project-test/file.txt');
 raise exception 'Organization used personal project storage';exception when insufficient_privilege then null;end;
end $$;
set request.jwt.claim.sub='80000000-0000-0000-0000-000000000001';
do $$ begin
 delete from storage.objects where bucket_id='project-files';
 if not found then raise exception 'Owner cannot delete';end if;
end $$;
reset role;
rollback;
