\set ON_ERROR_STOP on
-- Run after messaging.test.sql and migration 013, against the disposable CI DB.
reset role;
create or replace function public.chat_test_assert(ok boolean,msg text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'Sample chat test failed: %',msg; end if; end $$;
select public.chat_test_assert((select count(*)=14 from auth.users where banned_until='infinity' and email is null and phone is null and encrypted_password is null),'all sample creators have no credentials and a permanent login ban');
update auth.users set banned_until=null,email='attempt@example.com',encrypted_password='attempt' where id='5a000000-0000-4000-8000-000000000001';
select public.chat_test_assert((select banned_until='infinity' and email is null and encrypted_password is null from auth.users where id='5a000000-0000-4000-8000-000000000001'),'sample credentials cannot be enabled');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.chat_test_assert((select count(*)=1 from public.chat_search_people('Maya Chen')),'sample creators are discoverable');
select public.chat_start_conversation('5a000000-0000-4000-8000-000000000001') as sample_conversation \gset
select public.chat_send_message(:'sample_conversation','60000000-0000-4000-8000-000000000001','Hello Maya') as sample_message \gset
select public.chat_test_assert((select count(*)=1 from public.chat_messages where id=:'sample_message' and body='Hello Maya'),'sample messages use normal message rows');
select public.chat_test_assert(public.chat_start_conversation('5a000000-0000-4000-8000-000000000001')=:'sample_conversation','sample conversation is reused');
select public.chat_edit_message(:'sample_message','Updated message');
select public.chat_test_assert((select body='Updated message' from public.chat_messages where id=:'sample_message'),'normal message editing works');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.chat_test_assert(not exists(select 1 from public.chat_messages where conversation_id=:'sample_conversation'),'another sender cannot read sample messages');
select public.chat_test_assert(not exists(select 1 from public.chat_inbox() where id=:'sample_conversation'),'another sender cannot see sample inbox');
select public.chat_start_conversation('5a000000-0000-4000-8000-000000000001') as other_conversation \gset
select public.chat_test_assert(:'other_conversation'<>:'sample_conversation','senders get separate private conversations');
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000001',false);
select public.chat_test_assert(not exists(select 1 from public.chat_messages),'sample identity cannot read messages even with a claimed token');
select public.chat_test_assert(not exists(select 1 from public.chat_inbox()),'sample identity cannot read inbox');
reset role;

drop function public.chat_test_assert(boolean,text);
