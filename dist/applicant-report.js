/* Printable applicant report for organization accounts. Opens the browser print dialog so the
   reviewer can choose "Save as PDF". Everything is built client-side from data the organization
   is already allowed to read; nothing is sent anywhere. */
const ApplicantReport={
skip:new Set(['photo','avatar','image','picture','photourl','avatarurl','id','user_id','owner_id','applicant_id','password','token']),
label(k){return String(k).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase())},
safe(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
text(v){if(v==null||v==='')return '';if(Array.isArray(v))return v.map(x=>ApplicantReport.text(x)).filter(Boolean).join(', ');if(typeof v==='object')return Object.values(v).map(x=>ApplicantReport.text(x)).filter(Boolean).join(', ');return String(v)},
date(v,long){const d=new Date(v);return isNaN(d)?'':long?d.toLocaleString():d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})},
fileName(a){const n=String(a.profile?.name||'applicant').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'applicant';return `nextwork-application-${n}`},
profileRows(profile){const short=[],long=[];for(const [k,v]of Object.entries(profile||{})){if(ApplicantReport.skip.has(k.toLowerCase()))continue;const t=ApplicantReport.text(v).trim();if(!t||/^data:/i.test(t))continue;(t.length>160||t.includes('\n')?long:short).push([k,t])}return {short,long}},
async messages(id){try{const r=await Account.client.from('application_messages').select('*').eq('application_id',id).order('created_at',{ascending:true}).limit(200);return r.error?[]:r.data||[]}catch{return[]}},
html(a,listing,org,messages,actor){const S=ApplicantReport.safe,p=a.profile||{},rows=ApplicantReport.profileRows(p);const skills=String(p.skills||'').split(',').map(s=>s.trim()).filter(Boolean);const orgName=org?.name||'Organization';
const facts=[['Email',p.email],['Role',p.role],...rows.short.filter(([k])=>!['name','email','role','skills'].includes(k.toLowerCase())).map(([k,v])=>[ApplicantReport.label(k),v])].filter(([,v])=>v);
const listingBlock=listing?`<section><h2>Position applied for</h2><div class="grid"><div><small>Title</small><span>${S(listing.title)}</span></div>${listing.kind?`<div><small>Type</small><span>${S(listing.kind)}</span></div>`:''}${listing.field?`<div><small>Field</small><span>${S(listing.field)}</span></div>`:''}${listing.duration?`<div><small>Duration</small><span>${S(listing.duration)}</span></div>`:''}${listing.budget?`<div><small>Budget</small><span>$${S(Number(listing.budget).toLocaleString())}</span></div>`:''}${listing.location?`<div><small>Location</small><span>${S(listing.location)}</span></div>`:''}</div>${Array.isArray(listing.skills)&&listing.skills.length?`<p class="chips">${listing.skills.map(s=>`<span>${S(s)}</span>`).join('')}</p>`:''}</section>`:`<section><h2>Position applied for</h2><p>${S(a.organization_listings?.title||'Listing')}</p></section>`;
const thread=messages.length?`<section class="break"><h2>Conversation with applicant</h2>${messages.map(m=>`<div class="msg ${m.sender_id===actor?'org':'app'}"><b>${m.sender_id===actor?S(orgName):S(p.name||'Applicant')}</b><span>${S(ApplicantReport.date(m.created_at,true))}</span><p>${S(m.body)}</p></div>`).join('')}</section>`:'';
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${S(ApplicantReport.fileName(a))}</title><style>
@page{size:A4;margin:16mm 15mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font:13px/1.55 "Segoe UI",Helvetica,Arial,sans-serif;color:#1b2238}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:14px;border-bottom:3px solid #1d3be0}
.brand{display:flex;align-items:center;gap:10px;font-family:Arial,sans-serif;font-weight:800;font-size:24px;color:#182438;letter-spacing:-.045em}.brand img{width:34px;height:34px;object-fit:contain}.meta{text-align:right;color:#5a6479;font-size:11px;line-height:1.6}
.hero{margin:22px 0 6px}.hero h1{margin:6px 0 2px;font-size:28px;letter-spacing:-.02em}.hero p{margin:0;color:#4a5570;font-size:14px}
.status{display:inline-block;padding:3px 11px;border-radius:99px;background:#e8ecff;color:#1d3be0;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.status.accepted{background:#dcf5e6;color:#17703c}.status.declined{background:#fde4e2;color:#a3281f}.status.shortlisted{background:#fff1d3;color:#8a5a00}.status.withdrawn{background:#eceef3;color:#555e73}
section{margin-top:20px;page-break-inside:auto}section.break{page-break-before:auto}
h2{margin:0 0 9px;padding-bottom:5px;border-bottom:1px solid #dfe3ee;font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:#1d3be0}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px 22px}.grid div{padding:7px 0;border-bottom:1px solid #eef0f6;page-break-inside:avoid}
.grid small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#7a8398}.grid span{font-weight:600;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}.chips span{padding:3px 10px;border:1px solid #cfd6ee;border-radius:99px;background:#f4f6ff;font-size:11.5px;color:#2b3a8f}
.prose{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.resume{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 Georgia,"Times New Roman",serif;padding:16px 18px;border:1px solid #dfe3ee;border-radius:8px;background:#fafbfe;margin:0}
.longrow{margin-bottom:12px;page-break-inside:avoid}.longrow small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#7a8398;margin-bottom:2px}
.msg{margin:0 0 9px;padding:9px 12px;border-radius:8px;border:1px solid #e2e6f1;page-break-inside:avoid}.msg.org{background:#eef1ff;border-color:#d2d9fb}
.msg b{font-size:12px}.msg span{margin-left:8px;color:#7a8398;font-size:10.5px}.msg p{margin:3px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.foot{margin-top:28px;padding-top:9px;border-top:1px solid #dfe3ee;color:#8a93a8;font-size:10px;display:flex;justify-content:space-between}
</style></head><body>
<div class="top"><div class="brand"><img src="https://mr-albenberg.github.io/nextwork/assets/brand/nextwork-icon.png" alt=""><span>nextwork</span></div><div class="meta"><b>${S(orgName)}</b><br>Application report<br>Generated ${S(ApplicantReport.date(Date.now()))}</div></div>
<div class="hero"><span class="status ${S(a.status)}">${S(a.status)}</span><h1>${S(p.name||'Applicant')}</h1><p>${S([p.role,p.email].filter(Boolean).join(' · '))}</p><p style="font-size:12px;margin-top:4px">Applied ${S(ApplicantReport.date(a.created_at))}${a.updated_at&&a.updated_at!==a.created_at?` · Last updated ${S(ApplicantReport.date(a.updated_at))}`:''}</p></div>
${a.decision_note?`<section><h2>Decision note shared with applicant</h2><p class="prose">${S(a.decision_note)}</p></section>`:''}
${listingBlock}
<section><h2>Applicant details</h2>${facts.length?`<div class="grid">${facts.map(([k,v])=>`<div><small>${S(k)}</small><span>${S(v)}</span></div>`).join('')}</div>`:'<p>No additional details provided.</p>'}${skills.length?`<p class="chips">${skills.map(s=>`<span>${S(s)}</span>`).join('')}</p>`:''}</section>
<section><h2>Introduction</h2><p class="prose">${S(a.introduction)}</p></section>
${rows.long.filter(([k])=>!['bio','introduction','resume'].includes(k.toLowerCase())).length?`<section><h2>Additional profile information</h2>${rows.long.filter(([k])=>!['bio','introduction','resume'].includes(k.toLowerCase())).map(([k,v])=>`<div class="longrow"><small>${S(ApplicantReport.label(k))}</small><p class="prose">${S(v)}</p></div>`).join('')}</section>`:''}
<section><h2>Resume</h2>${a.resume_file?.name?`<p>Original file shared through Nextwork: <b>${S(a.resume_file.name)}</b></p>`:''}${a.resume?`<pre class="resume">${S(a.resume)}</pre>`:'<p>No resume attached.</p>'}</section>
${thread}
<div class="foot"><span>Confidential. Shared privately with ${S(orgName)} through Nextwork.</span><span>${S(p.name||'Applicant')} · ${S(a.organization_listings?.title||'')}</span></div>
</body></html>`},
async download(id){const a=Organization.applications.find(x=>x.id===id);if(!a)return;const button=document.getElementById('applicant-pdf-button');if(button){button.disabled=true;button.dataset.label=button.textContent;button.textContent='Preparing…'}try{const actor=organizationUser()?.id,listing=Organization.listings.find(l=>String(l.id)===String(a.listing_id)),messages=await ApplicantReport.messages(id),doc=ApplicantReport.html(a,listing,Organization.profile,messages,actor);const old=document.getElementById('applicant-report-frame');if(old)old.remove();const frame=document.createElement('iframe');frame.id='applicant-report-frame';frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';const title=document.title;frame.onload=()=>{try{frame.contentWindow.focus();document.title=ApplicantReport.fileName(a);frame.contentWindow.print();if(typeof toast==='function')toast('Choose “Save as PDF” in the print dialog')}finally{setTimeout(()=>{document.title=title;frame.remove()},60000)}};frame.srcdoc=doc;document.body.appendChild(frame)}catch(e){if(typeof toast==='function')toast('Could not create the PDF. Please try again.')}finally{if(button){button.disabled=false;button.textContent=button.dataset.label||'Download PDF'}}}
};
function downloadApplicantReport(id){return ApplicantReport.download(id)}
