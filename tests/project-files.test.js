const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
let records=[{id:'project-test',status:'active',files:[]}],objects=new Map(),fail=false,swap=false,saved=0,toasts=[];
const bucket={upload:async(path,file)=>{if(fail)return {error:Error('offline')};objects.set(path,file);if(swap)c.Account.user={id:'bob'};return {};},remove:async paths=>{paths.forEach(p=>objects.delete(p));return {};},download:async path=>({data:objects.get(path)}),list:async prefix=>({data:[...objects.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>({id:'id',name:p.slice(prefix.length+1)}))})};
const c={Account:{user:{id:'alice'},sessionEpoch:1,client:{storage:{from:n=>{assert.equal(n,'project-files');return bucket;}}}},crypto:webcrypto,recoSavedIdeas:()=>JSON.parse(JSON.stringify(records)),storeTrackedIdeas:list=>{records=list},saveWorkspace:async()=>saved++,render(){},toast:s=>toasts.push(s),document:{getElementById:()=>null},esc:s=>String(s).replace(/[<>&"']/g,x=>'&#'+x.charCodeAt(0)+';'),icon:()=>'',setTimeout,URL};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/project-files.js','utf8')+'\nglobalThis.PF=ProjectFiles;',c);
const file=(name,content)=>{const b=new Blob([content]);return {name,size:b.size,slice:(a,z)=>b.slice(a,z)}};
(async()=>{
 await c.PF.upload('project-test',[file('notes.txt','A real project deliverable')]);assert.equal(records[0].files.length,1);assert.equal(objects.size,1);assert.equal(saved,1);assert(records[0].files[0].path.startsWith('alice/project-test/'));assert(!JSON.stringify(records).includes('A real project deliverable'));
 const retained=records[0].files[0].id;
 await c.PF.upload('project-test',[file('bad.pdf','fake content')]);assert.equal(objects.size,1);assert(toasts.at(-1).includes('extension'));
 await c.PF.upload('project-test',[file('script.html','<script>bad</script>')]);assert.equal(objects.size,1);
 fail=true;await c.PF.upload('project-test',[file('notes.txt','other')]);assert.equal(records[0].files.length,1);fail=false;
 swap=true;await c.PF.upload('project-test',[file('notes.txt','private')]);assert.equal(objects.size,1,'Account switch rolls back staged objects');assert.equal(records[0].files.length,1);swap=false;c.Account.user={id:'alice'};
 await c.PF.remove('project-test',retained);assert.equal(objects.size,0);assert.equal(records[0].files.length,0);
 await c.PF.upload('project-test',[file('<img onerror=alert(1)>.txt','safe text')]);assert(c.PF.html(records[0]).includes('&#60;img'));assert(!c.PF.html(records[0]).includes('<img onerror'));
 assert.equal(c.PF.validPath('bob/project-test/file.txt','alice','project-test'),false);assert.equal(c.PF.validPath('alice/project-test/../file.txt','alice','project-test'),false);
 await c.PF.cleanup('project-test');assert.equal(objects.size,0);
 console.log('Project files: validation, persistence, failure recovery, account-switch rollback, removal, cleanup, escaped filenames and private paths passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
