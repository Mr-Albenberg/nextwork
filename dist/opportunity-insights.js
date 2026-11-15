// Evidence coverage comes from the resume rubric, never from self-reported profile skills.
function evidenceChartHTML(match) {
  if (!match) return "";
  const rows = Array.isArray(match.requirements) ? match.requirements : [];
  const safe = (n) =>
    Number.isFinite(Number(n))
      ? Math.max(0, Math.min(100, Math.round(Number(n))))
      : 0;
  const measured = rows.map((row) => ({
    ...row,
    coverage:
      row.value != null
        ? safe(row.value)
        : /keyword evidence found/i.test(row.status || "")
          ? 100
          : /not evidenced/i.test(row.status || "")
            ? 0
            : null,
  }));
  const renderRow = (row) => {
    const value = row.coverage,
      state =
        value === null
          ? "manual"
          : value >= 75
            ? "found"
            : value > 0
              ? "partial"
              : "gap";
    return `<div class="evidence-chart-row"><div class="evidence-chart-label"><span>${esc(row.text)}</span><b class="evidence-state-${state}">${value === null ? "Review manually" : value >= 75 ? "Evidenced" : value > 0 ? "Partial evidence" : "Add evidence"}</b></div><div class="evidence-track" role="${value === null ? "img" : "meter"}" aria-label="Resume evidence for ${esc(row.text)}" aria-valuemin="0" aria-valuemax="100" ${value === null ? 'aria-valuetext="Manual review needed"' : `aria-valuenow="${value}" aria-valuetext="${value}% of this criterion evidenced"`}><span class="evidence-fill evidence-fill-${state}" style="width:${value === null ? 0 : value}%"></span><i aria-hidden="true"></i></div></div>`;
  };
  const grouped = measured.some((row) => row.group || row.kind);
  const foundations = measured.filter(
    (row) => row.group === "field" || row.id?.startsWith("field-"),
  );
  const job = measured.filter((row) => !foundations.includes(row));
  return `<section class="evidence-chart" aria-label="Resume evidence and project requirements"><div class="evidence-chart-heading"><div><span class="section-label">RESUME EVIDENCE</span><h2>Your experience against the requirements</h2><p>Filled bars show evidence found. The full track represents the requirement.</p></div><div class="evidence-legend"><span><i class="evidence-key-found"></i>Evidenced</span><span><i class="evidence-key-partial"></i>Partial</span><span><i class="evidence-key-gap"></i>Not evidenced</span></div></div>${rows.length ? `<div class="evidence-chart-groups"><div><h3>${grouped ? "Project requirements" : "Job description requirements"}</h3>${job.map(renderRow).join("") || '<p class="resume-hint">No individual project criteria were identified.</p>'}</div>${foundations.length ? `<div><h3>${esc(match.field || "Field")} foundations</h3>${foundations.map(renderRow).join("")}</div>` : ""}</div>` : "<p>No individual requirements were recognized. Use a more detailed job description to compare specific criteria.</p>"}<details class="evidence-details"><summary>Read supporting evidence ${icon("arrow", 14)}</summary>${measured.map((row) => `<div><b>${esc(row.text)}</b><p>${esc(row.evidence || "No direct evidence found. Include a specific example if you have relevant experience.")}</p>${row.reason ? `<p>${esc(row.reason)}</p>` : ""}</div>`).join("")}</details><p class="evidence-chart-note">This compares written evidence, not proficiency. A missing term can mean the resume needs a clearer example. Only add experience you actually have.</p></section>`;
}
function projectReadinessHTML(job) {
  if (!marketplaceResume().trim())
    return `<section class="readiness-invite"><div>${icon("resume", 22)}<span><b>See where your experience fits</b><small>Compare your resume with this project’s requirements and field foundations.</small></span></div><button class="outline" onclick="matchListing(${job.id})">Compare my resume ${icon("arrow", 16)}</button></section>`;
  const match = compatibilityFor(job);
  return `<section class="project-readiness"><div class="readiness-summary"><div><span class="section-label">PROJECT READINESS</span><h2>${match.score === null ? "Review your resume evidence" : match.score + "% evidence coverage"}</h2><p>${match.jobScore ?? 0}% project criteria · ${match.fieldScore ?? 0}% field foundations</p></div><button class="outline" onclick="matchListing(${job.id})">Full resume review ${icon("arrow", 16)}</button></div>${evidenceChartHTML(match)}</section>`;
}
