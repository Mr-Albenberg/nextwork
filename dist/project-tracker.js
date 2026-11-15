// Project progress and completed profile work share the existing account workspace.
function projectSteps(p) {
  const plan = Array.isArray(p.plan) ? p.plan.filter((x) => x && x.phase) : [];
  return plan.length
    ? plan
    : (p.build?.length
        ? p.build
        : [
            "Define the problem",
            "Build and test the project",
            "Document your work",
          ]
      ).map((phase) => ({ phase, details: "" }));
}
function projectFit(p) {
  const resume = marketplaceResume(),
    skills = [...new Set(p.skills || [])],
    evidenced = skills.filter((s) =>
      typeof RecommendEngine !== "undefined"
        ? RecommendEngine.has(resume, s)
        : ResumeEngine.has(resume, s),
    ),
    growth = skills.filter((s) => !evidenced.includes(s)),
    roleSkills =
      p.fitRoleSkills ||
      (!p.role || p.role === recoState.result?.role
        ? recoState.result?.profile?.skills?.map((s) => s.skill) || []
        : []),
    aligned = skills.filter((s) =>
      roleSkills.some((x) => String(x).toLowerCase() === s.toLowerCase()),
    );
  return {
    skills,
    evidenced,
    growth,
    aligned,
    hasResume: resume.trim().length >= 100,
    coverage: skills.length
      ? Math.round((evidenced.length / skills.length) * 100)
      : 0,
    hasRoleProfile: roleSkills.length > 0,
  };
}
function projectFitHTML(p, compact = false) {
  const f = projectFit(p);
  if (!f.hasResume)
    return `<section class="project-fit ${compact ? "project-fit-compact" : ""}"><div class="project-fit-title"><span>${icon("resume", 16)} Resume comparison</span></div><p class="resume-hint">Add a resume to compare your starting skills with this project.</p><a class="text-link" href="#profile">Add resume ${icon("arrow", 14)}</a></section>`;
  return `<section class="project-fit ${compact ? "project-fit-compact" : ""}" aria-label="Why this project fits"><div class="project-fit-title"><span>${icon("route", 16)} Starting skill coverage</span><b>${f.hasResume ? f.evidenced.length + "/" + f.skills.length : "Add resume"}</b></div><div class="project-fit-bar" role="meter" aria-label="Project skills evidenced in your resume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${f.hasResume ? f.coverage : 0}"><i style="width:${f.hasResume ? f.coverage : 0}%"></i></div>${compact ? `<p>${f.hasResume ? `${f.evidenced.length} ${f.evidenced.length === 1 ? "skill" : "skills"} evidenced · ${f.growth.length} to develop` : "Add a resume to see your starting point"}${f.hasRoleProfile ? ` · ${f.aligned.length}/${f.skills.length} role skills` : ""}</p>` : `<div class="project-fit-breakdown"><div><strong>${f.evidenced.length}</strong><span>Resume-supported skills</span><p>${esc(f.evidenced.join(", ") || "No direct terms found")}</p></div><div><strong>${f.growth.length}</strong><span>Skills to develop or evidence</span><p>${esc(f.growth.join(", ") || "Build depth in the skills you already use")}</p></div>${f.hasRoleProfile ? `<div><strong>${f.aligned.length}/${f.skills.length}</strong><span>Aligned with the target-role profile</span><p>Compared with the skill profile used to generate this idea.</p></div>` : ""}</div><small>Keyword coverage explains your starting point, not your proficiency or chance of getting hired.</small>`}</section>`;
}
function ideaRecord(p, role) {
  return {
    ...p,
    id:
      "project-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8),
    role: role || "",
    savedAt: new Date().toISOString(),
    status: "saved",
    checked: [],
    fitRoleSkills: recoState.result?.profile?.skills?.map((x) => x.skill) || [],
  };
}
function projectPercent(p) {
  return Math.round(
    (projectSteps(p).filter((_, i) => (p.checked || []).includes(i)).length /
      projectSteps(p).length) *
      100,
  );
}
function syncCompletedProjects(list) {
  const profile = graduateProfile(),
    other = (Array.isArray(profile.projects) ? profile.projects : []).filter(
      (p) => p.source !== "nextwork-project",
    );
  profile.projects = [
    ...other,
    ...list
      .filter((p) => p.status === "completed")
      .map((p) => ({
        id: p.id,
        source: "nextwork-project",
        title: p.title,
        description: p.outcome || "",
        url: p.workUrl || "",
        skills: p.skills || [],
        completedAt: p.completedAt,
        milestones: projectSteps(p).length,
        kind: "Self-directed project",
      })),
  ];
  if (workspaceLocal.getItem("proof-profile") !== JSON.stringify(profile))
    workspaceLocal.setItem("proof-profile", JSON.stringify(profile));
}
function storeTrackedIdeas(list) {
  workspaceLocal.setItem(RECO_SAVED_KEY, JSON.stringify(list));
  syncCompletedProjects(list);
}
async function startIdea(index, saved = false) {
  let list = recoSavedIdeas(),
    p = saved ? list[index] : recoState.result?.projects[index];
  if (!p) return;
  let position = list.findIndex((x) => x.title === p.title);
  if (position < 0) {
    list.unshift(ideaRecord(p, recoState.result?.role));
    position = 0;
  }
  const record = list[position];
  if (!record.id) record.id = ideaRecord(record, record.role).id;
  if (record.status !== "active" && record.status !== "completed") {
    record.status = "active";
    record.startedAt = new Date().toISOString();
    record.checked = [];
  }
  storeTrackedIdeas(list);
  location.hash = "recommend/saved/" + position;
  render();
  if (typeof saveWorkspace === "function")
    try {
      await saveWorkspace();
    } catch {
      return;
    }
}
function toggleProjectMilestone(index, step, checked) {
  const list = recoSavedIdeas(),
    p = list[index];
  if (
    !p ||
    p.status !== "active" ||
    !Number.isInteger(step) ||
    step < 0 ||
    step >= projectSteps(p).length
  )
    return;
  const form = document.querySelector("#project-evidence");
  if (form) {
    p.workUrl = form.elements.workUrl.value.slice(0, 1000);
    p.outcome = form.elements.outcome.value.slice(0, 2000);
  }
  p.checked = [
    ...new Set(
      checked
        ? [...(p.checked || []), step]
        : (p.checked || []).filter((n) => n !== step),
    ),
  ];
  storeTrackedIdeas(list);
  render();
}
function saveProjectEvidence(index) {
  const list = recoSavedIdeas(),
    p = list[index];
  if (!p) return;
  const form = document.querySelector("#project-evidence");
  if (!form) return true;
  const url = form.elements.workUrl.value.trim(),
    outcome = form.elements.outcome.value.trim();
  if (url && !validProjectURL(url)) {
    toast("Use a full http or https work sample link.");
    return false;
  }
  p.workUrl = url.slice(0, 1000);
  p.outcome = outcome.slice(0, 2000);
  storeTrackedIdeas(list);
  toast("Project details saved");
  return true;
}
async function completeIdea(index) {
  const list = recoSavedIdeas(),
    p = list[index];
  if (!p || p.status !== "active" || projectPercent(p) !== 100) return;
  if (!saveProjectEvidence(index)) return;
  const updated = recoSavedIdeas(),
    record = updated[index];
  record.status = "completed";
  record.completedAt = new Date().toISOString();
  storeTrackedIdeas(updated);
  render();
  if (typeof saveWorkspace === "function")
    try {
      await saveWorkspace();
    } catch {
      return;
    }
  toast("Project completed and added to your profile");
}
function reopenIdea(index) {
  const list = recoSavedIdeas(),
    p = list[index];
  if (!p) return;
  p.status = "active";
  delete p.completedAt;
  storeTrackedIdeas(list);
  render();
  toast("Project reopened. It will return to your profile when completed.");
}
function projectTimelineHTML(p, index, saved) {
  const steps = projectSteps(p),
    started = saved && ["active", "completed"].includes(p.status),
    weeks = Math.max(
      1,
      Number(p.weeks) || Math.ceil((Number(p.hours) || 24) / 8),
    ),
    checked = p.checked || [],
    percent = projectPercent(p);
  return `<section class="project-timeline panel"><div class="timeline-heading"><div><span class="section-label">${p.status === "completed" ? "COMPLETED PROJECT" : "YOUR PROJECT TIMELINE"}</span><h2>Milestones that move you forward</h2><p>${weeks}-week suggested plan · ${p.hours || weeks * 8} hours · Adjust to your own pace</p></div><strong>${started ? percent + "%" : "Ready to start"}</strong></div>${started ? `<div class="project-progress" role="progressbar" aria-label="Project completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>` : ""}<ol class="project-timeline-list idea-plan-steps">${steps
    .map((step, i) => {
      const done = checked.includes(i),
        week = Math.min(weeks, Math.floor((i * weeks) / steps.length) + 1);
      return `<li class="${done ? "is-complete" : ""}"><div class="milestone-marker">${started ? `<input type="checkbox" aria-label="Complete milestone ${i + 1}: ${esc(step.phase)}" ${done ? "checked" : ""} ${p.status === "completed" ? "disabled" : ""} onchange="toggleProjectMilestone(${index},${i},this.checked)">` : `<span>${i + 1}</span>`}</div><div><small>MILESTONE ${i + 1} · WEEK ${week}</small><h3>${esc(step.phase)}</h3><p>${esc(step.details || "Complete this phase and document the result before moving on.")}</p>${started && p.startedAt ? `<span class="milestone-date">Suggested by ${new Date(new Date(p.startedAt).getTime() + week * 7 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>` : ""}</div></li>`;
    })
    .join(
      "",
    )}</ol>${started ? `<div class="project-evidence-section"><h3>Capture what you built</h3><form id="project-evidence" onsubmit="event.preventDefault();saveProjectEvidence(${index})"><label class="field">Work sample link (optional)<input name="workUrl" type="url" maxlength="1000" placeholder="https://github.com/you/project" value="${esc(p.workUrl || "")}"></label><label class="field">Your contribution and outcome (optional)<textarea name="outcome" maxlength="2000" placeholder="What did you build, test, or learn? Include only outcomes you can support.">${esc(p.outcome || "")}</textarea></label><button class="outline" type="submit">Save project details</button></form></div>${typeof ProjectFiles !== "undefined" ? ProjectFiles.html(p) : ""}<div class="project-completion-action">${p.status === "completed" ? `<span>${icon("check", 18)} Added to your profile</span><a class="primary" href="#profile">View profile ${icon("arrow", 16)}</a><button class="text-control" onclick="reopenIdea(${index})">Reopen project</button>` : `<p>${percent === 100 ? "All milestones are checked. Add this self-directed project to your profile." : "Check off each milestone as you finish it. Completed projects can be added to your profile."}</p><button class="primary" ${percent === 100 ? "" : "disabled"} onclick="completeIdea(${index})">Complete & add to profile ${icon("arrow", 16)}</button>`}</div>` : `<button class="primary" onclick="startIdea(${index},${saved})">Start this project ${icon("arrow", 16)}</button><p class="resume-hint">Starting adds it to My work with a milestone checklist.</p>`}</section>`;
}
function completedProjectsHTML() {
  const list = (graduateProfile().projects || []).filter(
    (p) => p.source === "nextwork-project",
  );
  if (!list.length) return "";
  return `<section class="panel profile-completed-projects"><div class="section-title"><h2>Completed projects</h2><span>${list.length} projects</span></div>${list.map((p) => `<article><span class="completed-project-mark">${icon("check", 19)}</span><div><h3>${esc(p.title)}</h3><small>Self-directed project · ${p.milestones} milestones completed</small>${p.description ? `<p>${esc(p.description)}</p>` : ""}<div class="tags">${(p.skills || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>${typeof ProjectFiles !== "undefined" && recoSavedIdeas().some(r=>r.id===p.id && r.files?.length) ? `<a class="text-link completed-project-files" href="#recommend/saved/${recoSavedIdeas().findIndex(r=>r.id===p.id)}">${icon("resume",14)} View project files</a>` : ""}${p.url && validProjectURL(p.url) ? `<a class="text-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">View work ${icon("arrow", 14)}</a>` : ""}</div></article>`).join("")}</section>`;
}

function validProjectURL(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && Boolean(u.hostname);
  } catch {
    return false;
  }
}
