begin;
create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(length(name) between 2 and 120), website text not null default '' check(length(website)<=500),
 description text not null default '' check(length(description)<=5000), contact_email text not null default '' check(length(contact_email)<=250), created_at timestamptz not null default now()
);
create table if not exists public.organization_listings (
 id bigint generated always as identity(start with 1001) primary key, organization_id uuid not null references public.organizations(id),
 title text not null check(length(title) between 5 and 150), field text not null check(field in ('Development','Design','Data & Analytics','Marketing','Business')),
 kind text not null check(kind in ('Contract project','Full-time job','Part-time job')), description text not null check(length(description) between 50 and 12000),
 skills text[] not null check(cardinality(skills) between 1 and 20), requirements text[] not null default '{}' check(cardinality(requirements)<=20),
 deliverables text not null default '' check(length(deliverables)<=6000), budget integer not null check(budget>0), duration text not null check(length(duration) between 2 and 100),
 location text not null default 'Remote' check(length(location)<=200), status text not null default 'draft' check(status in ('draft','published','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.organization_applications (
 id uuid primary key default gen_random_uuid(), listing_id bigint not null references public.organization_listings(id), applicant_id uuid not null references auth.users(id),
 profile jsonb not null check(jsonb_typeof(profile)='object' and octet_length(profile::text)<=25000), resume text not null default '' check(length(resume)<=30000),
 introduction text not null check(length(introduction) between 30 and 6000), status text not null default 'submitted' check(status in ('submitted','shortlisted','accepted','declined','withdrawn')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(listing_id,applicant_id)
);
create table if not exists public.application_messages (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.organization_applications(id), sender_id uuid not null references auth.users(id),
 body text not null check(length(body) between 1 and 4000), created_at timestamptz not null default now()
);
create index if not exists organization_applications_listing on public.organization_applications(listing_id);
create index if not exists application_messages_application on public.application_messages(application_id,created_at);
create or replace function public.owns_organization(org uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organizations where id=org and owner_id=(select auth.uid())); $$;
create or replace function public.can_read_application(app uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organization_applications a join public.organization_listings l on l.id=a.listing_id join public.organizations o on o.id=l.organization_id where a.id=app and (a.applicant_id=(select auth.uid()) or o.owner_id=(select auth.uid()))); $$;
revoke all on function public.owns_organization(uuid), public.can_read_application(uuid) from public,anon;
grant execute on function public.owns_organization(uuid), public.can_read_application(uuid) to authenticated;
alter table public.organizations enable row level security;
alter table public.organization_listings enable row level security;
alter table public.organization_applications enable row level security;
alter table public.application_messages enable row level security;
revoke all on public.organizations,public.organization_listings,public.organization_applications,public.application_messages from anon,authenticated;
grant select on public.organizations,public.organization_listings to anon,authenticated;
grant insert,update on public.organizations,public.organization_listings to authenticated;
grant usage,select on sequence public.organization_listings_id_seq to authenticated;
grant select,insert on public.organization_applications,public.application_messages to authenticated;
create policy "Organization profiles public" on public.organizations for select using(true);
create policy "Create own organization" on public.organizations for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Edit own organization" on public.organizations for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Published listings public" on public.organization_listings for select using(status='published');
create policy "Owners read all listing states" on public.organization_listings for select to authenticated using(public.owns_organization(organization_id));
create policy "Owners create listings" on public.organization_listings for insert to authenticated with check(public.owns_organization(organization_id));
create policy "Owners edit listings" on public.organization_listings for update to authenticated using(public.owns_organization(organization_id)) with check(public.owns_organization(organization_id));
create policy "Application participants read" on public.organization_applications for select to authenticated using(applicant_id=(select auth.uid()) or public.can_read_application(id));
create policy "Applicants submit as themselves" on public.organization_applications for insert to authenticated with check(applicant_id=(select auth.uid()) and status='submitted' and exists(select 1 from public.organization_listings l where l.id=listing_id and l.status='published' and not public.owns_organization(l.organization_id)));
create policy "Participants read messages" on public.application_messages for select to authenticated using(public.can_read_application(application_id));
create policy "Participants send as themselves" on public.application_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.can_read_application(application_id));
create or replace function public.review_organization_application(app uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
begin
 if decision not in ('submitted','shortlisted','accepted','declined') then raise exception 'Invalid decision'; end if;
 update public.organization_applications a set status=decision,updated_at=now() from public.organization_listings l,public.organizations o where a.id=app and a.listing_id=l.id and l.organization_id=o.id and o.owner_id=(select auth.uid()) and a.status<>'withdrawn';
 if not found then raise exception 'Application unavailable or access denied'; end if;
end $$;
create or replace function public.withdraw_organization_application(app uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.organization_applications set status='withdrawn',updated_at=now() where id=app and applicant_id=(select auth.uid());
 if not found then raise exception 'Application unavailable or access denied'; end if;
end $$;
revoke all on function public.review_organization_application(uuid,text),public.withdraw_organization_application(uuid) from public,anon;
grant execute on function public.review_organization_application(uuid,text),public.withdraw_organization_application(uuid) to authenticated;
commit;
