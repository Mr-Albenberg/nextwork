const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {setup,login,users,resumeObjects}=require('./account-browser.cjs');
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
function pdf(text){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const stream='BT /F1 18 Tf 50 740 Td ('+text+') Tj ET';objects.push('<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream');let out='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(out);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const {page,errors,context}=await setup(browser);await page.setViewportSize({width:1366,height:900});await page.goto(base+'/#login');await login(page,'alice@example.com');await page.goto(base+'/#profile');
  const original=pdf('Alice - Original Resume'),replacement=pdf('Alice - Updated Resume');
  // A scanned PDF is a valid original document even when no matching text can be extracted.
  await page.evaluate(()=>{parseResumeFile=async()=>{throw Error('Scanned PDF needs OCR.');};});
  await page.getByLabel('Upload your resume',{exact:true}).setInputFiles({name:'alice-original.pdf',mimeType:'application/pdf',buffer:original});
  await page.locator('#profile-resume-document canvas').waitFor();await page.waitForFunction(()=>!resumeUploadBusy&&Backend.pending.size===0&&!Backend.saving);
  assert.equal(await page.locator('#profile-resume textarea').count(),0,'Profile must show the document instead of an editable text field');
  assert.equal(await page.evaluate(()=>savedResumeFile().extractionStatus),'unavailable');assert.equal(await page.evaluate(()=>marketplaceResume()),'');
  const downloadEvent=page.waitForEvent('download');await page.locator('#profile-resume-document').getByRole('link',{name:'Download',exact:true}).click();const downloaded=await downloadEvent;assert.deepEqual(fs.readFileSync(await downloaded.path()),original,'Downloaded bytes must equal the uploaded PDF');
  await page.reload();await page.locator('#profile-resume-document canvas').waitFor();
  const shareId='a0000000-0000-0000-0000-000000000001';let shared;
  await context.route('https://zkoqafidgromlbvczwzy.supabase.co/rest/v1/rpc/attach_application_resume',async route=>{shared=route.request().postDataJSON().file;await route.fulfill({contentType:'application/json',body:'null'});});
  assert(await page.evaluate(id=>shareResumeFile(id,null),shareId));assert(shared);assert.deepEqual(resumeObjects.get('application-resumes:'+shared.path),original);
  await page.evaluate(()=>{parseResumeFile=async()=>{throw Error('Scanned PDF needs OCR.');};});
  await page.getByLabel('Upload your resume',{exact:true}).setInputFiles({name:'alice-updated.pdf',mimeType:'application/pdf',buffer:replacement});await page.locator('#profile-resume-document .resume-document-toolbar').filter({hasText:'alice-updated.pdf'}).waitFor();
  assert.deepEqual(resumeObjects.get('application-resumes:'+shared.path),original,'Replacing a profile document must not change an already shared application copy');
  // The organization portal uses that same original-file viewer and snapshot path.
  await page.evaluate(async({file,id})=>{Organization.applications=[{id,resume_file:file}];document.getElementById('app').innerHTML='<div id="applicant-resume-file"></div>';await paintApplicationResume(id);},{file:shared,id:shareId});
  await page.locator('#applicant-resume-file canvas').waitFor();const orgDownload=page.waitForEvent('download');await page.locator('#applicant-resume-file').getByRole('link',{name:'Download',exact:true}).click();assert.deepEqual(fs.readFileSync(await(await orgDownload).path()),original);
  await page.goto(base+'/#profile');await page.reload();await page.locator('#profile-resume-document canvas').waitFor();await page.screenshot({path:'test-artifacts/profile-resume-document.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-artifacts/profile-resume-document-mobile.png',fullPage:true});
  // Word HTML is a sandboxed reading view; strip script, image requests, event handlers and unsafe links.
  const sanitized=await page.evaluate(()=>ResumeDocuments.safeWordHTML('<p onclick="alert(1)"><strong>Resume</strong><script>alert(1)</script><img src="https://example.com/track"><a href="javascript:alert(1)">bad</a></p>'));assert(!/script|onclick|<img|javascript:/i.test(sanitized));assert(sanitized.includes('<strong>Resume</strong>'));
  const docx=Buffer.from(await page.evaluate(()=>Array.from(createResumeDocx('Alice Word Resume\nEXPERIENCE\nBuilt a React dashboard for a community club and documented the handoff. Implemented accessible forms and tested them with volunteers.\nEDUCATION\nExample University'))));
  await page.getByLabel('Upload your resume',{exact:true}).setInputFiles({name:'alice-word.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docx});
  await page.frameLocator('#profile-resume-document iframe').getByText('Alice Word Resume',{exact:true}).waitFor();
  assert.equal(await page.locator('#profile-resume-document iframe').getAttribute('sandbox'),'');
  assert.equal(await page.evaluate(()=>savedResumeFile().extractionStatus),'ready');
  const wordDownload=page.waitForEvent('download');await page.locator('#profile-resume-document').getByRole('link',{name:'Download',exact:true}).click();assert.deepEqual(fs.readFileSync(await(await wordDownload).path()),docx);
  assert.equal(errors.length,0,errors.join('\n'));console.log('Resume document browser checks: original PDF preview, reload, byte-identical download, scanned upload, application snapshot, shared viewer, mobile fit and Word sanitization passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
