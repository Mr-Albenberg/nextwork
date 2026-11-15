// Private original-document previews shared by profiles and organization applications.
const ResumeDocuments = {
  entries: new Map(), generation: 0, mammothPromise: null, pdfPromise: null, pdfTasks: new Set(),
  actor(){return {id:Account.user?.id,epoch:Account.sessionEpoch,generation:this.generation};},
  current(a){return Boolean(a.id&&Account.user?.id===a.id&&Account.sessionEpoch===a.epoch&&this.generation===a.generation);},
  stopPreviews(){for(const task of this.pdfTasks)task.destroy().catch(()=>{});this.pdfTasks.clear();},
  reset(){this.stopPreviews();this.generation++;for(const entry of this.entries.values())if(entry.url)URL.revokeObjectURL(entry.url);this.entries.clear();},
  type(file){return {pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'}[String(file.name||'').split('.').pop().toLowerCase()]||'';},
  async validate(file){
    if(!file.size||file.size>5*1024*1024)throw Error('Choose a file between 1 byte and 5 MB.');
    const type=this.type(file);if(!type)throw Error('Choose a PDF, DOCX, or TXT file.');
    const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
    if(type==='application/pdf'&&![37,80,68,70,45].every((n,i)=>bytes[i]===n))throw Error('This file does not appear to be a PDF.');
    if(type.includes('wordprocessingml')&&!(bytes[0]===80&&bytes[1]===75))throw Error('This file does not appear to be a DOCX document.');
    return type;
  },
  async mammoth(){
    if(window.mammoth)return window.mammoth;
    if(!this.mammothPromise)this.mammothPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='vendor/mammoth-1.9.0.js';s.onload=()=>resolve(window.mammoth);s.onerror=()=>{s.remove();this.mammothPromise=null;reject(Error('Word preview is unavailable. You can still download the original file.'));};document.head.appendChild(s);});
    return this.mammothPromise;
  },
  async pdf(){
    if(!this.pdfPromise)this.pdfPromise=import('./vendor/pdf-4.10.38.min.mjs').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL('vendor/pdf.worker-4.10.38.min.mjs',document.baseURI).href;return pdf;}).catch(error=>{this.pdfPromise=null;throw error;});
    return this.pdfPromise;
  },
  async paintPDF(content,blob,current){
    const pdfjs=await this.pdf();if(!current())return;
    const task=pdfjs.getDocument({data:await blob.arrayBuffer(),isEvalSupported:false});this.pdfTasks.add(task);
    const doc=await task.promise;if(!current()){await task.destroy();this.pdfTasks.delete(task);return;}
    let number=1;const maximum=Math.min(20,doc.numPages);
    content.innerHTML='<div class="resume-pdf-navigation"><button type="button" class="outline" aria-label="Previous resume page">Previous</button><span role="status"></span><button type="button" class="outline" aria-label="Next resume page">Next</button></div><div class="resume-pdf-page"></div>';
    const [previous,next]=content.querySelectorAll('button'),label=content.querySelector('[role="status"]'),pageNode=content.querySelector('.resume-pdf-page');
    const draw=async()=>{
      if(!current())return;previous.disabled=true;next.disabled=true;label.textContent='Loading page '+number+'…';
      try{
        const page=await doc.getPage(number);if(!current())return;
        const viewport=page.getViewport({scale:1}),width=Math.max(240,content.clientWidth-32),ratio=Math.min(2,window.devicePixelRatio||1),scale=Math.min(2,width/viewport.width)*ratio;
        const rendered=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(rendered.width);canvas.height=Math.ceil(rendered.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Original resume, page '+number+' of '+doc.numPages);canvas.style.maxWidth='100%';
        await page.render({canvasContext:canvas.getContext('2d'),viewport:rendered}).promise;
        if(!current())return;pageNode.replaceChildren(canvas);label.textContent='Page '+number+' of '+doc.numPages+(doc.numPages>20?' · first 20 pages available here':'');
      }catch{if(current())pageNode.innerHTML='<p class="notice">This page could not be rendered. Use Open original to view the saved PDF.</p>';}
      finally{if(current()){previous.disabled=number<=1;next.disabled=number>=maximum;}}
    };
    previous.onclick=()=>{if(number>1){number--;draw();}};next.onclick=()=>{if(number<maximum){number++;draw();}};await draw();
  },
  async get(bucket,file){
    const actor=this.actor();if(!actor.id||!file?.path)return null;
    const key=actor.id+':'+actor.epoch+':'+bucket+':'+file.path;
    if(this.entries.has(key))return this.entries.get(key).promise;
    const entry={url:null,promise:null};
    entry.promise=(async()=>{const result=await Account.client.storage.from(bucket).download(file.path);if(!this.current(actor)||this.entries.get(key)!==entry)return null;if(result.error)throw result.error;const type=this.type(file);if(!type)throw Error('Unsupported document type.');const blob=new Blob([result.data],{type});entry.url=URL.createObjectURL(blob);return {url:entry.url,blob,type};})();
    if(this.entries.size>=6){const oldest=this.entries.keys().next().value,prior=this.entries.get(oldest);if(prior.url)URL.revokeObjectURL(prior.url);this.entries.delete(oldest);}
    this.entries.set(key,entry);
    try{return await entry.promise;}catch(e){this.entries.delete(key);throw e;}
  },
  safeWordHTML(html){
    const doc=new DOMParser().parseFromString(html,'text/html'),allowed=new Set(['P','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','U','S','BR','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','BLOCKQUOTE','A','SUP','SUB']);
    for(const node of [...doc.body.querySelectorAll('*')]){
      if(!allowed.has(node.tagName)){if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG','MATH'].includes(node.tagName))node.remove();else node.replaceWith(...node.childNodes);continue;}
      const href=node.tagName==='A'?node.getAttribute('href'):null;
      for(const attr of [...node.attributes])node.removeAttribute(attr.name);
      if(href&&/^https?:\/\//i.test(href)){node.setAttribute('href',href);node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}
    }
    return doc.body.innerHTML;
  },
  async paint(nodeId,bucket,file){
    const node=document.getElementById(nodeId),actor=this.actor();if(!node||!actor.id||!file?.path)return;
    node.innerHTML=inlineLoading('Loading your resume document…');
    const current=()=>this.current(actor)&&document.getElementById(nodeId)===node;
    try{
      const documentFile=await this.get(bucket,file);if(!current()||!documentFile)return;
      const {url,blob,type}=documentFile;
      node.innerHTML=`<div class="resume-document-toolbar"><span>${esc(file.name)} <small>· ${Math.ceil((file.size||blob.size)/1024)} KB</small></span><div><a class="outline" href="${url}" target="_blank" rel="noopener">Open original</a><a class="outline" href="${url}" download="${esc(file.name)}">Download</a></div></div><div class="resume-document-content"></div>`;
      const content=node.querySelector('.resume-document-content');
      if(type==='application/pdf'){try{await this.paintPDF(content,blob,current);}catch{if(current())content.innerHTML='<p class="notice">This PDF cannot be previewed here. Use Open original to view the saved document.</p>';}return;}
      if(type==='text/plain'){const pre=document.createElement('pre');pre.className='resume-document-text';pre.textContent=await blob.text();if(current())content.appendChild(pre);return;}
      content.innerHTML=inlineLoading('Preparing Word document preview…');
      try{
        const mammoth=await this.mammoth();if(!current())return;
        const converted=await mammoth.convertToHtml({arrayBuffer:await blob.arrayBuffer()},{convertImage:mammoth.images.imgElement(async()=>({src:''}))});
        if(!current())return;
        const frame=document.createElement('iframe');frame.className='resume-frame original-resume-frame';frame.title=file.name+' — Word reading preview';frame.setAttribute('sandbox','');
        frame.srcdoc='<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font:15px/1.65 Arial,sans-serif;color:#182438;background:white;max-width:760px;margin:0 auto;padding:36px}h1,h2,h3{line-height:1.25}table{border-collapse:collapse;width:100%}td,th{padding:6px;border:1px solid #ddd}a{color:#2453d7}p{overflow-wrap:anywhere}</style></head><body>'+this.safeWordHTML(converted.value)+'</body></html>';
        content.replaceChildren(frame);const hint=document.createElement('p');hint.className='resume-hint';hint.textContent='Word reading preview. Formatting may differ; download the original for the full document.';content.appendChild(hint);
      }catch{if(current())content.innerHTML='<p class="notice">Word preview is unavailable. Use Open original or Download to view the saved document.</p>';}
    }catch{
      if(!current())return;node.innerHTML='<div class="notice" role="alert">The document could not be loaded. Your saved file has not been changed. <button type="button" class="outline">Retry</button></div>';node.querySelector('button').onclick=()=>this.paint(nodeId,bucket,file);
    }
  },
  paintProfile(){const file=savedResumeFile();if(file)this.paint('profile-resume-document','account-resumes',file);},
  paintReview(){const file=savedResumeFile();if(file)this.paint('review-resume-document','account-resumes',file);}
};
