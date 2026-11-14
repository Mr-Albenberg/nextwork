const { authenticate, consumeReview } = require("../lib/account-auth");
const Market = require("../lib/market");
const Engine = require("../dist/recommend-engine");
const Custom = require("../lib/custom-role");

const FREE_MODEL = "gemini-3.5-flash-lite";
function freeAIReady() {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_FREE_TIER_CONFIRMED === "true";
}
function withDemand(projects, profile) {
  const demand = Engine.demandMap(profile);
  return projects.map((p) => ({ ...p, demand: Object.fromEntries(p.skills.map((s) => [s, demand[s] || null])) }));
}
function local(resume, role, family, profile, hoursPerWeek, reason) {
  const analysis = Engine.analyze(resume, profile);
  return {
    source: "local",
    fallbackReason: reason,
    market: { source: profile.source, postings: profile.postings, family: profile.family },
    projects: withDemand(Engine.fallbackProjects(family, analysis, { hoursPerWeek }), profile)
  };
}

// Any career outside the built-in fields: postings and Gemini build the market profile, Gemini designs the projects.
// There are no template projects for these roles, so every failure is reported plainly instead of faked.
async function customFlow(res, identity, resume, role, hours) {
  if (!freeAIReady()) return res.status(503).json({ error: "Careers outside the built-in fields need the free-tier AI, which is not set up on this server. Pick the closest built-in field instead." });
  if (!(await consumeReview(identity.authorization))) return res.status(429).json({ error: "Free AI limit reached for now. Try again later, or pick the closest built-in field." });
  let profile;
  try {
    profile = await Custom.getCustomProfile(role);
  } catch {
    return res.status(502).json({ error: "We could not build a job-market picture for this role right now. Try again in a minute, or pick the closest built-in field." });
  }
  const analysis = Engine.analyze(resume, profile);
  try {
    const out = await Custom.gemini(process.env, fetch, {
      system: Engine.aiInstruction,
      user: Engine.aiPayload(resume, role, profile, analysis, hours),
      schema: Engine.aiSchema,
      maxTokens: 4000,
      timeoutMs: 30000
    });
    const projects = Engine.validateAI(out, profile, resume, { hoursPerWeek: hours });
    return res.status(200).json({ source: "ai", provider: "gemini-free-tier", custom: true, market: profile, projects: withDemand(projects, profile) });
  } catch (e) {
    return res.status(502).json({ error: e && e.status === 429 ? "The free AI quota is temporarily exhausted. Try again later." : "The AI could not design projects this time. Try again, or pick the closest built-in field." });
  }
}

// Personalized project recommendations. Requires a signed-in session (same rules as /api/resume).
// Market statistics always come from the server's own profile; the model never supplies figures.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const allowed = process.env.ALLOWED_ORIGIN || "https://mr-albenberg.github.io";
  if (req.headers.origin === allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "GET") {
    return res.status(200).json({ service: "nextwork-recommend", aiConfigured: freeAIReady(), provider: "gemini-free-tier", model: FREE_MODEL, costPolicy: "free-only", authenticationRequired: true, version: 1 });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const identity = await authenticate(req);
  if (identity.status) {
    return res.status(identity.status).json({ error: identity.status === 401 ? "Sign in to get AI project recommendations." : identity.status === 403 ? "Project recommendations are available to personal accounts." : "Account verification is temporarily unavailable. Please try again." });
  }
  let body = req.body;
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: "Invalid JSON." });
  }
  const { resume, role, hoursPerWeek = 8, familyId = "", custom = false } = body || {};
  const hours = Number(hoursPerWeek);
  if (typeof resume !== "string" || resume.trim().length < 100 || resume.length > 30000) return res.status(400).json({ error: "Provide 100 to 30,000 resume characters." });
  if (typeof role !== "string" || role.trim().length < 2 || role.length > 120) return res.status(400).json({ error: "Describe your target role in 2 to 120 characters." });
  if (!Number.isFinite(hours) || hours < 2 || hours > 40) return res.status(400).json({ error: "Choose between 2 and 40 hours per week." });
  if (familyId && !Engine.familyById(familyId)) return res.status(400).json({ error: "Unknown role family." });
  if (custom === true) return customFlow(res, identity, resume.trim(), role.trim(), hours);

  const family = (familyId && Engine.familyById(familyId)) || Engine.matchFamily(role).family;
  const profile = await Market.getProfile(role, { familyId: family.id });
  if (!freeAIReady()) return res.status(200).json(local(resume, role, family, profile, hours, "Free template recommendations used. Gemini free-tier setup is not confirmed; no external AI request was made."));
  if (!(await consumeReview(identity.authorization))) return res.status(200).json(local(resume, role, family, profile, hours, "Free AI limit reached or account quota storage unavailable. Free template recommendations used; no paid fallback was attempted."));

  const analysis = Engine.analyze(resume, profile);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + FREE_MODEL + ":generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: Engine.aiInstruction + " Return only JSON matching this schema: " + JSON.stringify(Engine.aiSchema) }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(Engine.aiPayload(resume, role, profile, analysis, hours)) }] }],
        generationConfig: { temperature: 0.5, responseMimeType: "application/json", maxOutputTokens: 4000 }
      }),
      signal: AbortSignal.timeout(50000)
    });
    if (!r.ok) {
      const reason = r.status === 429 ? "The free AI quota is temporarily exhausted. Free template recommendations used; no paid fallback was attempted." : "The free AI service is unavailable. Free template recommendations used; no paid fallback was attempted.";
      return res.status(200).json(local(resume, role, family, profile, hours, reason));
    }
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    const projects = Engine.validateAI(JSON.parse(text), profile, resume, { hoursPerWeek: hours });
    return res.status(200).json({
      source: "ai",
      provider: "gemini-free-tier",
      market: { source: profile.source, postings: profile.postings, family: profile.family },
      projects: withDemand(projects, profile)
    });
  } catch {
    return res.status(200).json(local(resume, role, family, profile, hours, "Free AI recommendations could not complete. Free template recommendations used; no paid fallback was attempted."));
  }
};
