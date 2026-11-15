-- Sample creators participate in normal private messaging but can never sign in.
begin;
-- Fixed IDs are also used by the public catalog. No email, password, or OAuth
-- identity is created. A permanent ban also rejects passwordless authentication.
create or replace function chat_private.sample_creator_number(member uuid) returns integer
language sql immutable set search_path='' as $$
 select case when member::text ~ '^5a000000-0000-4000-8000-0000000000(0[1-9]|1[0-4])$'
 then right(member::text,2)::integer end;
$$;
revoke all on function chat_private.sample_creator_number(uuid) from public,anon;
grant execute on function chat_private.sample_creator_number(uuid) to authenticated;
create or replace function chat_private.lock_sample_login() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if chat_private.sample_creator_number(new.id) is not null then
  new.banned_until:='infinity'::timestamptz;
  new.email:=null;
  new.phone:=null;
  new.encrypted_password:=null;
 end if;
 return new;
end $$;
revoke all on function chat_private.lock_sample_login() from public,anon,authenticated;
create trigger lock_sample_creator_login before insert or update on auth.users
for each row execute function chat_private.lock_sample_login();
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000001', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000001','Forma','We help independent shops manage bookings, payments, and everyday customer relationships.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000001','Maya Chen','Co-founder & product lead','Forma','We help independent shops manage bookings, payments, and everyday customer relationships.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000002', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000002','Canopy','Canopy turns operational sustainability data into decisions small businesses can act on.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000002','Noah Rivera','Founder & engineering lead','Canopy','Canopy turns operational sustainability data into decisions small businesses can act on.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000003', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000003','Orbit','Orbit is building a financial-planning product that helps people make sense of everyday money decisions.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000003','Priya Shah','Head of product & analytics','Orbit','Orbit is building a financial-planning product that helps people make sense of everyday money decisions.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000004', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000004','Gather','Gather helps neighborhood makers introduce their products to nearby customers.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000004','Amara Brooks','Co-founder & community lead','Gather','Gather helps neighborhood makers introduce their products to nearby customers.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000005', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000005','Goodwell','Goodwell helps people navigate the administrative parts of finding and arranging care.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000005','Elena Park','Founder & service design lead','Goodwell','Goodwell helps people navigate the administrative parts of finding and arranging care.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000006', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000006','Relay','Relay builds lightweight collaboration tools for small remote teams.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000006','Sam Okafor','Product lead','Relay','Relay builds lightweight collaboration tools for small remote teams.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000007', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000007','Patchwork','Patchwork gives community spaces a simple way to organize room and event bookings.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000007','Casey Morgan','Founder & frontend lead','Patchwork','Patchwork gives community spaces a simple way to organize room and event bookings.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000008', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000008','Tallywell','Tallywell helps subscription businesses understand how customers begin using their products.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000008','Jordan Patel','Co-founder & data lead','Tallywell','Tallywell helps subscription businesses understand how customers begin using their products.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000009', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000009','Kindred','Kindred builds approachable scheduling tools for essential local services.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000009','Avery Ellis','Co-founder & product designer','Kindred','Kindred builds approachable scheduling tools for essential local services.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000010', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000010','Sproutly','Sproutly connects local food growers with customers in their neighborhoods.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000010','Leila Ahmed','Founder & growth lead','Sproutly','Sproutly connects local food growers with customers in their neighborhoods.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000011', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000011','Dockside','Dockside builds integrations that make support teams’ day-to-day tools work together.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000011','Leo Santos','Founder & backend engineer','Dockside','Dockside builds integrations that make support teams’ day-to-day tools work together.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000012', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000012','Clearpath','Clearpath helps growing teams make customer onboarding more consistent.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000012','Taylor Nguyen','Operations lead','Clearpath','Clearpath helps growing teams make customer onboarding more consistent.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000013', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000013','Looma','Looma is building a consistent, accessible interface for a young consumer product.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000013','Sofia Ramirez','Design lead','Looma','Looma is building a consistent, accessible interface for a young consumer product.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data,banned_until) values ('5a000000-0000-4000-8000-000000000014', '{"nextwork_sample":true}', '{"account_kind":"organization"}', 'infinity');
insert into public.organizations(owner_id,name,description) values ('5a000000-0000-4000-8000-000000000014','Signal Garden','Signal Garden helps small product teams communicate clearly with new customers.');
insert into public.chat_profiles(user_id,name,role,company,bio) values ('5a000000-0000-4000-8000-000000000014','Devon James','Founder & content strategist','Signal Garden','Signal Garden helps small product teams communicate clearly with new customers.') on conflict(user_id) do update set name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio;

-- Defense in depth: even a token claiming a sample creator cannot use chat.
create or replace function chat_private.chat_account_exists() returns boolean
language sql stable security definer set search_path='' as $$
 select chat_private.sample_creator_number(auth.uid()) is null
 and exists(select 1 from auth.users where id=auth.uid());
$$;
create or replace function chat_private.chat_is_member(conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select chat_private.sample_creator_number(auth.uid()) is null and exists(
 select 1 from public.chat_conversations c where c.id=conversation and auth.uid() in(c.member_a,c.member_b));
$$;
create policy "Sample creators cannot read conversations" on public.chat_conversations
as restrictive for select to authenticated using(chat_private.sample_creator_number(auth.uid()) is null);
create policy "Sample creators cannot read inbox state" on public.chat_memberships
as restrictive for select to authenticated using(chat_private.sample_creator_number(auth.uid()) is null);
commit;
