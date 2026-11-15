-- Only the sender may change message text; attachments, identity and send time stay intact.
begin;
alter table public.chat_messages add column if not exists edited_at timestamptz;
create or replace function chat_private.chat_edit_message(message uuid, text_body text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to edit messages' using errcode='42501'; end if;
 if text_body is null or length(trim(text_body))=0 or length(text_body)>4000 then
  raise exception 'Write a message of up to 4,000 characters' using errcode='22023';
 end if;
 -- Lock and check ownership even for unchanged text.
 perform 1 from public.chat_messages m where m.id=message and m.sender_id=auth.uid()
  and m.deleted_at is null and chat_private.chat_is_member(m.conversation_id) for update;
 if not found then raise exception 'Message unavailable' using errcode='42501'; end if;
 update public.chat_messages m set body=trim(text_body),edited_at=now()
  where m.id=message and m.body is distinct from trim(text_body);
end $$;
create or replace function public.chat_edit_message(message uuid, text_body text)
returns void language sql security invoker set search_path='' as $$
 select chat_private.chat_edit_message(message,text_body);
$$;
revoke all on function chat_private.chat_edit_message(uuid,text) from public,anon,authenticated;
revoke all on function public.chat_edit_message(uuid,text) from public,anon,authenticated;
grant execute on function chat_private.chat_edit_message(uuid,text) to authenticated;
grant execute on function public.chat_edit_message(uuid,text) to authenticated;
commit;
