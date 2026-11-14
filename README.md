# Prooflane

[Find paid projects](https://symmetrical-waffle-coral.vercel.app/) · [Set up your profile](https://symmetrical-waffle-coral.vercel.app/#profile) · [Resume Studio](https://symmetrical-waffle-coral.vercel.app/#resume)

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

Profiles are stored on the current device in localStorage. This is not authentication or a shared employer-facing account. Self-reported profile skills are not counted as verified resume evidence. Resume text stays in sessionStorage for the tab session and is removed by Resume Studio's Clear my data action.

## Listing and field compatibility

`dist/criteria.js` defines the six sample listings' individual criteria and field foundations. The marketplace calculates a quick local evidence score from resume text:

- **75% listing criteria:** requested skills have weight 2 each; listing-specific deliverable evidence has weight 1 each.
- **25% field foundations:** a transparent, authored four-criterion rubric for Development, Design, Data & Analytics, Marketing, or Business.

Field foundations are Prooflane coaching suggestions, not employer requirements or claims about live market demand. Missing resume evidence is not proof of missing ability. Scores do not certify proficiency or predict hiring.

Cards show overall score, both component scores, and expandable evidence. Default ordering is highest compatibility, with stable listing order for ties. No resume means no fabricated score. Users may switch to highest pay; editing their resume restores compatibility ordering.

Select Check my fit or choose a listing in Resume Studio. The listing's skills, brief, deliverables, and field rubric are used for the detailed review. Users can still paste an external description, and resume matching never blocks an application.

## Resume Studio and AI review

Upload PDF, DOCX, or TXT (5 MB max), or paste text. Pinned PDF.js and Mammoth parsers load from a CDN and extract text in the browser. Scanned PDFs need OCR; users can paste their text instead. Review extracted text before sending it.

Quick review runs on the device. Optional free-tier Gemini review requires explicit consent and sends resume/job text to the configured Vercel server and Google. Free-tier content may be used to improve Google products; remove sensitive personal information before sending it. The server uses structured JSON output and evaluates the listing rubric and field foundations separately. Each credited criterion must cite a contiguous resume excerpt. The server verifies citations, computes weighted scores, and drops rewrites whose original quote is absent. AI evidence can recognize transferable work more effectively than the quick keyword check, so its detailed scores can differ from marketplace cards.

The API has input limits, a timeout, no-store response headers, and a best-effort per-instance rate limit. Public scale still needs authentication and durable rate limits. There is no server-side resume database in this implementation.

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

Encrypted Actions secrets: `VERCEL_TOKEN` for deployment and optional `GEMINI_API_KEY` for free-tier AI. The free-tier confirmation is a repository Actions variable, not a secret. Verified team/project IDs are in the workflow. The workflow copies the Gemini key without logging it, applies the confirmation flag, and removes unused OpenAI runtime settings. Profiles and end-user login records do not belong in Actions; they need a runtime authentication/database service.

Secret settings: https://github.com/Mr-Albenberg/symmetrical-waffle/settings/secrets/actions

Variable settings: https://github.com/Mr-Albenberg/symmetrical-waffle/settings/variables/actions

Free AI does not guarantee unlimited free infrastructure. Vercel and GitHub hosting/execution are governed by their account plans and limits; this change does not purchase or upgrade either service.

## Remaining production work

Current opportunities are samples. Applications, profiles, and messages are browser-local and are not transmitted to employers. A real marketplace needs a connected authentication/database provider, graduate and employer access policies, employer-owned listing management, shared applications and conversations, and real employer-approved project briefs. Setting a database connection alone does not implement those features. The public Vercel URL works without a custom domain.

## Main demo and expanded marketplace

The marketplace contains 14 clearly labeled sample paid projects. Each has its own brief, budget, duration, deliverables, impact, skills, and two project-specific matching criteria, plus its field foundation rubric. The additional catalog is shared by the browser and server through `dist/extra-jobs.js`.

New visitors with no existing profile or resume start with **Jordan Rivera**, a fictional graduate with a complete profile, realistic sample resume, and saved opportunities. Existing visitors can choose **Load demo profile** in the toolbar. Their prior profile and resume are backed up in the tab session and restored by **Exit demo**. A default demo can be exited to start a personal profile; it does not automatically reload after dismissal. Reset demo restores its original sample data. Demo data is local and is not a real authenticated account or a real applicant. All demo achievements and contact details are illustrative.

The owner confirmed Free Tier setup for this deployment. Actions records that confirmation in its deployment environment; set the workflow value `GEMINI_FREE_TIER_CONFIRMED` to `false` to disable remote AI. This remains an owner attestation, not a billing-status check.

## Listing-to-application flow

Each project tile uses a native title link stretched across its surface. Save, match, evidence, and expandable score controls remain separate interactive targets. Keyboard users can focus the listing link and activate it normally. The detail page has a prominent application action in a sticky summary panel.

**See my highlighted resume** opens a document-and-criteria view. Green highlights direct listing skill/deliverable terms; yellow highlights supporting field terms. Missing criteria appear in red in the adjacent checklist, since nonexistent resume text cannot be highlighted. Labels accompany colors, and all resume text is escaped before markup is added. This is an instant text evidence view, not a new AI assessment or verification of proficiency.

Applications are prefilled from the active graduate profile. The review shows identity, education, availability, location, skills, portfolio, and introduction; a current resume snapshot can be attached. Missing name/email routes the applicant through profile setup and back to the selected opportunity. Saving persists an immutable application snapshot (profile, introduction, optional resume, listing ID, timestamp) locally and shows the applicant in My work. It does not submit to an employer or create an authenticated account. Demo switches back up and restore application records as well as profile data.

## Clearer workspace and conversations

The primary navigation now focuses on Find work, Applications, Messages, My profile, and Resume & match. Career tools sit in a secondary expandable group. A concise three-step row replaces the large marketing hero and statistics block, with a direct path from finding work to checking fit and applying. The refreshed visual system uses consistent SVG line icons, vector startup monograms, a refined brand mark, clearer active tabs, larger actions, and responsive layouts.

Messages supports creator conversations from project details, a searchable people directory (14 creators and 3 graduates), profile previews, related-project panels, searchable inboxes, saved/archived threads, unread markers, outgoing-message deletion, quick introduction prompts, Enter/Shift+Enter composition, and linked project sharing. Threads persist on this device. Existing messages are not forwarded to any external service, and no live presence or delivery receipts are simulated.

Repeated prototype notices are removed from the main journey. Workspace settings contains the single explanation of local storage, simulated communications, sample-profile controls, and free AI behavior. This remains a browser-local prototype rather than a multi-user messaging backend.
