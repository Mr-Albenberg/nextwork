# Nextwork

[Find paid projects](https://mr-albenberg.github.io/nextwork/) · [Set up your profile](https://mr-albenberg.github.io/nextwork/#profile) · [Resume Studio](https://mr-albenberg.github.io/nextwork/#resume)

A graduate marketplace for paid, scoped startup projects. Browse and filter opportunities, compare resume evidence with a listing, save opportunities, and prepare an application.

## Run and test

No frontend dependencies or build step:

```sh
python3 -m http.server 3000 --directory dist
node tests/resume.test.js
node tests/listing-match.test.js
node tests/profile-and-criteria.test.js
```

`dist/` is the static application. `docs/` mirrors it for GitHub Pages. `api/resume.js` is the Vercel Node function. Static files changed in `dist/` must be copied into `docs/` too; CI verifies this.

## Appearance

Click the theme icon button to cycle through Light (sun), Dark (moon), and System (computer). System is the default and follows device appearance changes automatically. Your choice is saved in this browser and synced across open tabs. Theme switching also works when browser storage is unavailable.

Browser checks: serve `dist/` on port 3000, install Playwright, then run `node tests/theme-browser.cjs` (set `CHROMIUM_PATH` if needed).

## Graduate profile

The three-step setup collects name, email, education, target field/role, engagement preferences, availability, skills, portfolio, and introduction. Drafts save between steps. Completion and sidebar identity use actual saved information.

Email/password and LinkedIn accounts use Supabase Auth. Signed-in profiles, saved projects, application drafts, and resume text are saved in a private account workspace after the database migration is applied. Profiles are available only after sign-in. Legacy guest profiles are no longer used. No employer-facing submissions are enabled. Self-reported profile skills are not counted as verified resume evidence. Logged-out visitors cannot access resume tools. Signed-in resume text is automatically saved; Clear resume data clears the active resume, while prior application snapshots are retained.

## Applications to organizations

Personal accounts track every organization application under **My work → Applications**: status (Submitted, Shortlisted, Accepted, Not selected, Withdrawn), a progress tracker, and any note the organization left with its decision. Declined or withdrawn applications can be resubmitted while the listing is still published (up to 5 attempts); resubmitting clears the previous decision. The old `#submissions` page redirects to My work.

When applying, the applicant chooses what to share: their full profile snapshot, resume text, and (if saved in their profile) the original resume file. The file is copied into the private `application-resumes` bucket under the application's ID, so only the applicant and the hiring organization can read it.

Organizations review each applicant on a full page: profile details, skills (highlighted where they match the listing), introduction, an in-browser PDF preview of the resume, and a **role fit analyzer**. The fit estimate is 55% resume evidence (the same listing criteria and field foundations used for marketplace scores), 30% requested skills (resume evidence counts fully, profile-only skills partly), and 15% stated preferences (field, engagement, availability, work style). Without resume text the estimate is capped at 60. It is a review aid, not a hiring decision; keyword evidence is not verified proficiency.

Database: run `supabase/migrations/202611150010_application_lifecycle.sql` (see JACK_SETUP.md step 5).

## Listing and field compatibility

`dist/criteria.js` defines the six sample listings' individual criteria and field foundations. The marketplace calculates a quick local evidence score from resume text:

- **75% listing criteria:** requested skills have weight 2 each; listing-specific deliverable evidence has weight 1 each.
- **25% field foundations:** a transparent, authored four-criterion rubric for Development, Design, Data & Analytics, Marketing, or Business.

Field foundations are Nextwork coaching suggestions, not employer requirements or claims about live market demand. Missing resume evidence is not proof of missing ability. Scores do not certify proficiency or predict hiring.

Cards show overall score, both component scores, and expandable evidence. Default ordering is highest compatibility, with stable listing order for ties. No resume means no fabricated score. Users may switch to highest pay; editing their resume restores compatibility ordering.

Select Check my fit or choose a listing in Resume Studio. The listing's skills, brief, deliverables, and field rubric are used for the detailed review. Users can still paste an external description, and resume matching never blocks an application.

## Resume Studio and AI review

Upload PDF, DOCX, or TXT (5 MB max), or paste text. Pinned PDF.js and Mammoth parsers load from a CDN and extract text in the browser. Scanned PDFs need OCR; users can paste their text instead. Review extracted text before sending it.

Quick review runs on the device. Optional free-tier Gemini review requires explicit consent and sends resume/job text to the configured Vercel server and Google. Free-tier content may be used to improve Google products; remove sensitive personal information before sending it. The server uses structured JSON output and evaluates the listing rubric and field foundations separately. Each credited criterion must cite a contiguous resume excerpt. The server verifies citations, computes weighted scores, and drops rewrites whose original quote is absent. AI evidence can recognize transferable work more effectively than the quick keyword check, so its detailed scores can differ from marketplace cards.

The API validates the Supabase session for every POST and rejects logged-out or anonymous users. It has input limits, a timeout, and no-store headers. A Postgres function atomically limits each user to 10 remote AI review attempts per UTC hour. If quota storage is unavailable, no Gemini request is made. Resume text is stored in the private account workspace.

### Free-only AI policy and setup

The default review is a free local calculation: no API key, credits, billing, or external request. The server contains no OpenAI route, paid model fallback, automatic upgrades, search grounding, or other chargeable tools. It uses the fixed `gemini-3.5-flash-lite` model only after an owner confirms a Free Tier project. Quota, network, model, and provider errors return a clearly labeled free text-check report instead of calling another provider. Old OpenAI environment variables are removed from Vercel by Actions and old GitHub OpenAI secrets are ignored.

Optional remote setup:

1. Create an API key in https://aistudio.google.com/api-keys for a project showing **Free Tier**. Do not attach billing or upgrade the project. Check status at https://aistudio.google.com/projects.
2. Add it to encrypted GitHub repository Actions secrets as `GEMINI_API_KEY`.
3. After confirming no billing is attached, add the repository Actions **variable** `GEMINI_FREE_TIER_CONFIRMED` with value `true`, then run the deployment workflow or push a change.

The API key cannot reveal the project's billing status to this app. The confirmation flag is an owner attestation, not independent billing verification. Keep the project unbilled; if you change its billing status, remove the confirmation flag to disable remote AI. Without both a key and confirmation, no remote AI call occurs. Free-tier availability, eligibility, model availability, and quotas can change. Free local review remains available. There is no requirement to buy credits.

Server environment variables: `GEMINI_API_KEY`, `GEMINI_FREE_TIER_CONFIRMED`, and optional `ALLOWED_ORIGIN` (defaults to `https://mr-albenberg.github.io`). Same-origin Vercel calls work too. Model selection is fixed to prevent accidental switching to a paid-only model.

`GET /api/resume` reports readiness and `costPolicy: free-only`. `POST /api/resume` accepts resume text, optional job description, listing ID, and field. A missing free-tier configuration returns free heuristic feedback without contacting an AI provider. The Gemini adapter is tested with mocked provider responses; live AI requires the owner's free-tier key.

Official references: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/billing.

## GitHub Actions and deployment

GitHub Actions checks syntax, app behavior, database permissions, Chrome workflows, and the recursive Pages mirror. GitHub Pages publishes `docs/` on pushes to `main`. Automatic Vercel deployments are disabled; no Vercel deployment secret is needed for publishing.

Supabase continues to provide authentication, shared messages, private file storage, and account data. SQL migrations and Storage bucket configuration must be applied separately by an authorized member of the existing project. The `api/` Vercel functions are retained as legacy optional integrations: GitHub Pages cannot run server functions, and the new messaging system does not call them.

Photo deployment needs only `SUPABASE_ACCESS_TOKEN` in encrypted Actions secrets, as described below. Runtime server credentials stay inside Supabase.

Secret settings: https://github.com/Mr-Albenberg/nextwork/settings/secrets/actions

Variable settings: https://github.com/Mr-Albenberg/nextwork/settings/variables/actions

Free AI does not guarantee unlimited free infrastructure. Vercel and GitHub hosting/execution are governed by their account plans and limits; this change does not purchase or upgrade either service.

## Remaining production work

The built-in catalog is illustrative; organization-owned published listings and submitted applications use the existing Supabase organization tables. Real direct messaging requires the messaging migration and private bucket described below. The frontend is implemented and tested locally, but activation and a live two-account verification require access to that same Supabase project.

## Sample marketplace catalog

The marketplace contains 14 clearly labeled sample paid projects. Each has its own brief, budget, duration, deliverables, impact, skills, and two project-specific matching criteria, plus its field foundation rubric. The additional catalog is shared by the browser and server through `dist/extra-jobs.js`.

New visitors see the public homepage without a profile, resume, bookmarks, or application records. There is no automatic or manually loadable demo account. All workspace routes require a signed-in Supabase account. The homepage, pricing, and account/recovery screens remain public. Signing out hides workspace navigation and redirects private routes to login. Legacy browser-saved profiles are no longer used.

The owner confirmed Free Tier setup for this deployment. Actions records that confirmation in its deployment environment; set the workflow value `GEMINI_FREE_TIER_CONFIRMED` to `false` to disable remote AI. This remains an owner attestation, not a billing-status check.

## Listing-to-application flow

Each project tile uses a native title link stretched across its surface. Save, match, evidence, and expandable score controls remain separate interactive targets. Keyboard users can focus the listing link and activate it normally. The detail page has a prominent application action in a sticky summary panel.

**See my highlighted resume** opens a document-and-criteria view. Green highlights direct listing skill/deliverable terms; yellow highlights supporting field terms. Missing criteria appear in red in the adjacent checklist, since nonexistent resume text cannot be highlighted. Labels accompany colors, and all resume text is escaped before markup is added. This is an instant text evidence view, not a new AI assessment or verification of proficiency.

Applications are prefilled from the active graduate profile. The review shows identity, education, availability, location, skills, portfolio, and introduction; a current resume snapshot can be attached. Missing name/email routes the applicant through profile setup and back to the selected opportunity. Saving persists an immutable application snapshot (profile, introduction, optional resume, listing ID, timestamp) locally and shows the applicant in My work. It does not submit to an employer; sign-in is handled separately through Supabase.

## Clearer workspace and conversations

The primary navigation now focuses on Find work, Applications, Messages, My profile, and Resume & match. Career tools sit in a secondary expandable group. A concise three-step row replaces the large marketing hero and statistics block, with a direct path from finding work to checking fit and applying. The refreshed visual system uses consistent SVG line icons, vector startup monograms, a refined brand mark, clearer active tabs, larger actions, and responsive layouts.

Messages uses real member/organization profiles, shared private conversations, unread counts, per-user saved/archive state, downloadable private attachments, and listing sharing. The composer supports Enter to send and Shift+Enter for a new line. Realtime updates preserve unsent drafts, with polling as a reconnect fallback. No sample contacts or fabricated greeting messages are used. See the activation section below; until setup is complete, delivery is unavailable rather than simulated.

## Public homepage and proposed plans

The root URL now opens a public homepage (`#home`) with the “Turn your degree into proof” hook, an explanation of the project journey, an actual catalog spotlight, evidence-matching example, pricing, FAQs, and free-start calls to action. `#pricing` opens the same page at pricing. The workspace remains at `#explore` and requires sign-in, with an Overview link back to the homepage.

Proposed graduate plans:

- **Free — $0/month:** every feature implemented today, including profile, projects/applications, messages, evidence matching, free-tier AI, resume versions/comparison, portfolio case-study exports, application overview, skills checks, and career guidance.
- **Premium — proposed $9/month or $72/year ($6/month equivalent):** new employer contact cards, verified-profile visibility, outreach organization, alerts, and application insights. Annual billing saves $36 against 12 monthly payments (approximately 33%). Browsing/applying remain free. Resume compatibility stays evidence-based; planned applicant-list priority is labeled separately.

These are proposed prices, not live subscriptions. No checkout, card collection, payment processor, charges, subscription entitlements, or cancellation system is connected. The price switch and Premium preview are interactive, but do not enroll the user in a paid plan.

The free `#tools` career toolkit (also available at the legacy `#premium` route) includes named resume versions (maximum 10), side-by-side text/skill-term comparison, loading a version into matching, a Markdown case-study draft download, and a personal application overview/next action. Data is stored in the account; these tools are included in Free. Premium outreach and visibility benefits are future proposals, not active subscription entitlements. Premium does not introduce paid AI APIs or guarantee unlimited free-provider capacity.

## Nextwork brand

The public product is named Nextwork. The single-color geometric N mark is provided as `dist/assets/brand/nextwork-mark.svg` and used for the favicon and wordmark. Public copy, page metadata, and exported report filenames use Nextwork. Internal storage keys, API service identifiers, repository name, and service identifiers are retained for compatibility. The canonical deployment is https://mr-albenberg.github.io/nextwork/. GitHub Pages publishes `docs/`; the checks workflow no longer deploys to Vercel.


## Accounts and private workspace storage

Email/password registration, confirmation, login, password recovery, password changes, LinkedIn login, and linking LinkedIn to an existing account use Supabase Auth. LinkedIn supplies basic identity details, not a complete career history. All workspace pages require login. Postgres RLS isolates each account, and the resume API verifies the current session server-side.

All account content is stored in Supabase. The browser holds only the active page's working state in memory; it does not persist profiles, resumes, saved projects, applications, messages, or tool state to localStorage/sessionStorage. Supabase's login session and PKCE verifier still use browser storage as required for authentication. Legacy browser-saved workspace records are removed and never imported. Database failures block the workspace rather than opening an offline account. There are no sync, import, copy-conflict, or device-replacement controls.

Saves update only the changed columns and use the server-managed row version internally to retry concurrent writes. Profile and application save actions wait for the server. Failed writes clear working state and require reloading the account from the database. Sign-out waits for an in-flight save and then clears account content from memory. Sample messages are still not delivered to other users, but their preview state and career tools are saved privately in the account's `extras` field.

The user card appears before the profile editor. Account connections, password settings, sign-out, and permanent deletion appear below it. Deletion requires typing DELETE and invokes a no-argument `delete_my_account()` function restricted to authenticated callers. The function derives the target from `auth.uid()`, deletes that user, and cascades their workspace and quota records. For organization owners it also removes their listings, received applications, and associated messages; the confirmation explains this before deletion. Other accounts and organizations are preserved. It never accepts a user ID or exposes an admin key.

Public project configuration is in `dist/account.js`. The publishable Supabase key is intentionally public. LinkedIn secrets stay in Supabase; Gemini and Vercel credentials stay server-side. Core account features use no privileged browser key. Profile-photo processing requires a server-only Supabase secret key. AI session tokens are sent only to the canonical Nextwork API.

Supabase setup:

1. Enable Email, email confirmation, LinkedIn (OIDC), and Allow manual linking in Authentication → Sign In / Providers.
2. Set Site URL to `https://mr-albenberg.github.io/nextwork`. Allow `https://mr-albenberg.github.io/nextwork/` and `https://mr-albenberg.github.io/nextwork/?auth=recovery` as redirect URLs.
3. Keep LinkedIn's callback at `https://zkoqafidgromlbvczwzy.supabase.co/auth/v1/callback`.
4. Run `supabase/migrations/202611140001_accounts.sql`, then `supabase/migrations/202611140003_account_updates.sql` in Supabase SQL Editor. If the first is already applied, run only the second. Never run test bootstrap files in production. The second migration adds account tool state and self-deletion. The publishable key cannot apply migrations.
5. Test a real confirmed email login, reset email, LinkedIn linking, account deletion, and a second browser login. Browser integration tests mock Supabase; database tests run the SQL against PostgreSQL.

GitHub checks JavaScript, account access, the recursive Pages mirror, database owner isolation, anonymous denial, quotas, and deletion. Pushes to main publish the static app through GitHub Pages; automatic Vercel deployment is disabled. SQL migrations must be applied separately in Supabase. No billing upgrades, paid AI fallback, or payment processor are enabled. Production email needs an SMTP provider subject to its own plan and limits.

## Repository-supplied Nextwork identity

The website now uses the owner's uploaded **App icon-selection.png** directly as `nextwork-icon.png` for the sidebar/homepage/footer logo, favicon, and Apple touch icon. Both uploaded full wordmark lockups are preserved as `nextwork-primary.png` and `nextwork-reversed.png`, available in Workspace settings. The primary lockup is also used for social sharing metadata. The older generated logo download is replaced by the supplied icon, and the SVG fallback reflects the blue arrow-N identity.

The color system is based on the uploaded assets: royal blue `#1d3be0`, ink `#0a0f1f`, white, and pale blue surfaces. Navigation, CTAs, pricing, messages, progress bars, resume review, and the public homepage use this identity. Semantic green/yellow/red resume evidence colors remain independent for clarity. The homepage uses “Where startups meet new grads” from the uploaded lockup and a revised Nextwork-focused hook. User data, free-tier AI behavior, links, and plan-preview functionality remain intact.

## Revised Premium concept: outreach and visibility

All currently implemented features are Free. The former Premium toolkit is renamed Career toolkit with a Free label. No existing functionality is gated.

Planned Premium benefits:

- Employer-published or employer-supplied business contact emails, where the listing creator has opted into direct applicant outreach. No private-address harvesting or invented contact details.
- Verified member badge after a profile/identity check; paying alone is not verification and does not certify job skills.
- Clearly labeled priority placement for verified Premium applications in employer applicant lists. This is independent of evidence-based resume scores and does not guarantee a response or hiring outcome.
- A cold-outreach workspace with message drafts, follow-up reminders, and contact history.
- Instant project-match alerts and application-view/outreach insights.

These are proposed plan features only. Verification, employer inbox ranking, email directory, email sending, subscriptions, and payments are not connected. Free-tier-only AI remains the policy for both plans.

## Premium workspace prototype

The Premium route now opens a working workspace prototype. Career toolkit keeps all previously implemented tools Free. No subscription, checkout, charge, or paid entitlement enforcement is active.

- Contacts & drafts: choose a listing and edit a profile-based cold introduction. Placeholder contacts use the reserved .example domain and are explicitly non-deliverable. Live contact cards require employer-provided business records. Copying or saving never sends an email.
- Outreach tracker: drafts, subject/body, follow-up dates, and manually recorded Draft/Sent externally/Replied/Closed statuses, with due follow-ups highlighted.
- Badge & priority: profile review can be requested after essential information is added. Requests remain pending; no verified badge is granted automatically. A separate synthetic employer queue previews labeled priority placement without changing actual applications, profile verification, or resume scores.
- Project alerts: save field/keyword searches and view current matches. Background push/email delivery is not connected.
- Insights: actual user-record counts. Employer views, email opens, delivery receipts, and response-time metrics are not fabricated and still require live integrations.

Premium records use the existing per-account workspaceLocal cache under nextwork-growth. They are device-local and are not included in the Supabase cloud-sync schema. Contact examples, review requests, priority previews, and metrics are distinguished from live employer services. Existing tools stay Free, and no paid AI is introduced.


## Account UI and visitor access

Login and registration use a responsive account card with a LinkedIn-blue (#0A66C2) button, the LinkedIn icon, a clear email divider, and labeled email/password inputs. Connected-account settings separate the LinkedIn status, password action, sync status, and sign-out control. Public visitors see marketing navigation rather than a fictional workspace sidebar or avatar.

The public route allowlist is `home`, `pricing`, `login`, `signup`, `forgot`, and `password` (the last shows recovery instructions when signed out). Every other route, including unknown hashes and project details, requires login. Workspace mutations also check the current account; Postgres RLS and the server's verified-session check remain the security boundary for stored data and remote resume analysis. The static sample catalog and public marketing examples are not confidential account data.
supabase/migrations/202611140002_organizations.sql

A downloadable copy is shipped as organization-setup.sql. Until this migration is applied, the portal shows an activation error and does not pretend to publish or submit shared records.

Organization features:
- Organization profile with name, website, description, and optional public business email.
- Job/contract builder with engagement type, field, budget/pay basis, location, skill tags, individual requirements, and deliverables.
- Draft, published, and closed states. Published listings join Find work and support resume matching.
- Applicant inbox with listing filters, private profile/resume snapshots, accept/decline/shortlist actions, and private application conversations.
- Applicant-side Organization applications page for decisions, withdrawal, and messages.

Access is enforced by database RLS and restricted decision RPCs. Only the owner can manage listings or decide applications; applicants cannot accept themselves. Only the applicant and organization owner can read application snapshots or send messages in that thread. No service-role key is exposed in the browser. Other organizations cannot see these applicants. Closing a listing stops new applications.

Existing sample catalog applications retain their prototype behavior. Real organization listings submit to the shared application tables. Messages use refresh to load new messages; they are stored in the database, not sent as email. Organization membership is owner-only in this version; multi-person hiring teams and invitation roles are future work.

## Profile resume upload and canonical skill tags

The experience step of profile setup accepts PDF, DOCX and TXT (5 MB maximum) or pasted text. It uses the existing browser document parser and stores extracted text in the current account's resume workspace for matching/private sync. Uploading does not call an AI provider. Scanned PDFs require pasted/OCR text.

Graduate and organization forms share a searchable skill multi-select with autocomplete, removable tags, keyboard selection, aliases such as JS/TS, and canonical names. Arbitrary free-text tags are not created. A maximum of 20 skills can be selected. Skills are still self-reported; selection does not verify proficiency.


## Organization portal, published listings and real applications

The organization portal uses the existing secure Supabase sign-in. A user can maintain both graduate and organization workspaces; each owner can create one organization. Organization profiles and optional explicitly published business contact emails are public. Draft listings and applicant documents are private.

Run the new migration once in the Supabase SQL Editor:
supabase/migrations/202611140002_organizations.sql

A downloadable copy is shipped as organization-setup.sql. Until this migration is applied, the portal shows an activation error and does not pretend to publish or submit shared records.

Organization features:
- Organization profile with name, website, description, and optional public business email.
- Job/contract builder with engagement type, field, budget/pay basis, location, skill tags, individual requirements, and deliverables.
- Draft, published, and closed states. Published listings join Find work and support resume matching.
- Applicant inbox with listing filters, private profile/resume snapshots, accept/decline/shortlist actions, and private application conversations.
- Applicant-side Organization applications page for decisions, withdrawal, and messages.

Access is enforced by database RLS and restricted decision RPCs. Only the owner can manage listings or decide applications; applicants cannot accept themselves. Only the applicant and organization owner can read application snapshots or send messages in that thread. No service-role key is exposed in the browser. Other organizations cannot see these applicants. Closing a listing stops new applications.

Existing sample catalog applications retain their prototype behavior. Real organization listings submit to the shared application tables. Messages use refresh to load new messages; they are stored in the database, not sent as email. Organization membership is owner-only in this version; multi-person hiring teams and invitation roles are future work.

## Profile resume upload and canonical skill tags

The experience step of profile setup accepts PDF, DOCX and TXT (5 MB maximum) or pasted text. It uses the existing browser document parser and stores extracted text in the current account's resume workspace for matching/private sync. Uploading does not call an AI provider. Scanned PDFs require pasted/OCR text.

Graduate and organization forms share a searchable skill multi-select with autocomplete, removable tags, keyboard selection, aliases such as JS/TS, and canonical names. Arbitrary free-text tags are not created. A maximum of 20 skills can be selected. Skills are still self-reported; selection does not verify proficiency.

## Brand asset layout

Editable/source brand PNGs live in `assets/brand/`. Published assets live in `dist/assets/brand/`, mirrored to `docs/assets/brand/`. Filenames use `nextwork-icon.png`, `nextwork-wordmark-primary.png`, `nextwork-wordmark-reversed.png`, and `nextwork-mark.svg`. The redundant `nextwork-logo.png` icon alias was removed. References, downloadable brand files, favicon metadata, and CI mirror validation use the new paths. There are no image assets in the repository root.


## LinkedIn login convenience

Both login and linking pass `enable_extended_login=true` so LinkedIn can offer its supported Google, Apple, and passkey login options. Nextwork retains and refreshes its Supabase session instead of sending returning users through LinkedIn on each visit. LinkedIn can reuse an existing browser session and prior consent; it still controls authentication, consent, and reauthorization. The flag changes login options, not API permissions. Standard OIDC access supplies basic identity data, not full career history. Supabase session refresh is separate from refreshing LinkedIn provider access tokens.


## Signed-in overview and public homepage

`#overview` is the private dashboard: profile completion, saved project count, application drafts, next steps, and saved opportunities use actual account data. Signed-in root visits and standard logins open Overview; organization-intent logins still open the organization portal. `#home` remains the public marketing page. When signed in, its top navigation shows the member's account and an Open app link; signup calls to action switch to opening the workspace. Logged-out visitors see login/registration controls and cannot open Overview.


## Dedicated organization access and hiring overview

Organization account creation now opens its own organization-signup route, separate from graduate signup, with an organization-login route for returning hiring users. Both use the existing Supabase identity system, so an existing graduate account can also own an organization without duplicate credentials.

The two-step organization sign-up asks for contact name, work email/password, company name/website/industry, team size, hiring engagement, primary field, starting compensation, start window, work arrangement, and hiring location. Passwords remain in transient form memory only and are cleared after signup or leaving the flow. Company/hiring answers are stored in the authenticated user's private organization_setup metadata; that metadata is not an authorization role and does not change database permissions.

Organization profile setup includes public company details and clearly separated private hiring defaults. Defaults prefill new listings while every listing remains editable. This uses existing tables and auth metadata; no additional migration is required.

The organization portal now defaults to Overview, with public company description, private industry/team/hiring summaries, published/pending/shortlist counts, setup steps, recent applications, a project-brief checklist, and an explanation of the review workflow. The applicant inbox also supports status filtering. Applicants still cannot access other candidates' documents, and existing organization ownership controls are unchanged.

### Fixed personal and organization accounts

Run `supabase/migrations/202611140004_account_types.sql` in the Supabase SQL Editor after the previous migrations. It preserves existing organization owners as hiring accounts and other existing users as personal accounts. Sign out and back in after running it. New organization signup assigns the type once at identity creation; editing user metadata cannot convert an existing identity. Use separate emails for personal and hiring accounts. The migration also restricts organization creation, listing management, candidate application submission, and candidate workspace access in database policies. No data is deleted.

The web interface uses trusted `app_metadata.nextwork_account_type`; organization signup requires this migration. The downloadable SQL is `/account-types-setup.sql`. GitHub Actions tests the migration and direct database role boundaries.

### Paper-money Premium checkout

Open `/#checkout` while signed into a personal account. Every account starts with $500 virtual USD. Test card `4242 4242 4242 4242`, future `MM/YY`, CVC `123`, and any test name/postal code simulate a successful payment; `4000 0000 0000 0002` simulates a decline. Monthly costs $9 virtual USD and yearly costs $72 virtual USD. Use **Fill test details** to populate the form. Cancellation, receipts, balance, and test activation persist in the existing private workspace extras; reset restores $500. No new migration or payment-provider keys are needed. Card number, expiry, security code, name, and receipt email are not stored in billing state or sent to a payment provider. Only a simulated receipt and fixed test last-four are saved. This client-editable sandbox state must never authorize real billing, verified badges, or applicant priority. No automatic renewals, real charges, or receipt emails occur.

### GitHub Pages and organization setup (2026-11-14)

GitHub Pages publishes `docs/` at https://mr-albenberg.github.io/nextwork/. Keep `dist` and `docs` mirrored; CI checks this. Automatic Vercel deployments have been removed from the validation workflow. Existing API hosting is unchanged; Supabase continues to provide authentication and private data storage.

Organization signup asks only for organization name, work email, and password. Industry, website, company story, team size, and hiring preferences are optional and can be edited in the portal. A first authenticated visit provisions a minimal organization profile from the signup name, under the existing organization-only database policy. Existing personal accounts still cannot convert.

All select controls use the shared searchable combobox, preserving canonical underlying form values and supported database enums. Skill selection searches 8,882 skill/tool labels, industry search includes 1,022 labels, and role/title suggestions include 1,016 occupations. See `data/catalog-sources.md` for public data attribution. Catalog breadth does not expand the matching engine’s claimed expertise. Search supports common aliases and approximate spelling, keyboard navigation, explicit canonical selection, and bounded suggestion lists. Optional selectors can be left blank.


## Real messaging

Messaging uses **only** `https://zkoqafidgromlbvczwzy.supabase.co`, the same project as authentication and account data. It runs directly from GitHub Pages with the existing publishable key; no Vercel API, second Supabase project, service-role key in the browser, or new hosting service is required.

The database exposes member names, public biography, role/company, and skills to signed-in member search. It does not expose account emails, resume text, or private application snapshots. Draft text/files remain in memory until sent and are cleared on account changes. Sends use a stable UUID for retries, private Storage for file bytes, and per-user read/saved/archive state. Realtime refreshes incoming messages without replacing the composer; a 15-second polling fallback catches reconnects. Threads load the newest 50 messages and support loading earlier messages.

While browsing other pages, an incoming message opens a compact chat at the bottom right. The widget supports quick replies, recent conversations, unread badges, minimize/close, and a handoff to full Messages with the same draft. New messages from another person show a notice without replacing the current conversation. It stays hidden on the Messages tab and clears on account changes. It uses the existing messaging setup; no additional Supabase migration is required.

Until the existing project has the migration and private bucket, the Messages page shows an unavailable state and does **not** pretend to deliver messages to sample people. Old `proof-conversations` workspace JSON is left untouched but is not imported: its sample IDs are not authenticated recipients. Existing organization application-message records are also retained in the separate application conversation interface.

For account deletion the client removes its uploaded files through the Storage API before deleting the auth account. Conversations and metadata cascade on account removal. If an account is deleted outside the app or a browser is closed during an upload, an administrator should periodically clean up unreferenced/pending files through the **Storage API**, never by deleting `storage.objects` rows directly. Pending reservations are capped; staged files are visible only to their uploader until sent, and deleted messages no longer authorize downloads.

Validation: `node tests/messaging.test.js` tests service contracts and retries. `node tests/messaging-browser.cjs` uses isolated synthetic accounts against a shared transport fixture to test browser interactions, live refresh, attachments, reload, and mobile layout. `tests/messaging.test.sql` exercises the real PostgreSQL RPCs/RLS with three identities plus an organization in a disposable database. A live two-account check is required after activation.
## Profile photos and shared LinkedIn imports

Photos run entirely on Supabase; GitHub Pages serves the website. Vercel deployments remain disabled. No paid Storage image transformations or external image service is used. The separate existing AI/market APIs keep their current hosting; this change moves the photo backend only.

Manual selections must be PNG/JPEG, at most 8 MiB, and 400 × 400 through 7680 × 4320 pixels after orientation. The browser crops and reduces the selected image to a JPEG square of at most 512 pixels before staging it. The Edge Function independently verifies magic bytes, extension/MIME, dimensions and byte limits, fully decodes with a pinned ImageMagick WebAssembly decoder, rejects decoding warnings, and re-encodes a metadata-free JPEG. It never trusts browser validation. Decoder memory is bounded and disk spilling is disabled. Resource-heavy direct API inputs fail closed; normal browser uploads are reduced first. Official LinkedIn thumbnails may be below 400 pixels and are never enlarged.

Raw staging and processed photos live in separate private buckets. Browser roles can write only their own fixed staging path, never processed photos or publication metadata. All signed-in members may request 5-minute signed photo URLs; anonymous, expired and deleted accounts are denied. URLs are bearer links usable until expiry. Frontend photo state stays in memory. Removing a photo suppresses future auto-import; account deletion clears photo objects before the database deletes the account.

Signup, linking and subsequent verified login of already-linked personal accounts share the same blank-only import. It reads provider-managed LinkedIn identity data, uses only allowlisted HTTPS LinkedIn CDN hosts, refuses redirects, and bounds download size/time. Existing names, contact emails and photos are preserved, including during concurrent manual uploads. Existing sessions without recorded consent can opt in from their profile; login/connect screens explain storage and signed-in visibility. Expired or missing provider photos do not block login. Standard LinkedIn OIDC scopes already cover these basic fields.

### Activate the Supabase photo backend

1. Apply [migration 006](supabase/migrations/202611140006_profile_photos.sql) in Supabase SQL Editor after migrations 001–005. A downloadable copy is published at `profile-photos-setup.sql`. **Do not run test SQL in production.** Migration 004 is the newer account-types migration; photos use 006; 005 is messaging.
2. Create a Supabase personal access token at https://supabase.com/dashboard/account/tokens. Put it in the repository's encrypted Actions secret **SUPABASE_ACCESS_TOKEN** at https://github.com/Mr-Albenberg/nextwork/settings/secrets/actions. Never paste it into chat or commit it. This token authorizes deployment; the function uses Supabase's automatically provided server-only `SUPABASE_SERVICE_ROLE_KEY` at runtime. No Supabase server key belongs in GitHub Pages, frontend files, or a Vercel environment for photos. The previously suggested GitHub `SUPABASE_SECRET_KEY` is not needed for this implementation.
3. Run **Check Nextwork (GitHub Pages)** from Actions, or push to `main`. After checks pass, the `deploy-photos` job deploys `profile-photo` to project `zkoqafidgromlbvczwzy`. Without the access-token secret the job reports that deployment was skipped; it does not pretend the backend is live. The frontend calls `https://zkoqafidgromlbvczwzy.supabase.co/functions/v1/profile-photo` directly.
4. Test real LinkedIn signup, connection from an email account, and a returning linked member. Confirm existing photos survive, removal persists, and deleting an account removes stored photos. Local automated tests cover the browser workflow with mocked Supabase; decoder and SQL permission tests run against real libraries/PostgreSQL. Live provider deployment testing still requires the above setup.

Manual deployment alternative (Supabase CLI 2.122.1, Docker running, and authenticated with your access token):

```sh
npm ci
npm run prepare:photos
supabase functions deploy profile-photo --project-ref zkoqafidgromlbvczwzy --use-docker
```

Deployment must use Docker/local bundling (`--use-docker`), which supports 20 MB functions and bundled static files. Do not use `--use-api`: server-side bundling has a 5 MB limit, smaller than the image decoder. GitHub Actions checks Docker availability and explicitly selects Docker so it cannot silently fall back to API bundling. This deployment limit applies independently of the Free/Pro plan; no upgrade is required.

The pinned WASM decoder is prepared during deployment and bundled as a function static file, outside `dist/` and `docs/`. It is never downloaded at request time. Browser origins are restricted to `https://mr-albenberg.github.io` and `https://nextwork-jobs.vercel.app`. Local function development can opt into localhost origins with the server-only `PHOTO_ALLOW_LOCALHOST=true`; production does not enable that switch. JWT gateway verification is disabled because the handler validates every bearer token with Supabase Auth, including current account existence. CORS does not replace authentication.

### Free plan budgets

Supabase currently includes 500,000 Edge Function invocations/month and 1 GiB file storage on Free, with separate 5 GB cached and 5 GB uncached egress allowances shared across services. Functions have a 256 MB memory and 2-second CPU limit. This feature requires no plan upgrade. Storage admission caps processed photos at 512 MiB and staging at 128 MiB, with serialized reservations to cover concurrent writes. That leaves room within the storage allowance for other app data, though existing project usage also counts. Per-member limits allow 240 API requests, 20 staging writes, 10 manual processing attempts and 3 provider imports per hour. An unchanged failed LinkedIn photo reference retries automatically at most once/day per importer release. Explicit Retry LinkedIn import bypasses that cooldown while retaining the 3/hour import quota. Interrupted attempts from an older release retry on the next login. Signed URL caching and small stored photos reduce calls/bandwidth. Free quotas remain finite: monitor project Usage; traffic or abuse can exhaust them and interrupt service. No implementation can guarantee unlimited use within a free allowance, and denied requests still count as function invocations.

References: [Supabase pricing](https://supabase.com/pricing), [function limits](https://supabase.com/docs/guides/functions/limits), [Storage egress](https://supabase.com/docs/guides/storage/serving/bandwidth), [WASM image processing](https://supabase.com/docs/guides/functions/examples/image-manipulation).

### Account creation next steps

Choose the personal or organization signup flow first, since account type is immutable. For personal LinkedIn signup, prefill available name, email and photo and show an editable review card; then ask about target work, availability, education and a resume. Collect a missing email explicitly. Locale could suggest interface language, but should not be guessed into a location/time zone. Standard LinkedIn OIDC does not provide full employment history, education, skills, headline or a guaranteed public profile URL; those need user-supplied data or separately approved LinkedIn access.

### Saved account resumes

Apply `supabase/migrations/202611140007_account_resumes.sql` after migration 006 (or run `docs/account-resumes-setup.sql` in the Supabase SQL editor). This creates the private `account-resumes` bucket with owner-only personal-account access and a 5 MB limit. Deploy the updated `profile-photo` function to import available LinkedIn headline/summary fields. LinkedIn OIDC normally supplies only identity details; unavailable headline/About fields stay blank for a resume or manual entry.

PDF, DOCX and TXT uploads in Profile or Resume Studio save the original file, extracted text, and a local review to the account immediately. Upload processing does not send text to external AI; optional AI review still requires explicit consent. Scanned PDFs need text pasted manually. A replacement keeps one active file; the saved original can be downloaded and removed with “Clear resume data.” Account deletion also cleans up interrupted resume uploads.

LinkedIn imports fill missing identity details. Resume uploads do not write profile answers automatically.

The profile resume panel is available on every setup step. Use “Upload a new resume” to replace the account resume or “Clear resume” to remove it across the workspace. Skills, listing matches, Resume Studio, project recommendations, and new applications reuse the saved account text; project recommendations link back to the profile for file management. Previously submitted application snapshots retain the version attached when submitted.

### Detailed sample listings and membership (2026-11-15)

All 14 sample opportunities have an illustrated creator profile, reserved `.example` contact address, company context, responsibilities, deliverables, milestones, and working arrangements. Creator messaging opens an explicitly simulated conversation, stored privately in the signed-in account under `nextwork-demo-chats`. Its generated sample replies do not contact or impersonate a live employer. Real member messaging still uses the existing Supabase conversation system. The illustrations are local SVG assets with no external photo requests.

Skills check and Career path pages have been removed; their legacy links redirect to Project ideas. Project ideas is a direct workspace navigation link. Portfolio and resume tools remain Free.

The Premium workspace is locked for Free accounts. Current plan and Upgrade/Manage actions appear in the sidebar and profile/settings. The checkout uses a conventional plan selector, payment form, order summary, receipt, active plan view, and cancellation. This remains a clearly labeled **demo subscription**: invalid, expired, arbitrary, or empty card fields intentionally activate Premium after consent. Card, expiry, security code, billing name, email, and postal fields never enter persisted state or payment requests. No payment provider is connected and no real charges occur. Only the simulated plan, safe receipt, and legacy virtual balance are saved using the private account extras. Cancellation returns to Free and relocks the tools while preserving drafts. This client-editable membership is for demonstration only and must not be used as real billing authorization. Verification and actual applicant priority remain separate from membership.

### AI profile drafts from a resume

Upload and store the resume once, then choose **Fill in profile details** to start Gemini processing. The model writes concise form answers rather than pasting resume sections, with an exact resume excerpt supporting each suggestion. Suggestions remain in memory and are discarded when the account or resume changes. Unknown details remain unsuggested. No local extraction fallback pretends to be a model response.

When processing finishes, a popup offers **Fill empty fields** or **Update everything**. The first saves only blank fields; the second also replaces existing differing answers. No suggestion table or answer preview is displayed. Neither mode clears fields without a supported suggestion or changes authentication email/password. The chosen mode applies once against the current profile, without an extra review or second click. Uploading or preparing suggestions alone never saves those suggestions to the account.

The authenticated `POST /api/resume` action `profile-import` uses the existing Gemini free-tier configuration and durable per-user quota. The button starts processing directly, with a brief provider disclosure and no confirmation checkbox. Structured output, a bounded repair attempt, and per-field validation keep valid suggestions when another field needs correction. Deploy the updated API separately from Pages: run the **Deploy profile AI API** workflow, which uses the existing `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_ORG_ID` repository secrets and preserves runtime configuration. Without the updated API or available free-tier configuration, the UI reports the limitation and leaves the profile unchanged.

### Single general plan (2026-11-14)

The Premium plan was removed. Every tool is part of one free general plan. The sidebar upgrade box, the Premium workspace link, the pricing comparison, the account-settings plan panel, and the paper-money checkout are gone from the interface. The old `#premium`, `#checkout`, and `#tools` addresses open resume review after the UI redesign. The unused `growth.js` and `paper-checkout.js` files and their tests remain in the repository and can be deleted in a later cleanup.

### UI redesign (2026-11-15)

The shared `ui.css` design layer unifies typography, neutral surfaces, indigo actions, light/dark colors, form fields, navigation, and mobile layouts. Personal accounts have a five-item mobile navigation bar; resume review and account settings remain reachable from profile/account actions. Portfolio & Resumes and its toolkit have been removed. Legacy `#tools` links open resume review, without deleting old account records.

Project Ideas now follows a short form → compact cards → individual project plan flow. Market graphs and resume-coverage percentages are removed from the results UI. Source context and evidence gaps remain available in a closed optional section, with baseline, AI estimate, and live posting data identified accurately. Full steps, outputs, tools, and optional extensions are available on `#recommend/idea/:index`; saved plans open at `#recommend/saved/:index`. Saved work is organized into Applications, Saved listings, and Project ideas tabs. The last generated plan is kept in private workspace extras so reloading a plan works after synchronization. Account changes clear in-memory recommendation views.

### Organization-to-personal messaging (2026-11-14)

Messages are only possible between one organization account and one personal account. Applying to a listing is not required: a personal account can message any organization from its listing page or the Messages search, and an organization can message any personal account from the Messages search. Personal-to-personal and organization-to-organization chats are blocked, and older conversations of those kinds stay readable but cannot receive new messages. Apply `supabase/migrations/202611150009_org_user_messaging.sql` in the Supabase SQL editor after migration 005; until it is applied the database still allows any two members to chat.
