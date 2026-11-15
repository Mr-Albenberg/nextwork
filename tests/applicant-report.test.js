const assert=require('assert'),fs=require('fs'),vm=require('vm');
const ctx={document:{},Account:{},Organization:{},organizationUser(){}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('dist/applicant-report.js','utf8')+';this.AR=ApplicantReport',ctx);
const AR=ctx.AR;
const app={id:'a1',status:'accepted',created_at:'2026-11-10T14:00:00Z',updated_at:'2026-11-10T14:00:00Z',introduction:'I build <b>things</b> & ship them.',resume:'Jane <script>alert(1)</script> Doe\nEXPERIENCE',organization_listings:{title:'Frontend "Dev"'},profile:{name:'Jane <img src=x onerror=alert(1)>',email:'jane@example.com',role:'Engineer',skills:'React, SQL',photo:'data:image/png;base64,AAAA',location:'Austin',customNotes:'Line one\nLine two'}};
const html=AR.html(app,{title:'Frontend Dev',kind:'Contract project',budget:6000,skills:['React']},{name:'Acme <Labs>'},[{sender_id:'org',body:'Hello <i>there</i>',created_at:'2026-11-11T10:00:00Z'}],'org');
// Applicant-controlled text is escaped everywhere
assert(!html.includes('<script>alert(1)</script>'),'script tag leaked');
assert(!html.includes('<img src=x'),'profile name not escaped');
assert(!html.includes('<b>things</b>'),'introduction not escaped');
assert(!html.includes('Acme <Labs>'),'org name not escaped');
assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
// Content is present
for(const t of ['jane@example.com','Engineer','Austin','React','SQL','EXPERIENCE','Contract project','Hello','Position applied for','Introduction','Resume'])assert(html.includes(t),'missing '+t);
assert(html.includes('Custom Notes'),'long-form extra field should be labelled');
assert(!html.includes('data:image/png'),'photo data URL must not be printed');
assert(html.includes('class="status accepted"'));
// Empty cases
const bare=AR.html({...app,resume:'',profile:{name:'Sam'}},null,null,[],'org');
assert(bare.includes('No resume attached.')&&!bare.includes('Conversation with applicant'));
assert.strictEqual(AR.fileName({profile:{name:'Jane  O\'Neil!'}}),'nextwork-application-jane-o-neil');
assert.strictEqual(AR.fileName({profile:{}}),'nextwork-application-applicant');
console.log('applicant report tests passed');
