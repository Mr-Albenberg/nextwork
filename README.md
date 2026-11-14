# Prooflane

[Open Prooflane](https://symmetrical-waffle-coral.vercel.app/) · [Resume Studio](https://symmetrical-waffle-coral.vercel.app/#resume)

Real work. Real proof. Your next role.

A responsive graduate project marketplace with paid startup opportunities, saved projects, local demo applications, resume-based practice quizzes, career gap comparisons, messaging, and profiles.

## Run locally

No dependencies or build step required:

```sh
python3 -m http.server 3000 --directory dist
```

Open http://localhost:3000.

## Deploy to Vercel

Import this repository in Vercel. The included `vercel.json` serves `dist` with no build step or framework. Vercel assigns a `.vercel.app` domain after deployment. Custom domains can be added in the project's domain settings.

## Files

- `dist/index.html`: application shell
- `dist/style.css`: responsive styles
- `dist/app.js`: page routing and interactive demo
- `dist/logo.svg`: Prooflane vector logo and favicon

## Demo limitations

Listings and profile matches are illustrative. Resume analysis uses local keyword matching rather than an AI service. Career comparisons use supplied job requirements or example checklists, not live labor-market data. Applications, profiles, and messages are stored in browser localStorage and are not transmitted to employers. Production use needs authentication, a backend, real employer records, messaging, AI integration, and a job-data source.

## Resume Studio

Open `#resume` for two review modes: general resume health and job-description alignment. Upload PDF/DOCX/TXT (5 MB max) or paste text, review extraction, run a review, revise, and download feedback. PDF and Word parsers load pinned third-party JavaScript libraries; document parsing runs in the browser. Scanned PDFs need OCR and should be pasted as text.

Local review checks section headings, accomplishment statements, numeric evidence, length, and recognized skills. It labels keyword coverage explicitly and never treats missing keywords as proof of missing ability. Scores are coaching signals, not ATS results or hiring predictions.

### Enable contextual AI review

1. Import this repository into Vercel. Keep Output Directory `dist`; Vercel also deploys `api/resume.js` as a serverless function.
2. Set `OPENAI_API_KEY` in Vercel project environment variables. Never put it in client code or GitHub. Optional: `OPENAI_MODEL` (default `gpt-4.1-mini`) and `ALLOWED_ORIGIN` (default `https://mr-albenberg.github.io`).
3. Redeploy after setting variables.
4. In Resume Studio, select **AI review**. On GitHub Pages or Sites, enter the deployed Vercel origin and consent to transmitting the text. On the Vercel site itself, leave the server URL blank.

The endpoint rejects oversized requests, uses a timeout, and applies a best-effort per-instance request limit. Before wider production use, add authenticated access and durable rate limiting. No AI request is made without selecting AI review and providing consent. Resume text is held in sessionStorage for the tab session; **Clear my data** removes it and the report. Reports stay in memory unless downloaded.

### GitHub Pages

The `docs/` folder mirrors the static site. Open repository **Settings → Pages**, choose **Deploy from a branch**, select **main**, choose **/docs**, and save. The intended URL is:

https://mr-albenberg.github.io/symmetrical-waffle/

This URL only works after Pages is enabled and its deployment finishes. GitHub Pages serves the static client; live AI calls use your configured Vercel endpoint. When editing static files, update `docs/` alongside `dist/`.

### Backend readiness

`GET /api/resume` returns a non-sensitive readiness check with `aiConfigured`. This confirms whether a server key is set, not whether the provider account has credit. The client checks this endpoint and enables the AI review selector when configured. Actual resumes are accepted only via POST. Vercel functions are configured with a 60-second maximum duration to accommodate review generation.

## Match a marketplace opportunity

Select **Check my fit** on any project card, or **Match my resume to this project** on its details page. Resume Studio opens with that listing's published skills, brief, deliverables, budget, and duration. Alternatively choose a listing in the review form or paste an external job description. Review feedback links back to the listing and its application flow. Resume matching is optional and does not block applications. All current listings are samples, and applications still save locally.

## What is needed before a real marketplace launch

- **AI reviews:** In Vercel, select this project → Settings → Environment Variables → add `OPENAI_API_KEY` for Production, then redeploy. Create the key at https://platform.openai.com/api-keys and enable API billing. ChatGPT subscriptions do not include API usage. Never commit or paste the key into chat. Confirm `/api/resume` reports `aiConfigured: true` and test one review with consent. The existing endpoint handles resume analysis; it does not provide accounts or employer records.
- **Accounts and shared data:** Connect a database/auth provider (for example Supabase), then implement graduate/employer accounts, listing ownership, applications, conversations, and access policies. This is additional backend work; setting a connection string alone does not enable these features. Existing profiles, applications, and conversations use local browser storage.
- **Real opportunities:** Supply employer-approved paid briefs with budget, deliverables, duration, location restrictions, and an actual hiring contact. Replace sample content before inviting applicants to submit real applications.
- **Account administration:** GitHub code writes and Vercel auto-deploy already work. To let the assistant manage Vercel settings, install/connect the Vercel integration for the account/team that owns this project. Repository settings and domain changes need separate administration permission; code access alone does not grant it. Custom domains are optional because the public `.vercel.app` URL already works.

Checks: `node tests/resume.test.js` and `node tests/listing-match.test.js`.

## Automatic listing compatibility

The marketplace reads the resume entered or uploaded in Resume Studio for the current tab session. Each card shows the percentage of its listed skill tags found in that text, a progress bar, and an expandable explanation of matched and missing terms. Synonyms cover common label variants. Listings default to highest compatibility, with stable listing order for ties. No resume means no invented score. Users can explicitly choose highest pay; editing the resume restores compatibility sorting. This local calculation runs without an AI key or transmitting resume text. It measures requested-skill keyword coverage, not verified proficiency. Detailed contextual AI review remains a separate, consented request.

## GitHub Actions and credentials

`.github/workflows/quality-and-deploy.yml` checks JavaScript, tests resume analysis and compatibility ranking, and verifies the GitHub Pages mirror on pushes and pull requests. It can also deploy production on a manual workflow run.

**Deployment credentials** belong in GitHub encrypted Actions secrets. **End-user passwords, resumes, sessions, and accounts do not belong in GitHub Actions, repository files, workflow logs, or artifacts.** Use a runtime authentication service and database for those. Actions is a CI/deployment system, not an authentication backend.

To enable manual Actions deployment:

1. Open https://github.com/Mr-Albenberg/symmetrical-waffle/settings/secrets/actions and add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
2. Create a Vercel access token in https://vercel.com/account/settings/tokens for the team that owns this project. Obtain the Team ID (`VERCEL_ORG_ID`) from Vercel team settings and Project ID (`VERCEL_PROJECT_ID`) from the project settings. Do not share the token in chat or code.
3. Open repository Actions → **Check Prooflane and deploy** → **Run workflow**, enable the deployment checkbox, and run it on `main`.

Checks run without secrets. Existing Vercel Git integration continues automatic deployment on push; manual Actions deployment is optional and uses the same configured Vercel project. Keep `OPENAI_API_KEY` in Vercel runtime environment variables. This connection currently lacks repository Actions/Secrets administration permission, so the owner must add secrets or grant that permission through the GitHub app configuration.
