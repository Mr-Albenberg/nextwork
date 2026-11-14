# Jack: activate real messaging

**The code is ready. The remaining work is in your existing Supabase project.**

- Supabase: [`zkoqafidgromlbvczwzy`](https://supabase.com/dashboard/project/zkoqafidgromlbvczwzy)
- Website: https://mr-albenberg.github.io/nextwork/
- Hosting: **GitHub Pages**, not Vercel.

Do not create another Supabase project or change the app's Supabase URL/key. The assistant's connected Supabase account could not access this project, so it has **not applied the database setup**. You can perform the steps below, or grant the developer access to this same project.

## 1. Create the private attachment bucket

In the existing project's **Storage** area, create a bucket with these exact settings:

| Setting | Value |
| --- | --- |
| Bucket name/ID | `message-attachments` |
| Public | **Off — private** |
| Maximum file size | **10 MB** (`10485760` bytes) |
| Allowed MIME types | `application/octet-stream` |

- [ ] Bucket exists with these settings.

The app uploads files as binary data and keeps their original names in message records. The SQL below supplies the file access policies; do not add a public-access policy.

## 2. Run the messaging migration

First verify that the existing account/organization setup has been applied. Only apply prerequisites that are actually missing, in this order:

1. [Accounts — 001](supabase/migrations/202611140001_accounts.sql)
2. [Organizations — 002](supabase/migrations/202611140002_organizations.sql)
3. [Account updates — 003](supabase/migrations/202611140003_account_updates.sql)
4. [Account types — 004](supabase/migrations/202611140004_account_types.sql)

Then open **SQL Editor** in the same project, paste the complete contents of **[005 — messaging](supabase/migrations/202611140005_messaging.sql)**, and run it.

[Downloadable copy of the same SQL](https://mr-albenberg.github.io/nextwork/messaging-setup.sql)

- [ ] Messaging SQL completed without errors.

This adds shared conversations, messages, member profiles, private attachment policies, authenticated RPCs, and Realtime publication entries. Existing account data and application conversations are retained. **Do not run anything under `tests/` against the hosted project**; those files create synthetic test accounts and database fixtures.

## 3. Check the GitHub Pages login redirects

In **Authentication → URL Configuration**, verify:

- Site URL: `https://mr-albenberg.github.io/nextwork/`
- Allowed redirect: `https://mr-albenberg.github.io/nextwork/`
- Allowed recovery redirect: `https://mr-albenberg.github.io/nextwork/?auth=recovery`

- [ ] GitHub Pages login and recovery redirects are allowed.

Keep LinkedIn's provider callback at `https://zkoqafidgromlbvczwzy.supabase.co/auth/v1/callback`.

## 4. Verify real delivery before calling it live

Use two real accounts in separate browser profiles, with recognizable profile names:

- [ ] Account A finds account B through **Messages → New conversation**.
- [ ] A sends a message; B sees it and replies without refreshing.
- [ ] Both accounts still see their messages after reloading.
- [ ] A shares a listing; B can open it.
- [ ] A attaches a file; B can download it.
- [ ] Save/archive preferences work independently for each account.
- [ ] A third account cannot see either participant's conversation or files.
- [ ] An organization account can also open Messages and send/reply.

Until the bucket and migration are configured, Messages intentionally reports that it is unavailable. The old sample contacts and account-only preview threads are not real recipients and are not migrated into real conversations.

After completing this checklist, let the developer know that setup is applied so live verification can be repeated. No admin or service-role secret belongs in the frontend, GitHub Pages files, or a chat message.
