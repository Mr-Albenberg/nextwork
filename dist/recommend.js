// Project recommendations page: compares real hiring demand with the user's resume
// and suggests portfolio projects. Depends on helpers defined in earlier scripts
// ($, esc, toast, title, icon, jobs, workspaceSession, workspaceLocal, Account, resumeAPIBase).
const RECO_ROLE_KEY = "nw-reco-role";
const RECO_HOURS_KEY = "nw-reco-hours";
const RECO_SAVED_KEY = "nw-saved-ideas";

function recoSavedIdeas() {
  try {
    const list = JSON.parse(workspaceLocal.getItem(RECO_SAVED_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function recoStrings(list, max) {
  return (Array.isArray(list) ? list : []).map((x) => String(x)).slice(0, max);
}

function recoDemandLabel(d) {
  if (!d) return "";
  if (typeof d.pct === "number") return ` · ${Math.max(0, Math.min(100, Math.round(d.pct)))}% of postings`;
  if (d.tier) return ` · ${esc(d.tier)} skill`;
  return "";
}

function recoRelatedListings(project) {
  return jobs
    .map((j) => ({
      j,
      score: project.skills.filter((s) => j.tags.some((t) => t.toLowerCase() === s.toLowerCase() || RecommendEngine.has(t, s))).length
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.j.id - b.j.id)
    .slice(0, 2)
    .map((x) => x.j);
}

async function recoLoadMarket(role, family) {
  try {
    const r = await fetch(resumeAPIBase() + "/api/market?role=" + encodeURIComponent(role.slice(0, 80)) + "&family=" + encodeURIComponent(family.id), { signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw Error("market unavailable");
    const p = await r.json();
    if (p.service !== "nextwork-market" || !Array.isArray(p.skills) || !p.skills.length) throw Error("bad market response");
    p.skills = p.skills
      .filter((s) => s && typeof s.skill === "string")
      .map((s) => ({ skill: s.skill, pct: typeof s.pct === "number" ? s.pct : null, count: typeof s.count === "number" ? s.count : null, tier: typeof s.tier === "string" ? s.tier : null }));
    return p;
  } catch {
    const b = RecommendEngine.baselineProfile(family);
    b.note = "Live posting data could not be reached from this device. Showing Nextwork's authored baseline for this role. " + MarketData.snapshotNote;
    return b;
  }
}

async function recoFetchAI(resume, role, family, hours, custom = false) {
  const session = (await Account.client.auth.getSession()).data.session;
  if (!session) {
    Account.message = "Sign in to get AI project recommendations.";
    location.hash = "login";
    return null;
  }
  const response = await fetch(resumeAPIBase() + "/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: JSON.stringify(custom ? { resume, role, hoursPerWeek: hours, custom: true } : { resume, role, hoursPerWeek: hours, familyId: family.id }),
    signal: AbortSignal.timeout(58000)
  });
  let out;
  try {
    out = await response.json();
  } catch {
    throw Error("The server did not return recommendations.");
  }
  if (!response.ok) throw Error(out.error || "Recommendations could not be completed.");
  if (!Array.isArray(out.projects) || !out.projects.length) throw Error("The server returned no recommendations.");
  return out;
}

function recoMarketHTML(s) {
  const p = s.profile;
  const rows = new Map(s.analysis.have.concat(s.analysis.gaps).map((r) => [r.skill, r]));
  const live = p.source === "live";
  const sources = (Array.isArray(p.sources) ? p.sources : []).map((x) => `${esc(x.name)} (${Number(x.count) || 0})`).join(", ");
  const when = p.fetchedAt ? new Date(p.fetchedAt).toLocaleDateString() : "";
  const samples = (Array.isArray(p.samples) ? p.samples : []).filter((x) => /^https:\/\//.test(String(x.url)));
  return `<div class="panel wide-panel report-card"><div class="section-title"><div class="eyebrow">◎ WHAT EMPLOYERS ASK FOR</div><span class="tag">${live ? "Live postings" : p.source === "ai-estimate" ? "AI estimate" : "Baseline estimate"}</span></div>
<h2>${esc(p.family?.label || s.family.label)}</h2>
<p>${live ? `Based on <b>${Number(p.postings) || 0}</b> live postings from ${sources}${when ? ", fetched " + esc(when) : ""}. Skills are counted by keyword match in each posting. This is a sample of public postings, not the whole job market.` : esc(p.note || "Showing Nextwork's authored baseline for this role.")}</p>
<div class="reco-skills">${p.skills.slice(0, 10).map((m) => {
    const r = rows.get(m.skill);
    const pct = typeof m.pct === "number" ? Math.max(0, Math.min(100, m.pct)) : null;
    return `<div class="reco-skill"><span class="reco-skill-name">${esc(m.skill)}</span>${pct !== null ? `<div class="progress" role="img" aria-label="${esc(m.skill)} appears in ${pct}% of postings"><i style="width:${pct}%"></i></div><b>${pct}%</b>` : `<span class="tag">${esc(m.tier || "common")}</span>`}<span class="tag ${r && r.have ? "tag-positive" : "tag-gap"}">${r && r.have ? "✓ In your resume" : "Not yet evidenced"}</span></div>`;
  }).join("")}</div>
${samples.length ? `<h3 style="margin-top:22px">A few of the postings counted</h3><div class="reco-samples">${samples.map((x) => `<a class="text-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} · ${esc(x.company)} ↗</a>`).join("")}</div>` : ""}</div>`;
}

function recoGapHTML(s) {
  const a = s.analysis;
  return `<div class="panel wide-panel report-card"><div class="eyebrow">↗ YOUR GAP ANALYSIS</div>
<h2>${a.coverage === null ? "Add your resume to compare" : a.coverage + "% of the demand shows up in your resume"}</h2>
<p>Demand-weighted keyword check against the skills above. Missing resume evidence does not mean you lack the skill. Add it to your resume only if it reflects your real experience.</p>
<h3>Already evidenced</h3><div class="tags">${a.have.map((r) => `<span class="tag tag-positive">✓ ${esc(r.skill)}</span>`).join("") || '<span class="resume-hint">No matching skill terms found yet.</span>'}</div>
<h3 style="margin-top:20px">In demand, not yet evidenced</h3><div class="tags">${a.gaps.slice(0, 8).map((r) => `<span class="tag tag-gap">${esc(r.skill)}</span>`).join("") || '<span class="resume-hint">None of the tracked skills are missing.</span>'}</div></div>`;
}

const RECO_LAST_KEY = "nw-reco-last";
const RECO_HOURS = 8; // assumed weekly hours; only used to size projects, never asked of the user

let recoState = { status: "idle", step: "", error: "", result: null, busy: false };

const RECO_CSS = `
.rp-wrap{max-width:760px;margin:0 auto;padding:6px 0 40px}.rp-wrap.rp-wide{max-width:920px}
.rp-hero{text-align:center;margin:10px 0 28px}.rp-hero .eyebrow{display:block;text-align:center}.rp-hero h1{font-size:36px;line-height:1.12;letter-spacing:-.025em;margin:8px 0 12px}.rp-hero p{max-width:560px;margin:0 auto;color:var(--theme-muted,#5f6583);font-size:15px;line-height:1.6}
.rp-card{background:var(--theme-surface,#fff);border:1px solid var(--theme-line,#dfe6f7);border-radius:18px;padding:30px;box-shadow:0 18px 50px rgba(28,53,122,.07)}
.rp-card .field{display:block;margin:0 0 20px;font-weight:600}.rp-card .field input{margin-top:8px;font-size:16px;padding:14px 16px}
.rp-label{display:flex;justify-content:space-between;align-items:baseline;font-weight:600;margin-bottom:8px}.rp-label small{font-weight:400;color:var(--theme-muted,#5f6583)}
.rp-resume-ok{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--theme-line,#dfe6f7);background:var(--theme-subtle,#f1f3fc);border-radius:12px;padding:14px 16px;font-size:14px}.rp-resume-ok b{color:var(--theme-success,#1c7a4a)}
.rp-card .upload-zone{margin:0}.rp-text{margin-top:14px}.rp-text summary{cursor:pointer;color:var(--theme-accent,#1d3be0);font-size:13px;font-weight:600}.rp-text textarea{margin-top:10px;min-height:170px;width:100%}
.rp-go{width:100%;margin-top:24px;padding:16px;font-size:16px}.rp-fine{font-size:11px;line-height:1.6;color:var(--theme-muted,#5f6583);margin:14px 0 0;text-align:center}
.rp-how{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px}.rp-how div{font-size:12px;line-height:1.55;color:var(--theme-muted,#5f6583);padding:14px;border-radius:12px;background:var(--theme-subtle,#f1f3fc)}.rp-how b{display:block;color:var(--theme-ink,#1b1f37);font-size:13px;margin-bottom:4px}
.rp-results-head{margin:14px 0 26px}.rp-results-head h1{font-size:32px;line-height:1.15;letter-spacing:-.02em;margin:8px 0 10px}.rp-results-head p{color:var(--theme-muted,#5f6583);font-size:15px;margin:0 0 14px}
.rp-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.rp-chips a{font-size:12px;font-weight:600;margin-left:6px}
.rp-pill{display:inline-block;font-size:12px;font-weight:600;padding:5px 11px;border-radius:99px;background:var(--theme-subtle,#eef1fb);border:1px solid var(--theme-line,#dfe6f7);color:var(--theme-ink,#1b1f37)}.rp-pill.strong{background:var(--theme-accent,#1d3be0);border-color:transparent;color:#fff}
.rp-project{background:var(--theme-surface,#fff);border:1px solid var(--theme-line,#dfe6f7);border-radius:18px;padding:30px;margin-bottom:22px;box-shadow:0 12px 40px rgba(28,53,122,.06)}
.rp-project-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.rp-meta{display:flex;gap:8px;flex-wrap:wrap}
.rp-num{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--theme-accent,#1d3be0);color:#fff;font-weight:700}
.rp-project h2{font-size:25px;line-height:1.2;letter-spacing:-.015em;margin:0 0 10px}.rp-lead{font-size:15px;line-height:1.7;color:var(--theme-ink,#1b1f37);margin:0 0 16px}
.rp-why{display:grid;gap:4px;background:var(--theme-subtle,#eef1fb);border-left:3px solid var(--theme-accent,#1d3be0);border-radius:8px;padding:13px 16px;font-size:13px;line-height:1.6;margin-bottom:6px}.rp-why b{font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.rp-project h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--theme-muted,#5f6583);margin:24px 0 10px}
.rp-plan{list-style:none;counter-reset:rp;padding:0;margin:0;display:grid;gap:12px}.rp-plan li{counter-increment:rp;position:relative;padding-left:44px;font-size:14px;line-height:1.6}.rp-plan li:before{content:counter(rp);position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--theme-subtle,#eef1fb);border:1px solid var(--theme-line,#dfe6f7);font-size:12px;font-weight:700}.rp-plan b{display:block}.rp-plan span{color:var(--theme-muted,#5f6583)}
.rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.rp-project ul{margin:0;padding-left:18px;font-size:14px;line-height:1.8}.rp-project .rp-block p{font-size:14px;line-height:1.7;margin:0}
.rp-actions button,.rp-actions a{width:auto;flex:0 0 auto;margin:0}.rp-project .tag{font-size:12px;padding:5px 10px}.rp-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;padding-top:20px;border-top:1px solid var(--theme-line,#dfe6f7)}
.rp-section{margin-top:34px}.rp-h2{font-size:22px;letter-spacing:-.01em;margin:0 0 6px}.rp-sub{color:var(--theme-muted,#5f6583);font-size:14px;margin:0 0 16px}
.rp-loading{text-align:center;padding:60px 30px}.rp-loading h2{margin:18px 0 8px}.rp-loading p{color:var(--theme-muted,#5f6583);margin:0}.rp-spinner{width:44px;height:44px;margin:0 auto;border-radius:50%;border:4px solid var(--theme-line,#dfe6f7);border-top-color:var(--theme-accent,#1d3be0);animation:rp-spin 1s linear infinite}@keyframes rp-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.rp-spinner{animation-duration:3s}}
.rp-saved-card .rp-saved-details{margin-top:10px;font-size:13px}.rp-saved-details summary{cursor:pointer;color:var(--theme-accent,#1d3be0);font-weight:600}.rp-saved-details ol,.rp-saved-details ul{padding-left:18px;line-height:1.7}
@media(max-width:700px){.rp-hero h1{font-size:28px}.rp-how{grid-template-columns:1fr}.rp-grid{grid-template-columns:1fr}.rp-project,.rp-card{padding:22px}.rp-results-head h1{font-size:26px}}
`;

function recoInjectStyle() {
  try {
    if (typeof document === "undefined" || !document.head || typeof document.createElement !== "function" || document.getElementById("rp-style")) return;
    const style = document.createElement("style");
    style.id = "rp-style";
    style.textContent = RECO_CSS;
    document.head.appendChild(style);
  } catch {
    /* styling is cosmetic; never break the page */
  }
}

const recoCap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

function recoSafeProject(p, profile, weekly) {
  const dm = RecommendEngine.demandMap(profile);
  const skills = recoStrings(p.skills, 10);
  const demand = {};
  for (const s of skills) demand[s] = p.demand && p.demand[s] ? p.demand[s] : dm[s] || null;
  const weeks = Number.isFinite(+p.weeks) ? Math.max(1, Math.min(12, Math.round(+p.weeks))) : RecommendEngine.scopeWeeks(40, weekly);
  const plan = (Array.isArray(p.plan) ? p.plan : [])
    .slice(0, 7)
    .filter((x) => x && x.phase)
    .map((x) => ({ phase: String(x.phase).slice(0, 80), details: String(x.details || "").slice(0, 400) }));
  return {
    title: String(p.title || "Untitled project").slice(0, 120),
    pitch: String(p.pitch || ""),
    overview: String(p.overview || "").slice(0, 800),
    why: String(p.why || ""),
    difficulty: ["beginner", "intermediate", "advanced"].includes(p.difficulty) ? p.difficulty : "",
    build: recoStrings(p.build, 8),
    plan,
    tools: recoStrings(p.tools, 8),
    deliverables: recoStrings(p.deliverables, 6),
    stretch: recoStrings(p.stretch, 3),
    showcase: String(p.showcase || "").slice(0, 400),
    skills,
    covers: recoStrings(p.covers, 10),
    buildsOn: recoStrings(p.buildsOn, 10),
    weeks,
    hours: Number.isFinite(+p.hours) && +p.hours > 0 ? Math.round(+p.hours) : weeks * weekly,
    demand
  };
}

function recoProjectHTML(p, i) {
  const saved = recoSavedIdeas().some((x) => x.title === p.title);
  const related = recoRelatedListings(p);
  const steps = p.plan.length ? p.plan : p.build.map((b) => ({ phase: b, details: "" }));
  const tags = (list, cls) => list.map((x) => `<span class="tag ${cls || ""}">${esc(x)}</span>`).join("");
  return `<article class="rp-project">
<div class="rp-project-top"><span class="rp-num">${i + 1}</span><div class="rp-meta">${p.difficulty ? `<span class="rp-pill">${esc(recoCap(p.difficulty))}</span>` : ""}<span class="rp-pill">About ${p.hours} hours · ${p.weeks} week${p.weeks === 1 ? "" : "s"}</span></div></div>
<h2>${esc(p.title)}</h2>
<p class="rp-lead">${esc(p.overview || p.pitch)}</p>
${p.why ? `<div class="rp-why"><b>Why this project for you</b><span>${esc(p.why)}</span></div>` : ""}
<h3>Skills it proves</h3>
<div class="tags">${p.skills.map((x) => `<span class="tag ${p.covers.includes(x) ? "tag-gap" : "tag-positive"}">${esc(x)}${recoDemandLabel(p.demand[x])}</span>`).join("")}</div>
<p class="resume-hint" style="margin-top:8px">Red skills are in demand but not yet shown in your resume. Green skills you already show and will deepen.</p>
<h3>Your plan</h3>
<ol class="rp-plan">${steps.map((x) => `<li><b>${esc(x.phase)}</b>${x.details ? `<span>${esc(x.details)}</span>` : ""}</li>`).join("")}</ol>
<div class="rp-grid">
${p.deliverables.length ? `<div><h3>What you will finish with</h3><ul>${p.deliverables.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
${p.tools.length ? `<div><h3>Tools to use</h3><div class="tags">${tags(p.tools)}</div></div>` : ""}
</div>
${p.showcase ? `<div class="rp-block"><h3>How to show it off</h3><p>${esc(p.showcase)}</p></div>` : ""}
${p.stretch.length ? `<div class="rp-block"><h3>If you want to go further</h3><ul>${p.stretch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
${related.length ? `<div class="rp-block"><h3>Get paid to build something similar</h3>${related.map((j) => `<a class="reco-related" href="#project/${j.id}"><b>${esc(j.title)}</b><small>${esc(j.c)} · $${j.pay.toLocaleString()} · ${esc(j.weeks)}</small></a>`).join("")}</div>` : ""}
<div class="rp-actions"><button class="primary" onclick="saveIdea(${i})">${saved ? "Saved ✓" : "Save this project"}</button><button class="outline" onclick="copyIdea(${i})">Copy project brief</button></div>
</article>`;
}

function recoDoneHTML() {
  const s = recoState.result;
  const p = s.profile;
  const a = s.analysis;
  const basis = p.source === "live" ? `${Number(p.postings) || 0} live job postings` : p.source === "ai-estimate" ? "an AI estimate of what employers ask for" : "Nextwork's baseline for this field";
  return `<div class="rp-wrap rp-wide">
<a class="text-link" href="#recommend">← Change role or resume</a>
<div class="rp-results-head"><span class="eyebrow">YOUR PROJECT PLAN</span>
<h1>${s.projects.length} project${s.projects.length === 1 ? "" : "s"} to get you ready for ${esc(s.role)}</h1>
<p>Designed from ${esc(basis)} and your resume.</p>
<div class="rp-chips"><span class="rp-pill strong">${p.source === "live" ? "Live postings" : p.source === "ai-estimate" ? "AI estimate" : "Baseline estimate"}</span>${a.coverage !== null ? `<span class="rp-pill">${a.coverage}% of employer demand already in your resume</span>` : ""}<a href="#projects">Saved ideas →</a></div></div>
${s.note ? `<div class="notice" style="margin-bottom:18px">${esc(s.note)}</div>` : ""}
<section class="rp-section"><h2 class="rp-h2">What employers are asking for</h2><p class="rp-sub">What the job postings ask for, and how your resume compares. The projects below are built to close these gaps.</p>${recoMarketHTML(s)}${recoGapHTML(s)}</section>
<section class="rp-section"><h2 class="rp-h2">Projects to build</h2><p class="rp-sub">Each one targets a gap above. Save the ones you want.</p></section>
${s.projects.map((x, i) => recoProjectHTML(x, i)).join("")}
</div>`;
}

function recoResultsHTML() {
  if (recoState.status === "loading") {
    return `<div class="rp-wrap"><div class="rp-card rp-loading" role="status"><div class="rp-spinner"></div><h2>Building your project plan</h2><p id="reco-step">${esc(recoState.step || "Working…")}</p><p class="resume-hint" style="margin-top:10px">This usually takes 15 to 40 seconds.</p></div></div>`;
  }
  if (recoState.status === "error") {
    return `<div class="rp-wrap"><div class="rp-card rp-loading"><h2>We could not finish that</h2><p role="alert">${esc(recoState.error || "Something went wrong.")}</p><div class="rp-actions" style="justify-content:center;border:0"><a class="primary" href="#recommend" style="text-decoration:none">Try again</a></div></div></div>`;
  }
  if (recoState.status === "done" && recoState.result) return recoDoneHTML();
  return `<div class="rp-wrap"><div class="rp-card rp-loading"><h2>No project plan yet</h2><p>Tell us the job you want and add your resume to get started.</p><div class="rp-actions" style="justify-content:center;border:0"><a class="primary" href="#recommend" style="text-decoration:none">Get started</a></div></div></div>`;
}

function recoRestore() {
  try {
    const last = JSON.parse(workspaceSession.getItem(RECO_LAST_KEY) || "null");
    if (!last || !last.profile || !Array.isArray(last.projects) || !last.projects.length) return;
    const resume = marketplaceResume();
    recoState = {
      status: "done",
      step: "",
      error: "",
      busy: false,
      result: { role: String(last.role || ""), family: last.profile.family || { label: last.role }, profile: last.profile, analysis: RecommendEngine.analyze(resume, last.profile), hours: RECO_HOURS, source: last.source, note: last.note || "", projects: last.projects }
    };
  } catch {
    /* ignore a corrupt saved result */
  }
}

function recommendResultsPage() {
  recoInjectStyle();
  if (recoState.status === "idle" && !recoState.result) recoRestore();
  return `<section id="reco-results" aria-live="polite">${recoResultsHTML()}</section>`;
}

function bindRecommendResults() {
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0);
}

function recommendPage() {
  recoInjectStyle();
  const role = workspaceSession.getItem(RECO_ROLE_KEY) || "";
  const resume = marketplaceResume();
  const hasResume = resume.trim().length >= 100;
  return `<div class="rp-wrap">
<div class="rp-hero"><span class="eyebrow">PROJECT IDEAS</span><h1>Build the project that gets you hired.</h1><p>Tell us the job you want and add your resume. We read real job postings, see what employers ask for, and design three projects that fill your gaps.</p></div>
<form id="reco-form" class="rp-card" novalidate>
<label class="field">What job do you want?<input id="reco-role" required minlength="2" maxlength="120" placeholder="e.g. Mechanical engineer, UX designer, Data analyst, Nurse" value="${esc(role)}" autocomplete="off"></label>
<div class="rp-label">Your profile resume</div>
<div id="reco-saved" class="rp-resume-ok"><span>${hasResume?'✓ Using your saved profile resume':'Upload your resume once in your profile to get started.'}</span><a class="outline" href="#profile">${hasResume?'Manage resume':'Upload resume'}</a></div>
<details class="rp-text" id="reco-text-wrap"><summary>View saved resume text</summary><textarea id="reco-resume" readonly maxlength="30000">${esc(resume)}</textarea></details>
<button class="primary rp-go" id="reco-run" type="submit">Find my projects ↗</button>
<p id="reco-error" class="review-error" role="alert"></p>
<p class="rp-fine">When you continue, your resume text and target job are sent to Google Gemini (free tier) to design your projects. Google may use free-tier content to improve its products. Remove anything sensitive first.</p>
</form>
<div class="rp-how"><div><b>1. We read the market</b>Real job postings show which skills employers ask for.</div><div><b>2. We check your resume</b>See which of those skills you already show and which you do not.</div><div><b>3. You get a plan</b>Three projects with steps, tools and a finished result to show.</div></div>
</div>`;
}

function bindRecommend() {
  const text = $("#reco-resume");
  const role = $("#reco-role");
  role.oninput = () => workspaceSession.setItem(RECO_ROLE_KEY, role.value);
  $("#reco-form").onsubmit = runRecommend;
}

function recoStep(text) {
  recoState.step = text;
  const el = typeof $ === "function" ? $("#reco-step") : null;
  if (el) el.textContent = text;
}

function recoRerender() {
  if (typeof render === "function" && typeof location !== "undefined" && location.hash === "#recommend/results") render();
}

async function runRecommend(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (recoState.busy) return;
  const error = $("#reco-error");
  error.textContent = "";
  const resume = $("#reco-resume").value.trim();
  const role = $("#reco-role").value.trim();
  if (role.length < 2) {
    error.textContent = "Tell us what job you want.";
    return;
  }
  if (resume.length < 100) {
    error.textContent = "Add your resume in your profile first. It will be available here automatically.";
    $("#reco-text-wrap").open = true;
    return;
  }
  if (typeof Account !== "undefined" && !Account.user) {
    Account.message = "Sign in to get project recommendations.";
    location.hash = "login";
    return;
  }
  setMarketplaceResume(resume);
  workspaceSession.setItem(RECO_ROLE_KEY, role);
  try {
    workspaceSession.removeItem(RECO_LAST_KEY);
  } catch {
    /* ignore */
  }
  const matched = RecommendEngine.matchFamily(role);
  const custom = !matched.matched;
  const family = custom ? { id: "custom", label: role } : matched.family;
  recoState = { status: "loading", step: custom ? "Researching this career…" : "Reading the job market…", error: "", result: null, busy: true };
  location.hash = "#recommend/results";
  try {
    let profile;
    let analysis;
    let projects = null;
    let source = "ai";
    let note = "";
    if (custom) {
      const out = await recoFetchAI(resume, role, family, RECO_HOURS, true);
      if (!out) {
        recoState.status = "idle";
        return;
      }
      const m = out.market || {};
      profile = {
        ...m,
        skills: (Array.isArray(m.skills) ? m.skills : []).filter((s) => s && typeof s.skill === "string").map((s) => ({ skill: s.skill, pct: typeof s.pct === "number" ? s.pct : null, count: typeof s.count === "number" ? s.count : null, tier: typeof s.tier === "string" ? s.tier : null }))
      };
      if (!profile.skills.length) throw Error("The server returned no market data for this role.");
      analysis = RecommendEngine.analyze(resume, profile);
      projects = out.projects;
    } else {
      profile = await recoLoadMarket(role, family);
      analysis = RecommendEngine.analyze(resume, profile);
      recoStep("Designing your projects…");
      try {
        const out = await recoFetchAI(resume, role, family, RECO_HOURS);
        if (!out) {
          recoState.status = "idle";
          return;
        }
        projects = out.projects;
        source = out.source === "ai" ? "ai" : "local";
        note = out.fallbackReason || "";
      } catch (err) {
        if (/sign in|session/i.test(err.message || "")) throw err;
        if (err.name !== "TimeoutError" && err.name !== "TypeError") throw err;
        source = "local";
        note = "The AI service could not be reached, so template projects are shown instead.";
      }
      if (!projects) {
        source = "local";
        projects = RecommendEngine.fallbackProjects(family, analysis, { hoursPerWeek: RECO_HOURS });
      }
    }
    const safe = projects.slice(0, 3).map((p) => recoSafeProject(p, profile, RECO_HOURS));
    recoState = { status: "done", step: "", error: "", busy: true, result: { role, family, profile, analysis, hours: RECO_HOURS, source, note, projects: safe } };
    try {
      workspaceSession.setItem(RECO_LAST_KEY, JSON.stringify({ role, profile, projects: safe, source, note }));
    } catch {
      /* the result still shows; it just will not survive a refresh */
    }
  } catch (err) {
    recoState = { status: "error", step: "", error: err.message || "Recommendations failed. Please try again.", result: null, busy: true };
  } finally {
    recoState.busy = false;
    recoRerender();
  }
}

function recoRefreshSaved() {
  if (location.hash === "#recommend/results") {
    const box = $("#reco-results");
    if (box) {
      box.innerHTML = recoResultsHTML();
      return;
    }
  }
  if (typeof render === "function") render();
}

function saveIdea(i) {
  const s = recoState.result;
  const p = s && s.projects[i];
  if (!p) return;
  let list = recoSavedIdeas();
  if (list.some((x) => x.title === p.title)) list = list.filter((x) => x.title !== p.title);
  else
    list = [
      {
        title: p.title,
        pitch: p.pitch,
        overview: p.overview,
        why: p.why,
        difficulty: p.difficulty,
        build: p.build,
        plan: p.plan,
        tools: p.tools,
        deliverables: p.deliverables,
        stretch: p.stretch,
        showcase: p.showcase,
        skills: p.skills,
        weeks: p.weeks,
        hours: p.hours,
        role: s.role,
        savedAt: new Date().toISOString()
      },
      ...list
    ].slice(0, 30);
  workspaceLocal.setItem(RECO_SAVED_KEY, JSON.stringify(list));
  recoRefreshSaved();
  toast(list.some((x) => x.title === p.title) ? "Project saved. Find it under Applications." : "Project removed");
}

function removeIdea(n) {
  const list = recoSavedIdeas();
  if (!list[n]) return;
  list.splice(n, 1);
  workspaceLocal.setItem(RECO_SAVED_KEY, JSON.stringify(list));
  recoRefreshSaved();
  toast("Project removed");
}

function recoBrief(p, role) {
  const lines = ["# " + p.title, p.overview || p.pitch || ""];
  if (p.why) lines.push("", "Why: " + p.why);
  const steps = p.plan && p.plan.length ? p.plan.map((x, n) => n + 1 + ". " + x.phase + (x.details ? ": " + x.details : "")) : (p.build || []).map((x) => "- " + x);
  if (steps.length) lines.push("", "## Plan", ...steps);
  if (p.deliverables && p.deliverables.length) lines.push("", "## Deliverables", ...p.deliverables.map((x) => "- " + x));
  if (p.tools && p.tools.length) lines.push("", "Tools: " + p.tools.join(", "));
  if (p.stretch && p.stretch.length) lines.push("", "## Stretch goals", ...p.stretch.map((x) => "- " + x));
  if (p.showcase) lines.push("", "Show it off: " + p.showcase);
  lines.push("", "Skills: " + (p.skills || []).join(", "));
  if (p.hours) lines.push("Scope: about " + p.hours + " hours" + (p.weeks ? " (" + p.weeks + " weeks part-time)" : ""));
  if (role) lines.push("Target role: " + role);
  return lines.join("\n");
}

function recoCopyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("Project brief copied"), () => toast("Copy failed. Select the text manually."));
  else toast("Copy is not available in this browser.");
}

function copyIdea(i) {
  const s = recoState.result;
  const p = s && s.projects[i];
  if (p) recoCopyText(recoBrief(p, s.role));
}

function copySavedIdea(n) {
  const x = recoSavedIdeas()[n];
  if (x) recoCopyText(recoBrief(x, x.role));
}

// Saved ideas as shown on the Applications page.
function recoApplicationsHTML() {
  recoInjectStyle();
  const list = recoSavedIdeas();
  const head = `<div class="section-title" style="margin-top:35px"><h2>Saved project ideas · ${list.length}</h2><a class="text-link" href="#recommend">Get more ideas →</a></div>`;
  if (!list.length) return head + '<div class="jobs"><div class="empty">Save a project from <a href="#recommend">Project ideas</a> and it will show up here.</div></div>';
  return (
    head +
    `<div class="jobs">${list
      .map((x, n) => {
        const steps = Array.isArray(x.plan) && x.plan.length ? x.plan : (x.build || []).map((b) => ({ phase: b, details: "" }));
        return `<div class="panel rp-saved-card"><span class="tag">Project idea</span><h3 style="margin-top:16px">${esc(x.title)}</h3><p>${esc(x.overview || x.pitch || "")}</p>
${x.skills && x.skills.length ? `<div class="tags">${x.skills.slice(0, 6).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : ""}
<small class="resume-hint">For: ${esc(x.role || "your target role")}${x.hours ? " · about " + esc(x.hours) + " hours" : x.weeks ? " · about " + esc(x.weeks) + " weeks" : ""}</small>
${steps.length ? `<details class="rp-saved-details"><summary>See the plan</summary><ol>${steps.map((s) => `<li><b>${esc(s.phase)}</b>${s.details ? " " + esc(s.details) : ""}</li>`).join("")}</ol>${x.tools && x.tools.length ? `<p><b>Tools:</b> ${x.tools.map(esc).join(", ")}</p>` : ""}</details>` : ""}
<div class="resume-actions" style="margin-top:12px"><button class="outline" onclick="copySavedIdea(${n})">Copy project brief</button><button class="outline" onclick="removeIdea(${n})">Remove</button></div></div>`;
      })
      .join("")}</div>`
  );
}

recoInjectStyle();
