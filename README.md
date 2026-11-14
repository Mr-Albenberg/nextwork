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

Quick review runs on the device. Contextual AI review requires explicit consent and sends resume/job text to the configured Vercel server and OpenAI. The server uses structured JSON output and evaluates the listing rubric and field foundations separately. Each credited criterion must cite a contiguous resume excerpt. The server verifies citations, computes weighted scores, and drops rewrites whose original quote is absent. AI evidence can recognize transferable work more effectively than the quick keyword check, so its detailed scores can differ from marketplace cards.

The API has input limits, a timeout, no-store response headers, and a best-effort per-instance rate limit. Public scale still needs authentication and durable rate limits. There is no server-side resume database in this implementation.

### Environment variables

- `OPENAI_API_KEY`: server-side OpenAI key with API billing enabled.
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`.
- `ALLOWED_ORIGIN`: optional CORS origin; defaults to `https://mr-albenberg.github.io`. Same-origin Vercel requests also work.

`GET /api/resume` returns only readiness information, including `aiConfigured`. It does not test billing or validate the key. `POST /api/resume` accepts `resume`, optional `job`, optional `listingId`, and `field`. Listing IDs select server-owned rubric definitions. Responses include coaching feedback and evidence-specific improvements. End-to-end provider verification should use synthetic resume data and requires API billing.

## GitHub Actions and deployment

The workflow checks syntax, tests analysis/matching/profile behavior, and verifies the Pages mirror. On a push to main, or a manual run with deployment selected, it deploys the verified Vercel project after checks.

Encrypted repository Actions secrets:

- `VERCEL_TOKEN`: deployment access for the owning team.
- `OPENAI_API_KEY`: when set, Actions securely copies it to Vercel's production environment before deployment.

The verified team and project IDs are configured in the workflow; they are not secret credentials. No credentials belong in source code, chat, logs, artifacts, or client scripts. GitHub Actions stores deployment secrets, not end-user login records. The workflow links the Vercel project, sets the AI environment variable from stdin, and deploys with the configured token. The existing Vercel Git integration can also deploy each push; the Actions deployment ensures the runtime secret is applied.

Repository secret administration is not available to the current coding connection. Owners can manage secrets at https://github.com/Mr-Albenberg/symmetrical-waffle/settings/secrets/actions. To set the AI key directly, use Vercel project Settings → Environment Variables → Production, then redeploy.

## Remaining production work

Current opportunities are samples. Applications, profiles, and messages are browser-local and are not transmitted to employers. A real marketplace needs a connected authentication/database provider, graduate and employer access policies, employer-owned listing management, shared applications and conversations, and real employer-approved project briefs. Setting a database connection alone does not implement those features. The public Vercel URL works without a custom domain.
