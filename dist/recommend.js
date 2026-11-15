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

function recoSourceLabel(s){const p=s.profile;return p.source==='live'?`${Number(p.postings)||0} public job postings`:p.source==='ai-estimate'?'AI role estimate':'Role baseline'}
function recoExcerpt(value,max=170){const text=String(value||'').trim();return text.length>max?text.slice(0,max).replace(/\s+\S*$/,'')+'…':text}
function recoMarketHTML(s){const p=s.profile,sources=(Array.isArray(p.sources)?p.sources:[]).map(x=>esc(x.name)).join(', '),samples=(Array.isArray(p.samples)?p.samples:[]).filter(x=>/^https:\/\//.test(String(x.url)));return `<div class="idea-source-content"><p>${p.source==='live'?`Skills were sampled from ${Number(p.postings)||0} public postings${sources?' through '+sources:''}. This is a sample of hiring activity.`:esc(p.note||'These suggestions use a role baseline, not a live hiring forecast.')} Missing resume evidence does not mean you lack a skill.</p>${p.skills?.length?`<div class="tags">${p.skills.slice(0,6).map(x=>`<span class="tag">${esc(x.skill)}</span>`).join('')}</div>`:''}${samples.length?`<ul>${samples.slice(0,4).map(x=>`<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} · ${esc(x.company)} ↗</a></li>`).join('')}</ul>`:''}</div>`}
function recoGapHTML(s){return `<div class="idea-source-content"><h3>Skills to practice</h3><div class="tags">${s.analysis.gaps.slice(0,5).map(x=>`<span class="tag">${esc(x.skill)}</span>`).join('')||'<span>No tracked gaps were found.</span>'}</div></div>`}

const RECO_LAST_KEY = "nw-reco-last";
const RECO_HOURS = 8; // assumed weekly hours; only used to size projects, never asked of the user

let recoState = { status: "idle", step: "", error: "", result: null, busy: false };

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

function recoProjectHTML(p,i){const saved=recoSavedIdeas().some(x=>x.title===p.title);return `<article class="rp-project idea-card"><div class="idea-card-meta"><span class="idea-number">IDEA ${String(i+1).padStart(2,'0')}</span><span>${p.hours} hours${p.difficulty?' · '+esc(recoCap(p.difficulty)):''}</span></div><h2>${esc(p.title)}</h2><p>${esc(recoExcerpt(p.overview||p.pitch))}</p><div class="tags">${p.skills.slice(0,3).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>${projectFitHTML(p,true)}<div class="idea-card-actions"><a class="primary" href="#recommend/idea/${i}">View project plan ${icon('arrow',16)}</a><button class="idea-save-button ${saved?'saved':''}" onclick="saveIdea(${i})" aria-pressed="${saved}" aria-label="${saved?'Unsave':'Save'} ${esc(p.title)}">${icon('save',18)}<span>${saved?'Saved ✓':'Save'}</span></button></div></article>`}
function recoDoneHTML(){const s=recoState.result;return `<div class="ideas-page"><div class="page-heading-row"><div>${title('Your next project starts here.','Ideas for '+s.role+'. Choose one to see a practical plan.')}</div><a class="outline" href="#recommend">Change target role</a></div><div class="ideas-result-toolbar"><span>${s.projects.length} project ideas <span class="muted">· ${esc(recoSourceLabel(s))}</span></span><a href="#projects" onclick="workTab='ideas'">Saved ideas ${icon('arrow',15)}</a></div><div class="idea-cards">${s.projects.map(recoProjectHTML).join('')}</div><details class="idea-source-details"><summary>${icon('eye',18)} How these ideas were chosen <span>+</span></summary><div>${recoGapHTML(s)}${recoMarketHTML(s)}${s.note?`<p class="resume-hint">${esc(s.note)}</p>`:''}</div></details><div class="ideas-next-callout">${icon('briefcase',22)}<div><b>Ready for paid work?</b><p>Explore projects posted by startups and small teams.</p></div><a class="outline" href="#explore">Find work ${icon('arrow',15)}</a></div></div>`}
function recoPlanHTML(p,index,saved=false){return `<div class="ideas-page"><a class="text-link" href="${saved?'#projects':'#recommend/results'}" ${saved?"onclick=\"workTab='ideas'\"":''}>${icon('back',15)} ${saved?'My work':'All project ideas'}</a><div class="idea-plan-heading"><div><span class="eyebrow">SELF-DIRECTED PROJECT · ${p.hours||p.weeks*8} HOURS</span><h1>${esc(p.title)}</h1><p>${esc(p.overview||p.pitch)}</p></div><button class="outline" onclick="${saved?'copySavedIdea('+index+')':'saveIdea('+index+')'}">${icon(saved?'link':'save',17)} ${saved?'Copy project brief':recoSavedIdeas().some(x=>x.title===p.title)?'Saved ✓':'Save project'}</button></div>${projectFitHTML(p)}<div class="idea-plan-layout">${projectTimelineHTML(p,index,saved)}<div class="idea-plan-side"><section class="panel"><span class="section-label">FINISHED OUTPUT</span><h2>What you’ll create</h2><ul class="idea-deliverables">${(p.deliverables?.length?p.deliverables:p.build||[]).map(x=>`<li>${icon('check',16)}<span>${esc(x)}</span></li>`).join('')}</ul><h3>Skills you’ll practice</h3><div class="tags">${(p.skills||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>${p.tools?.length?`<h3>Suggested tools</h3><div class="tags">${p.tools.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:''}</section>${p.why?`<section class="panel idea-why"><h3>Why this fits your goal</h3><p>${esc(recoExcerpt(p.why,260))}</p></section>`:''}${p.stretch?.length?`<details class="panel simple-details"><summary>Optional stretch goals</summary><ul>${p.stretch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}</div></div></div>`}

function recommendIdeaPage(index){if(!recoState.result)recoRestore();const p=recoState.result?.projects[index];return p?recoPlanHTML(p,index):title('Project idea not found','Generate a new set of project ideas to continue.')+'<a class="primary" href="#recommend">Get project ideas</a>'}
function savedIdeaPage(index){const p=recoSavedIdeas()[index];return p?recoPlanHTML(p,index,true):title('Saved idea not found','Choose another idea from My work.')+'<a class="outline" href="#projects">Back to My work</a>'}

function recoResultsHTML() {
  if (recoState.status === "loading") {
    const current=/Designing/i.test(recoState.step)?1:0;
    return loadingView('Preparing your project ideas',recoState.step||'Reading your experience and target role.',false,['Review your experience','Design your projects','Prepare your plans'],current);
  }
  if (recoState.status === "error") {
    return `<div class="rp-wrap"><div class="rp-card rp-loading"><h2>We could not finish that</h2><p role="alert">${esc(recoState.error || "Something went wrong.")}</p><div class="rp-actions" style="justify-content:center;border:0"><a class="primary" href="#recommend" style="text-decoration:none">Try again</a></div></div></div>`;
  }
  if (recoState.status === "done" && recoState.result) return recoDoneHTML();
  return `<div class="rp-wrap"><div class="rp-card rp-loading"><h2>No project plan yet</h2><p>Tell us the job you want and add your resume to get started.</p><div class="rp-actions" style="justify-content:center;border:0"><a class="primary" href="#recommend" style="text-decoration:none">Get started</a></div></div></div>`;
}

function recoRestore() {
  try {
    const last = JSON.parse(workspaceLocal.getItem(RECO_LAST_KEY) || workspaceSession.getItem(RECO_LAST_KEY) || "null");
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
  if (recoState.status === "idle" && !recoState.result) recoRestore();
  return `<section id="reco-results" aria-live="polite">${recoResultsHTML()}</section>`;
}

function bindRecommendResults() {
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0);
}

function recommendPage(){const role=workspaceSession.getItem(RECO_ROLE_KEY)||'',resume=marketplaceResume(),hasResume=resume.trim().length>=100;return `<div class="ideas-page"><div class="page-heading-row">${title('Turn your ambition into a project.','Choose a direction. Get a plan. Build something you can show.') }<a class="text-link" href="#projects" onclick="workTab='ideas'">Saved ideas ${icon('arrow',15)}</a></div><div class="ideas-start-layout"><form id="reco-form" class="ideas-form" novalidate><span class="section-label">LET’S FIND YOUR NEXT BUILD</span><h2>What’s your next role?</h2><p class="ideas-form-intro">We’ll connect your experience to practical projects for that role.</p><label class="field" for="reco-role">Target role<input id="reco-role" data-search-catalog="roles" required minlength="2" maxlength="120" placeholder="e.g. Data analyst" value="${esc(role)}" autocomplete="off"></label><div class="ideas-resume-card"><span class="ideas-resume-icon">${icon('resume',23)}</span><div><b>${hasResume?'Your resume is ready':'Add your resume first'}</b><p>${hasResume?'We’ll use the resume saved in your profile.':'Upload once to get ideas matched to your experience.'}</p></div><a class="text-link" href="#profile">${hasResume?'Update':'Upload'} ${icon('arrow',14)}</a></div><details class="simple-details" id="reco-text-wrap"><summary>View resume text</summary><textarea id="reco-resume" readonly maxlength="30000" aria-label="Saved resume text">${esc(resume)}</textarea></details><button class="primary ideas-generate" id="reco-run" type="submit">Generate project ideas ${icon('spark',17)}</button><p id="reco-error" class="review-error" role="alert"></p><p class="ideas-data-note">Your resume and target role are sent to Google Gemini. Free-tier data may be used to improve its products. Remove sensitive information first.</p></form><section class="ideas-intro"><div class="project-process-graphic" role="img" aria-label="Three stages: scope your idea, build and test it, document the result"><div class="process-graphic-head"><span>PROJECT WORKFLOW</span>${icon('route',22)}</div>${[['01','Scope','Define a useful problem'],['02','Build','Create and test your solution'],['03','Show','Document your contribution']].map(([n,t,d])=>`<div class="process-graphic-stage"><b>${n}</b><span><strong>${t}</strong><small>${d}</small></span>${icon('check',16)}</div>`).join('')}</div><h2>Build and show your work.</h2><p>Track milestones and add finished projects to your profile.</p><small>Practice projects are not paid listings.</small></section></div></div>`}

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
  const actor = typeof Account === 'undefined' ? null : Account.user?.id;
  const sameAccount = () => actor === (typeof Account === 'undefined' ? null : Account.user?.id);
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
    workspaceLocal.removeItem(RECO_LAST_KEY);
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
    if (!sameAccount()) return;
    const safe = projects.slice(0, 3).map((p) => recoSafeProject(p, profile, RECO_HOURS));
    recoState = { status: "done", step: "", error: "", busy: true, result: { role, family, profile, analysis, hours: RECO_HOURS, source, note, projects: safe } };
    try {
      workspaceLocal.setItem(RECO_LAST_KEY, JSON.stringify({ role, profile, projects: safe, source, note }));
    } catch {
      /* the result still shows; it just will not survive a refresh */
    }
  } catch (err) {
    if (!sameAccount()) return;
    recoState = { status: "error", step: "", error: err.message || "Recommendations failed. Please try again.", result: null, busy: true };
  } finally {
    if (sameAccount()) { recoState.busy = false; recoRerender(); }
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
  const existing=list.find(x=>x.title===p.title);
  if(existing&&['active','completed'].includes(existing.status)){toast('This project is in My work. Manage its progress there.');return}
  if(existing)list=list.filter(x=>x.title!==p.title);
  else list=[ideaRecord(p,s.role),...list];
  storeTrackedIdeas(list);
  recoRefreshSaved();
  toast(list.some((x) => x.title === p.title) ? "Project saved to My work." : "Project removed");
}

async function removeIdea(n) {
  if (typeof ProjectFiles !== 'undefined' && ProjectFiles.busy) {toast('Wait for the file operation to finish.');return;}
  const record = recoSavedIdeas()[n],actor=Account.user?.id,epoch=Account.sessionEpoch;
  if (!record) return;
  try {if(record.id && typeof ProjectFiles !== 'undefined')await ProjectFiles.cleanup(record.id);}
  catch {toast('Could not remove project files. Try again before removing this project.');return;}
  if(Account.user?.id!==actor || Account.sessionEpoch!==epoch)return;
  const list=recoSavedIdeas();const position=list.findIndex(p=>record.id?p.id===record.id:p.title===record.title);
  if(position<0)return;
  list.splice(position,1);storeTrackedIdeas(list);recoRefreshSaved();toast('Project removed');
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
function recoApplicationsHTML(){const list=recoSavedIdeas();return `<div class="section-title"><h2>Saved project ideas · ${list.length}</h2><a class="text-link" href="#recommend">Get more ideas ${icon('arrow',15)}</a></div>${list.length?`<div class="idea-cards">${list.map((p,i)=>`<article class="panel idea-saved-card"><span class="section-label">PRACTICE PROJECT</span><div class="tracked-project-status">${p.status==='completed'?'Completed · on your profile':p.status==='active'?'In progress · '+projectPercent(p)+'% complete':'Saved for later'}</div><h3>${esc(p.title)}</h3><p>${esc(recoExcerpt(p.overview||p.pitch,145))}</p>${p.status==='active'||p.status==='completed'?`<div class="project-progress" role="progressbar" aria-label="Project completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${projectPercent(p)}"><i style="width:${projectPercent(p)}%"></i></div>`:''}<div class="tags">${(p.skills||[]).slice(0,3).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="idea-card-actions"><a class="outline" href="#recommend/saved/${i}">${p.status==='active'?'Continue project':p.status==='completed'?'View completed project':'View project plan'} ${icon('arrow',15)}</a><button class="text-control" onclick="removeIdea(${i})">Remove</button></div></article>`).join('')}</div>`:'<div class="empty-state">'+icon('spark',30)+'<h3>A place for your next idea.</h3><p>Save a project idea and come back when you’re ready to build.</p><a class="primary" href="#recommend">Get project ideas</a></div>'}`}
