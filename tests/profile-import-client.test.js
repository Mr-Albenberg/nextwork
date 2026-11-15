const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let profile={name:'Manual Name',education:'Old University'},saved=0,resume='A saved resume with enough supported information.',release;
const ctx={Account:{user:{id:'alice'},sessionEpoch:1},workspaceSession:{getItem:()=>resume},graduateProfile:()=>({...profile}),document:{querySelector:()=>null},requireAccount:()=>true,workspaceLocal:{setItem:(key,value)=>{assert.equal(key,'proof-profile');profile=JSON.parse(value)}},saveWorkspace:async()=>{saved++},render(){},toast(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/profile-import.js','utf8'),ctx);
vm.runInContext("profileImportCurrent();ProfileImport.suggestions=[{field:'education',value:'New University',evidence:'New University'},{field:'bio',value:'I build accessible web tools.',evidence:'accessible web tools'}];ProfileImport.preview={education:'Old University',bio:''}",ctx);
assert.equal(saved,0);assert.equal(profile.bio,undefined);
(async()=>{
 await vm.runInContext("applyProfileImport('missing')",ctx);assert.equal(profile.education,'Old University');assert.equal(profile.bio,'I build accessible web tools.');assert.equal(saved,1);
 vm.runInContext("ProfileImport.preview={education:'Old University',bio:'I build accessible web tools.'}",ctx);
 profile.education='Edited since preview';await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(saved,1,'Stale preview must not overwrite new manual edits');
 vm.runInContext("ProfileImport.preview={education:'Edited since preview',bio:'I build accessible web tools.'}",ctx);
 await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(profile.education,'New University');assert.equal(profile.name,'Manual Name');assert.equal(saved,2);
 ctx.Account.user={id:'bob'};await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(saved,2,'Another account cannot apply old suggestions');
 console.log('Profile draft application: no autosave, fill blanks, update differences, manual-edit and owner guards passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
