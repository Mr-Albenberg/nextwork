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
