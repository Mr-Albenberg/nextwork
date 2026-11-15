// AI suggestions are transient. Only an explicit Apply action writes the account profile.
const ProfileImport={owner:null,resume:'',suggestions:null,busy:false,error:'',notice:'',request:0,preview:{}};
const profileImportLabels={name:'Full name',email:'Contact email',location:'Location',education:'College or university',degree:'Degree or area of study',graduation:'Graduation year',portfolio:'Portfolio',role:'Target role',field:'Career field',tagline:'Tagline',bio:'Description',skills:'Skills',availability:'Weekly availability',workstyle:'Work style',engagement:'Work you’re looking for'};
function currentProfileDraft(){
 const profile={...graduateProfile()},form=document.querySelector('#profile-form');
 if(form)for(const [key,value]of new FormData(form))profile[key]=String(value).trim();
 return profile;
}
function profileImportCurrent(){
 const owner=Account.user?.id||null,resume=workspaceSession.getItem('proof-resume')||'';
 if(ProfileImport.owner!==owner||ProfileImport.resume!==resume){Object.assign(ProfileImport,{owner,resume,suggestions:null,busy:false,error:'',notice:'',preview:{}});ProfileImport.request++;}
 return ProfileImport;
}
function profileImportChanges(profile,mode){
 const state=profileImportCurrent();
 return (state.suggestions||[]).filter(row=>Object.hasOwn(profileImportLabels,row.field)&&row.value.trim()&&String(profile[row.field]||'').trim()!==row.value.trim()&&(mode==='different'||!String(profile[row.field]||'').trim()));
}
function profileImportPanel(){return `<div id="profile-import-panel">${profileImportContents()}</div>`;}
function profileImportContents(){
 const state=profileImportCurrent(),profile=currentProfileDraft(),rows=profileImportChanges(profile,'different'),blanks=profileImportChanges(profile,'missing');
 state.preview=Object.fromEntries((state.suggestions||[]).map(row=>[row.field,String(profile[row.field]||'').trim()]));
 return `<h3>Profile suggestions</h3><p>Prepare a draft with AI, review it here, then choose what to save. Your profile stays unchanged until you apply the suggestions.</p><p class="resume-hint">Preparing suggestions sends your resume to Google Gemini. Google may use free-tier content to improve its products.</p><button type="button" class="outline" id="prepare-profile-import" onclick="prepareProfileImport()" ${state.busy?'disabled':''}>${state.busy?'Reading your resume…':state.suggestions?'Regenerate suggestions':'Prepare profile suggestions'}</button>${state.suggestions?`<h3>Review suggested changes</h3><p>Contact email is a profile detail. Your sign-in email and password will stay the same.</p>${rows.length?`<div style="overflow-x:auto"><table class="profile-import-table"><thead><tr><th>Profile field</th><th>Current value</th><th>Suggested value</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(profileImportLabels[row.field])}</th><td>${esc(profile[row.field]||'Not filled')}</td><td>${esc(row.value)}<details><summary>Resume evidence</summary><p>${esc(row.evidence)}</p></details></td></tr>`).join('')}</tbody></table></div>`:'<p>No supported changes to your current profile were found.</p>'}<div class="resume-actions"><button type="button" class="primary" onclick="applyProfileImport('missing')" ${!blanks.length||state.busy?'disabled':''}>Fill missing profile details (${blanks.length})</button><button type="button" class="outline" onclick="applyProfileImport('different')" ${!rows.length||state.busy?'disabled':''}>Update all different details (${rows.length})</button></div>`:''}<p role="alert" class="review-error">${esc(state.error)}</p><p role="status" class="resume-hint">${esc(state.notice)}</p>`;
}
function paintProfileImport(){const panel=document.querySelector('#profile-import-panel');if(panel)panel.innerHTML=profileImportContents();}
async function prepareProfileImport(){
 if(!requireAccount())return;
 const state=profileImportCurrent();if(state.busy)return;
 if(state.resume.trim().length<100){state.error='Upload a resume with at least 100 characters first.';paintProfileImport();return;}
 const owner=state.owner,resume=state.resume,epoch=Account.sessionEpoch,request=++state.request;
 const current=()=>Account.user?.id===owner&&Account.sessionEpoch===epoch&&(workspaceSession.getItem('proof-resume')||'')===resume&&ProfileImport.request===request;
 state.busy=true;state.error='';state.notice='';paintProfileImport();
 try{
  const session=(await Account.client.auth.getSession()).data.session;
  if(!session)throw Error('Sign in again to prepare suggestions.');
  const response=await fetch(resumeAPIBase()+'/api/resume',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'profile-import',resume}),signal:AbortSignal.timeout(55000)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'AI profile processing is unavailable. Your profile has not changed.');
  if(data.source!=='ai'||!Array.isArray(data.suggestions))throw Error('This server needs the updated AI profile processor deployed. Your profile has not changed.');
  if(!current())return;
  state.suggestions=data.suggestions.filter(row=>Object.hasOwn(profileImportLabels,row.field)&&typeof row.value==='string'&&typeof row.evidence==='string').map(row=>({...row,value:row.field==='skills'&&typeof canonicalSkills==='function'?canonicalSkills(row.value).join(', '):row.value})).filter(row=>row.value);
  state.notice='Suggestions are ready. Nothing has been saved to your profile.';
 }catch(error){if(current())state.error=error.message||'Could not prepare suggestions. Your profile has not changed.';}
 finally{if(current()){state.busy=false;paintProfileImport();}}
}
async function applyProfileImport(mode){
 if(!requireAccount()||!['missing','different'].includes(mode))return;
 const state=profileImportCurrent();if(state.busy||!state.suggestions)return;
 const profile=currentProfileDraft();
 if(state.suggestions.some(row=>String(profile[row.field]||'').trim()!==state.preview[row.field])){state.notice='Your profile changed. Review the refreshed comparison before applying.';paintProfileImport();return;}
 const changes=profileImportChanges(profile,mode);if(!changes.length)return;
 const owner=Account.user.id,epoch=Account.sessionEpoch;
 for(const row of changes)profile[row.field]=row.value;
 state.busy=true;state.error='';paintProfileImport();
 try{
  workspaceLocal.setItem('proof-profile',JSON.stringify(profile));
  await saveWorkspace();
  if(Account.user?.id!==owner||Account.sessionEpoch!==epoch)return;
  state.busy=false;state.notice=`Saved ${changes.length} profile ${changes.length===1?'detail':'details'}.`;
  render();toast(state.notice);
 }catch{if(Account.user?.id===owner&&Account.sessionEpoch===epoch){state.busy=false;state.error='Could not save the profile changes. Reconnect and try again.';paintProfileImport();}}
}
