const assert = require("node:assert/strict");
const engine = require("../dist/resume-engine");
const resume =
  "Alex Johnson\nalex@example.com\nEDUCATION\nBS Computer Science\nSKILLS\nReact, JavaScript, SQL, Git\nPROJECTS\n- Built a React dashboard for 40 volunteers.\n- Developed a SQL report that reduced time by 20%.\nEXPERIENCE\n- Collaborated with four team members.";
let r = engine.review(
  resume,
  "Required React, TypeScript and SQL. Must have testing experience.",
);
assert.equal(r.match.score, 63);
assert(r.match.partial.includes("TypeScript"), "Related JavaScript evidence earns partial, not full TypeScript credit");
assert.deepEqual(r.match.missing, ["TypeScript", "Testing"]);
assert(r.match.matched.includes("React"));
assert(r.improvements.every((x) => x.title));
assert.equal(engine.review(resume).match, null);
assert.equal(
  engine.review(resume, "Be enthusiastic and kind.").match.score,
  null,
);
assert(!engine.has("reactive behavior", "React"));
assert(engine.has("Experience with react.js", "React"));
assert(engine.review("Small resume").score < engine.review(resume).score);
assert.equal(engine.review("<script>alert(1)</script>").source, "local");
const fit = engine.compatibility(
  "Experienced graduate with React and JavaScript. Built multiple customer dashboards and worked with a team to deliver responsive web applications.",
  { tags: ["React", "JavaScript", "Data Visualization"] },
);
assert.equal(fit.jobScore, 33, "Bare skill claims receive half credit; a contribution must name the relevant skill");
assert.equal(
  fit.score,
  Math.round(fit.jobScore * 0.75 + fit.fieldScore * 0.25),
);
assert(fit.missing.includes("Data Visualization"));
assert(fit.partial.includes("React"));
assert.equal(engine.compatibility("", { tags: ["React"] }).score, null);
assert.equal(
  engine.compatibility(
    "A long resume about reactive systems and work without the specific skill requested. Academic project portfolio and team experience.",
    { tags: ["React"] },
  ).jobScore,
  0,
);
assert.equal(
  engine.compatibility(
    "Experience in UX Design, copywriting, and user research for academic projects. Conducted user tests and delivered a complete design case study.",
    { tags: ["UI/UX Design", "User Research"] },
  ).jobScore,
  50,
);
const handler = require("../api/resume");
function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
    end() {
      return this;
    },
  };
}
(async () => {
  let providerCalls = 0,
    authMode = "valid",
    quota = true,
    providerMode = "ok";
  global.fetch = async (url, options) => {
    if (url.endsWith("/auth/v1/user")) {
      assert.equal(options.headers.Authorization, "Bearer test-session");
      if (authMode === "offline") throw Error("Offline");
      return {
        ok: authMode === "valid",
        status: 401,
        json: async () => ({
          id: "user-a",
          is_anonymous: authMode === "anonymous",
        }),
      };
    }
    if (url.endsWith("/rpc/consume_resume_review"))
      return { ok: true, json: async () => quota };
    assert(url.startsWith("https://generativelanguage.googleapis.com/"));
    providerCalls++;
    assert(!options.headers.Authorization);
    assert.equal(options.headers["x-goog-api-key"], "test-free-key");
    if (providerMode === "timeout") throw Error("Timeout");
    if (providerMode === "quota")
      return { ok: false, status: 429, json: async () => ({}) };
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }],
      }),
    };
  };
  const call = async (
    headers = { authorization: "Bearer test-session" },
    body = { resume },
  ) => {
    const res = response();
    await handler({ method: "POST", headers, body }, res);
    return res;
  };
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_FREE_TIER_CONFIRMED;
  process.env.OPENAI_API_KEY = "ignored-paid-key";
  assert.equal((await call({})).statusCode, 401);
  assert.equal(providerCalls, 0);
  authMode = "invalid";
  assert.equal((await call()).statusCode, 401);
  authMode = "anonymous";
  assert.equal((await call()).statusCode, 401);
  authMode = "offline";
  assert.equal((await call()).statusCode, 503);
  authMode = "valid";
  let res = await call();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "local");
  assert.equal(providerCalls, 0);
  process.env.GEMINI_API_KEY = "test-free-key";
  res = await call();
  assert.equal(res.body.source, "local");
  assert.equal(providerCalls, 0);
  process.env.GEMINI_FREE_TIER_CONFIRMED = "true";
  assert.equal((await call(undefined, { resume: "short" })).statusCode, 400);
  quota = false;
  res = await call();
  assert.equal(res.body.source, "local");
  assert.equal(providerCalls, 0);
  quota = true;
  res = await call({
    authorization: "Bearer test-session",
    origin: "https://mr-albenberg.github.io",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, "ai");
  assert.equal(res.body.provider, "gemini-free-tier");
  assert(res.headers["Access-Control-Allow-Headers"].includes("Authorization"));
  providerMode = "quota";
  res = await call(undefined, { resume, listingId: 2 });
  assert.equal(res.body.source, "local");
  assert(res.body.fallbackReason.includes("no paid fallback"));
  assert.equal(res.body.match.field, "Development");
  providerMode = "timeout";
  res = await call();
  assert.equal(res.body.source, "local");
  assert(res.body.fallbackReason.includes("no paid fallback"));
  console.log(
    "Resume checks, verified sessions, anonymous rejection, durable quota gate, Gemini free-tier and fallback checks passed.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
