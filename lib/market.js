// Live job-posting market profile. Uses only public, terms-friendly sources:
// Greenhouse and Lever public job-board endpoints (no key) and, optionally, the Adzuna API.
// LinkedIn has no public jobs API and prohibits scraping, so it is intentionally not used.
// Any failure falls back to the authored baseline profile; this module never throws to callers.
const Engine = require("../dist/recommend-engine");
const Data = require("../dist/market-data");

// Default public boards. These are board identifiers that may change over time; failures are skipped.
// Override without code changes via JOB_BOARDS_GREENHOUSE / JOB_BOARDS_LEVER (comma-separated).
const DEFAULT_GREENHOUSE = "stripe,airbnb,discord,coinbase,robinhood,reddit,lyft,instacart,databricks,asana,brex,gusto,mongodb,twilio,cloudflare,datadog,figma,anthropic,vercel,airtable,duolingo,pinterest,dropbox,intercom,amplitude,webflow,gitlab,carta";
const DEFAULT_LEVER = "palantir,spotify,plaid,wealthfront";

const TTL_MS = 6 * 60 * 60 * 1000;
const PER_BOARD_TIMEOUT_MS = 6000;
const PER_BOARD_POSTING_CAP = 8;
const TOTAL_POSTING_CAP = 150;
const cache = new Map();
const inflight = new Map();

function boardList(raw, fallback) {
  return String(raw || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9_-]{2,40}$/i.test(s))
    .slice(0, 60);
}

function decode(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
// Greenhouse returns entity-escaped HTML, Lever returns plain text plus HTML lists.
function htmlToText(html) {
  let s = decode(html);
  s = s.replace(/<(br|\/p|\/li|\/h\d|\/div|\/ul)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ");
  s = decode(s).replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n\s*\n+/g, "\n");
  return s.trim().slice(0, 6000);
}

async function getJSON(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(PER_BOARD_TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

async function fromGreenhouse(token, titleRe, fetchImpl) {
  const data = await getJSON("https://boards-api.greenhouse.io/v1/boards/" + encodeURIComponent(token) + "/jobs?content=true", fetchImpl);
  return (Array.isArray(data.jobs) ? data.jobs : [])
    .filter((j) => j && titleRe.test(String(j.title || "")))
    .slice(0, PER_BOARD_POSTING_CAP)
    .map((j) => ({ source: "Greenhouse", company: token, title: String(j.title), text: htmlToText(j.content), url: String(j.absolute_url || "") }));
}

async function fromLever(site, titleRe, fetchImpl) {
  const data = await getJSON("https://api.lever.co/v0/postings/" + encodeURIComponent(site) + "?mode=json", fetchImpl);
  return (Array.isArray(data) ? data : [])
    .filter((j) => j && titleRe.test(String(j.text || "")))
    .slice(0, PER_BOARD_POSTING_CAP)
    .map((j) => ({
      source: "Lever",
      company: site,
      title: String(j.text),
      text: [j.descriptionPlain, ...(Array.isArray(j.lists) ? j.lists.map((l) => String(l.text || "") + " " + htmlToText(l.content)) : []), j.additionalPlain].filter(Boolean).join("\n").slice(0, 6000),
      url: String(j.hostedUrl || "")
    }));
}

async function fromAdzuna(query, env, fetchImpl) {
  const id = env.ADZUNA_APP_ID;
  const key = env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const country = /^[a-z]{2}$/i.test(env.ADZUNA_COUNTRY || "") ? env.ADZUNA_COUNTRY.toLowerCase() : "us";
  const out = [];
  for (const page of [1, 2]) {
    const url = "https://api.adzuna.com/v1/api/jobs/" + country + "/search/" + page + "?app_id=" + encodeURIComponent(id) + "&app_key=" + encodeURIComponent(key) + "&results_per_page=50&what=" + encodeURIComponent(query) + "&content-type=application/json";
    const data = await getJSON(url, fetchImpl);
    for (const j of Array.isArray(data.results) ? data.results : []) {
      out.push({ source: "Adzuna", company: String(j.company?.display_name || ""), title: String(j.title || "").replace(/<[^>]+>/g, ""), text: htmlToText(j.description), url: String(j.redirect_url || "") });
    }
  }
  return out;
}

async function gather(family, env, fetchImpl) {
  const titleRe = new RegExp(family.titles, "i");
  const jobs = [
    ...boardList(env.JOB_BOARDS_GREENHOUSE, DEFAULT_GREENHOUSE).map((t) => ({ name: "Greenhouse", run: () => fromGreenhouse(t, titleRe, fetchImpl) })),
    ...boardList(env.JOB_BOARDS_LEVER, DEFAULT_LEVER).map((t) => ({ name: "Lever", run: () => fromLever(t, titleRe, fetchImpl) })),
    { name: "Adzuna", run: () => fromAdzuna(family.query, env, fetchImpl) }
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const seen = new Set();
  const postings = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const p of result.value) {
      const key = (p.company + "|" + p.title).toLowerCase();
      if (!p.title || seen.has(key)) continue;
      seen.add(key);
      postings.push(p);
      if (postings.length >= TOTAL_POSTING_CAP) return postings;
    }
  }
  return postings;
}

function sampleLinks(postings) {
  const bySource = new Map();
  for (const p of postings) {
    if (!/^https:\/\//.test(p.url)) continue;
    const list = bySource.get(p.source) || [];
    if (list.length < 2) list.push({ title: p.title.slice(0, 90), company: p.company, source: p.source, url: p.url });
    bySource.set(p.source, list);
  }
  return [...bySource.values()].flat().slice(0, 6);
}

async function build(family, env, fetchImpl, now) {
  let postings = [];
  try {
    postings = await gather(family, env, fetchImpl);
  } catch {
    postings = [];
  }
  if (postings.length < Data.MIN_LIVE_POSTINGS) {
    const base = Engine.baselineProfile(family);
    base.liveCount = postings.length;
    base.fetchedAt = new Date(now()).toISOString();
    base.note = "Live posting data was unavailable or too thin (" + postings.length + " found, " + Data.MIN_LIVE_POSTINGS + " needed). Showing Nextwork's authored baseline for this role. " + Data.snapshotNote;
    return base;
  }
  const agg = Engine.aggregate(postings, family);
  const counts = new Map();
  for (const p of postings) counts.set(p.source, (counts.get(p.source) || 0) + 1);
  return {
    source: "live",
    family: { id: family.id, label: family.label, field: family.field },
    postings: agg.postings,
    sources: [...counts.entries()].map(([name, count]) => ({ name, count })),
    fetchedAt: new Date(now()).toISOString(),
    skills: agg.skills,
    titles: agg.titles,
    samples: sampleLinks(postings)
  };
}

async function getProfile(role, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const env = opts.env || process.env;
  const now = opts.now || Date.now;
  const forced = opts.familyId ? Engine.familyById(opts.familyId) : null;
  const family = forced || Engine.matchFamily(role).family;
  const hit = cache.get(family.id);
  if (hit && now() - hit.at < TTL_MS) return hit.profile;
  if (inflight.has(family.id)) return inflight.get(family.id);
  const promise = build(family, env, fetchImpl, now)
    .then((profile) => {
      // Cache live results for the full TTL; cache baseline fallbacks only briefly so outages recover.
      cache.set(family.id, { profile, at: profile.source === "live" ? now() : now() - TTL_MS + 5 * 60 * 1000 });
      return profile;
    })
    .finally(() => inflight.delete(family.id));
  inflight.set(family.id, promise);
  return promise;
}

function resetCache() {
  cache.clear();
  inflight.clear();
}

module.exports = { getProfile, resetCache, htmlToText, boardList, gather, sampleLinks, TTL_MS };
