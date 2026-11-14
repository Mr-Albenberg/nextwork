# Nextwork

[Find paid projects](https://nextwork-jobs.vercel.app/) · [Set up your profile](https://nextwork-jobs.vercel.app/#profile) · [Resume Studio](https://nextwork-jobs.vercel.app/#resume)

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

## Graduate profile

The three-step setup collects name, email, education, target field/role, engagement preferences, availability, skills, portfolio, and introduction. Drafts save between steps. Completion and sidebar identity use actual saved information.

Email/password and LinkedIn accounts use Supabase Auth. Signed-in profiles, saved projects, application drafts, and resume text sync to a private account workspace after the database migration is applied. Profiles are available only after sign-in. Personal guest profiles saved by older versions stay on the device until explicitly imported by their owner. No employer-facing submissions are enabled. Self-reported profile skills are not counted as verified resume evidence. Logged-out visitors cannot access resume tools. Signed-in resume text is automatically synced; Clear resume data clears the active resume, while prior application snapshots are retained.

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

Actions checks syntax, tests analysis/matching/profile behavior, verifies the Pages mirror, and deploys the checked commit through the Vercel project API on pushes to main (or manual deployment).

Encrypted Actions secrets: `VERCEL_TOKEN` for deployment and optional `GEMINI_API_KEY` for free-tier AI. The free-tier confirmation is a repository Actions variable, not a secret. Verified team/project IDs are in the workflow. The workflow copies the Gemini key without logging it, applies the confirmation flag, and removes unused OpenAI runtime settings. Supabase provides runtime authentication and private account storage; user records do not belong in Actions.

Secret settings: https://github.com/Mr-Albenberg/symmetrical-waffle/settings/secrets/actions

Variable settings: https://github.com/Mr-Albenberg/symmetrical-waffle/settings/variables/actions

Free AI does not guarantee unlimited free infrastructure. Vercel and GitHub hosting/execution are governed by their account plans and limits; this change does not purchase or upgrade either service.

## Remaining production work

Current opportunities are samples. Applications, profiles, and messages are browser-local and are not transmitted to employers. A live marketplace still needs employer-owned listing management, shared application submission and conversations, and real employer-approved project briefs. Account-workspace RLS does not implement those marketplace features. Setting a database connection alone does not implement those features. The public Vercel URL works without a custom domain.

## Sample marketplace catalog

The marketplace contains 14 clearly labeled sample paid projects. Each has its own brief, budget, duration, deliverables, impact, skills, and two project-specific matching criteria, plus its field foundation rubric. The additional catalog is shared by the browser and server through `dist/extra-jobs.js`.

New visitors see the public homepage without a profile, resume, bookmarks, or application records. There is no automatic or manually loadable demo account. All workspace routes require a signed-in Supabase account. The homepage, pricing, and account/recovery screens remain public. Signing out hides workspace navigation and redirects private routes to login. Existing personal guest data from older versions is preserved; fictional guest data is never imported into an account.

The owner confirmed Free Tier setup for this deployment. Actions records that confirmation in its deployment environment; set the workflow value `GEMINI_FREE_TIER_CONFIRMED` to `false` to disable remote AI. This remains an owner attestation, not a billing-status check.

## Listing-to-application flow

Each project tile uses a native title link stretched across its surface. Save, match, evidence, and expandable score controls remain separate interactive targets. Keyboard users can focus the listing link and activate it normally. The detail page has a prominent application action in a sticky summary panel.

**See my highlighted resume** opens a document-and-criteria view. Green highlights direct listing skill/deliverable terms; yellow highlights supporting field terms. Missing criteria appear in red in the adjacent checklist, since nonexistent resume text cannot be highlighted. Labels accompany colors, and all resume text is escaped before markup is added. This is an instant text evidence view, not a new AI assessment or verification of proficiency.

Applications are prefilled from the active graduate profile. The review shows identity, education, availability, location, skills, portfolio, and introduction; a current resume snapshot can be attached. Missing name/email routes the applicant through profile setup and back to the selected opportunity. Saving persists an immutable application snapshot (profile, introduction, optional resume, listing ID, timestamp) locally and shows the applicant in My work. It does not submit to an employer; sign-in is handled separately through Supabase.

## Clearer workspace and conversations

The primary navigation now focuses on Find work, Applications, Messages, My profile, and Resume & match. Career tools sit in a secondary expandable group. A concise three-step row replaces the large marketing hero and statistics block, with a direct path from finding work to checking fit and applying. The refreshed visual system uses consistent SVG line icons, vector startup monograms, a refined brand mark, clearer active tabs, larger actions, and responsive layouts.

Messages supports creator conversations from project details, a searchable people directory (14 creators and 3 graduates), profile previews, related-project panels, searchable inboxes, saved/archived threads, unread markers, outgoing-message deletion, quick introduction prompts, Enter/Shift+Enter composition, and linked project sharing. Threads persist on this device. Existing messages are not forwarded to any external service, and no live presence or delivery receipts are simulated.

Workspace settings explains storage, simulated communications, and free AI behavior. No sample-profile controls are exposed. Messaging remains a browser-local prototype; account profiles, bookmarks, application drafts, and resumes can sync separately.

## Public homepage and proposed plans

The root URL now opens a public homepage (`#home`) with the “Turn your degree into proof” hook, an explanation of the project journey, an actual catalog spotlight, evidence-matching example, pricing, FAQs, and free-start calls to action. `#pricing` opens the same page at pricing. The workspace remains at `#explore` and requires sign-in, with an Overview link back to the homepage.

Proposed graduate plans:

- **Free — $0/month:** every feature implemented today, including profile, projects/applications, messages, evidence matching, free-tier AI, resume versions/comparison, portfolio case-study exports, application overview, skills checks, and career guidance.
- **Premium — proposed $9/month or $72/year ($6/month equivalent):** new employer contact cards, verified-profile visibility, outreach organization, alerts, and application insights. Annual billing saves $36 against 12 monthly payments (approximately 33%). Browsing/applying remain free. Resume compatibility stays evidence-based; planned applicant-list priority is labeled separately.

These are proposed prices, not live subscriptions. No checkout, card collection, payment processor, charges, subscription entitlements, or cancellation system is connected. The price switch and Premium preview are interactive, but do not enroll the user in a paid plan.

The free `#tools` career toolkit (also available at the legacy `#premium` route) includes named resume versions (maximum 10), side-by-side text/skill-term comparison, loading a version into matching, a Markdown case-study draft download, and a personal application overview/next action. Data is stored on the device; these tools are included in Free. Premium outreach and visibility benefits are future proposals, not active subscription entitlements. Premium does not introduce paid AI APIs or guarantee unlimited free-provider capacity.

## Nextwork brand

The public product is named Nextwork. The single-color geometric N mark is provided as `dist/logo.svg` and used for the favicon and wordmark. Public copy, page metadata, and exported report filenames use Nextwork. Internal storage keys, API service identifiers, repository name, and service identifiers are retained for compatibility. The canonical deployment is https://nextwork-jobs.vercel.app.


## Accounts and private workspace storage

Supported flows: email/password registration, confirmation, sign-in, password recovery, password changes, LinkedIn sign-in, and connecting LinkedIn to an existing signed-in account. The LinkedIn OAuth product supplies basic identity fields, not a complete career history. Sign-in and linking use distinct Supabase APIs. Resume Studio and skill analysis require sign-in; the server validates the bearer token with Supabase before processing any analysis POST.

Supabase project: `https://zkoqafidgromlbvczwzy.supabase.co`. The publishable key in `dist/account.js` is public browser configuration, not a privileged credential. The pinned Supabase JS SDK (2.89.0, MIT license) is served locally. LinkedIn's Client Secret belongs only in the Supabase provider configuration. Gemini and Vercel tokens stay in server/Actions secrets. No service-role key is required by this app. AI review only sends sessions to the canonical Nextwork API, never a configurable third-party server.

One-time Supabase setup:

1. Enable Email, email confirmation, LinkedIn (OIDC), and Allow manual linking under Authentication → Sign In / Providers.
2. Set Site URL to `https://nextwork-jobs.vercel.app`. Add `https://nextwork-jobs.vercel.app/` and `https://nextwork-jobs.vercel.app/?auth=recovery` to the allowed redirect URLs. Local tests need their exact equivalent URLs if using live authentication.
3. Keep LinkedIn's authorized callback at `https://zkoqafidgromlbvczwzy.supabase.co/auth/v1/callback`.
4. Run `supabase/migrations/202611140001_accounts.sql` in the project's SQL editor. Run only that migration, **not** the local test bootstrap. This creates `account_workspaces`, owner-only row-level policies, and a private AI quota counter/function. The publishable key cannot apply migrations.
5. Test with two real accounts: verify email, sign in, save a profile/resume, and open a second browser to confirm sync. Check that neither account can read the other's workspace. Test a real confirmation/reset email and LinkedIn linking. Automated browser tests mock Supabase and cannot establish email deliverability or LinkedIn approval.

Each account gets one private database row with profile fields, saved sample-listing IDs, application-draft snapshots, active resume text, and a server-managed version. This deliberately stores workspace drafts together; live employer listings, submitted applications, and messages will need separate relational tables. Resumes automatically sync for signed-in users. Original uploaded files are parsed locally and not stored. Messages and Premium resume versions remain device-local. Existing guest profiles are imported only with an explicit action; fictional demo data is excluded.

Workspace caches are isolated per user ID. Offline changes persist locally and sync on reconnect; cross-device version conflicts require choosing the account or device copy. If the migration is missing, sign-in still works but storage shows an explicit setup error and retains changes on the device. No cross-device sync is claimed until storage responds successfully. Signing out with unsynced changes preserves them for that account's next sign-in. This is browser caching, not protection against someone with access to browser developer tools on the same device.

Additional checks:

```sh
node tests/account.test.js
# With Playwright installed and dist served on port 3000:
node tests/account-browser.cjs
```

GitHub Actions also runs the migration and `tests/database.test.sql` in a fresh PostgreSQL service, testing owner isolation, anonymous denial, validation, versions, and durable quotas. Pushes to `main` deploy only after checks pass. The deploy job verifies that `nextwork-jobs.vercel.app` is assigned to the Vercel project. The migration itself must be applied separately in Supabase; deploying frontend files does not create database tables.

Supabase and Vercel plan limits still apply. No paid plan, billing upgrade, payment processor, or paid AI fallback is enabled by these changes. Production email delivery needs an SMTP provider and its own plan/limits; Supabase's default mail service is limited and is not a production deliverability guarantee.


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
