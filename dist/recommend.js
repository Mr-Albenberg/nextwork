// Project recommendations page: compares real hiring demand with the user's resume
// and suggests portfolio projects. Depends on helpers defined in earlier scripts
// ($, esc, toast, title, icon, jobs, workspaceSession, workspaceLocal, Account, resumeAPIBase).
const RECO_ROLE_KEY = "nw-reco-role";
const RECO_HOURS_KEY = "nw-reco-hours";
const RECO_SAVED_KEY = "nw-saved-ideas";
let recoState = { result: null, busy: false };

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

function recoSafeProject(p, profile, hours) {
  const dm = RecommendEngine.demandMap(profile);
  const skills = recoStrings(p.skills, 10);
  const demand = {};
  for (const s of skills) demand[s] = p.demand && p.demand[s] ? p.demand[s] : dm[s] || null;
  return {
    title: String(p.title || "Untitled project").slice(0, 120),
    pitch: String(p.pitch || ""),
    why: String(p.why || ""),
    build: recoStrings(p.build, 6),
    deliverables: recoStrings(p.deliverables, 4),
    skills,
    covers: recoStrings(p.covers, 10),
    buildsOn: recoStrings(p.buildsOn, 10),
    weeks: Number.isFinite(+p.weeks) ? Math.max(1, Math.min(12, Math.round(+p.weeks))) : RecommendEngine.scopeWeeks(40, hours),
    demand
  };
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

function recommendPage() {
  const role = workspaceSession.getItem(RECO_ROLE_KEY) || "";
  const hours = workspaceSession.getItem(RECO_HOURS_KEY) || "8";
  const resume = marketplaceResume();
  const hasResume = resume.trim().length >= 100;
  return (
    title("Project recommendations.", "Tell us where you want to go. We compare real hiring demand with your resume and suggest projects that build the proof you are missing.") +
    `<div class="resume-layout"><section class="panel wide-panel resume-input reco-input"><div class="section-title"><h2>Where are you headed?</h2><span class="tag">${hasResume ? "Using your saved resume" : "Add your resume"}</span></div>
<form id="reco-form">
<label class="field">The role or career you want<input id="reco-role" required minlength="2" maxlength="120" list="reco-roles" placeholder="e.g. Robotics software engineer, UX designer, Data analyst" value="${esc(role)}" autocomplete="off"></label>
<datalist id="reco-roles">${RecommendEngine.families.map((f) => `<option value="${esc(f.label)}">`).join("")}</datalist>
<label class="field">Field <span class="resume-hint" id="reco-detected"></span><select id="reco-family"><option value="">Detect from my role</option>${RecommendEngine.families.map((f) => `<option value="${esc(f.id)}">${esc(f.label)}</option>`).join("")}</select></label>
<label class="upload-zone" id="reco-drop"><span style="font-size:28px">↥</span><b>Drop your resume here or choose a file</b><small>PDF, DOCX, or TXT · up to 5 MB</small><input id="reco-file" type="file" accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
<p id="reco-file-status" class="resume-hint" role="status">Files are read in your browser. Review the extracted text below.</p>
<label class="field">Resume text <span class="resume-hint">Used for skill matching</span><textarea id="reco-resume" required minlength="100" maxlength="30000" placeholder="Paste your resume here, or upload a file above." style="min-height:200px">${esc(resume)}</textarea></label>
<label class="field">Time you can give each week<select id="reco-hours">${[[4, "About 4 hours"], [8, "About 8 hours"], [12, "About 12 hours"], [20, "About 20 hours"]].map(([v, t]) => `<option value="${v}" ${String(v) === hours ? "selected" : ""}>${t}</option>`).join("")}</select></label>
<label class="field">Recommendation method<select id="reco-method"><option value="local">Free recommendations · matched on this device</option><option value="ai">Free-tier AI · personalized, optional (sign-in required)</option></select></label>
<div id="reco-ai" hidden><label class="consent"><input id="reco-consent" type="checkbox"> I agree to send my resume text and target role to Google Gemini through the Nextwork server. Google may use free-tier content to improve its products. I have removed sensitive information I do not want to share.</label></div>
<div class="resume-actions"><button class="primary" id="reco-run">Recommend projects ↗</button></div>
<p id="reco-error" class="review-error" role="alert"></p>
</form></section>
<section id="reco-results" aria-live="polite">${recoResultsHTML()}</section></div>`
  );
}

function bindRecommend() {
  const text = $("#reco-resume");
  const role = $("#reco-role");
  const family = $("#reco-family");
  const detect = () => {
    const value = role.value.trim();
    const m = RecommendEngine.matchFamily(value);
    $("#reco-detected").textContent = family.value ? "Using the field you chose." : value.length < 2 ? "" : m.matched ? "Detected: " + m.family.label : "No clear match. Choose a field for better results.";
  };
  detect();
  role.oninput = () => {
    workspaceSession.setItem(RECO_ROLE_KEY, role.value);
    detect();
  };
  family.onchange = detect;
  text.oninput = () => setMarketplaceResume(text.value);
  $("#reco-hours").onchange = (e) => workspaceSession.setItem(RECO_HOURS_KEY, e.target.value);
  $("#reco-method").onchange = (e) => {
    $("#reco-ai").hidden = e.target.value !== "ai";
  };
  const load = async (file) => {
    if (!file) return;
    const status = $("#reco-file-status");
    status.textContent = "Reading your file…";
    try {
      text.value = await parseResumeFile(file);
      setMarketplaceResume(text.value);
      status.textContent = `Loaded ${file.name}. Check the extracted text before continuing.`;
    } catch (e) {
      status.textContent = e.message || "Could not read this file. Paste the resume text instead.";
    }
  };
  $("#reco-file").onchange = (e) => load(e.target.files[0]);
  const drop = $("#reco-drop");
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  };
  drop.ondragleave = () => drop.classList.remove("dragging");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
    load(e.dataTransfer.files[0]);
  };
  $("#reco-form").onsubmit = runRecommend;
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

async function recoFetchAI(resume, role, family, hours) {
  const session = (await Account.client.auth.getSession()).data.session;
  if (!session) {
    Account.message = "Sign in to get AI project recommendations.";
    location.hash = "login";
    return null;
  }
  const response = await fetch(resumeAPIBase() + "/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: JSON.stringify({ resume, role, hoursPerWeek: hours, familyId: family.id }),
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

async function runRecommend(e) {
  e.preventDefault();
  if (recoState.busy) return;
  const error = $("#reco-error");
  error.textContent = "";
  const resume = $("#reco-resume").value.trim();
  const role = $("#reco-role").value.trim();
  const hours = Number($("#reco-hours").value) || 8;
  const ai = $("#reco-method").value === "ai";
  const chosen = $("#reco-family").value;
  if (resume.length < 100) {
    error.textContent = "Add at least 100 characters of resume text.";
    return;
  }
  if (role.length < 2) {
    error.textContent = "Tell us what role you want.";
    return;
  }
  if (ai && typeof Account !== "undefined" && !Account.user) {
    Account.message = "Sign in to get AI project recommendations.";
    location.hash = "login";
    return;
  }
  if (ai && !$("#reco-consent").checked) {
    error.textContent = "Confirm consent before sending your resume for AI recommendations.";
    return;
  }
  const family = chosen ? RecommendEngine.familyById(chosen) : RecommendEngine.matchFamily(role).family;
  setMarketplaceResume(resume);
  workspaceSession.setItem(RECO_ROLE_KEY, role);
  workspaceSession.setItem(RECO_HOURS_KEY, String(hours));
  const button = $("#reco-run");
  recoState.busy = true;
  button.disabled = true;
  button.textContent = "Reading the job market…";
  try {
    const profile = await recoLoadMarket(role, family);
    const analysis = RecommendEngine.analyze(resume, profile);
    let projects = null;
    let source = "local";
    let note = "";
    if (ai) {
      button.textContent = "Designing your projects…";
      try {
        const out = await recoFetchAI(resume, role, family, hours);
        if (!out) return;
        projects = out.projects;
        source = out.source === "ai" ? "ai" : "local";
        note = out.fallbackReason || "";
      } catch (err) {
        if (/sign in|session/i.test(err.message || "")) throw err;
        if (err.name !== "TimeoutError" && err.name !== "TypeError") throw err;
        note = "The AI service could not be reached. Free template recommendations are shown instead.";
      }
    }
    if (!projects) projects = RecommendEngine.fallbackProjects(family, analysis, { hoursPerWeek: hours });
    recoState.result = { role, family, profile, analysis, hours, source, note, projects: projects.slice(0, 3).map((p) => recoSafeProject(p, profile, hours)) };
    $("#reco-results").innerHTML = recoResultsHTML();
    $("#reco-results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    error.textContent = err.message || "Recommendations failed. Please try again.";
  } finally {
    recoState.busy = false;
    button.disabled = false;
    button.textContent = "Recommend projects ↗";
  }
}

function recoMarketHTML(s) {
  const p = s.profile;
  const rows = new Map(s.analysis.have.concat(s.analysis.gaps).map((r) => [r.skill, r]));
  const live = p.source === "live";
  const sources = (Array.isArray(p.sources) ? p.sources : []).map((x) => `${esc(x.name)} (${Number(x.count) || 0})`).join(", ");
  const when = p.fetchedAt ? new Date(p.fetchedAt).toLocaleDateString() : "";
  const samples = (Array.isArray(p.samples) ? p.samples : []).filter((x) => /^https:\/\//.test(String(x.url)));
  return `<div class="panel wide-panel report-card"><div class="section-title"><div class="eyebrow">◎ WHAT EMPLOYERS ASK FOR</div><span class="tag">${live ? "Live postings" : "Baseline estimate"}</span></div>
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

function recoProjectHTML(p, i, s) {
  const saved = recoSavedIdeas().some((x) => x.title === p.title);
  const related = recoRelatedListings(p);
  return `<article class="panel wide-panel reco-project"><div class="section-title"><div class="eyebrow">✧ PROJECT ${i + 1}</div><span class="tag">About ${p.weeks} week${p.weeks === 1 ? "" : "s"} at ~${s.hours} hrs/week</span></div>
<h2>${esc(p.title)}</h2><p>${esc(p.pitch)}</p>
${p.why ? `<p class="reco-why"><b>Why this one:</b> ${esc(p.why)}</p>` : ""}
<h3>What you will build</h3><ul class="reco-list">${p.build.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
${p.deliverables.length ? `<h3>What you will have at the end</h3><ul class="reco-list">${p.deliverables.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h3>Skills it proves</h3><div class="tags">${p.skills.map((x) => `<span class="tag ${p.covers.includes(x) ? "tag-gap" : "tag-positive"}">${esc(x)}${recoDemandLabel(p.demand[x])}</span>`).join("")}</div>
<p class="resume-hint">Red skills are in demand but not yet shown in your resume. Green skills you already show and will deepen.</p>
${related.length ? `<h3>Get paid to build something similar</h3>${related.map((j) => `<a class="reco-related" href="#project/${j.id}"><b>${esc(j.title)}</b><small>${esc(j.c)} · $${j.pay.toLocaleString()} · ${esc(j.weeks)}</small></a>`).join("")}` : ""}
<div class="resume-actions"><button class="primary" onclick="saveIdea(${i})">${saved ? "Saved ✓" : "Save this idea"}</button><button class="outline" onclick="copyIdea(${i})">Copy project brief</button></div></article>`;
}

function recoSavedHTML() {
  const list = recoSavedIdeas();
  if (!list.length) return "";
  return `<div class="panel wide-panel report-card"><div class="section-title"><h2>Saved project ideas · ${list.length}</h2></div>${list.map((x, n) => `<div class="roadmap-item"><span class="step">${n + 1}</span><div><h3>${esc(x.title)}</h3><p>${esc(x.pitch || "")}</p><small class="resume-hint">For: ${esc(x.role || "your target role")}</small><br><button class="inline-button" onclick="removeIdea(${n})">Remove</button></div></div>`).join("")}</div>`;
}

function recoResultsHTML() {
  const s = recoState.result;
  if (!s) {
    return `<div class="panel resume-empty"><span class="empty-orbit">✧</span><div class="eyebrow">PROOF OVER PROMISES</div><h2>See what the market wants.<br>Build the proof.</h2><p>Add your resume and the role you are aiming for. You will get the skills employers ask for, the gaps in your resume, and three projects to close them.</p>
<div class="review-feature"><b>◎ &nbsp; Real posting data</b><p>Skill demand is counted from public job postings when available, and clearly labeled when it is not.</p></div>
<div class="review-feature"><b>◔ &nbsp; Honest gap check</b><p>We compare keyword evidence in your resume with market demand. It is not a measure of your ability.</p></div>
<div class="review-feature"><b>↗ &nbsp; Projects you can finish</b><p>Each idea has a scope, concrete deliverables, and the skills it proves.</p></div></div>${recoSavedHTML()}`;
  }
  return `${s.note ? `<div class="notice">${esc(s.note)}</div>` : ""}${recoMarketHTML(s)}${recoGapHTML(s)}<div class="section-title" style="margin-top:8px"><h2>Projects to build for ${esc(s.role)}</h2><span class="tag">${s.source === "ai" ? "Free-tier AI" : "Free recommendations"}</span></div>${s.projects.map((p, i) => recoProjectHTML(p, i, s)).join("")}${recoSavedHTML()}`;
}

function recoRefreshSaved() {
  const box = typeof $ === "function" ? $("#reco-results") : null;
  if (box) box.innerHTML = recoResultsHTML();
  else if (typeof render === "function") render();
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
        why: p.why || "",
        build: recoStrings(p.build, 8),
        deliverables: recoStrings(p.deliverables, 8),
        skills: recoStrings(p.skills, 12),
        weeks: p.weeks,
        hours: s.hours,
        role: s.role,
        savedAt: new Date().toISOString(),
      },
      ...list,
    ].slice(0, 30);
  workspaceLocal.setItem(RECO_SAVED_KEY, JSON.stringify(list));
  recoRefreshSaved();
  toast(list.some((x) => x.title === p.title) ? "Project idea saved" : "Project idea removed");
}

function removeIdea(n) {
  const list = recoSavedIdeas();
  if (!list[n]) return;
  list.splice(n, 1);
  workspaceLocal.setItem(RECO_SAVED_KEY, JSON.stringify(list));
  recoRefreshSaved();
  toast("Project idea removed");
}

function recoBrief(p, weeks, hours, role) {
  const lines = ["# " + p.title, p.pitch || ""];
  if (p.why) lines.push("", "Why: " + p.why);
  if (p.build && p.build.length) lines.push("", "## What you will build", ...p.build.map((x) => "- " + x));
  if (p.deliverables && p.deliverables.length) lines.push("", "## Deliverables", ...p.deliverables.map((x) => "- " + x));
  lines.push("", "Skills: " + (p.skills || []).join(", "));
  if (weeks) lines.push("Scope: about " + weeks + " weeks" + (hours ? " at ~" + hours + " hrs/week" : ""));
  if (role) lines.push("Target role: " + role);
  return lines.join("\n");
}

function recoCopyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("Project brief copied"), () => toast("Copy failed. Select the text manually."));
  else toast("Copy is not available in this browser.");
}

function copySavedIdea(n) {
  const x = recoSavedIdeas()[n];
  if (x) recoCopyText(recoBrief(x, x.weeks, x.hours, x.role));
}

// Saved ideas as shown on the Applications page.
function recoApplicationsHTML() {
  const list = recoSavedIdeas();
  const head = `<div class="section-title" style="margin-top:35px"><h2>Saved project ideas · ${list.length}</h2><a class="text-link" href="#recommend">Get more ideas →</a></div>`;
  if (!list.length) return head + '<div class="jobs"><div class="empty">Save a project idea from <a href="#recommend">Project ideas</a> and it will show up here.</div></div>';
  return (
    head +
    `<div class="jobs">${list
      .map(
        (x, n) => `<div class="panel reco-saved"><span class="tag">Project idea</span><h3 style="margin-top:16px">${esc(x.title)}</h3><p>${esc(x.pitch || "")}</p>
${x.skills && x.skills.length ? `<div class="tags">${x.skills.slice(0, 6).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : ""}
<small class="resume-hint">For: ${esc(x.role || "your target role")}${x.weeks ? " · about " + esc(x.weeks) + " weeks" : ""}</small>
<div class="resume-actions" style="margin-top:12px"><button class="outline" onclick="copySavedIdea(${n})">Copy project brief</button><button class="outline" onclick="removeIdea(${n})">Remove</button></div></div>`
      )
      .join("")}</div>`
  );
}

function copyIdea(i) {
  const s = recoState.result;
  const p = s && s.projects[i];
  if (p) recoCopyText(recoBrief(p, p.weeks, s.hours, s.role));
}
