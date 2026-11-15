// Sample listings accept account-backed applications and link to creator messaging.
let sampleApplicationBusy=false;
function sampleApplicationRows(){
 let rows=[];try{rows=JSON.parse(workspaceLocal.getItem('proof-applications')||'[]');}catch{}
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&Number.isInteger(r.jobId)).map(r=>({...r,isSample:true,status:r.status==='withdrawn'?'withdrawn':'submitted',id:'sample-'+r.jobId,created_at:r.createdAt}));
}
function sampleApplicationCard(app){
 const job=jobs.find(j=>j.id===app.jobId),company=job?.c||app.listing?.company||'Sample company',title=job?.title||app.listing?.title||'Sample opportunity';
 return `<article class="my-application sample-application-card tone-${statusMeta(app.status).tone}"><div class="my-app-head">${job?logo(job):''}<div class="my-app-title"><small>${esc(company)} · Sample listing</small><h3>${esc(title)}</h3></div>${statusPill(app.status)}</div>${applicationProgress(app.status)}<p class="resume-hint">Saved in your account. No external employer receives this sample application.</p><div class="my-app-foot"><small>${app.status==='withdrawn'?'Withdrawn':'Submitted'} ${esc(friendlyDate(app.status==='withdrawn'?app.withdrawnAt:app.createdAt))}${app.resumeFile?' · resume document attached':app.resume?' · resume text attached':''}</small><div class="row-actions"><button class="outline" onclick="apply(${app.jobId})">View application</button>${job?.demoCreator?`<button class="outline" onclick="messageCreator(${app.jobId})">${icon('message',15)} Message</button>`:''}${app.status==='withdrawn'?`<button class="primary" onclick="applySampleListing(${app.jobId},true)">Reapply</button>`:`<button class="text-control" onclick="withdrawSampleApplication(${app.jobId})">Withdraw</button>`}</div></div></article>`;
}
function applySampleListing(id,reapply=false){
 if(typeof requireAccount==='function'&&!requireAccount())return;
 if(typeof isOrganizationAccount==='function'&&isOrganizationAccount()){toast('Use a personal account to apply for work.');return;}
 const job=jobs.find(j=>j.id===id);if(!job||job.organizationId)return;
 const profile=graduateProfile(),record=applicationRecord(id),existing=record&&!reapply;
 if(!profile.name||!profile.email){workspaceSession.setItem('proof-application-return',id);profileStep=0;location.hash='profile';toast('Add your name and email to apply as yourself');return;}
 if(reapply&&record?.status!=='withdrawn')return;
 const person=existing?record.profile:profile,file=typeof savedResumeFile==='function'?savedResumeFile():null,resume=marketplaceResume();
 $('#modal').hidden=false;
 $('#modal').innerHTML=`<div class="dialog application-dialog" role="dialog" aria-modal="true" aria-labelledby="application-title"><button class="close" onclick="closeModal()" aria-label="Close">×</button><div class="eyebrow">${existing?'YOUR APPLICATION':'APPLY WITH YOUR PROFILE'}</div><h2 id="application-title">${esc(job.title)}</h2><p>${esc(job.c)} · Sample listing</p><div class="applicant-card"><span class="avatar">${profileInitials(person.name)}</span><div><h3>${esc(person.name)}</h3><p>${esc(person.email)}<br>${esc(person.role||'Graduate applicant')} · ${esc(person.education||'')}</p></div></div><div class="application-facts">${[['Availability',person.availability],['Location',person.location],['Skills',person.skills],['Portfolio',person.portfolio]].filter(x=>x[1]).map(([k,v])=>`<div><small>${k}</small><span>${esc(v)}</span></div>`).join('')}</div>${existing?`<p>${statusPill(record.status==='withdrawn'?'withdrawn':'submitted')} · ${esc(friendlyDate(record.createdAt))}</p><h3>Your introduction</h3><p class="sample-application-introduction">${esc(record.introduction||'')}</p>${record.resumeFile?'<div id="sample-application-resume" class="resume-document-view"></div>':record.resume?'<p class="resume-hint">Your submitted resume text is attached.</p>':'<p class="resume-hint">No resume was attached.</p>'}<div class="dialog-actions">${record.status==='withdrawn'?`<button class="primary" onclick="applySampleListing(${id},true)">Reapply</button>`:`<button class="outline" onclick="withdrawSampleApplication(${id})">Withdraw application</button>`}<button class="outline" onclick="closeModal();workTab='applications';location.hash='projects'">My work</button></div>`:`<form id="application"><label class="field">Your introduction<textarea id="application-intro" required minlength="30" maxlength="3000" placeholder="Explain what you can contribute to this project.">${esc(reapply?record.introduction:profile.bio||'')}</textarea></label><label class="consent"><input type="checkbox" id="attach-resume" ${resume?'checked':'disabled'}> Include matching resume text ${resume?'':'(none saved)'}</label><label class="consent"><input type="checkbox" id="attach-sample-file" ${file?.path?'checked':'disabled'}> Attach original resume document ${file?.path?`<small>${esc(file.name)}</small>`:'(upload one in My resume)'}</label><p class="resume-hint">Your profile is included automatically. This sample application stays in your account and is not sent to an external employer.</p><label class="consent"><input type="checkbox" required> I have reviewed my details and want to submit this sample application.</label><p id="sample-application-error" role="alert" class="review-error"></p><div class="dialog-actions"><button class="primary" type="submit">${reapply?'Resubmit':'Submit'} application ${icon('arrow',15)}</button><button type="button" class="outline" onclick="closeModal()">Cancel</button></div></form>`}</div>`;
 $('#modal').querySelector('.close').focus();
 if(existing){if(record.resumeFile&&typeof ResumeDocuments!=='undefined')ResumeDocuments.paint('sample-application-resume','account-resumes',record.resumeFile);return;}
 const actor=typeof Account==='undefined'?null:Account.user?.id,epoch=typeof Account==='undefined'?null:Account.sessionEpoch;
 const current=()=>actor===(typeof Account==='undefined'?null:Account.user?.id)&&epoch===(typeof Account==='undefined'?null:Account.sessionEpoch);
 $('#application').onsubmit=async event=>{
  event.preventDefault();if(sampleApplicationBusy)return;
  const button=event.submitter||$('#application').querySelector('button.primary'),error=$('#sample-application-error');
  const intro=$('#application-intro').value.trim();if(intro.length<30){error.textContent='Add at least 30 characters about your contribution.';return;}
  const records=sampleApplicationRows().map(({isSample,id,created_at,...r})=>r),position=records.findIndex(r=>r.jobId===id);
  if(position>=0&&!reapply){applySampleListing(id);return;}
  if(position<0&&records.length>=100){error.textContent='Your account can hold up to 100 sample applications.';return;}
  const withText=$('#attach-resume').checked,withFile=$('#attach-sample-file').checked&&file?.path;
  sampleApplicationBusy=true;if(button)button.disabled=true;error.textContent='';let staged=null,writeAttempted=false;
  const previousRaw=workspaceLocal.getItem('proof-applications')||'[]',previousApplications=[...applications];
  try{
   if(!current())return;
   if(withFile){
    const client=Account.client,type=ResumeDocuments.type(file),ext=file.name.split('.').pop().toLowerCase();
    const download=await client.storage.from('account-resumes').download(file.path);if(download.error)throw Error('Your resume could not be attached. Try again, or uncheck the document.');if(!current())return;
    const path=actor+'/'+crypto.randomUUID()+'.'+ext,result=await client.storage.from('account-resumes').upload(path,download.data,{contentType:type,upsert:false});if(result.error)throw Error('Your resume copy could not be saved. Try again.');
    staged={path,name:file.name,type,size:file.size||download.data.size};if(!current()){await client.storage.from('account-resumes').remove([path]);return;}
   }
   const snapshot={jobId:id,listing:{title:job.title,company:job.c},profile:JSON.parse(JSON.stringify(profile)),introduction:intro,resume:withText?resume:'',resumeFile:staged,createdAt:new Date().toISOString(),status:'submitted',source:'sample',attempt:(record?.attempt||0)+1};
   if(position>=0)records[position]=snapshot;else records.push(snapshot);
   const encoded=JSON.stringify(records);if(new TextEncoder().encode(encoded).length>4000000)throw Error('Your saved applications exceed the account limit. Shorten the introduction or omit resume text.');
   writeAttempted=true;workspaceLocal.setItem('proof-applications',encoded);applications=records.map(r=>r.jobId);workspaceLocal.setItem('lp-apps',JSON.stringify(applications));
   if(typeof saveWorkspace==='function')await saveWorkspace();if(!current())return;
   if(record?.resumeFile?.path)await Account.client.storage.from('account-resumes').remove([record.resumeFile.path]).catch(()=>{});
   closeModal();if(typeof Organization!=='undefined')Organization.mineFilter='all';workTab='applications';location.hash='projects';render();toast('Application submitted. Track it in My work.');
  }catch(e){if(current()){if(writeAttempted&&(typeof Backend==='undefined'||Backend.ready)){workspaceLocal.setItem('proof-applications',previousRaw);applications=previousApplications;workspaceLocal.setItem('lp-apps',JSON.stringify(applications));}if(error.isConnected!==false)error.textContent=e.message||'Your application could not be saved. Please try again.';}}
  finally{if(staged&&!writeAttempted&&current())await Account.client.storage.from('account-resumes').remove([staged.path]).catch(()=>{});sampleApplicationBusy=false;if(button)button.disabled=false;/* An uncertain save may have committed; retain its private file until account cleanup. */}
 };
}
async function withdrawSampleApplication(id){
 if(sampleApplicationBusy)return;
 const actor=typeof Account==='undefined'?null:Account.user?.id,epoch=typeof Account==='undefined'?null:Account.sessionEpoch;
 const records=sampleApplicationRows().map(({isSample,id,created_at,...r})=>r),record=records.find(r=>r.jobId===id);if(!record||record.status==='withdrawn')return;
 record.status='withdrawn';record.withdrawnAt=new Date().toISOString();workspaceLocal.setItem('proof-applications',JSON.stringify(records));
 try{if(typeof saveWorkspace==='function')await saveWorkspace();}catch{return;}
 if(actor!==(typeof Account==='undefined'?null:Account.user?.id)||epoch!==(typeof Account==='undefined'?null:Account.sessionEpoch))return;
 closeModal();if(typeof Organization!=='undefined')Organization.mineFilter='all';workTab='applications';location.hash='projects';render();toast('Application withdrawn');
}
