-- The caller can delete only their own authenticated account. No user ID is accepted.
begin;
alter table public.account_workspaces add column if not exists extras jsonb not null default '{}'::jsonb check (jsonb_typeof(extras)='object' and octet_length(extras::text)<=2000000);
commit;
