// AI suggestions are transient. Only an explicit Apply action writes the account profile.
const ProfileImport={owner:null,resume:'',suggestions:null,busy:false,error:'',notice:'',request:0};
const profileImportLabels={name:'Full name',email:'Contact email',location:'Location',education:'College or university',degree:'Degree or area of study',graduation:'Graduation year',portfolio:'Portfolio',role:'Target role',field:'Career field',tagline:'Tagline',bio:'Description',skills:'Skills',availability:'Weekly availability',workstyle:'Work style',engagement:'Work you’re looking for'};
function currentProfileDraft(){
 const profile={...graduateProfile()},form=document.querySelector('#profile-form');
 if(form)for(const [key,value]of new FormData(form))profile[key]=String(value).trim();
 return profile;
}
function profileImportCurrent(){
 const owner=Account.user?.id||null,resume=workspaceSession.getItem('proof-resume')||'';
 if(ProfileImport.owner!==owner||ProfileImport.resume!==resume){Object.assign(ProfileImport,{owner,resume,suggestions:null,busy:false,error:'',notice:''});ProfileImport.request++;}
 return ProfileImport;
}
function profileImportChanges(profile,mode){
 const state=profileImportCurrent();
 return (state.suggestions||[]).filter(row=>Object.hasOwn(profileImportLabels,row.field)&&row.value.trim()&&String(profile[row.field]||'').trim()!==row.value.trim()&&(mode==='different'||!String(profile[row.field]||'').trim()));
}
function profileImportPanel(){return `<div id="profile-import-panel">${profileImportContents()}</div>`;}
function profileImportContents(){
 const state=profileImportCurrent();
 return `<h3>Fill in your profile from your resume</h3><p>Use your saved resume to prepare profile details, then choose how to apply them.</p><button type="button" class="primary" id="prepare-profile-import" onclick="prepareProfileImport()" ${state.busy?'disabled':''}>${state.busy?'Reading your resume…':'Fill in profile details'}</button><p class="resume-hint">Uses Google Gemini to process your resume. Google may use free-tier content to improve its products.</p><p role="alert" class="review-error">${esc(state.error)}</p><p role="status" class="resume-hint">${esc(state.notice)}</p>`;
}
function openProfileImportDialog(){
 const state=profileImportCurrent();if(!state.suggestions)return;
 const modal=document.querySelector('#modal');if(!modal)return;
 modal.hidden=false;
 modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="profile-import-title"><button type="button" class="close" onclick="closeModal()" aria-label="Close">×</button><h2 id="profile-import-title">Your profile details are ready</h2><p>Choose how to apply the details from your resume.</p><div class="dialog-actions"><button type="button" class="primary" onclick="applyProfileImport('missing')">Fill empty fields</button><button type="button" class="outline" onclick="applyProfileImport('different')">Update everything</button></div><p id="profile-import-save-status" role="status"></p></div>`;
 modal.querySelector('.primary')?.focus();
}

function paintProfileImport(){const panel=document.querySelector('#profile-import-panel');if(panel)panel.innerHTML=profileImportContents();}
async function prepareProfileImport(){
 if(!requireAccount())return;
 const state=profileImportCurrent();if(state.busy)return;
 if(state.suggestions){openProfileImportDialog();return;}
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
  state.notice='';
 }catch(error){if(current())state.error=error.message||'Could not prepare suggestions. Your profile has not changed.';}
 finally{if(current()){state.busy=false;paintProfileImport();if(state.suggestions)openProfileImportDialog();}}
}
async function applyProfileImport(mode){
 if(!requireAccount()||!['missing','different'].includes(mode))return;
 const state=profileImportCurrent();if(state.busy||!state.suggestions)return;
 const profile=currentProfileDraft();
 const changes=profileImportChanges(profile,mode);
 if(!changes.length){closeModal();state.notice='Your profile is already up to date.';paintProfileImport();return;}
 const owner=Account.user.id,epoch=Account.sessionEpoch;
 for(const row of changes)profile[row.field]=row.value;
 state.busy=true;state.error='';paintProfileImport();
 const modal=document.querySelector('#modal');modal?.querySelectorAll('button').forEach(button=>button.disabled=true);
 const status=document.querySelector('#profile-import-save-status');if(status)status.textContent='Saving your profile…';
 try{
  workspaceLocal.setItem('proof-profile',JSON.stringify(profile));
  await saveWorkspace();
  if(Account.user?.id!==owner||Account.sessionEpoch!==epoch)return;
  closeModal();state.suggestions=null;state.busy=false;state.notice=`Saved ${changes.length} profile ${changes.length===1?'detail':'details'}.`;
  render();toast(state.notice);
 }catch{if(Account.user?.id===owner&&Account.sessionEpoch===epoch){state.busy=false;state.error='Could not save the profile changes. Reconnect and try again.';closeModal();paintProfileImport();}}
}
