-- Real direct messages. Apply after migrations 001 through 004 in the Supabase SQL editor.
begin;
create schema if not exists chat_private;
revoke all on schema chat_private from public,anon;
grant usage on schema chat_private to authenticated;
create table if not exists public.chat_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), role text not null default '',
 company text not null default '', bio text not null default '' check(length(bio)<=2000),
 skills text[] not null default '{}' check(cardinality(skills)<=40), updated_at timestamptz not null default now()
);
create table if not exists public.chat_conversations (
 id uuid primary key default gen_random_uuid(), member_a uuid not null references public.chat_profiles(user_id) on delete cascade,
 member_b uuid not null references public.chat_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(), last_message_at timestamptz not null default now(),
 check(member_a<member_b), unique(member_a,member_b)
);
create table if not exists public.chat_memberships (
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 user_id uuid not null references public.chat_profiles(user_id) on delete cascade,
 saved boolean not null default false, archived boolean not null default false,
 last_read_at timestamptz not null default '-infinity', primary key(conversation_id,user_id)
);
create table if not exists public.chat_messages (
 id uuid primary key, conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 sender_id uuid not null references public.chat_profiles(user_id) on delete cascade,
 body text not null default '' check(length(body)<=4000), listing jsonb,
 created_at timestamptz not null default now(), deleted_at timestamptz,
 check(listing is null or (jsonb_typeof(listing)='object' and octet_length(listing::text)<=4000))
);
create table if not exists public.chat_attachments (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 uploaded_by uuid not null references public.chat_profiles(user_id) on delete cascade,
 message_id uuid references public.chat_messages(id) on delete cascade,
 name text not null check(length(name) between 1 and 255), size_bytes bigint not null check(size_bytes between 0 and 10485760),
 path text not null unique, created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread on public.chat_messages(conversation_id,created_at,id);
create index if not exists chat_messages_sender on public.chat_messages(sender_id,created_at);
create index if not exists chat_attachments_conversation on public.chat_attachments(conversation_id);
create index if not exists chat_attachments_owner on public.chat_attachments(uploaded_by);
create index if not exists chat_attachments_message on public.chat_attachments(message_id);
create index if not exists chat_conversations_b on public.chat_conversations(member_b);
create index if not exists chat_memberships_user on public.chat_memberships(user_id);

-- Only these intentionally public profile fields are discoverable by signed-in users.
-- Email addresses, resumes and private application snapshots are never copied.
insert into public.chat_profiles(user_id,name,role,company,bio,skills)
select w.user_id,left(trim(w.profile->>'name'),120),left(coalesce(w.profile->>'role','Member'),120),'',
 left(coalesce(w.profile->>'bio',''),2000), (string_to_array(coalesce(w.profile->>'skills',''),','))[1:40]
from public.account_workspaces w where length(trim(coalesce(w.profile->>'name','')))>0
on conflict(user_id) do nothing;
insert into public.chat_profiles(user_id,name,role,company,bio)
select owner_id,left(name,120),'Organization',left(name,120),left(description,2000) from public.organizations
on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;

create or replace function chat_private.chat_account_exists() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid());
$$;
create or replace function chat_private.chat_is_member(conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_conversations c where c.id=conversation and auth.uid() in(c.member_a,c.member_b));
$$;
alter table public.chat_profiles enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_memberships enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_attachments enable row level security;
revoke all on public.chat_profiles,public.chat_conversations,public.chat_memberships,public.chat_messages,public.chat_attachments from public,anon,authenticated;
grant select on public.chat_profiles,public.chat_conversations,public.chat_memberships,public.chat_messages,public.chat_attachments to authenticated;
drop policy if exists "Signed in profile directory" on public.chat_profiles;
create policy "Signed in profile directory" on public.chat_profiles for select to authenticated using((select chat_private.chat_account_exists()));
drop policy if exists "Direct conversation participants" on public.chat_conversations;
create policy "Direct conversation participants" on public.chat_conversations for select to authenticated using(auth.uid() in(member_a,member_b));
drop policy if exists "Own inbox preferences" on public.chat_memberships;
create policy "Own inbox preferences" on public.chat_memberships for select to authenticated using(user_id=auth.uid());
drop policy if exists "Private chat messages" on public.chat_messages;
create policy "Private chat messages" on public.chat_messages for select to authenticated using(chat_private.chat_is_member(conversation_id));
drop policy if exists "Private attachment metadata" on public.chat_attachments;
create policy "Private attachment metadata" on public.chat_attachments for select to authenticated using(chat_private.chat_is_member(conversation_id) and (message_id is not null or uploaded_by=auth.uid()));

create or replace function chat_private.chat_sync_profile() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p jsonb; org public.organizations;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into org from public.organizations where owner_id=actor;
 select profile into p from public.account_workspaces where user_id=actor;
 insert into public.chat_profiles(user_id,name,role,company,bio,skills) values(actor,
  left(coalesce(nullif(trim(org.name),''),nullif(trim(p->>'name'),''),'Nextwork member'),120),
  left(case when org.id is not null then 'Organization' else coalesce(p->>'role','Member') end,120),
  left(coalesce(org.name,''),120),left(coalesce(org.description,p->>'bio',''),2000),
  (string_to_array(coalesce(p->>'skills',''),','))[1:40])
 on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio,skills=excluded.skills,updated_at=now();
end $$;
create or replace function chat_private.chat_profile_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='organizations' then
  insert into public.chat_profiles(user_id,name,role,company,bio) values(new.owner_id,left(new.name,120),'Organization',left(new.name,120),left(new.description,2000))
  on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio,updated_at=now();
 elsif length(trim(coalesce(new.profile->>'name','')))>0 and not exists(select 1 from public.organizations where owner_id=new.user_id) then
  insert into public.chat_profiles(user_id,name,role,bio,skills) values(new.user_id,left(trim(new.profile->>'name'),120),left(coalesce(new.profile->>'role','Member'),120),left(coalesce(new.profile->>'bio',''),2000),(string_to_array(coalesce(new.profile->>'skills',''),','))[1:40])
  on conflict(user_id) do update set name=excluded.name,role=excluded.role,bio=excluded.bio,skills=excluded.skills,updated_at=now();
 end if;
 return new;
end $$;
drop trigger if exists chat_directory_organization on public.organizations;
create trigger chat_directory_organization after insert or update on public.organizations for each row execute function chat_private.chat_profile_changed();
drop trigger if exists chat_directory_profile on public.account_workspaces;
create trigger chat_directory_profile after insert or update of profile on public.account_workspaces for each row execute function chat_private.chat_profile_changed();
create or replace function public.chat_search_people(query text default '') returns setof public.chat_profiles
language sql stable security invoker set search_path='' as $$
 select p.* from public.chat_profiles p where p.user_id<>auth.uid()
 and position(lower(left(trim(query),100)) in lower(p.name||' '||p.company||' '||p.role||' '||array_to_string(p.skills,' ')))>0
 order by p.name,p.user_id limit 40;
$$;
create or replace function chat_private.chat_start_conversation(recipient uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 if actor is null or recipient=actor then raise exception 'Choose another member' using errcode='42501'; end if;
 if not exists(select 1 from public.chat_profiles where user_id=recipient) then raise exception 'Member unavailable'; end if;
 perform chat_private.chat_sync_profile();
 insert into public.chat_conversations(member_a,member_b) values(least(actor,recipient),greatest(actor,recipient))
 on conflict(member_a,member_b) do update set member_a=excluded.member_a returning id into result;
 insert into public.chat_memberships(conversation_id,user_id) values(result,actor),(result,recipient) on conflict do nothing;
 return result;
end $$;
create or replace function chat_private.chat_set_state(conversation uuid, save boolean default null, archive boolean default null, mark_read boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not chat_private.chat_is_member(conversation) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 update public.chat_memberships set saved=coalesce(save,saved),archived=coalesce(archive,archived),last_read_at=case when mark_read then now() else last_read_at end
 where conversation_id=conversation and user_id=auth.uid();
end $$;
create or replace function chat_private.chat_reserve_attachment(conversation uuid, filename text, bytes bigint) returns public.chat_attachments
language plpgsql security definer set search_path='' as $$
declare result public.chat_attachments; key uuid:=gen_random_uuid();
begin
 if not chat_private.chat_is_member(conversation) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 if (select count(*) from public.chat_attachments where uploaded_by=auth.uid() and message_id is null and created_at>now()-interval '1 hour')>=30 then raise exception 'Too many pending attachments'; end if;
 insert into public.chat_attachments(id,conversation_id,uploaded_by,name,size_bytes,path)
 values(key,conversation,auth.uid(),filename,bytes,conversation::text||'/'||auth.uid()::text||'/'||key::text) returning * into result;
 return result;
end $$;
create or replace function chat_private.chat_send_message(conversation uuid, client_id uuid, text_body text default '', project jsonb default null, files uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.chat_messages;
begin
 if not chat_private.chat_is_member(conversation) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 -- One logical send retains its client UUID across retries and uncertain connections.
 perform pg_advisory_xact_lock(hashtextextended(client_id::text,0));
 select * into old from public.chat_messages where id=client_id;
 if found then
  if old.sender_id=actor and old.conversation_id=conversation then
   if old.body is distinct from trim(text_body) or old.listing is distinct from project or
    (select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]) from public.chat_attachments a where a.message_id=old.id) is distinct from
    (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(files) x) then
    raise exception 'The earlier send completed. Your edited draft has not been sent.' using errcode='P0002';
   end if;
   return old.id;
  end if;
  raise exception 'Message identifier unavailable' using errcode='42501';
 end if;
 if length(trim(text_body))=0 and project is null and cardinality(files)=0 then raise exception 'Empty message'; end if;
 if cardinality(files)>3 or cardinality(files)<>(select count(distinct x) from unnest(files) x) then raise exception 'Up to three different attachments allowed'; end if;
 if project is not null and (jsonb_typeof(project)<>'object' or not coalesce(project->>'id' ~ '^[1-9][0-9]*$',false) or length(coalesce(project->>'title','')) not between 1 and 250 or length(coalesce(project->>'company',''))>120) then raise exception 'Invalid listing'; end if;
 if (select count(*) from public.chat_messages where sender_id=actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Please wait before sending more messages'; end if;
 -- Lock staged files so two concurrent sends cannot claim the same upload.
 perform 1 from public.chat_attachments where id=any(files) for update;
 if (select count(*) from public.chat_attachments a where a.id=any(files) and a.uploaded_by=actor and a.conversation_id=conversation and a.message_id is null
   and exists(select 1 from storage.objects o where o.bucket_id='message-attachments' and o.name=a.path and (o.metadata->>'size')::bigint=a.size_bytes))<>cardinality(files) then raise exception 'Attachment upload incomplete or unavailable'; end if;
 insert into public.chat_messages(id,conversation_id,sender_id,body,listing) values(client_id,conversation,actor,trim(text_body),project);
 update public.chat_attachments set message_id=client_id where id=any(files);
 update public.chat_conversations set last_message_at=now() where id=conversation;
 update public.chat_memberships set archived=false,last_read_at=case when user_id=actor then now() else last_read_at end where conversation_id=conversation;
 return client_id;
end $$;
create or replace function chat_private.chat_delete_message(message uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.chat_messages set body='',listing=null,deleted_at=now() where id=message and sender_id=auth.uid() and chat_private.chat_is_member(conversation_id);
 if not found then raise exception 'Message unavailable' using errcode='42501'; end if;
end $$;
create or replace function chat_private.chat_discard_attachment(attachment uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.chat_attachments where id=attachment and uploaded_by=auth.uid() and message_id is null;
end $$;
create or replace function public.chat_inbox() returns table(
 id uuid,other_id uuid,contact jsonb,saved boolean,archived boolean,last_read_at timestamptz,unread bigint,last_message jsonb,last_message_at timestamptz
) language sql stable security invoker set search_path='' as $$
 select c.id,p.user_id,to_jsonb(p),s.saved,s.archived,s.last_read_at,
 (select count(*) from public.chat_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid() and m.deleted_at is null and m.created_at>s.last_read_at),
 (select jsonb_build_object('body',m.body,'listing',m.listing,'deleted_at',m.deleted_at,'created_at',m.created_at,
  'filename',(select a.name from public.chat_attachments a where a.message_id=m.id order by a.created_at limit 1))
  from public.chat_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),c.last_message_at
 from public.chat_conversations c join public.chat_memberships s on s.conversation_id=c.id and s.user_id=auth.uid()
 join public.chat_profiles p on p.user_id=case when c.member_a=auth.uid() then c.member_b else c.member_a end
 order by c.last_message_at desc,c.id;
$$;
-- Create the private message-attachments bucket through the Storage API or Dashboard,
-- not by inserting/deleting Storage's managed metadata tables.
create or replace function chat_private.chat_setup_version() returns integer language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null and exists(select 1 from storage.buckets where id='message-attachments' and not public and file_size_limit<=10485760 and (allowed_mime_types is null or 'application/octet-stream'=any(allowed_mime_types))) then 1 else 0 end;
$$;
create or replace function chat_private.chat_can_read_file(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_attachments a where a.path=object_path and chat_private.chat_is_member(a.conversation_id)
 and ((a.message_id is null and a.uploaded_by=auth.uid()) or exists(select 1 from public.chat_messages m where m.id=a.message_id and m.deleted_at is null)));
$$;
create or replace function chat_private.chat_can_upload_file(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_attachments a where a.path=object_path and a.uploaded_by=auth.uid() and a.message_id is null and chat_private.chat_is_member(a.conversation_id));
$$;
create or replace function chat_private.chat_can_delete_file(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_attachments a where a.path=object_path and a.uploaded_by=auth.uid() and chat_private.chat_is_member(a.conversation_id));
$$;
drop policy if exists "Chat private file reads" on storage.objects;
create policy "Chat private file reads" on storage.objects for select to authenticated using(bucket_id='message-attachments' and chat_private.chat_can_read_file(name));
drop policy if exists "Chat staged file uploads" on storage.objects;
create policy "Chat staged file uploads" on storage.objects for insert to authenticated with check(bucket_id='message-attachments' and chat_private.chat_can_upload_file(name));
drop policy if exists "Chat sender file deletion" on storage.objects;
create policy "Chat sender file deletion" on storage.objects for delete to authenticated using(bucket_id='message-attachments' and chat_private.chat_can_delete_file(name));

-- Definer implementations are outside the exposed public schema. Public RPCs are
-- invoker wrappers; only authenticated callers can reach the intended entry points.
do $$ declare f record; calls text; api text[]:=array['chat_sync_profile','chat_start_conversation','chat_set_state','chat_reserve_attachment','chat_send_message','chat_delete_message','chat_discard_attachment','chat_setup_version']; begin
 for f in select p.oid,p.oid::regprocedure as signature,p.proname,p.pronargs from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='chat_private' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.proname<>'chat_profile_changed' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  if f.proname=any(api) then
   select string_agg('$'||i,',') into calls from generate_series(1,f.pronargs) i;
   execute format('create or replace function public.%I(%s) returns %s language sql security invoker set search_path=%L as %L',f.proname,pg_get_function_arguments(f.oid),pg_get_function_result(f.oid),'','select chat_private.'||f.proname||'('||coalesce(calls,'')||')');
  end if;
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,5)='chat_' loop
  execute format('revoke all on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
-- Supabase Realtime still applies each table's SELECT policy to delivered changes.
do $$ declare t text; begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
 foreach t in array array['chat_messages','chat_conversations','chat_memberships'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
