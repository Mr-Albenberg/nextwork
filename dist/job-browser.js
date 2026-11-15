let previewJobId = null;
function previewJob(id) {
  previewJobId = Number(id);
  const panel = document.getElementById("opportunity-preview");
  if (panel) {
    panel.innerHTML = jobPreviewHTML(jobs.find((j) => j.id === previewJobId));
    document
      .querySelectorAll("[data-preview-job]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(Number(button.dataset.previewJob) === previewJobId),
        ),
      );
  }
}
function browserJobCard(j) {
  const fit = compatibilityFor(j);
  return `<article class="browse-job"><button class="browse-job-select" data-preview-job="${j.id}" aria-controls="opportunity-preview" aria-pressed="${previewJobId === j.id}" onclick="previewJob(${j.id})"><div>${logo(j)}<span>${esc(j.c)}<small>${esc(j.cat)}</small></span></div><h3>${esc(j.title)}</h3><p><b>$${j.pay.toLocaleString()}</b> · ${esc(j.weeks)}</p><small>${esc(j.location || "Remote")} · ${j.organizationId ? esc(j.sector) : "Project contract"}</small>${fit.score !== null ? `<span class="browse-job-match">${fit.score}% resume compatibility</span>` : ""}</button><button class="bookmark ${saved.includes(j.id) ? "saved" : ""}" onclick="save(${j.id})" aria-pressed="${saved.includes(j.id)}" aria-label="${saved.includes(j.id) ? "Unsave" : "Save"} ${esc(j.title)}">${bookmarkIcon(saved.includes(j.id))}</button></article>`;
}
function jobPreviewHTML(j) {
  if (!j)
    return '<div class="empty-state"><h2>Select an opportunity</h2><p>Choose a result to see the brief, requirements, and application options.</p></div>';
  const p = j.demoCreator,
    requirements = j.requirements || j.tags,
    deliverables = p?.deliverables || [j.deliver],
    responsibilities = p?.responsibilities || [];
  return `<div class="preview-job-heading"><div class="preview-company">${logo(j)}<span><b>${esc(j.c)}</b><small>${esc(j.sector || j.cat)}</small></span></div><h2>${esc(j.title)}</h2><div class="preview-metadata"><span>${icon("briefcase", 15)} ${j.organizationId ? esc(j.sector) : "Project contract"}</span><span>${icon("route", 15)} ${esc(j.location || "Remote")}</span><span>${icon("apps", 15)} ${esc(j.weeks)}</span></div><div class="preview-apply-row"><strong>$${j.pay.toLocaleString()}<small>${j.sector?.includes("Full-time") ? "Compensation" : "Project budget"}</small></strong><a class="primary" href="#project/${j.id}">View project & apply ${icon("arrow", 16)}</a></div></div><div class="preview-job-content"><h3>The opportunity</h3><p>${esc(j.desc)}</p>${responsibilities.length ? `<h3>What you’ll work on</h3><ul>${responsibilities.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<h3>What you’ll deliver</h3><ul>${deliverables
    .filter(Boolean)
    .map((x) => `<li>${esc(x)}</li>`)
    .join(
      "",
    )}</ul><h3>Relevant skills & requirements</h3><div class="tags">${requirements.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>${compatibilityHTML(j)}<button class="outline" onclick="matchListing(${j.id})">${icon("resume", 16)} Review my resume for this project</button></div>`;
}
function resetOpportunitySearch() {
  query = "";
  category = "All projects";
  render();
}
function renderJobBrowser(list) {
  if (!list.length)
    return `<div class="empty-state"><h2>No opportunities match this search</h2><p>Try another skill, company, or field.</p><button class="outline" onclick="resetOpportunitySearch()">Clear search and filters</button></div>`;
  if (!list.some((j) => j.id === previewJobId))
    previewJobId = list[0]?.id || null;
  return `<div class="opportunity-results-list" aria-label="Opportunities">${list.map(browserJobCard).join("")}</div><section id="opportunity-preview" class="opportunity-preview" tabindex="-1" aria-label="Selected opportunity details">${jobPreviewHTML(list.find((j) => j.id === previewJobId))}</section>`;
}
