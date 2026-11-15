const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let recipient,profile;
const context=vm.createContext({jobs:[],requireAccount:()=>true,openConversation:id=>recipient=id});
vm.runInContext(fs.readFileSync('dist/demo-listings.js','utf8'),context);
vm.runInContext(`jobs=Object.keys(DemoListingProfiles).map(Number).map(id=>({id,c:'Company '+id}));enrichDemoListings(jobs)`,context);
for(let id=1;id<=14;id++){
 vm.runInContext(`messageDemoCreator(${id})`,context);
 assert.equal(recipient,'5a000000-0000-4000-8000-'+String(id).padStart(12,'0'));
 profile=vm.runInContext(`sampleCreatorProfile('${recipient}')`,context);
 assert.equal(profile.id,id);
 assert.equal(profile.demoCreator.photo,`assets/people/creator-${id}.svg`);
}
context.requireAccount=()=>false;recipient=null;
vm.runInContext('messageDemoCreator(1)',context);assert.equal(recipient,null);
for(const file of ['demo-listings.js','messaging.js','chat-service.js','sample-creators-setup.sql'])assert.equal(fs.readFileSync('docs/'+file,'utf8'),fs.readFileSync('dist/'+file,'utf8'));
console.log('Sample creators: stable database routing, original portraits, login gate, and deployment copies passed.');
