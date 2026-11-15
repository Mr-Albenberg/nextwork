const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let profile={name:'Manual Name',education:'Old University'},saved=0,resume='A saved resume with enough supported information.',closed=0;
const ctx={Account:{user:{id:'alice'},sessionEpoch:1},workspaceSession:{getItem:()=>resume},graduateProfile:()=>({...profile}),document:{querySelector:()=>null},requireAccount:()=>true,workspaceLocal:{setItem:(key,value)=>{assert.equal(key,'proof-profile');profile=JSON.parse(value)}},saveWorkspace:async()=>{saved++},render(){},toast(){},closeModal(){closed++}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/profile-import.js','utf8'),ctx);
const seed=()=>vm.runInContext("profileImportCurrent();ProfileImport.suggestions=[{field:'education',value:'New University',evidence:'New University'},{field:'bio',value:'I build accessible web tools.',evidence:'accessible web tools'}]",ctx);
seed();assert.equal(saved,0);assert.equal(profile.bio,undefined);
(async()=>{
 await vm.runInContext("applyProfileImport('missing')",ctx);assert.equal(profile.education,'Old University');assert.equal(profile.bio,'I build accessible web tools.');assert.equal(saved,1);assert.equal(closed,1);
 seed();profile.education='Edited since generation';
 await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(profile.education,'New University');assert.equal(profile.name,'Manual Name');assert.equal(saved,2,'Updating everything saves with one click even after a manual edit');
 seed();ctx.Account.user={id:'bob'};await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(saved,2,'Another account cannot apply old suggestions');
 ctx.Account.user={id:'alice'};seed();profile.education='Another University';let release;
 ctx.saveWorkspace=()=>{saved++;return new Promise(resolve=>release=resolve)};
 const pending=vm.runInContext("applyProfileImport('different')",ctx);
 await vm.runInContext("applyProfileImport('different')",ctx);assert.equal(saved,3,'Double clicks produce one save');release();await pending;
 console.log('Profile popup: fill blanks, one-click update, duplicate-click and owner guards passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
