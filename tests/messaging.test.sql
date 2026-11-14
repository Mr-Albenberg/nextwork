\set ON_ERROR_STOP on
create or replace function public.chat_test_assert(ok boolean,msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'Chat test failed: %',msg; end if; end $$;
-- Four accounts, including a hiring account; no real users or live database are touched.
insert into auth.users(id) values('00000000-0000-0000-0000-000000000003');
insert into auth.users(id,raw_user_meta_data) values('00000000-0000-0000-0000-000000000004','{"account_kind":"organization"}');
insert into public.account_workspaces(user_id,profile) values
 ('00000000-0000-0000-0000-000000000001','{"name":"Alex","role":"Developer","skills":"React, SQL","email":"never-exposed@example.com"}'),
 ('00000000-0000-0000-0000-000000000002','{"name":"Taylor","role":"Designer","skills":"Figma"}'),
 ('00000000-0000-0000-0000-000000000003','{"name":"Outsider"}');
insert into public.organizations(owner_id,name,description) values('00000000-0000-0000-0000-000000000004','Real startup','A real organization profile');
select public.chat_test_assert(not has_function_privilege('anon','public.chat_send_message(uuid,uuid,text,jsonb,uuid[])','execute'),'anonymous RPC denied');
select public.chat_test_assert(not has_table_privilege('anon','public.chat_messages','select'),'anonymous reads denied');
select public.chat_test_assert(not has_table_privilege('authenticated','public.chat_messages','insert'),'sender spoofing via direct insert denied');
select public.chat_test_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,5)='chat_' and p.prosecdef),'public APIs are invoker wrappers');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
update public.account_workspaces set profile=jsonb_set(profile,'{role}','"Frontend developer"') where user_id=auth.uid();
select public.chat_test_assert((select role='Frontend developer' from public.chat_profiles where user_id=auth.uid()),'directory sync trigger respects profile edits');
select public.chat_sync_profile();
select public.chat_test_assert(public.chat_setup_version()=1,'private bucket activation check');
select public.chat_test_assert((select count(*)=1 from public.chat_search_people('Real startup')),'organization discoverable');
select public.chat_test_assert(not exists(select 1 from public.chat_profiles where to_jsonb(chat_profiles)::text like '%never-exposed%'),'directory excludes private email');
select public.chat_start_conversation('00000000-0000-0000-0000-000000000002') as conversation \gset
select public.chat_test_assert(public.chat_start_conversation('00000000-0000-0000-0000-000000000002')=:'conversation','one conversation per pair');
select public.chat_reserve_attachment(:'conversation','notes.txt',5) as unused;
select id as attachment,path as filepath from public.chat_attachments where conversation_id=:'conversation' \gset
insert into storage.objects(bucket_id,name,metadata) values('message-attachments',:'filepath','{"size":5}');
select public.chat_test_assert(chat_private.chat_can_read_file(:'filepath'),'sender reads staged own file');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.chat_test_assert(not chat_private.chat_can_read_file(:'filepath'),'recipient cannot read unsent upload');
select public.chat_test_assert((select count(*)=0 from public.chat_attachments),'recipient cannot see staged metadata');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.chat_send_message(:'conversation','10000000-0000-0000-0000-000000000001','Hello Taylor','{"id":7,"title":"A paid project","company":"Startup"}',array[:'attachment'::uuid]);
select public.chat_send_message(:'conversation','10000000-0000-0000-0000-000000000001','Hello Taylor','{"id":7,"title":"A paid project","company":"Startup"}',array[:'attachment'::uuid]);
select public.chat_test_assert((select count(*)=1 from public.chat_messages),'retry is idempotent');
select public.chat_test_assert((select unread=0 from public.chat_inbox()),'sender message marked read');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.chat_test_assert((select body='Hello Taylor' from public.chat_messages),'recipient receives actual sender content');
select public.chat_test_assert((select unread=1 from public.chat_inbox()),'recipient unread count');
select public.chat_test_assert((select sender_id='00000000-0000-0000-0000-000000000001' from public.chat_messages),'sender attributed by server');
select public.chat_test_assert(chat_private.chat_can_read_file(:'filepath'),'recipient can download sent file');
select public.chat_test_assert(not chat_private.chat_can_upload_file(:'filepath'),'sent uploads cannot be replaced');
select public.chat_set_state(:'conversation',true,true,true);
select public.chat_test_assert((select saved and archived and unread=0 from public.chat_inbox()),'recipient preferences and read state saved');
select public.chat_send_message(:'conversation','10000000-0000-0000-0000-000000000002','Reply');
select public.chat_test_assert((select count(*)=2 from public.chat_messages),'reply stored in same shared conversation');
select public.chat_test_assert((select count(*)=1 from public.chat_memberships),'other participant preferences remain private');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select set_config('chat.test_conversation',:'conversation',false);
select public.chat_test_assert((select count(*)=0 from public.chat_messages),'outsider cannot read messages');
select public.chat_test_assert((select count(*)=0 from public.chat_inbox()),'outsider cannot read inbox');
select public.chat_test_assert((select count(*)=0 from storage.objects),'outsider cannot read private files');
select public.chat_test_assert(not chat_private.chat_can_delete_file(:'filepath'),'outsider cannot delete files');
-- Run denied mutations with real role + JWT claims, not mocked policy strings.
do $$ declare c uuid; begin
 begin perform public.chat_send_message(current_setting('chat.test_conversation')::uuid,'10000000-0000-0000-0000-000000000003','Forged');raise exception 'Unexpected send'; exception when insufficient_privilege then null; end;
 begin perform public.chat_delete_message('10000000-0000-0000-0000-000000000001');raise exception 'Unexpected delete'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.chat_test_assert((select not saved from public.chat_inbox()),'other user cannot change my saved state');
select public.chat_test_assert((select unread=1 and not archived from public.chat_inbox()),'reply reaches original sender');
-- A confirmed send cannot silently consume a subsequently edited retry.
do $$ declare c uuid; begin
 select id into c from public.chat_conversations limit 1;
 begin perform public.chat_send_message(c,'10000000-0000-0000-0000-000000000001','Changed draft');raise exception 'Unexpected changed retry'; exception when no_data_found then null; end;
end $$;
-- Pending files and missing listing IDs cannot be smuggled into messages.
do $$ declare c uuid; f public.chat_attachments; begin
 select id into c from public.chat_conversations limit 1;
 f:=public.chat_reserve_attachment(c,'not-uploaded.txt',5);
 begin perform public.chat_send_message(c,'10000000-0000-0000-0000-000000000004','',null,array[f.id]);raise exception 'Unexpected send'; exception when raise_exception then if sqlerrm='Unexpected send' then raise; end if; end;
 begin perform public.chat_send_message(c,'10000000-0000-0000-0000-000000000005','','{"title":"Missing ID"}');raise exception 'Unexpected listing'; exception when raise_exception then if sqlerrm='Unexpected listing' then raise; end if; end;
 perform public.chat_discard_attachment(f.id);
end $$;
select public.chat_delete_message('10000000-0000-0000-0000-000000000001');
select public.chat_test_assert((select deleted_at is not null and body='' and listing is null from public.chat_messages where id='10000000-0000-0000-0000-000000000001'),'delete produces tombstone');
select public.chat_test_assert(not chat_private.chat_can_read_file(:'filepath'),'deleted message files no longer downloadable');
reset role;
-- Account removal cascades through conversation data and revokes access to any orphaned blobs.
delete from auth.users where id='00000000-0000-0000-0000-000000000002';
select public.chat_test_assert((select count(*)=0 from public.chat_conversations),'deleted account removes conversation');
select public.chat_test_assert((select count(*)=0 from public.chat_messages),'deleted account removes associated messages');
select public.chat_test_assert((select count(*)=0 from public.chat_attachments),'deleted account removes attachment metadata');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.chat_test_assert((select count(*)=0 from public.chat_profiles),'deleted account token cannot browse member directory');
reset role;
drop function public.chat_test_assert(boolean,text);
