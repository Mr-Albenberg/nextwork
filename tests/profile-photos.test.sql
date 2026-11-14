\set ON_ERROR_STOP on
insert into auth.users(id) values('00000000-0000-0000-0000-000000000004');
insert into public.account_workspaces(user_id,profile) values('00000000-0000-0000-0000-000000000004','{"name":" ","email":"","skills":"React"}');
set role service_role;
select public.fill_linkedin_profile('00000000-0000-0000-0000-000000000004','{"name":"LinkedIn name","email":"linkedin@example.com","skills":"Do not import"}');
select public.fill_linkedin_profile('00000000-0000-0000-0000-000000000001','{"name":"Do not replace","email":"do-not-replace@example.com"}');
insert into public.profile_import_state(user_id,photo_removed) values('00000000-0000-0000-0000-000000000004',true);
do $$ declare result jsonb;begin
 result:=public.commit_profile_photo('00000000-0000-0000-0000-000000000004','{"object_path":"00000000-0000-0000-0000-000000000004/10000000-0000-0000-0000-000000000004.jpg","source":"linkedin","width":100,"height":100,"byte_size":1000}',false);
 if result is not null then raise exception 'Import undid deliberate photo removal';end if;
 result:=public.commit_profile_photo('00000000-0000-0000-0000-000000000004','{"object_path":"00000000-0000-0000-0000-000000000004/10000000-0000-0000-0000-000000000004.jpg","source":"upload","width":400,"height":400,"byte_size":1000}',true);
 if result->>'source'<>'upload' then raise exception 'Manual photo not published';end if;
 result:=public.commit_profile_photo('00000000-0000-0000-0000-000000000004','{"object_path":"00000000-0000-0000-0000-000000000004/20000000-0000-0000-0000-000000000004.jpg","source":"linkedin","width":100,"height":100,"byte_size":1000}',false);
 if result->>'source'<>'upload' then raise exception 'Import replaced manual photo';end if;
end $$;
delete from public.profile_photos where user_id='00000000-0000-0000-0000-000000000004';
insert into public.profile_photos(user_id,object_path,source,width,height,byte_size) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001.jpg','upload',512,512,1000);
reset role;
do $$ begin
 if (select profile->>'name' from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000004')<>'LinkedIn name' then raise exception 'Missing name was not filled';end if;
 if (select profile->>'skills' from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000004')<>'React' then raise exception 'Unapproved field changed';end if;
 if (select profile->>'name' from public.account_workspaces where user_id='00000000-0000-0000-0000-000000000001')<>'Alice updated' then raise exception 'Existing name was overwritten';end if;
 if (select public from storage.buckets where id='profile-photos') then raise exception 'Photos are public';end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
do $$ begin
 if (select count(*) from public.profile_photos)<>1 then raise exception 'Signed-in members cannot see photo metadata';end if;
 begin
  perform public.fill_linkedin_profile(auth.uid(),'{"name":"forged"}');raise exception 'Client called trusted backfill';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.profile_photos(user_id,object_path,source,width,height,byte_size) values(auth.uid(),'00000000-0000-0000-0000-000000000004/10000000-0000-0000-0000-000000000004.jpg','upload',512,512,1000);raise exception 'Unvalidated photo write allowed';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.profile_photos;raise exception 'Member deleted photo metadata';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.profile_import_state;raise exception 'Private import state leaked';
 exception when insufficient_privilege then null;end;
end $$;
insert into storage.objects(bucket_id,name) values('profile-photo-staging','00000000-0000-0000-0000-000000000004/pending');
do $$ begin
 begin
  insert into storage.objects(bucket_id,name) values('profile-photo-staging','00000000-0000-0000-0000-000000000001/pending');raise exception 'Cross-user staging allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into storage.objects(bucket_id,name) values('profile-photo-staging','00000000-0000-0000-0000-000000000004/another-file');raise exception 'Unlimited object paths allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into storage.objects(bucket_id,name) values('profile-photos','00000000-0000-0000-0000-000000000004/10000000-0000-0000-0000-000000000004.jpg');raise exception 'Browser bypassed image processing';
 exception when insufficient_privilege then null;end;
 for i in 1..10 loop if not public.consume_photo_action('process') then raise exception 'Valid upload quota denied';end if;end loop;
 if public.consume_photo_action('process') then raise exception 'Upload quota bypassed';end if;
 begin
  delete from public.profile_photo_limits;raise exception 'Member reset their quota';
 exception when insufficient_privilege then null;end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$ begin
 if (select count(*) from storage.objects)<>0 then raise exception 'Another member read quarantine';end if;
 begin
  perform public.delete_my_account();raise exception 'Account deleted before photo cleanup';
 exception when raise_exception then if sqlerrm<>'PHOTO_CLEANUP_REQUIRED' then raise;end if;end;
 begin
  perform public.delete_account_records();raise exception 'Photo cleanup guard bypassed';
 exception when insufficient_privilege then null;end;
 if not public.consume_photo_action('process') then raise exception 'Users share upload quota';end if;
end $$;
set role anon;
reset request.jwt.claim.sub;
do $$ begin
 begin perform * from public.profile_photos;raise exception 'Anonymous photo access';exception when insufficient_privilege then null;end;
 begin perform public.consume_photo_action('process');raise exception 'Anonymous upload quota';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- A deleted user's still-unexpired JWT must not permit new staged files.
delete from auth.users where id='00000000-0000-0000-0000-000000000004';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
do $$ begin
 if public.is_active_photo_member() then raise exception 'Deleted user still active';end if;
 if (select count(*) from public.profile_photos)<>0 then raise exception 'Deleted session can read photos';end if;
 begin
  update storage.objects set name=name where bucket_id='profile-photo-staging';
  insert into storage.objects(bucket_id,name) values('profile-photo-staging','00000000-0000-0000-0000-000000000004/pending');raise exception 'Deleted session can stage files';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Photo validation boundary, signed-in visibility, private storage, owner staging, quotas, blank-only backfill and deletion cleanup guard passed' as result;
