/* Application lifecycle for both sides of Nextwork.
   Personal accounts: apply, reapply, track status and decision notes in My work.
   Organization accounts: full applicant profile, shared resume file, and a transparent fit analysis. */

const ApplicationStatus = {
  submitted: { label: 'Submitted', tone: 'info', step: 1, note: 'Waiting for the hiring team to review.' },
  shortlisted: { label: 'Shortlisted', tone: 'progress', step: 2, note: 'The hiring team is taking a closer look.' },
  accepted: { label: 'Accepted', tone: 'success', step: 3, note: 'Congratulations — the organization accepted your application.' },
  declined: { label: 'Not selected', tone: 'danger', step: 3, note: 'The organization decided not to move forward this time.' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', step: 0, note: 'You withdrew this application.' },
};
const APPLICATION_BUCKET = 'application-resumes';
const MAX_ATTEMPTS = 5;

function statusMeta(status) { return ApplicationStatus[status] || { label: status || 'Unknown', tone: 'neutral', step: 0, note: '' }; }
function statusPill(status, forOrganization = false) {
  const meta = statusMeta(status);
  const label = forOrganization && status === 'declined' ? 'Declined' : meta.label;
  return `<span class="status-pill tone-${meta.tone}">${esc(label)}</span>`;
}
function friendlyDate(value) {
  const date = new Date(value);
  if (!value || isNaN(date)) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
function splitSkills(value) { return (Array.isArray(value) ? value : String(value || '').split(',')).map(s => String(s).trim()).filter(Boolean); }
function initialsFor(name) { return typeof profileInitials === 'function' ? profileInitials(name) : esc(String(name || '?').slice(0, 2).toUpperCase()); }
function safeLink(url) { return /^https?:\/\//i.test(String(url || '')) ? esc(url) : ''; }
function canReapply(app) {
  const listingOpen = (app.organization_listings?.status || 'published') === 'published';
  return ['declined', 'withdrawn'].includes(app.status) && listingOpen && (app.attempt || 1) < MAX_ATTEMPTS;
}
function migrationMissing(error) { return ['PGRST202', '42883', '42703', 'PGRST204'].includes(error?.code); }

/* ---------------- Fit analyzer ---------------- */
const FitAnalyzer = {
  job(listing) {
    const row = { ...listing, organizations: listing.organizations || { name: Organization.profile?.name || 'Organization' } };
    return { ...liveJob(row), id: null };
  },
  preferences(profile, listing) {
    const checks = [], kind = listing.kind || '', engagement = profile.engagement || '', hours = profile.availability || '', style = profile.workstyle || '', where = String(listing.location || '').toLowerCase();
    if (profile.field) checks.push(profile.field === listing.field ? ['pass', 'Field', `Targets ${profile.field}`] : ['warn', 'Field', `Targets ${profile.field}, listing is ${listing.field}`]);
    if (engagement) {
      const wantsJob = /full-time|both/i.test(engagement), wantsProject = /project|contract|both/i.test(engagement);
      const fits = kind === 'Full-time job' ? wantsJob : wantsProject || /part-time/i.test(kind) && wantsJob;
      checks.push([fits ? 'pass' : 'warn', 'Engagement', fits ? `Looking for ${engagement.toLowerCase()}` : `Prefers ${engagement.toLowerCase()}`]);
    }
    if (hours) {
      const full = kind === 'Full-time job', low = /under 10/i.test(hours), high = /30\+/.test(hours);
      const fits = full ? high : !low;
      checks.push([fits ? 'pass' : 'warn', 'Availability', `${hours} per week${fits ? '' : full ? ' — role is full-time' : ' — may be limited'}`]);
    }
    if (style) {
      const remoteListing = /remote/.test(where), onsite = /on-?site|in office|in-person/.test(where), hybrid = /hybrid/.test(where);
      const fits = remoteListing || style === 'Open to all' || (onsite && style === 'On-site') || (hybrid && style !== 'Remote') || (!onsite && !hybrid);
      checks.push([fits ? 'pass' : 'warn', 'Work style', `Prefers ${style.toLowerCase()}${fits ? '' : ' · listing: ' + listing.location}`]);
    }
    return checks;
  },
  analyze(app, listing) {
    if (!listing) return null;
    const profile = app.profile || {}, resume = app.resume || '', job = FitAnalyzer.job(listing);
    const evidence = ResumeEngine.compatibility(resume, job);
    const profileSkills = splitSkills(profile.skills), profileText = profileSkills.join(', ');
    const skills = (listing.skills || []).map(skill => {
      const row=evidence.requirements.find(r=>r.kind==='Requested skill'&&r.text.toLowerCase()===skill.toLowerCase());
      const inResume = row ? row.value===100 : resume.trim().length >= 100 && ResumeEngine.has(resume, skill);
      const partialResume = row?.value===50;
      const contradicted = row && ['contradictory','conflicting','manual'].includes(row.label);
      const inProfile = profileSkills.some(s => s.toLowerCase() === skill.toLowerCase()) || ResumeEngine.has(profileText, skill);
      return { skill, inResume, inProfile, partialResume, value: contradicted ? 0 : inResume ? 1 : partialResume ? 0.5 : inProfile ? 0.6 : 0 };
    });
    const skillScore = skills.length ? Math.round(skills.reduce((n, s) => n + s.value, 0) / skills.length * 100) : 0;
    const prefs = FitAnalyzer.preferences(profile, listing);
    const prefScore = prefs.length ? Math.round(prefs.filter(p => p[0] === 'pass').length / prefs.length * 100) : 50;
    const hasResume = evidence.score !== null;
    const score = hasResume ? Math.round(evidence.score * 0.55 + skillScore * 0.3 + prefScore * 0.15) : Math.min(60, Math.round(skillScore * 0.75 + prefScore * 0.25));
    const verdict = score >= 75 ? ['Strong fit', 'success'] : score >= 55 ? ['Good fit', 'progress'] : score >= 35 ? ['Partial fit', 'info'] : ['Limited evidence', 'neutral'];
    const jobRows = evidence.requirements.filter(r => r.group === 'job'), fieldRows = evidence.requirements.filter(r => r.group === 'field');
    const strengths = [
      ...jobRows.filter(r => r.value && r.kind !== 'Requested skill').map(r => r.text).slice(0, 3),
      ...skills.filter(s => s.inResume).map(s => s.skill + ' shown in resume').slice(0, 3),
      ...prefs.filter(p => p[0] === 'pass').map(p => p[1] + ': ' + p[2]).slice(0, 2),
    ];
    // Each category gets room so preference mismatches aren't crowded out by missing criteria.
    const gaps = [
      ...jobRows.filter(r => !r.value && r.kind !== 'Requested skill').map(r => r.text).slice(0, 3),
      ...[...skills.filter(s=>s.partialResume).map(s=>s.skill+' needs a specific contribution'), ...skills.filter(s => !s.inResume && !s.partialResume && !s.inProfile).map(s => s.skill + ' not evidenced'), ...skills.filter(s => !s.inResume && !s.partialResume && s.inProfile).map(s => s.skill + ' self-reported only')].slice(0, 3),
      ...prefs.filter(p => p[0] === 'warn').map(p => p[1] + ': ' + p[2]),
    ];
    return { score, verdict, hasResume, evidence, skills, skillScore, prefs, prefScore, jobRows, fieldRows, strengths, gaps };
  },
};
function listingFor(app) { return Organization.listings.find(l => String(l.id) === String(app.listing_id)) || app.organization_listings; }
function fitFor(app) {
  const cache = Organization.fitCache || (Organization.fitCache = new Map()), key = app.id + ':' + app.updated_at;
  if (!cache.has(key)) cache.set(key, FitAnalyzer.analyze(app, listingFor(app)));
  return cache.get(key);
}
function fitBadge(fit) {
  if (!fit) return '';
  return `<span class="fit-badge tone-${fit.verdict[1]}" title="Nextwork fit estimate"><b>${fit.score}</b><small>${esc(fit.verdict[0])}</small></span>`;
}
function fitRing(score, tone) {
  const r = 34, c = 2 * Math.PI * r, dash = Math.max(0, Math.min(100, score)) / 100 * c;
  return `<svg class="fit-ring tone-${tone}" viewBox="0 0 80 80" width="96" height="96" role="img" aria-label="Fit score ${score} out of 100"><circle cx="40" cy="40" r="${r}" class="track"/><circle cx="40" cy="40" r="${r}" class="value" stroke-dasharray="${dash} ${c}" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle">${score}</text></svg>`;
}
function fitBar(label, value, detail) {
  return `<div class="fit-bar"><div><span>${esc(label)}</span><b>${value === null ? '—' : value + '%'}</b></div><div class="fit-track"><i style="width:${value || 0}%"></i></div>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`;
}
function fitAnalysisHTML(app) {
  const fit = fitFor(app);
  if (!fit) return `<section class="panel applicant-card-block"><h2>Fit analysis</h2><p class="muted-copy">The listing for this application is no longer available, so a fit analysis can’t be calculated.</p></section>`;
  return `<section class="panel applicant-card-block fit-analysis" aria-labelledby="fit-title">
    <div class="block-heading"><div><span class="section-label">ROLE FIT ANALYZER</span><h2 id="fit-title">How well ${esc(app.profile?.name?.split(' ')[0] || 'this applicant')} fits this role</h2></div></div>
    <div class="fit-summary">${fitRing(fit.score, fit.verdict[1])}<div><span class="status-pill tone-${fit.verdict[1]}">${esc(fit.verdict[0])}</span><p>${fit.hasResume ? 'Based on resume evidence, requested skills, and the applicant’s stated work preferences.' : 'No resume text was shared, so this estimate uses profile skills and preferences only and is capped at 60.'}</p></div>
      <div class="fit-bars">${fitBar('Resume evidence', fit.evidence.score, fit.hasResume ? `${fit.evidence.matched.length} of ${fit.evidence.total} listing criteria evidenced` : 'No resume shared')}${fitBar('Requested skills', fit.skillScore, `${fit.skills.filter(s => s.value).length} of ${fit.skills.length} skills shown`)}${fitBar('Preferences', fit.prefScore, `${fit.prefs.filter(p => p[0] === 'pass').length} of ${fit.prefs.length} aligned`)}</div></div>
    <div class="fit-columns"><div><h3>${icon('check', 16)} Strengths</h3><ul class="fit-list good">${fit.strengths.map(s => `<li>${esc(s)}</li>`).join('') || '<li class="empty-item">No clear strengths found yet.</li>'}</ul></div><div><h3>${icon('eye', 16)} Worth asking about</h3><ul class="fit-list gap">${fit.gaps.map(s => `<li>${esc(s)}</li>`).join('') || '<li class="empty-item">No obvious gaps.</li>'}</ul></div></div>
    <details class="fit-details"><summary>Criteria breakdown</summary>
      <table class="fit-table"><thead><tr><th>Criterion</th><th>Type</th><th>Evidence</th></tr></thead><tbody>${[...fit.jobRows, ...fit.fieldRows].map(r => `<tr><td>${esc(r.text)}</td><td>${esc(r.kind)}</td><td>${r.value ? `<span class="evidence-yes">Found</span>${r.evidence ? `<small>“${esc(r.evidence.slice(0, 160))}”</small>` : ''}` : '<span class="evidence-no">Not evidenced</span>'}</td></tr>`).join('')}</tbody></table>
      <p class="fine-print">Score = 55% resume evidence + 30% requested skills + 15% preferences. Resume evidence isn’t verified proficiency, and missing evidence isn’t proof of missing ability. Use this to guide your review, not to decide for you.</p>
    </details>
  </section>`;
}

/* ---------------- Shared resume files ---------------- */
const ApplicationFiles = { urls: new Map() };
async function applicationFileURL(app) {
  if (!app?.resume_file?.path) return null;
  if (ApplicationFiles.urls.has(app.resume_file.path)) return ApplicationFiles.urls.get(app.resume_file.path);
  const result = await Account.client.storage.from(APPLICATION_BUCKET).download(app.resume_file.path);
  if (result.error) throw result.error;
  const type = app.resume_file.type || result.data.type || 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([result.data], { type }));
  ApplicationFiles.urls.set(app.resume_file.path, url);
  return url;
}
async function paintApplicationResume(id) {
  const app = Organization.applications.find(a => a.id === id) || Organization.mine.find(a => a.id === id), node = document.getElementById('applicant-resume-file');
  if (!app || !node) return;
  try {
    const url = await applicationFileURL(app);
    if (!url || !document.getElementById('applicant-resume-file')) return;
    const isPDF = /pdf/i.test(app.resume_file.type || app.resume_file.name);
    node.innerHTML = `${isPDF ? `<iframe class="resume-frame" src="${url}#view=FitH" title="${esc(app.resume_file.name)}"></iframe>` : `<div class="empty-inline">${icon('resume', 22)}<p>This file type can’t be previewed in the browser.</p></div>`}<div class="file-actions"><a class="outline" href="${url}" target="_blank" rel="noopener">${icon('eye', 15)} Open in new tab</a><a class="outline" href="${url}" download="${esc(app.resume_file.name)}">${icon('save', 15)} Download</a></div>`;
  } catch {
    node.innerHTML = `<div class="empty-inline">${icon('resume', 22)}<p>The resume file couldn’t be loaded. Try again in a moment.</p><button class="outline" onclick="paintApplicationResume('${id}')">Retry</button></div>`;
  }
}
function safeFileName(name) {
  const ext = (String(name).toLowerCase().match(/\.(pdf|docx|txt)$/) || [, 'pdf'])[1];
  return 'resume-' + Date.now().toString(36) + '.' + ext;
}
async function shareResumeFile(appId, previous) {
  const file = typeof savedResumeFile === 'function' ? savedResumeFile() : null;
  if (!file?.path) return false;
  const download = await Account.client.storage.from('account-resumes').download(file.path);
  if (download.error) throw download.error;
  const path = appId + '/' + safeFileName(file.name), type = file.type || download.data.type || 'application/pdf';
  const upload = await Account.client.storage.from(APPLICATION_BUCKET).upload(path, download.data, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;
  const attached = await Account.client.rpc('attach_application_resume', { app: appId, file: { name: file.name, size: file.size || download.data.size, path, type } });
  if (attached.error) { await Account.client.storage.from(APPLICATION_BUCKET).remove([path]); throw attached.error; }
  if (previous?.path && previous.path !== path) await Account.client.storage.from(APPLICATION_BUCKET).remove([previous.path]).catch(() => {});
  return true;
}

/* ---------------- Personal: apply, reapply, track ---------------- */
function applicationSnapshot(user) {
  const profile = { ...graduateProfile(), email: user.email };
  const completed = typeof recoSavedIdeas === 'function' ? recoSavedIdeas().filter(x => x.status === 'completed').map(x => x.title).filter(Boolean).slice(0, 6) : [];
  if (completed.length) profile.completed_projects = completed.join(', ');
  return profile;
}
function myApplicationFor(listingId) { return Organization.mine.find(a => Number(a.listing_id) === Number(listingId)); }
function applyButtonLabel(job) {
  if (!job.organizationId) return applications.includes(job.id) ? 'View your application' : 'Apply to this project ↗';
  ensureApplicationsLoaded();
  const existing = myApplicationFor(job.id);
  if (!existing) return 'Apply to this opportunity ↗';
  return canReapply(existing) ? 'Reapply to this opportunity ↗' : 'View application status';
}
function ensureApplicationsLoaded() {
  if (typeof Account === 'undefined' || !Account.user) return;
  if (Organization.owner !== Account.user.id) { resetOrganizationWorkspace(); Organization.owner = Account.user.id; }
  if (!Organization.loaded && !Organization.busy) setTimeout(loadOrganization, 0);
}

async function applyLiveListing(id) {
  const job = jobs.find(j => j.id === id), user = organizationUser();
  if (!user) { Account.message = 'Sign in to apply to this organization.'; location.hash = 'login'; return; }
  if (isOrganizationAccount()) return toast('Use a separate personal account to apply for work.');
  if (user.id === job.ownerId) return toast('You cannot apply to your own listing.');
  if (!Organization.loaded) { await loadOrganization(); }
  const existing = myApplicationFor(id);
  if (existing && !canReapply(existing)) { closeModal(); workTab = 'applications'; location.hash = 'projects'; return toast('You already applied — here’s your application status.'); }
  const profile = applicationSnapshot(user);
  if (!profile.name) { location.hash = 'profile'; return toast('Add your name before applying.'); }
  const file = typeof savedResumeFile === 'function' ? savedResumeFile() : null, resumeText = marketplaceResume();
  const reapplying = Boolean(existing);
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="dialog apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title"><button class="close" onclick="closeModal()" aria-label="Close">×</button>
    <span class="section-label">${reapplying ? 'REAPPLY TO' : 'APPLY TO'} ${esc(job.c).toUpperCase()}</span><h2 id="apply-title">${esc(job.title)}</h2>
    ${reapplying ? `<div class="callout tone-${statusMeta(existing.status).tone}"><b>Your previous application was ${esc(statusMeta(existing.status).label.toLowerCase())}.</b>${existing.decision_note ? `<p>“${esc(existing.decision_note)}”</p>` : ''}<small>Update your introduction or resume, then resubmit. Attempt ${(existing.attempt || 1) + 1} of ${MAX_ATTEMPTS}.</small></div>` : ''}
    <div class="apply-identity"><span class="avatar-lg">${initialsFor(profile.name)}</span><div><b>${esc(profile.name)}</b><small>${esc([profile.role, profile.email].filter(Boolean).join(' · '))}</small><div class="tags">${splitSkills(profile.skills).slice(0, 6).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div></div><a class="text-link" href="#profile" onclick="closeModal()">Edit profile</a></div>
    <form id="live-application">
      <label class="field">Your introduction<textarea id="live-introduction" required minlength="30" maxlength="6000" rows="6" placeholder="Why this opportunity, and what you’d bring to it.">${esc(reapplying ? existing.introduction : profile.bio || '')}</textarea></label>
      <fieldset class="share-options"><legend>Share with ${esc(job.c)}</legend>
        <label class="consent"><input type="checkbox" checked disabled> Your full Nextwork profile (education, preferences, skills, links)</label>
        <label class="consent"><input id="live-attach-resume" type="checkbox" ${resumeText ? 'checked' : 'disabled'}> Resume text ${resumeText ? '' : '<small>(none saved)</small>'}</label>
        <label class="consent"><input id="live-attach-file" type="checkbox" ${file?.path ? 'checked' : 'disabled'}> Resume file ${file?.path ? `<small>${esc(file.name)}</small>` : '<small>(upload one in your profile)</small>'}</label>
      </fieldset>
      <label class="consent confirm"><input type="checkbox" required> I’ve reviewed this information and want to ${reapplying ? 'resubmit' : 'submit'} my application.</label>
      <div class="dialog-actions"><button class="primary">${reapplying ? 'Resubmit application' : 'Submit application'} ${icon('arrow', 15)}</button><button type="button" class="outline" onclick="closeModal()">Cancel</button></div>
      <p id="live-application-error" class="review-error" role="alert"></p>
    </form></div>`;
  $('#live-application').onsubmit = async event => {
    event.preventDefault();
    const button = event.target.querySelector('button.primary'), introduction = $('#live-introduction').value.trim();
    const resume = $('#live-attach-resume').checked ? resumeText : '', withFile = $('#live-attach-file').checked;
    button.disabled = true;
    try {
      let appId;
      if (reapplying) {
        const result = await Account.client.rpc('reapply_organization_application', { app: existing.id, new_profile: profile, new_resume: resume, new_introduction: introduction });
        if (result.error) throw migrationMissing(result.error) ? Error('Reapplying isn’t available yet. The Nextwork administrator needs to finish a database update.') : result.error;
        appId = existing.id;
      } else {
        appId = checked(await Account.client.from('organization_applications').insert({ listing_id: id, applicant_id: user.id, profile, resume, introduction }).select('id').single()).id;
      }
      let fileNote = '';
      if (withFile) { try { await shareResumeFile(appId, reapplying ? existing.resume_file : null); } catch { fileNote = ' Your resume file couldn’t be attached — your profile and resume text were sent.'; } }
      closeModal(); Organization.loaded = false; workTab = 'applications'; location.hash = 'projects'; render();
      await loadOrganization();
      toast((reapplying ? 'Application resubmitted to ' : 'Application submitted to ') + job.c + '.' + fileNote);
    } catch (error) {
      $('#live-application-error').textContent = error.code === '23505' ? 'You already applied to this listing. Find it in My work → Applications.' : organizationError(error);
      button.disabled = false;
    }
  };
}
function reapplyApplication(id) {
  const app = Organization.mine.find(a => a.id === id);
  if (!app) return;
  const listingId = Number(app.listing_id);
  if (!jobs.find(j => j.id === listingId)) { catalogLoadedAt = 0; loadPublicOrganizationJobs().then(() => jobs.find(j => j.id === listingId) ? applyLiveListing(listingId) : toast('This listing is no longer open.')); return; }
  applyLiveListing(listingId);
}
async function withdrawOrganizationApplication(id) {
  const app = Organization.mine.find(a => a.id === id);
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="withdraw-title"><button class="close" onclick="closeModal()" aria-label="Close">×</button><h2 id="withdraw-title">Withdraw this application?</h2><p>${esc(app?.organization_listings?.organizations?.name || 'The organization')} will see that you withdrew. You can reapply later while the listing is open.</p><div class="dialog-actions"><button class="primary danger" id="confirm-withdraw">Withdraw application</button><button class="outline" onclick="closeModal()">Keep it</button></div></div>`;
  $('#confirm-withdraw').onclick = async () => {
    try { checked(await Account.client.rpc('withdraw_organization_application', { app: id })); closeModal(); await loadOrganization(); render(); toast('Application withdrawn'); }
    catch (e) { closeModal(); toast(organizationError(e)); }
  };
}
function setApplicationFilter(value) { Organization.mineFilter = value; render(); }
function applicationProgress(status) {
  const meta = statusMeta(status), steps = ['Submitted', 'Under review', status === 'declined' ? 'Not selected' : 'Decision'];
  if (status === 'withdrawn') return '<div class="app-progress withdrawn"><span>Withdrawn by you</span></div>';
  return `<ol class="app-progress tone-${meta.tone}" aria-label="Application progress">${steps.map((label, i) => `<li class="${i + 1 < meta.step ? 'done' : i + 1 === meta.step ? 'current' : ''}"><i></i><span>${esc(label)}</span></li>`).join('')}</ol>`;
}
function myApplicationCard(app) {
  const listing = app.organization_listings || {}, org = listing.organizations?.name || 'Organization', meta = statusMeta(app.status);
  const decided = ['accepted', 'declined'].includes(app.status);
  return `<article class="my-application tone-${meta.tone}">
    <div class="my-app-head"><span class="org-mark" aria-hidden="true">${esc(org.slice(0, 1).toUpperCase())}</span><div class="my-app-title"><small>${esc(org)}</small><h3><a href="#project/${Number(app.listing_id)}">${esc(listing.title || 'Opportunity')}</a></h3><p>${esc([listing.kind, listing.location, listing.budget ? '$' + Number(listing.budget).toLocaleString() : ''].filter(Boolean).join(' · '))}</p></div>${statusPill(app.status)}</div>
    ${applicationProgress(app.status)}
    ${decided || app.decision_note ? `<div class="decision-note tone-${meta.tone}"><b>${app.status === 'accepted' ? icon('check', 15) + ' Accepted' : app.status === 'declined' ? 'Decision: not selected' : 'Note from ' + esc(org)}</b>${app.decision_note ? `<p>“${esc(app.decision_note)}”</p><small>— ${esc(org)}${app.decided_at ? ' · ' + esc(friendlyDate(app.decided_at)) : ''}</small>` : `<p class="muted-copy">${esc(meta.note)}</p>`}</div>` : `<p class="status-hint">${esc(meta.note)}</p>`}
    <div class="my-app-foot"><small>${app.attempt > 1 ? `Reapplied ${esc(friendlyDate(app.reapplied_at || app.updated_at))} · attempt ${app.attempt}` : `Applied ${esc(friendlyDate(app.created_at))}`}${app.resume_file ? ' · resume file shared' : ''}</small><div class="row-actions">
      ${canReapply(app) ? `<button class="primary" onclick="reapplyApplication('${app.id}')">Reapply ${icon('arrow', 14)}</button>` : ''}
      <button class="outline" onclick="openApplicationMessages('${app.id}')">${icon('message', 15)} Message</button>
      ${['submitted', 'shortlisted'].includes(app.status) ? `<button class="text-control" onclick="withdrawOrganizationApplication('${app.id}')">Withdraw</button>` : ''}
    </div></div>
  </article>`;
}
function myApplicationsHTML() {
  ensureApplicationsLoaded();
  const all = Organization.mine || [], filter = Organization.mineFilter || 'all';
  const groups = { all: all, active: all.filter(a => ['submitted', 'shortlisted'].includes(a.status)), accepted: all.filter(a => a.status === 'accepted'), closed: all.filter(a => ['declined', 'withdrawn'].includes(a.status)) };
  const shown = groups[filter] || all;
  const drafts = applications.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  const loading = !Organization.loaded && !Organization.error;
  return `<div class="applications-overview">${[['all', 'All applications', groups.all.length], ['active', 'In progress', groups.active.length], ['accepted', 'Accepted', groups.accepted.length], ['closed', 'Closed', groups.closed.length]].map(([key, label, n]) => `<button class="${filter === key ? 'active' : ''}" aria-pressed="${filter === key}" onclick="setApplicationFilter('${key}')"><strong>${n}</strong><span>${label}</span></button>`).join('')}</div>
    ${Organization.error ? `<div class="org-error" role="alert">${esc(Organization.error)}</div>` : ''}
    <div class="my-application-list">${loading ? inlineLoading('Loading your applications…') : shown.map(myApplicationCard).join('') || `<div class="empty-state">${icon('apps', 30)}<h2>${all.length ? 'Nothing here right now.' : 'Make your first move.'}</h2><p>${all.length ? 'Try another filter.' : 'Apply to an organization’s opportunity and track every decision here.'}</p>${all.length ? '' : '<a class="primary" href="#explore">Explore opportunities</a>'}</div>`}</div>
    ${drafts.length ? `<section class="drafts-section"><div class="section-title"><h2>Practice drafts</h2><small>Sample listings — drafts stay private in your account.</small></div>${drafts.map(j => `<article class="application-row compact">${logo(j)}<div><small>${esc(j.c)}</small><h3>${esc(j.title)}</h3></div><span class="status-pill tone-neutral">Draft</span><button class="outline" onclick="apply(${j.id})">Open draft ${icon('arrow', 14)}</button></article>`).join('')}</section>` : ''}`;
}
function submissionsPage() { workTab = 'applications'; setTimeout(() => { location.hash = 'projects'; }, 0); return loadingView('Opening My work', 'Your applications now live in My work.'); }

/* ---------------- Organization: applicant inbox and full profile ---------------- */
function organizationApplicantList() {
  const inScope = Organization.applications.filter(a => Organization.selected === 'all' || String(a.listing_id) === Organization.selected);
  const counts = s => s === 'all' ? inScope.length : inScope.filter(a => a.status === s).length;
  const query = String(Organization.applicantSearch || '').trim().toLowerCase(), sort = Organization.applicantSort || 'newest';
  const rows = inScope
    .filter(a => Organization.applicationStatus === 'all' || a.status === Organization.applicationStatus)
    .filter(a => !query || [a.profile?.name, a.profile?.role, a.profile?.skills, a.profile?.email, a.organization_listings?.title].join(' ').toLowerCase().includes(query))
    .sort((x, y) => sort === 'name' ? String(x.profile?.name || '').localeCompare(String(y.profile?.name || '')) : sort === 'fit' ? (fitFor(y)?.score || 0) - (fitFor(x)?.score || 0) : sort === 'oldest' ? new Date(x.created_at) - new Date(y.created_at) : new Date(y.created_at) - new Date(x.created_at));
  return `<section class="panel wide-panel applicant-inbox">
    <div class="inbox-toolbar"><div class="inbox-heading"><h2>Applicants</h2><p class="applicant-count" role="status">${rows.length} of ${inScope.length} shown</p></div>
      <div class="inbox-filters"><input id="applicant-search" class="applicant-search" type="search" placeholder="Search name, role, skill or listing" aria-label="Search applicants" value="${esc(Organization.applicantSearch || '')}" oninput="searchOrganizationApplicants(this.value)">
      <select aria-label="Filter applicants by listing" onchange="Organization.selected=this.value;render()"><option value="all">All listings</option>${Organization.listings.map(l => `<option value="${l.id}" ${String(l.id) === Organization.selected ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select>
      <select aria-label="Sort applicants" onchange="Organization.applicantSort=this.value;render()">${[['newest', 'Newest first'], ['fit', 'Best fit'], ['oldest', 'Oldest first'], ['name', 'Name A–Z']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="status-chips" role="group" aria-label="Filter by status">${['all', 'submitted', 'accepted', 'declined', 'withdrawn'].map(s => `<button class="${Organization.applicationStatus === s ? 'active' : ''}" aria-pressed="${Organization.applicationStatus === s}" onclick="Organization.applicationStatus='${s}';render()">${s === 'all' ? 'All' : s === 'declined' ? 'Declined' : statusMeta(s).label}<span>${counts(s)}</span></button>`).join('')}</div>
    <div class="applicant-table" role="list">${rows.map(a => {
      const fit = fitFor(a);
      return `<article class="applicant-line" role="listitem"><button class="applicant-open" onclick="openApplicant('${a.id}')" aria-label="Open ${esc(a.profile?.name || 'applicant')}’s full profile">${typeof memberPhotoAvatar === 'function' ? memberPhotoAvatar(a.applicant_id, a.profile?.name) : `<span class="avatar">${initialsFor(a.profile?.name)}</span>`}<span class="applicant-who"><b>${esc(a.profile?.name || 'Applicant')}</b><small>${esc([a.profile?.role, a.profile?.education].filter(Boolean).join(' · '))}</small></span></button>
        <span class="applicant-listing"><small>Applied for</small>${esc(a.organization_listings?.title || listingFor(a)?.title || 'Listing')}</span>
        ${fitBadge(fit)}
        <span class="applicant-status">${statusPill(a.status, true)}<small>${a.attempt > 1 ? 'Reapplied · ' : ''}${esc(friendlyDate(a.attempt > 1 ? a.reapplied_at || a.updated_at : a.created_at))}</small></span>
        <span class="applicant-actions"><button class="primary" onclick="openApplicant('${a.id}')">View profile</button><button class="icon-button" onclick="openApplicationMessages('${a.id}')" aria-label="Message ${esc(a.profile?.name || 'applicant')}" title="Message">${icon('message', 17)}</button></span>
      </article>`;
    }).join('') || `<div class="empty-state">${icon('user', 30)}<h2>${Organization.applications.length ? 'No applicants match these filters.' : 'No applicants yet.'}</h2><p>${Organization.applications.length ? 'Try clearing the search or choosing another status.' : 'Applications to your published listings will appear here.'}</p></div>`}</div>
  </section>`;
}
function openApplicant(id) { Organization.viewing = id; Organization.tab = 'applicants'; render(); window.scrollTo(0, 0); }
function closeApplicant() { Organization.viewing = null; render(); }
function viewOrganizationApplicant(id) { closeModal(); openApplicant(id); }
function profileFactRows(profile) {
  const rows = [['Education', [profile.education, profile.degree].filter(Boolean).join(' — ')], ['Graduation', profile.graduation], ['Location', profile.location], ['Target field', profile.field], ['Target role', profile.role], ['Looking for', profile.engagement], ['Availability', profile.availability ? profile.availability + ' / week' : ''], ['Work style', profile.workstyle]];
  const known = new Set(['name', 'email', 'education', 'degree', 'graduation', 'location', 'field', 'role', 'engagement', 'availability', 'workstyle', 'skills', 'tagline', 'portfolio', 'bio', 'completed_projects']);
  for (const [key, value] of Object.entries(profile)) if (!known.has(key) && !ApplicantReport.skip.has(key.toLowerCase()) && typeof value === 'string' && value.trim() && value.length < 200 && !/^data:/.test(value)) rows.push([ApplicantReport.label(key), value]);
  return rows.filter(([, v]) => v);
}
function organizationApplicantPage(id) {
  const app = Organization.applications.find(a => a.id === id);
  if (!app) return `<button class="text-control back-link" onclick="closeApplicant()">${icon('back', 16)} Back to applicants</button><div class="empty-state"><h2>This application is no longer available.</h2></div>`;
  const p = app.profile || {}, listing = listingFor(app) || {}, fit = fitFor(app), matched = new Set((fit?.skills || []).filter(s => s.value).map(s => s.skill.toLowerCase()));
  const open = app.status !== 'withdrawn';
  setTimeout(() => { if (app.resume_file) paintApplicationResume(id); if (typeof paintProfilePhotos === 'function') paintProfilePhotos(); }, 0);
  return `<div class="applicant-page">
    <button class="text-control back-link" onclick="closeApplicant()">${icon('back', 16)} Back to applicants</button>
    <section class="applicant-hero panel" aria-label="Applicant summary">
      <div class="applicant-identity">${typeof memberPhotoAvatar === 'function' ? `<span class="hero-avatar">${memberPhotoAvatar(app.applicant_id, p.name)}</span>` : `<span class="avatar-lg">${initialsFor(p.name)}</span>`}<div><div class="hero-title"><h1>${esc(p.name || 'Applicant')}</h1>${statusPill(app.status, true)}${app.attempt > 1 ? `<span class="status-pill tone-neutral">Reapplied · attempt ${app.attempt}</span>` : ''}</div><p class="hero-tagline">${esc(p.tagline || p.role || '')}</p><p class="hero-meta">${[p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '', p.location ? esc(p.location) : '', safeLink(p.portfolio) ? `<a href="${safeLink(p.portfolio)}" target="_blank" rel="noopener noreferrer">${icon('link', 14)} Portfolio</a>` : ''].filter(Boolean).join('<span aria-hidden="true">·</span>')}</p><small>Applied for <b>${esc(listing.title || 'this listing')}</b> · ${esc(friendlyDate(app.created_at))}${app.attempt > 1 ? ' · resubmitted ' + esc(friendlyDate(app.reapplied_at || app.updated_at)) : ''}</small></div></div>
      ${fit ? `<div class="hero-fit">${fitRing(fit.score, fit.verdict[1])}<span>${esc(fit.verdict[0])}</span></div>` : ''}
      <div class="decision-bar">${open ? `<button class="primary" onclick="decideApplication('${id}','accepted')">${icon('check', 15)} Accept</button><button class="outline danger-outline" onclick="decideApplication('${id}','declined')">Decline</button>` : '<span class="muted-copy">The applicant withdrew this application.</span>'}<span class="bar-spacer"></span><button class="outline" onclick="openApplicationMessages('${id}')">${icon('message', 15)} Message</button><button id="applicant-pdf-button" class="outline" onclick="downloadApplicantReport('${id}')">${icon('save', 15)} Export PDF</button></div>
      ${app.decision_note ? `<div class="decision-note tone-${statusMeta(app.status).tone}"><b>Note shared with applicant</b><p>“${esc(app.decision_note)}”</p></div>` : ''}
    </section>
    <div class="applicant-layout">
      <div class="applicant-main">
        ${fitAnalysisHTML(app)}
        <section class="panel applicant-card-block"><h2>Introduction</h2><p class="prose-text">${esc(app.introduction)}</p></section>
        <section class="panel applicant-card-block"><div class="block-heading"><h2>Resume</h2>${app.resume_file ? `<small>${esc(app.resume_file.name)}${app.resume_file.size ? ' · ' + Math.ceil(app.resume_file.size / 1024) + ' KB' : ''}</small>` : ''}</div>
          ${app.resume_file ? `<div id="applicant-resume-file" class="resume-file-view">${inlineLoading('Loading resume file…')}</div>` : '<p class="muted-copy">No resume file was attached to this application.</p>'}
          ${app.resume ? `<details class="resume-text-details" ${app.resume_file ? '' : 'open'}><summary>Resume text${app.resume_file ? ' (as submitted)' : ''}</summary><pre class="resume-paper">${esc(app.resume)}</pre></details>` : ''}
        </section>
      </div>
      <div class="applicant-side">
        <section class="panel applicant-card-block"><h2>Profile</h2>${p.bio ? `<p class="prose-text">${esc(p.bio)}</p>` : ''}<dl class="profile-facts">${profileFactRows(p).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
        <section class="panel applicant-card-block"><h2>Skills</h2><div class="tags">${splitSkills(p.skills).map(s => `<span class="tag ${matched.has(s.toLowerCase()) ? 'tag-match' : ''}">${esc(s)}</span>`).join('') || '<span class="muted-copy">No skills listed.</span>'}</div>${fit ? `<p class="fine-print">Highlighted skills match this listing.</p>` : ''}${p.completed_projects ? `<h3>Completed Nextwork projects</h3><p>${esc(p.completed_projects)}</p>` : ''}</section>
        <section class="panel applicant-card-block"><h2>The role</h2><b>${esc(listing.title || '')}</b><p class="muted-copy">${esc([listing.kind, listing.field, listing.location].filter(Boolean).join(' · '))}</p><div class="tags">${(listing.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div></section>
      </div>
    </div>
  </div>`;
}
const DECISION_COPY = {
  accepted: { title: 'Accept this applicant', button: 'Accept applicant', placeholder: 'e.g. Welcome aboard! We’ll email you this week about next steps.' },
  declined: { title: 'Decline this application', button: 'Decline application', placeholder: 'Optional but appreciated — e.g. what would make a future application stronger.' },
};
function decideApplication(id, status) {
  const app = Organization.applications.find(a => a.id === id), copy = DECISION_COPY[status];
  if (!app || !copy) return;
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="dialog decision-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title"><button class="close" onclick="closeModal()" aria-label="Close">×</button><span class="section-label">${esc(app.profile?.name || 'Applicant')}</span><h2 id="decision-title">${copy.title}</h2>
    <form id="decision-form"><label class="field">Note to the applicant <small>Visible to ${esc(app.profile?.name?.split(' ')[0] || 'them')} in their applications</small><textarea id="decision-note" maxlength="2000" rows="5" placeholder="${esc(copy.placeholder)}">${esc(app.status === status ? app.decision_note || '' : '')}</textarea></label>
    <div class="dialog-actions"><button class="primary ${status === 'declined' ? 'danger' : ''}">${copy.button}</button><button type="button" class="outline" onclick="closeModal()">Cancel</button></div><p id="application-action-error" class="review-error" role="alert"></p></form></div>`;
  $('#decision-note').focus();
  $('#decision-form').onsubmit = async event => { event.preventDefault(); event.target.querySelector('button.primary').disabled = true; await reviewOrganizationApplication(id, status, $('#decision-note').value.trim()); };
}
async function reviewOrganizationApplication(id, status, note = '') {
  if (!['accepted', 'shortlisted', 'declined', 'submitted'].includes(status)) return;
  try {
    let result = await Account.client.rpc('decide_organization_application', { app: id, decision: status, note });
    let warning = '';
    if (result.error && migrationMissing(result.error)) { result = await Account.client.rpc('review_organization_application', { app: id, decision: status }); if (note) warning = ' The note wasn’t saved — a database update is still pending.'; }
    checked(result);
    closeModal(); await loadOrganization(); render();
    toast('Application ' + (status === 'declined' ? 'declined' : status) + '.' + warning);
  } catch (e) {
    const node = $('#application-action-error');
    if (node) { node.textContent = organizationError(e); const b = $('#decision-form button.primary'); if (b) b.disabled = false; } else toast(organizationError(e));
  }
}
