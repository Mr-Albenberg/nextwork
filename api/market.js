const Market = require("../lib/market");
const Engine = require("../dist/recommend-engine");

function cors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || "https://mr-albenberg.github.io";
  if (req.headers.origin === allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
}

// Public, read-only market profile. Contains no user data, so it is cacheable at the CDN.
module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET." });
  let role = "";
  let familyId = "";
  try {
    const url = new URL(req.url || "/", "http://localhost");
    role = String(req.query?.role ?? url.searchParams.get("role") ?? "");
    familyId = String(req.query?.family ?? url.searchParams.get("family") ?? "");
  } catch {
    /* fall through to validation */
  }
  role = role.replace(/[\u0000-\u001f]/g, " ").trim();
  if (role.length < 2 || role.length > 80) return res.status(400).json({ error: "Provide a role between 2 and 80 characters." });
  if (familyId && !Engine.familyById(familyId)) return res.status(400).json({ error: "Unknown role family." });
  const profile = await Market.getProfile(role, { familyId: familyId || undefined });
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  return res.status(200).json({ service: "nextwork-market", version: 1, ...profile });
};
