function overviewPage() {
  if (typeof ensureApplicationsLoaded === "function") ensureApplicationsLoaded();
  const p = graduateProfile(),
    progress = profileCompletion(),
    name = (p.name || "").trim().split(/\s+/)[0],
    hasResume = marketplaceResume().trim().length >= 100,
    tracked = typeof recoSavedIdeas === "function" ? recoSavedIdeas() : [],
    active = tracked.filter((x) => x.status === "active"),
    completed = tracked.filter((x) => x.status === "completed");
  const bookmarked = jobs.filter((j) => saved.includes(j.id)).slice(0, 3),
    featured = jobs.find((j) => j.id === 7) || jobs[0];
  return `<div class="dashboard-topline"><div><span class="section-label">YOUR WORKSPACE</span><h1>${name ? "Welcome back, " + esc(name) + "." : "Welcome to Nextwork."}</h1><p class="dashboard-subtitle">A clear view of your opportunities, projects, and next steps.</p></div><a class="primary" href="#explore">${icon("search", 17)} Find work</a></div><div class="workspace-stat-grid">${[
    [
      "apps",
      (Organization.mine || []).length + applications.length,
      "Applications",
      "projects",
      "workTab='applications'",
    ],
    [
      "save",
      saved.length,
      "Saved opportunities",
      "projects",
      "workTab='saved'",
    ],
    [
      "briefcase",
      active.length,
      "Projects in progress",
      "projects",
      "workTab='ideas'",
    ],
    ["check", completed.length, "Projects completed", "projects", ""],
  ]
    .map(
      ([i, n, t, r, click]) =>
        `<a href="#${r}" ${click ? `onclick="${click}"` : ""}><span>${icon(i, 20)}</span><div><strong>${n}</strong><small>${t}</small></div>${icon("arrow", 15)}</a>`,
    )
    .join(
      "",
    )}</div><div class="workspace-priority-grid"><section class="panel workspace-next-action"><div class="section-title"><span class="section-label">YOUR NEXT STEP</span><span class="workspace-status-dot">${hasResume ? "Resume ready" : "Profile setup"}</span></div><h2>${hasResume ? "Put your experience to work." : "Show teams what you bring."}</h2><p>${hasResume ? "Browse clear project briefs, review your fit, and choose work where you can contribute." : "Add your resume and a few profile details to give organizations a useful picture of your experience."}</p><div><a class="primary" href="#${hasResume ? "explore" : "resume"}">${hasResume ? "Explore opportunities" : "Add resume"} ${icon("arrow", 16)}</a><a class="text-link" href="#resume">Review resume ${icon("arrow", 15)}</a></div><div class="workspace-profile-progress"><span>Profile details</span><b>${progress.done}/${progress.total}</b><div class="progress"><i style="width:${progress.percent}%"></i></div></div></section><section class="panel workspace-current-project"><div class="section-title"><span class="section-label">${active.length ? "CONTINUE YOUR PROJECT" : "OPPORTUNITY SPOTLIGHT"}</span>${icon(active.length ? "route" : "briefcase", 19)}</div>${
    active.length
      ? `<h2>${esc(active[0].title)}</h2><p>Keep your momentum. Your milestones and work samples are saved in My work.</p><div class="workspace-mini-roadmap">${projectSteps(
          active[0],
        )
          .slice(0, 5)
          .map(
            (step, i) =>
              `<span class="${(active[0].checked || []).includes(i) ? "done" : ""}"><i>${(active[0].checked || []).includes(i) ? icon("check", 12) : i + 1}</i><small>${esc(step.phase)}</small></span>`,
          )
          .join(
            "",
          )}</div><a class="outline" href="#recommend/saved/${tracked.indexOf(active[0])}">Continue project ${icon("arrow", 16)}</a>`
      : `<div class="workspace-featured-company">${logo(featured)}<span><b>${esc(featured.c)}</b><small>${esc(featured.cat)} · ${esc(featured.location || "Remote")}</small></span></div><h2>${esc(featured.title)}</h2><p>${esc(featured.desc)}</p><div class="workspace-featured-bottom"><strong>$${featured.pay.toLocaleString()}<small>${esc(featured.weeks)}</small></strong><a class="outline" href="#project/${featured.id}">View opportunity ${icon("arrow", 16)}</a></div>`
  }</section></div><div class="dashboard-section-title"><div><span class="section-label">QUICK ACTIONS</span><h2>Where do you want to start?</h2></div></div><div class="workspace-quick-links">${[
    [
      "spark",
      "Project ideas",
      "Build experience with a milestone plan.",
      "recommend",
    ],
    [
      "resume",
      "Resume review",
      "Get specific edits for your next application.",
      "resume",
    ],
    [
      "message",
      "Messages",
      "Keep conversations with teams moving.",
      "messages",
    ],
  ]
    .map(
      ([i, h, d, r]) =>
        `<a href="#${r}"><span>${icon(i, 21)}</span><div><h3>${h}</h3><p>${d}</p></div>${icon("arrow", 16)}</a>`,
    )
    .join(
      "",
    )}</div><div class="dashboard-bottom-grid"><section class="panel dashboard-shortlist"><div class="section-title"><h2>Your shortlist</h2><a class="text-link" href="#projects" onclick="workTab='saved'">View saved ${icon("arrow", 15)}</a></div>${bookmarked.length ? bookmarked.map((j) => `<a class="dashboard-saved-row" href="#project/${j.id}">${logo(j)}<span><b>${esc(j.title)}</b><small>${esc(j.c)} · $${j.pay.toLocaleString()}</small></span>${icon("arrow", 17)}</a>`).join("") : `<div class="shortlist-empty"><span>${icon("save", 25)}</span><div><h3>Start a shortlist.</h3><p>Save the opportunities you want to come back to.</p><a class="text-link" href="#explore">Browse work ${icon("arrow", 14)}</a></div></div>`}</section><section class="panel dashboard-readiness"><span class="section-label">APPLICATION READINESS</span><h2>Make your profile ready to share.</h2>${[
    [Boolean(p.name && p.education), "Introduce yourself", "profile"],
    [hasResume, "Add your resume", "profile"],
    [Boolean(p.skills), "Show your skills", "profile"],
  ]
    .map(
      ([done, label, route]) =>
        `<a href="#${route}"><span class="readiness-check ${done ? "done" : ""}">${done ? icon("check", 14) : icon("plus", 14)}</span>${label}<small>${done ? "Done" : "Add"}</small></a>`,
    )
    .join(
      "",
    )}<a class="text-link" href="#submissions">Open organization applications ${icon("arrow", 14)}</a></section></div>`;
}
