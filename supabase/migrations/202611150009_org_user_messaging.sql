-- Messaging is only between one organization account and one personal account.
-- Applying to a listing is not required. Apply after migration 005.

create or replace function chat_private.chat_pair_allowed(first_member uuid, second_member uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations where owner_id=first_member)
     <> exists(select 1 from public.organizations where owner_id=second_member);
$$;
revoke all on function chat_private.chat_pair_allowed(uuid,uuid) from public,anon;
grant execute on function chat_private.chat_pair_allowed(uuid,uuid) to authenticated;

-- Members only discover accounts they are allowed to message.
create or replace function public.chat_search_people(query text default '') returns setof public.chat_profiles
language sql stable security invoker set search_path='' as $$
 select p.* from public.chat_profiles p where p.user_id<>auth.uid()
 and chat_private.chat_pair_allowed(auth.uid(),p.user_id)
 and position(lower(left(trim(query),100)) in lower(p.name||' '||p.company||' '||p.role||' '||array_to_string(p.skills,' ')))>0
 order by p.name,p.user_id limit 40;
$$;
revoke all on function public.chat_search_people(text) from public,anon;
grant execute on function public.chat_search_people(text) to authenticated;

create or replace function chat_private.chat_start_conversation(recipient uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 if actor is null or recipient=actor then raise exception 'Choose another member' using errcode='42501'; end if;
 if not exists(select 1 from public.chat_profiles where user_id=recipient) then raise exception 'Member unavailable'; end if;
 if not chat_private.chat_pair_allowed(actor,recipient) then raise exception 'Messages are only between organizations and personal accounts' using errcode='42501'; end if;
 perform chat_private.chat_sync_profile();
 insert into public.chat_conversations(member_a,member_b) values(least(actor,recipient),greatest(actor,recipient))
 on conflict(member_a,member_b) do update set member_a=excluded.member_a returning id into result;
 insert into public.chat_memberships(conversation_id,user_id) values(result,actor),(result,recipient) on conflict do nothing;
 return result;
end $$;

-- Older conversations between two personal or two organization accounts stay readable but cannot receive new messages.
create or replace function chat_private.chat_enforce_pair() returns trigger
language plpgsql security definer set search_path='' as $$
declare first_member uuid; second_member uuid;
begin
 select member_a,member_b into first_member,second_member from public.chat_conversations where id=new.conversation_id;
 if not chat_private.chat_pair_allowed(first_member,second_member) then
  raise exception 'Messages are only between organizations and personal accounts' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function chat_private.chat_enforce_pair() from public,anon,authenticated;
drop trigger if exists chat_pair_rule on public.chat_messages;
create trigger chat_pair_rule before insert on public.chat_messages for each row execute function chat_private.chat_enforce_pair();
