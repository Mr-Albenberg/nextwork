# Prooflane

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
