# Nextwork

**A marketplace that connects recent graduates with paid, scoped startup projects.**

[Live demo](https://mr-albenberg.github.io/nextwork/) · [Development notes](DEVELOPMENT.md)

Nextwork was built as a team **hackathon project**. Entry-level hiring is hard: graduates struggle to show real experience, and startups struggle to find affordable help for small, well-defined pieces of work. Nextwork lets organizations post scoped, paid projects and lets graduates prove their skills by doing them, with transparent matching instead of a black-box resume filter.

## What it does

**For graduates**
- Build a profile (education, skills, availability, portfolio) with a photo, or import details from LinkedIn.
- Browse and filter paid projects, save the ones you like, and see an explainable fit score for each listing.
- Apply, track every application's status, and message the organization.
- **Resume Studio:** upload a PDF, DOCX or TXT resume (or paste text), get a local review, and optionally an AI review.
- **Project ideas:** see what employers are asking for, find the gaps in your resume, and get project ideas to build that close them.

**For organizations**
- A separate hiring portal to publish project listings and review applicants.
- Each applicant opens to their profile, resume and a fit analysis showing the evidence behind the score.
- Accept or decline with an optional note, and message any member directly.

**For everyone**
- Direct messaging between organizations and personal accounts, with file attachments.
- Light, dark and system themes.
- A single free plan, with no paywalled features.

## Project ideas

Project ideas turns the job market into a to-do list for a graduate's portfolio:

1. Takes your resume (pasted or from your profile).
2. Pulls live job postings for your field from public applicant-tracking feeds (Greenhouse, Lever) and Adzuna.
3. Extracts the skills and experience employers ask for and compares them with your resume to find the gaps.
4. Uses Google's Gemini model to propose portfolio projects that target those gaps.

Results show the market signals and gap analysis first, then the project ideas.

## Nextwork Match

Listing compatibility and fit explanations come from **EvidenceNet**, a small custom classifier trained on synthetic data that runs locally, with no model API cost. It separates real contributions from partial mentions, missing evidence and contradictions, and sends credentials or conflicts to manual review. It is an early model with no independent validation on real applicants. See the [model card](dist/nextwork-match-model-card.md) and the [training guide](models/nextwork-match/README.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vanilla HTML, CSS and JavaScript, with no build step |
| Auth, database, storage | Supabase: Auth, Postgres with row-level security, private Storage buckets |
| Server functions | Supabase Edge Functions (profile photos), Vercel serverless functions (AI review, job market data) |
| AI | Google Gemini (free tier only) for resume review and project ideas; custom EvidenceNet classifier for matching |
| Hosting | GitHub Pages and Vercel |
| CI | GitHub Actions: syntax and unit tests, Postgres permission tests, headless Chrome (Playwright) workflows |

## Project layout

```
dist/        the static web app (source of truth)
docs/        byte-identical mirror of dist/ served by GitHub Pages (CI enforces this)
api/, lib/   serverless functions: resume review, project ideas, job market data
supabase/    SQL migrations, row-level security, Edge Functions
models/      EvidenceNet training and evaluation
tests/       unit, SQL and browser tests
```

## Run it locally

Requires Node 22 or newer.

```sh
npm install
python3 -m http.server 3000 --directory dist   # open http://localhost:3000
npm test
```

The app talks to a hosted Supabase project for accounts and messaging, so sign-in and storage need that project's setup. Database migrations live in `supabase/migrations/`. Deployment, Supabase setup and the long-form feature notes are in [DEVELOPMENT.md](DEVELOPMENT.md).

After changing files in `dist/`, copy them into `docs/` (`cp -r dist/. docs/`). CI fails if the two differ.

## Status

A hackathon prototype. Listings and some sample accounts are demo data, the matching model is trained on synthetic data, and the live job-data backend runs on free-tier services. It is not intended for production use.

## Team

Built by a team at a hackathon. See the [contributors](https://github.com/Mr-Albenberg/nextwork/graphs/contributors) for who built what.
