// Project deliverables are private storage objects, never embedded in profiles.
const ProjectFiles = {
  bucket: 'project-files', limit: 10 * 1024 * 1024, busy: false,
  types: {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',zip:'application/zip'},
  actor(){return {id:Account.user?.id,epoch:Account.sessionEpoch};},
  current(a){return Boolean(a.id && Account.user?.id===a.id && Account.sessionEpoch===a.epoch);},
  record(id){return recoSavedIdeas().find(p=>p.id===id);},
  size(n){return n<1048576?Math.ceil(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';},
  validPath(path,owner,id){return typeof path==='string' && path.startsWith(owner+'/'+id+'/') && path.split('/').length===3 && !path.includes('..');},
  async validate(file){
    const ext=file.name.split('.').pop().toLowerCase(),mime=this.types[ext];
    if(!mime)throw Error('Choose a PDF, DOCX, TXT, PNG, JPG, WEBP, or ZIP file.');
    if(!file.size || file.size>this.limit)throw Error('Each file must be between 1 byte and 10 MB.');
    const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const starts=(s)=>s.every((v,i)=>b[i]===v);
    if((ext==='pdf'&&!starts([37,80,68,70,45])) || (['zip','docx'].includes(ext)&&!starts([80,75])) || (ext==='png'&&!starts([137,80,78,71,13,10,26,10])) || (['jpg','jpeg'].includes(ext)&&!starts([255,216,255])) || (ext==='webp'&&!(starts([82,73,70,70])&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80)))throw Error('The file contents do not match its extension.');
    return {ext,mime};
  },
  preserve(id){const p=this.record(id),form=document.getElementById('project-evidence');if(p&&form){const list=recoSavedIdeas(),item=list.find(x=>x.id===id);item.workUrl=form.elements.workUrl.value.slice(0,1000);item.outcome=form.elements.outcome.value.slice(0,2000);storeTrackedIdeas(list);}},
  html(p){
    const files=Array.isArray(p.files)?p.files:[],id=esc(p.id||'');
    return `<section class="project-files" aria-label="Project files"><div class="project-files-heading"><div><h3>Project files</h3><p>Keep deliverables, screenshots, and supporting documents together.</p></div><span>${files.length}/10 files</span></div><label class="project-upload-button outline">${icon('plus',17)} Add files<input type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip" ${this.busy?'disabled':''} onchange="ProjectFiles.upload('${id}',this.files);this.value=''" aria-label="Upload project files"></label><small class="project-file-hint">Private to your account · Up to 10 MB per file · PDF, DOCX, TXT, images, ZIP</small>${this.busy?'<div class="project-file-progress" role="status"><progress aria-label="Saving project files"></progress><span>Saving your files…</span></div>':''}<ul class="project-file-list">${files.map(f=>`<li><span class="project-file-symbol">${icon('resume',20)}</span><div><strong>${esc(f.name)}</strong><small>${this.size(f.size)} · ${esc(new Date(f.uploadedAt).toLocaleDateString())}</small></div><button type="button" class="outline" ${this.busy?'disabled':''} onclick="ProjectFiles.download('${id}','${esc(f.id)}')" aria-label="Download ${esc(f.name)}">Download</button><button type="button" class="text-control" ${this.busy?'disabled':''} onclick="ProjectFiles.remove('${id}','${esc(f.id)}')" aria-label="Remove ${esc(f.name)}">Remove</button></li>`).join('')}</ul>${!files.length?'<p class="project-files-empty">Your files will appear here when you upload them.</p>':''}</section>`;
  },
  async upload(id,selection){
    if(this.busy)return;const actor=this.actor(),p=this.record(id),files=Array.from(selection||[]);if(!actor.id||!p||!['active','completed'].includes(p.status)||!files.length)return;
    if((p.files||[]).length+files.length>10){toast('A project can hold up to 10 files.');return;}
    const storage=Account.client.storage.from(this.bucket);let staged=[];
    this.preserve(id);this.busy=true;render();
    try{
      // Validate the entire selection before uploading any objects.
      const checked=await Promise.all(files.map(f=>this.validate(f)));
      for(let i=0;i<files.length;i++){
        if(!this.current(actor)||!this.record(id))throw Error('Upload cancelled because the account or project changed.');
        const key=crypto.randomUUID(),path=actor.id+'/'+id+'/'+key+'.'+checked[i].ext;
        const result=await storage.upload(path,files[i],{contentType:checked[i].mime,upsert:false});if(result.error)throw Error('Upload failed. Please try again.');
        staged.push({id:key,path,name:files[i].name.slice(0,240),size:files[i].size,mime:checked[i].mime,uploadedAt:new Date().toISOString()});
      }
      if(!this.current(actor)||!this.record(id))throw Error('Upload cancelled because the account or project changed.');
      const list=recoSavedIdeas(),record=list.find(p=>p.id===id);record.files=[...(record.files||[]),...staged];storeTrackedIdeas(list);
      await saveWorkspace();staged=[];if(this.current(actor))toast('Project files uploaded');
    }catch(e){
      if(staged.length){await storage.remove(staged.map(f=>f.path));if(this.current(actor)){const list=recoSavedIdeas(),record=list.find(p=>p.id===id);if(record){record.files=(record.files||[]).filter(f=>!staged.some(s=>s.id===f.id));storeTrackedIdeas(list);}}}
      if(this.current(actor))toast(e.message||'Could not upload files. Please try again.');
    }finally{this.busy=false;if(this.current(actor))render();}
  },
  async download(id,fileId){const actor=this.actor(),f=this.record(id)?.files?.find(f=>f.id===fileId);if(!f||!this.validPath(f.path,actor.id,id))return;try{const result=await Account.client.storage.from(this.bucket).download(f.path);if(result.error)throw result.error;if(!this.current(actor))return;const url=URL.createObjectURL(result.data),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{if(this.current(actor))toast('Could not download this file. Please try again.');}},
  async remove(id,fileId){if(this.busy)return;const actor=this.actor(),f=this.record(id)?.files?.find(f=>f.id===fileId);if(!f||!this.validPath(f.path,actor.id,id))return;this.preserve(id);this.busy=true;render();try{const result=await Account.client.storage.from(this.bucket).remove([f.path]);if(result.error)throw result.error;if(!this.current(actor))return;const list=recoSavedIdeas(),p=list.find(p=>p.id===id);if(p){p.files=(p.files||[]).filter(f=>f.id!==fileId);storeTrackedIdeas(list);await saveWorkspace();}toast('File removed');}catch{if(this.current(actor))toast('Could not remove the file. Please try again.');}finally{this.busy=false;if(this.current(actor))render();}},
  async cleanup(id){const owner=Account.user?.id;if(!owner)return;const storage=Account.client.storage.from(this.bucket),prefix=id?owner+'/'+id:owner;const walk=async(path)=>{for(;;){const r=await storage.list(path,{limit:100});if(r.error)throw r.error;if(!r.data.length)return;const objects=r.data.filter(x=>x.id).map(x=>path+'/'+x.name);for(const folder of r.data.filter(x=>!x.id))await walk(path+'/'+folder.name);if(objects.length){const removed=await storage.remove(objects);if(removed.error)throw removed.error;}if(r.data.length<100)return;}};await walk(prefix);}
};
async function cleanupProjectUploads(){await ProjectFiles.cleanup();}
