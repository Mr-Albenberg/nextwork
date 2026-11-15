const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const values=new Map();
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
const status={textContent:''};
let uploads=[],deletes=[],saves=0,failUpload=false;
const bucket={upload:async(path,file)=>{if(failUpload)return {error:Error('offline')};uploads.push(path);return {};},remove:async paths=>{deletes.push(...paths);return {};}};
const ctx={URL,workspaceSession:storage,workspaceLocal:storage,crypto:webcrypto,Account:{user:{id:'alice'},sessionEpoch:1,client:{storage:{from:name=>{assert.equal(name,'account-resumes');return bucket;}}}},ResumeEngine:require('../dist/resume-engine'),graduateProfile:()=>JSON.parse(storage.getItem('proof-profile')||'{}'),saveWorkspace:async()=>{saves++},render(){},sort:'',document:{querySelectorAll:()=>[]},$:s=>s==='#file-status'?status:null};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('dist/resume.js','utf8'),ctx);
const text='Alex Johnson\nFrontend Developer\nSUMMARY\nI build accessible web applications for community teams using React and JavaScript.\nEXPERIENCE\nBuilt a dashboard for forty volunteers.';
(async()=>{
const fields=vm.runInContext('resumeProfileFields('+JSON.stringify(text)+')',ctx);
assert.equal(fields.tagline,'Frontend Developer');assert(fields.bio.includes('accessible'));assert(!fields.bio.includes('dashboard'));
const complete=`Alex Johnson
Frontend Developer
alex@example.com | Seattle, WA | https://github.com/alex
SUMMARY: I build accessible applications for community teams.
EDUCATION
University of Washington
Bachelor of Science in Computer Science
Expected graduation: June 2027
SKILLS: React, JavaScript, SQL
Availability: 10-20 hours per week
Work style: Remote
Seeking: Full-time and contract
EXPERIENCE
Frontend Developer, Example Inc. 2021-2024`;
const extracted=vm.runInContext('resumeProfileFields('+JSON.stringify(complete)+')',ctx);
for(const [key,value] of Object.entries({name:'Alex Johnson',email:'alex@example.com',location:'Seattle, WA',portfolio:'https://github.com/alex',education:'University of Washington',degree:'Bachelor of Science in Computer Science',graduation:'2027',role:'Frontend Developer',field:'Development',availability:'10–20 hours',workstyle:'Remote',engagement:'Both projects and full-time'}))assert.equal(extracted[key],value,key);
assert(extracted.skills.includes('React'));assert(extracted.bio.startsWith('I build'));
const sparse=vm.runInContext('resumeProfileFields("EDUCATION\\nExample University 2021\\nEXPERIENCE\\nRemote software work 2024")',ctx);
assert.equal(sparse.name,undefined);assert.equal(sparse.graduation,undefined);assert.equal(sparse.workstyle,undefined);assert.equal(sparse.availability,undefined);
storage.setItem('proof-profile',JSON.stringify({name:'Manual Name',email:'manual@example.com',education:'Manual University',skills:'Python',workstyle:'Hybrid',tagline:'Manual headline'}));
vm.runInContext('fillResumeProfile('+JSON.stringify(complete)+')',ctx);
const filled=JSON.parse(storage.getItem('proof-profile'));
assert.equal(filled.name,'Manual Name');assert.equal(filled.email,'manual@example.com');assert.equal(filled.education,'Manual University');assert.equal(filled.skills,'Python');assert.equal(filled.workstyle,'Hybrid');assert.equal(filled.graduation,'2027');
storage.removeItem('proof-profile');
ctx.file={name:'resume.txt' ,size:text.length,text:async()=>text};
await vm.runInContext('readResumeFile(file)',ctx);
assert.equal(uploads.length,1);assert(uploads[0].startsWith('alice/'));assert.equal(storage.getItem('proof-resume'),text);assert(JSON.parse(storage.getItem('proof-resume-report')).metrics.length);assert.equal(JSON.parse(storage.getItem('proof-profile')).tagline,'Frontend Developer');assert.equal(saves,1);
storage.setItem('proof-profile',JSON.stringify({tagline:'My manual headline',bio:'My manual description'}));
await vm.runInContext('readResumeFile(file)',ctx);
assert.equal(JSON.parse(storage.getItem('proof-profile')).tagline,'My manual headline');assert.equal(JSON.parse(storage.getItem('proof-profile')).bio,'My manual description');assert.equal(deletes[0],uploads[0]);
const previous=storage.getItem('proof-resume-file');failUpload=true;
await vm.runInContext('readResumeFile(file)',ctx);
assert.equal(storage.getItem('proof-resume-file'),previous);assert(status.textContent.includes('Could not store'));
ctx.file={name:'scan.txt',size:10,text:async()=> 'too short'};
await vm.runInContext('readResumeFile(file)',ctx);assert.equal(uploads.length,2);
console.log('Resume upload, account save, automatic review, profile precedence, replacement and failure checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
