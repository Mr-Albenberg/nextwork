// Fit analyzer, application status rules, and My work rendering for organization applications.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const noop = () => {};
const el = () => ({ innerHTML: '', textContent: '', hidden: true, style: {}, classList: { add: noop, remove: noop, toggle: noop }, querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, focus: noop });
const data = {}, storage = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } };
const ctx = { document: { body: el(), getElementById: () => null, querySelector: () => el(), querySelectorAll: () => [], addEventListener: noop }, localStorage: storage, sessionStorage: storage, workspaceLocal: storage, workspaceSession: storage, location: { hash: '#projects' }, window: { addEventListener: noop, scrollTo: noop }, setTimeout: noop, URL, Blob };
vm.createContext(ctx);
for (const f of ['ui-state.js', 'account-types.js', 'extra-jobs.js', 'criteria.js', 'resume-engine.js', 'interface.js', 'applicant-report.js', 'organization.js', 'applications.js']) {
  vm.runInContext(fs.readFileSync('dist/' + f, 'utf8'), ctx);
  if (f === 'extra-jobs.js') ctx.ExtraJobs = ctx.window.ExtraJobs;
  if (f === 'criteria.js') ctx.MatchCriteria = ctx.window.MatchCriteria;
  if (f === 'resume-engine.js') ctx.ResumeEngine = ctx.window.ResumeEngine;
}
vm.runInContext('var applications=[],jobs=[],workTab="applications";function esc(s){return String(s).replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]))}function logo(){return ""}', ctx);
const run = code => vm.runInContext(code, ctx);

const listing = { id: 1001, title: 'Frontend engineer', field: 'Development', kind: 'Contract project', location: 'Remote', skills: ['React', 'JavaScript', 'Data Visualization'], requirements: ['Shipped a React application to real users', 'Comfortable writing automated tests'], status: 'published' };
ctx.__listing = listing;
const strong = { id: 'a1', listing_id: 1001, status: 'submitted', profile: { name: 'Alex', field: 'Development', engagement: 'Both projects and full-time', availability: '20–30 hours', workstyle: 'Remote', skills: 'React, JavaScript' }, resume: 'Alex Kim. Built and shipped a React application with JavaScript and data visualization dashboards to real users. Wrote automated tests with Jest. Used git and collaborated with a team on accessible interfaces.', introduction: 'x' };
const weak = { id: 'a2', listing_id: 1001, status: 'submitted', profile: { name: 'Sam', field: 'Marketing', engagement: 'Full-time role', availability: 'Under 10 hours', workstyle: 'On-site', skills: 'Copywriting' }, resume: '', introduction: 'x' };
ctx.__strong = strong; ctx.__weak = weak;
const a = run('FitAnalyzer.analyze(__strong,__listing)'), b = run('FitAnalyzer.analyze(__weak,__listing)');
assert(a.hasResume && a.score >= 75, 'strong applicant should be a strong fit, got ' + a.score);
assert.equal(a.verdict[0], 'Strong fit');
assert(a.skills.every(s => s.inResume), 'all requested skills evidenced in resume');
assert(!b.hasResume && b.score <= 60, 'no-resume estimate must be capped');
assert(b.gaps.some(g => g.startsWith('Field')) && b.gaps.some(g => g.startsWith('Availability')));
assert(b.score < a.score);
assert.equal(run('FitAnalyzer.analyze(__weak,null)'), null);

// Reapply is allowed only for declined/withdrawn applications to open listings, within the attempt limit.
assert.equal(run('canReapply({status:"declined",attempt:1,organization_listings:{status:"published"}})'), true);
assert.equal(run('canReapply({status:"withdrawn",attempt:1})'), true);
assert.equal(run('canReapply({status:"declined",attempt:5,organization_listings:{status:"published"}})'), false);
assert.equal(run('canReapply({status:"declined",attempt:1,organization_listings:{status:"closed"}})'), false);
assert.equal(run('canReapply({status:"shortlisted",attempt:1})'), false);

// My work shows organization applications with status, decision notes and the right actions; notes are escaped.
run(`Account={user:{id:'u1',app_metadata:{nextwork_account_type:'personal'}}};Organization.owner='u1';Organization.loaded=true;Organization.mine=[
 {id:'d1',listing_id:1,status:'declined',decision_note:'Try again with <b>portfolio</b>',decided_at:new Date().toISOString(),attempt:1,created_at:new Date().toISOString(),organization_listings:{title:'Role A',status:'published',organizations:{name:'Org A'}}},
 {id:'s1',listing_id:2,status:'shortlisted',decision_note:'',attempt:1,created_at:new Date().toISOString(),organization_listings:{title:'Role B',status:'published',organizations:{name:'Org B'}}}]`);
const html = run('myApplicationsHTML()');
assert(html.includes('Not selected') && html.includes('Shortlisted'));
assert(html.includes('Try again with &lt;b&gt;portfolio&lt;/b&gt;') && !html.includes('<b>portfolio</b>'));
assert(html.includes("reapplyApplication('d1')") && !html.includes("reapplyApplication('s1')"));
assert(html.includes("withdrawOrganizationApplication('s1')") && !html.includes("withdrawOrganizationApplication('d1')"));
run('Organization.mineFilter="active"');
const active = run('myApplicationsHTML()');
assert(active.includes('Role B') && !active.includes('Role A'));
assert.equal(run('applyButtonLabel({id:1,organizationId:"o"})'), 'Reapply to this opportunity ↗');
assert.equal(run('applyButtonLabel({id:2,organizationId:"o"})'), 'View application status');
assert.equal(run('applyButtonLabel({id:3,organizationId:"o"})'), 'Apply to this opportunity ↗');
console.log('applications tests passed');
