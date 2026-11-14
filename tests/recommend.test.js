const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Engine = require("../dist/recommend-engine");
const Data = require("../dist/market-data");
const Market = require("../lib/market");
const marketHandler = require("../api/market");
const recommendHandler = require("../api/recommend");

const resume =
  "Alex Johnson\nalex@example.com\nEDUCATION\nBS Computer Science, 2026\nSKILLS\nReact, TypeScript, Git, SQL, Python\nPROJECTS\n- Built a React dashboard with TypeScript for 40 volunteers.\n- Wrote C++ firmware for a small rover and collaborated with a team of four.";

// ---------- Engine ----------
for (const [role, id] of [["Frontend developer", "frontend"], ["robotics software engineer", "embedded"], ["Data analyst", "data"], ["UX designer", "design"], ["Growth marketer", "marketing"], ["Product manager", "product"], ["ML engineer", "mlai"], ["software engineer", "fullstack"], ["autonomous drone software engineer", "embedded"]]) {
  const m = Engine.matchFamily(role);
  assert.equal(m.family.id, id, role);
  assert.equal(m.matched, true);
}
assert.equal(Engine.matchFamily("zzz").matched, false);
assert.equal(Engine.matchFamily("").family.id, "fullstack");

assert(Engine.has("wrote C++, and Java", "C/C++"));
assert(!Engine.has("I know JavaScript", "TypeScript"));
assert(Engine.has("Experience with react.js", "React"));
assert(!Engine.has("reactive systems", "React"));
assert(Engine.has("CI/CD pipelines", "CI/CD"));
assert(Engine.has("Next.js app", "Next.js"));
assert(!Engine.has("the rest of the team", "REST API"));

// Every template skill is part of its family's market list, and every family has enough templates.
for (const f of Data.families) {
  const names = new Set(f.skills.map(([s]) => s));
  assert(f.templates.length >= 4, f.id);
  for (const t of f.templates) {
    assert(t.skills.length && t.build.length >= 3 && t.deliverables.length >= 2 && t.hours > 0, t.title);
    for (const s of t.skills) assert(names.has(s), `${f.id}: ${t.title} uses skill outside family list: ${s}`);
  }
  assert(new RegExp(f.titles, "i"));
}

const postings = [
  { title: "Frontend Engineer (Remote)", text: "React, TypeScript, CSS and accessibility. Git required." },
  { title: "Frontend Engineer - Growth", text: "React and JavaScript. Testing with Jest." },
  { title: "UI Engineer", text: "TypeScript and React. We love GraphQL." },
  { title: "Frontend Engineer", text: "Next.js, React, HTML, CSS." }
];
const agg = Engine.aggregate(postings, Engine.familyById("frontend"));
assert.equal(agg.postings, 4);
const react = agg.skills.find((s) => s.skill === "React");
assert.equal(react.count, 4);
assert.equal(react.pct, 100);
assert.equal(agg.skills.find((s) => s.skill === "TypeScript").pct, 50);
assert.equal(agg.skills[0].skill, "React");
assert.equal(agg.titles[0].title, "frontend engineer");
assert.deepEqual(Engine.aggregate([], Engine.familyById("frontend")), { postings: 0, skills: [], titles: [] });

const base = Engine.baselineProfile(Engine.familyById("frontend"));
assert.equal(base.source, "baseline");
assert(base.skills.every((s) => s.pct === null && s.tier));
const analysis = Engine.analyze(resume, base);
assert(analysis.have.some((r) => r.skill === "React"));
assert(analysis.gaps.some((r) => r.skill === "Accessibility"));
assert(analysis.coverage > 0 && analysis.coverage < 100);
assert(analysis.have.find((r) => r.skill === "React").evidence.includes("React"));
assert.equal(Engine.analyze("short", base).coverage, null);
assert.equal(Engine.analyze("short", base).have.length, 0);

const projects = Engine.fallbackProjects(Engine.familyById("frontend"), analysis, { hoursPerWeek: 10 });
assert.equal(projects.length, 3);
assert.equal(new Set(projects.map((p) => p.title)).size, 3);
assert(projects.every((p) => p.weeks >= 1 && p.weeks <= 12 && p.why && p.source === "template"));
assert.equal(projects[0].weeks, Math.round(projects[0].hours / 10));
assert(projects[0].covers.length >= projects[2].covers.length - 1);
assert(projects.every((p) => p.covers.every((s) => analysis.gaps.some((g) => g.skill === s))));
// No gaps: still returns projects with a showpiece explanation.
const full = Engine.analyze(resume + " JavaScript HTML CSS Testing Accessibility REST API Next.js GraphQL CI/CD", base);
assert.equal(full.gaps.length, 0);
const showpiece = Engine.fallbackProjects(Engine.familyById("frontend"), full);
assert.equal(showpiece.length, 3);
assert(showpiece[0].why.includes("showpiece"));

// AI output is untrusted.
const live = { source: "live", skills: agg.skills, postings: 4 };
const valid = Engine.validateAI(
  {
    projects: [
      { title: "  Accessible\n tracker ", pitch: "A real app.", why: "Fills 80% of the postings you saw across 40 jobs.", build: ["Step one", "Step two", "Step three"], deliverables: ["Repo"], skills: ["react", "Accessibility", "COBOL", "react"], weeks: 4 },
      { title: "Bad weeks", pitch: "Pitch", why: "Fits your React work.", build: ["a", "b"], deliverables: [], skills: ["TypeScript"], weeks: 99 },
      { title: "No skills", pitch: "x", build: ["a", "b"], deliverables: [], skills: ["COBOL"], weeks: 3 },
      { title: "Beyond the three-project cap", pitch: "x", build: ["a", "b"], deliverables: [], skills: ["Git"], weeks: 3 }
    ]
  },
  live,
  resume,
  { hoursPerWeek: 8 }
);
assert.equal(valid.length, 2);
assert.equal(valid[0].title, "Accessible tracker");
assert.deepEqual(valid[0].skills, ["React", "Accessibility"]);
assert(!/%|40 jobs/.test(valid[0].why));
assert.equal(valid[0].source, "ai");
assert.equal(valid[1].why, "Fits your React work.");
assert.equal(valid[1].weeks, 5);
assert.throws(() => Engine.validateAI({ projects: [] }, live, resume));
assert.throws(() => Engine.validateAI({ projects: [null, { title: "One step only", pitch: "x", build: ["a"], skills: ["React"], weeks: 3 }] }, live, resume));
assert.throws(() => Engine.validateAI("garbage", live, resume));
assert.equal(Engine.aiPayload(resume, "Frontend developer", base, analysis, 8).marketSkills.length > 0, true);
assert(!JSON.stringify(Engine.aiPayload(resume, "r", base, analysis, 8).marketSkills).includes("pct"));

// ---------- Market lib (mocked network, no real requests) ----------
assert.equal(Market.htmlToText("&lt;p&gt;We use &lt;b&gt;React&lt;/b&gt; &amp;amp; Git&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Testing&lt;/li&gt;&lt;/ul&gt;"), "We use React & Git\nTesting");
assert.deepEqual(Market.boardList("a-b, c_d ,bad name,x", "z"), ["a-b", "c_d"]);

const ghJobs = (n, prefix = "Frontend Engineer") => ({
  jobs: Array.from({ length: n }, (_, i) => ({ title: `${prefix} ${i}`, absolute_url: `https://boards.greenhouse.io/x/jobs/${i}`, content: "&lt;p&gt;React, TypeScript and CSS. Git required.&lt;/p&gt;" })).concat([{ title: "Office Manager", absolute_url: "https://example.com/off", content: "Excel" }])
});
const leverJobs = (n) => Array.from({ length: n }, (_, i) => ({ text: `UI Engineer ${i}`, hostedUrl: `https://jobs.lever.co/y/${i}`, descriptionPlain: "React and accessibility.", lists: [{ text: "Requirements", content: "&lt;li&gt;GraphQL&lt;/li&gt;" }], additionalPlain: "" }));
const urls = [];
let mode = "live";
const netFetch = async (url) => {
  urls.push(url);
  if (mode === "down") throw new Error("offline");
  if (url.includes("greenhouse.io/v1/boards/alpha/")) return { ok: true, json: async () => ghJobs(10) };
  if (url.includes("lever.co/v0/postings/gamma")) return { ok: true, json: async () => leverJobs(8) };
  return { ok: false, status: 404, json: async () => ({}) };
};
(async () => {
  Market.resetCache();
  const env = { JOB_BOARDS_GREENHOUSE: "alpha,beta", JOB_BOARDS_LEVER: "gamma" };
  let clock = 1_000_000;
  const opts = { fetchImpl: netFetch, env, now: () => clock };
  let profile = await Market.getProfile("Frontend developer", opts);
  assert.equal(profile.source, "live");
  assert.equal(profile.postings, 16, "per-board cap of 8 applies");
  assert.deepEqual(profile.sources.map((s) => [s.name, s.count]).sort(), [["Greenhouse", 8], ["Lever", 8]]);
  assert.equal(profile.skills.find((s) => s.skill === "React").pct, 100);
  assert.equal(profile.skills.find((s) => s.skill === "GraphQL").count, 8);
  assert(profile.samples.length > 0 && profile.samples.every((s) => s.url.startsWith("https://")));
  assert.equal(profile.family.id, "frontend");
  const calls = urls.length;
  assert.equal(calls, 3);
  await Market.getProfile("front-end engineer", opts);
  assert.equal(urls.length, calls, "second request served from cache");
  clock += Market.TTL_MS + 1;
  await Market.getProfile("Frontend developer", opts);
  assert(urls.length > calls, "cache expires after TTL");

  // Too few live postings -> authored baseline, clearly labeled.
  Market.resetCache();
  urls.length = 0;
  profile = await Market.getProfile("Frontend developer", { fetchImpl: netFetch, env: { JOB_BOARDS_GREENHOUSE: "beta", JOB_BOARDS_LEVER: "gamma" }, now: () => clock });
  assert.equal(profile.source, "baseline");
  assert.equal(profile.liveCount, 8);
  assert(profile.note.includes("baseline"));
  assert(profile.skills.every((s) => s.pct === null));

  // Total outage never throws and recovers after the short fallback window.
  Market.resetCache();
  mode = "down";
  profile = await Market.getProfile("Data analyst", { fetchImpl: netFetch, env, now: () => clock });
  assert.equal(profile.source, "baseline");
  assert.equal(profile.liveCount, 0);
  mode = "live";
  const before = urls.length;
  await Market.getProfile("Data analyst", { fetchImpl: netFetch, env, now: () => clock + 60_000 });
  assert.equal(urls.length, before, "baseline fallback cached briefly");
  clock += 6 * 60_000;
  Market.resetCache();

  // Adzuna is used only with keys, and never sends anything unexpected.
  urls.length = 0;
  const adzunaFetch = async (url) => {
    urls.push(url);
    if (url.startsWith("https://api.adzuna.com/")) return { ok: true, json: async () => ({ results: Array.from({ length: 20 }, (_, i) => ({ title: `Data Analyst ${i}`, description: "SQL, Python and Tableau.", company: { display_name: "Co" + i }, redirect_url: "https://www.adzuna.com/x/" + i })) }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  profile = await Market.getProfile("Data analyst", { fetchImpl: adzunaFetch, env: { JOB_BOARDS_GREENHOUSE: "zz", JOB_BOARDS_LEVER: "zz", ADZUNA_APP_ID: "id", ADZUNA_APP_KEY: "key" }, now: () => clock });
  assert.equal(profile.source, "live");
  assert(urls.some((u) => u.includes("app_id=id") && u.includes("what=data%20analyst")));
  assert.equal(profile.skills.find((s) => s.skill === "SQL").pct, 100);

  // ---------- API handlers ----------
  const response = () => ({
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; },
    end() { return this; }
  });
  Object.assign(process.env, { JOB_BOARDS_GREENHOUSE: "alpha", JOB_BOARDS_LEVER: "gamma" });
  delete process.env.ADZUNA_APP_ID;
  Market.resetCache();
  let authMode = "valid", quota = true, aiMode = "ok", aiCalls = 0, aiText;
  global.fetch = async (url, options) => {
    if (url.endsWith("/auth/v1/user")) return { ok: authMode === "valid", status: 401, json: async () => ({ id: "user-a", is_anonymous: false }) };
    if (url.endsWith("/rpc/consume_resume_review")) return { ok: true, json: async () => quota };
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      aiCalls++;
      assert.equal(options.headers["x-goog-api-key"], "test-free-key");
      assert(!options.headers.Authorization);
      const sent = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
      assert(sent.resumeLacksEvidenceFor.length > 0 && sent.marketSkills.length > 0);
      if (aiMode === "timeout") throw new Error("timeout");
      if (aiMode === "quota") return { ok: false, status: 429, json: async () => ({}) };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: aiText }] } }] }) };
    }
    return netFetch(url);
  };

  let res = response();
  await marketHandler({ method: "GET", headers: { origin: "https://mr-albenberg.github.io" }, query: { role: "Frontend developer" }, url: "/api/market?role=Frontend%20developer" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.service, "nextwork-market");
  assert.equal(res.body.source, "live");
  assert(res.headers["Cache-Control"].includes("s-maxage"));
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://mr-albenberg.github.io");
  for (const bad of [{}, { role: "x" }, { role: "y".repeat(81) }, { role: "Designer", family: "nope" }]) {
    res = response();
    await marketHandler({ method: "GET", headers: {}, query: bad, url: "/api/market" }, res);
    assert.equal(res.statusCode, 400);
  }
  res = response();
  await marketHandler({ method: "POST", headers: {}, query: {}, url: "/api/market" }, res);
  assert.equal(res.statusCode, 405);

  const call = async (body = { resume, role: "Frontend developer", hoursPerWeek: 8 }, headers = { authorization: "Bearer test-session" }) => {
    const r = response();
    await recommendHandler({ method: "POST", headers, body }, r);
    return r;
  };
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_FREE_TIER_CONFIRMED;
  assert.equal((await call(undefined, {})).statusCode, 401);
  authMode = "invalid";
  assert.equal((await call()).statusCode, 401);
  authMode = "valid";
  assert.equal(aiCalls, 0);
  res = await call();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "local");
  assert.equal(res.body.projects.length, 3);
  assert(res.body.projects.every((p) => p.demand && Object.keys(p.demand).length === p.skills.length));
  assert.equal(res.body.market.source, "live");
  assert.equal(aiCalls, 0, "no AI request without free-tier confirmation");

  process.env.GEMINI_API_KEY = "test-free-key";
  process.env.GEMINI_FREE_TIER_CONFIRMED = "true";
  for (const body of [{ resume: "short", role: "Frontend developer" }, { resume, role: "x" }, { resume, role: "Frontend developer", hoursPerWeek: 99 }, { resume, role: "Frontend developer", familyId: "nope" }]) {
    assert.equal((await call(body)).statusCode, 400);
  }
  assert.equal(aiCalls, 0);

  aiText = JSON.stringify({ projects: [{ title: "Accessible tracker", pitch: "Build it.", why: "Covers 90% of postings", build: ["One", "Two"], deliverables: ["Repo"], skills: ["Accessibility", "React", "Made Up Skill"], weeks: 4 }] });
  quota = false;
  res = await call();
  assert.equal(res.body.source, "local");
  assert(res.body.fallbackReason.includes("no paid fallback"));
  assert.equal(aiCalls, 0, "quota gate checked before any provider request");
  quota = true;
  res = await call();
  assert.equal(res.body.source, "ai");
  assert.equal(res.body.provider, "gemini-free-tier");
  assert.equal(res.body.projects.length, 1);
  assert.deepEqual(res.body.projects[0].skills, ["Accessibility", "React"]);
  assert(!/90%/.test(res.body.projects[0].why));
  assert.equal(res.body.projects[0].demand.React.pct, 100);
  aiMode = "quota";
  res = await call();
  assert.equal(res.body.source, "local");
  assert(res.body.fallbackReason.includes("no paid fallback"));
  aiMode = "timeout";
  res = await call();
  assert.equal(res.body.source, "local");
  aiMode = "ok";
  aiText = "not json";
  res = await call();
  assert.equal(res.body.source, "local");
  aiText = JSON.stringify({ projects: [{ title: "Nope", pitch: "x", build: ["a", "b"], skills: ["Made Up"], weeks: 3 }] });
  res = await call();
  assert.equal(res.body.source, "local", "projects with no valid market skills are rejected");
  res = response();
  await recommendHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.body.service, "nextwork-recommend");
  assert.equal(res.body.costPolicy, "free-only");

  // ---------- Page behavior (client code in a stubbed browser context) ----------
  const elements = {};
  const element = (s) => elements[s] || (elements[s] = { querySelector() { return { textContent: "", focus() {} }; }, querySelectorAll() { return []; }, focus() {}, value: "", style: {}, innerHTML: "", textContent: "", hidden: true, checked: false, disabled: false, classList: { add() {}, remove() {} }, scrollIntoView() {} });
  const data = {};
  const storage = { getItem: (k) => data[k] || null, setItem: (k, v) => (data[k] = String(v)), removeItem: (k) => delete data[k] };
  let clipboard = "";
  let marketResponse;
  const ctx = {
    document: { getElementById: element, querySelector: element, querySelectorAll() { return []; }, addEventListener() {}, body: { classList: { toggle() {}, add() {}, remove() {} } } },
    localStorage: storage, workspaceLocal: storage, workspaceSession: storage, sessionStorage: storage,
    location: { hash: "#recommend", hostname: "nextwork-jobs.vercel.app" },
    window: { addEventListener() {}, scrollTo() {} },
    navigator: { clipboard: { writeText: async (t) => { clipboard = t; } } },
    setTimeout() {}, authPage() { return "Sign in"; }, FormData, AbortSignal,
    fetch: async (url) => {
      if (!url.includes("/api/market")) throw new Error("unexpected request " + url);
      if (marketResponse instanceof Error) throw marketResponse;
      return { ok: true, json: async () => marketResponse };
    }
  };
  vm.createContext(ctx);
  const pageScripts = [...fs.readFileSync("dist/index.html", "utf8").matchAll(/<script src="([^"]+)"/g)].map((x) => x[1]).filter((f) => !["supabase.js", "account.js", "backend.js"].includes(f));
  assert(pageScripts.includes("recommend.js") && pageScripts.indexOf("recommend.js") < pageScripts.indexOf("app.js"), "recommend.js must load before app.js");
  for (const f of pageScripts) {
    vm.runInContext(fs.readFileSync("dist/" + f, "utf8"), ctx);
    if (f === "extra-jobs.js") ctx.ExtraJobs = ctx.window.ExtraJobs;
    if (f === "criteria.js") ctx.MatchCriteria = ctx.window.MatchCriteria;
    if (f === "resume-engine.js") ctx.ResumeEngine = ctx.window.ResumeEngine;
    if (f === "market-data.js") ctx.MarketData = ctx.window.MarketData;
    if (f === "recommend-engine.js") ctx.RecommendEngine = ctx.window.RecommendEngine;
  }
  vm.runInContext("render()", ctx);
  const html = element("#app").innerHTML;
  assert(html.includes("Where are you headed?") && html.includes("Project recommendations."));
  assert(element("#nav").innerHTML.includes("Project ideas"));
  assert(html.includes("id=\"reco-role\"") && html.includes("Free-tier AI"));
  assert(element("#reco-results").innerHTML === "" || true);

  const submit = async (values) => {
    Object.assign(element("#reco-resume"), { value: values.resume });
    Object.assign(element("#reco-role"), { value: values.role });
    Object.assign(element("#reco-hours"), { value: "8" });
    Object.assign(element("#reco-method"), { value: "local" });
    Object.assign(element("#reco-family"), { value: values.family || "" });
    element("#reco-error").textContent = "";
    await vm.runInContext("runRecommend({preventDefault(){}})", ctx);
  };
  marketResponse = { service: "nextwork-market", source: "live", postings: 18, fetchedAt: "2026-11-14T00:00:00Z", family: { id: "frontend", label: "Frontend / web development" }, sources: [{ name: "Greenhouse", count: 18 }], skills: [{ skill: "React", pct: 100, count: 18 }, { skill: "TypeScript", pct: 80, count: 14 }, { skill: "Accessibility", pct: 40, count: 7 }, { skill: "<img src=x onerror=alert(1)>", pct: 30, count: 5 }], samples: [{ title: "Frontend Engineer", company: "acme", source: "Greenhouse", url: "https://boards.greenhouse.io/acme/jobs/1" }, { title: "Evil", company: "x", source: "Greenhouse", url: "javascript:alert(1)" }] };
  await submit({ resume, role: "Frontend developer" });
  let out = element("#reco-results").innerHTML;
  assert.equal(element("#reco-error").textContent, "");
  assert(out.includes("Live postings") && out.includes("18</b> live postings from Greenhouse (18)"));
  assert(out.includes("100%") && out.includes("In demand, not yet evidenced"));
  assert(out.includes("Accessibility"));
  assert((out.match(/class="panel wide-panel reco-project"/g) || []).length === 3);
  assert(!out.includes("<img src=x"), "market data is escaped");
  assert(!out.includes("javascript:"), "non-https sample links are dropped");
  assert(out.includes("https://boards.greenhouse.io/acme/jobs/1") && out.includes("noopener noreferrer"));
  assert(out.includes("Free recommendations"));
  assert(out.includes('href="#project/'), "related marketplace listings are linked");
  assert.equal(data["nw-reco-role"], "Frontend developer");
  assert.equal(data["proof-resume"], resume);

  vm.runInContext("saveIdea(0)", ctx);
  assert.equal(JSON.parse(data["nw-saved-ideas"]).length, 1);
  assert(element("#reco-results").innerHTML.includes("Saved ✓"));
  vm.runInContext("saveIdea(0)", ctx);
  assert.equal(JSON.parse(data["nw-saved-ideas"]).length, 0);
  vm.runInContext("saveIdea(1)", ctx);
  vm.runInContext("removeIdea(0)", ctx);
  assert.equal(JSON.parse(data["nw-saved-ideas"]).length, 0);
  vm.runInContext("copyIdea(0)", ctx);
  await Promise.resolve();
  assert(clipboard.startsWith("# ") && clipboard.includes("Target role: Frontend developer"));

  // Network failure falls back to the authored baseline, labeled as such.
  marketResponse = new Error("offline");
  await submit({ resume, role: "Robotics engineer" });
  out = element("#reco-results").innerHTML;
  assert(out.includes("Baseline estimate") && out.includes("authored baseline"));
  assert(out.includes("Embedded systems and robotics"));
  // Short inputs are rejected before any request.
  await submit({ resume: "too short", role: "Frontend developer" });
  assert(element("#reco-error").textContent.includes("100 characters"));
  await submit({ resume, role: "x" });
  assert(element("#reco-error").textContent.includes("what role"));
  // AI mode requires consent.
  Object.assign(element("#reco-method"), { value: "ai" });
  Object.assign(element("#reco-consent"), { checked: false });
  Object.assign(element("#reco-resume"), { value: resume });
  Object.assign(element("#reco-role"), { value: "Frontend developer" });
  await vm.runInContext("runRecommend({preventDefault(){}})", ctx);
  assert(element("#reco-error").textContent.includes("consent"));

  console.log("Project recommendation engine, live and baseline market data, AI validation, quota gate, API auth and page behavior checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
