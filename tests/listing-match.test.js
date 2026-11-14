const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements={};const element=s=>elements[s]||(elements[s]={querySelector(){return {textContent:'',focus(){}}},querySelectorAll(){return []},focus(){},setAttribute(){},value:'',style:{},innerHTML:'',textContent:'',hidden:true,classList:{add(){},remove(){},toggle(){}},scrollIntoView(){},insertAdjacentHTML(pos,html){this.innerHTML=html+this.innerHTML}});const data={};const storage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]};const ctx={document:{body:element('body'),getElementById:element,querySelector:element,querySelectorAll(){return []},addEventListener(){}},localStorage:storage,workspaceLocal:storage,workspaceSession:storage,sessionStorage:storage,location:{hash:'#explore',hostname:'mr-albenberg.github.io'},window:{addEventListener(){},scrollTo(){}},setTimeout(){},authPage(){return "Sign in"},FormData};vm.createContext(ctx);for(const f of ['extra-jobs.js','criteria.js','resume-engine.js','resume.js','profile.js','interface.js','messaging.js','flows.js','home.js','growth.js','skill-select.js','organization-access.js','organization.js','overview.js','app.js']){vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),ctx);if(f==='extra-jobs.js')ctx.ExtraJobs=ctx.window.ExtraJobs;if(f==='criteria.js')ctx.MatchCriteria=ctx.window.MatchCriteria;if(f==='resume-engine.js')ctx.ResumeEngine=ctx.window.ResumeEngine;}
assert(element('#jobs').innerHTML.includes('Check my fit'));assert(!element('#jobs').innerHTML.includes('% compatibility'));
data['proof-resume']='A graduate with projects using Python, SQL, and Data Analysis. Built reports and dashboards to understand customers and improve business decisions.';vm.runInContext('render()',ctx);assert(element('#jobs').innerHTML.includes('% resume compatibility'));assert.equal(vm.runInContext('filtered()[0].id',ctx),3);
data['proof-resume']='A graduate skilled in Figma, User Research and UI/UX Design. Designed and tested onboarding experiences and researched user needs in team projects.';vm.runInContext('render()',ctx);assert.equal(vm.runInContext('filtered()[0].id',ctx),1);
vm.runInContext("sort='pay';listings()",ctx);assert.equal(vm.runInContext('filtered()[0].id',ctx),11);
vm.runInContext("setMarketplaceResume('A graduate with experience in Python and SQL. Built data pipelines, analyzed customer behavior and prepared clear reports for project stakeholders.');listings()",ctx);assert.equal(vm.runInContext('sort',ctx),'match');assert.equal(vm.runInContext('filtered()[0].id',ctx),3);
assert(!element('#jobs').innerHTML.includes('% profile match'));
vm.runInContext('matchListing(2)',ctx);assert.equal(ctx.location.hash,'resume');ctx.location.hash='#resume';vm.runInContext('render()',ctx);
assert.equal(data['proof-selected-listing'],'2');assert(element('#review-job').value.includes('Build a carbon impact dashboard'));assert(element('#review-job').value.includes('React'));assert(element('#review-job').readOnly);assert(element('#app').innerHTML.includes('Choose an opportunity'));
element('#review-resume').value='My saved resume text';vm.runInContext('selectResumeListing(3)',ctx);assert.equal(data['proof-resume'],'My saved resume text');assert(element('#review-job').value.includes('Python'));assert(!element('#review-job').value.includes('carbon impact dashboard'));
vm.runInContext('selectResumeListing("")',ctx);assert.equal(data['proof-selected-listing'],undefined);assert(!element('#review-job').readOnly);assert.equal(element('#review-job').value,'');
vm.runInContext('matchListing(999)',ctx);assert.equal(data['proof-selected-listing'],undefined);
vm.runInContext("resumeReport={source:'local',score:60,summary:'Review',metrics:[],strengths:[],improvements:[],rewrites:[],listingId:2,match:{score:50,summary:'Match',matched:[],missing:[],requirements:[]}};render()",ctx);assert(element('#app').innerHTML.includes('View project & apply'));assert(element('#app').innerHTML.includes('apply(2)'));
console.log('Marketplace-to-resume selection, draft preservation, custom descriptions, and apply links passed.');

const applicant={name:'Jamie Lee',email:'jamie@example.com',education:'State University',role:'Frontend developer',skills:'React, JavaScript',portfolio:'https://example.com/jamie',field:'Development',availability:'20–30 hours',bio:'I build accessible interfaces with React.'};data['proof-profile']=JSON.stringify(applicant);data['proof-resume']='Jamie Lee built React and JavaScript interfaces, tested components, collaborated with a university team, and documented accessible design decisions.';assert.equal(vm.runInContext('jobs.length',ctx),14);

vm.runInContext('apply(7)',ctx);assert(element('#modal').innerHTML.includes('Jamie Lee'));assert(element('#modal').innerHTML.includes('jamie@example.com'));assert(element('#modal').innerHTML.includes('Save application'));element('#application-intro').value='I can contribute a responsive, tested booking flow based on my academic projects.';element('#attach-resume').checked=true;element('#application').onsubmit({preventDefault(){}});const snapshot=JSON.parse(data['proof-applications'])[0];assert.equal(snapshot.jobId,7);assert.equal(snapshot.profile.name,'Jamie Lee');assert(snapshot.resume.includes('Jamie Lee'));assert(snapshot.introduction.includes('booking'));vm.runInContext('apply(7)',ctx);assert(element('#modal').innerHTML.includes('YOUR SAVED APPLICATION'));const highlighted=vm.runInContext("highlightedResume('<script>alert(1)</script> React and Git',MatchCriteria.criteriaFor({id:2}))",ctx);assert(highlighted.includes('&lt;script&gt;'));assert(highlighted.includes('highlight-direct'));assert(highlighted.includes('highlight-support'));assert(!highlighted.includes('<script>'));console.log('Profile-backed application snapshots and safe resume highlighting passed.');

vm.runInContext("openConversation('peer-2')",ctx);ctx.location.hash='#messages';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('Leo Santos'));assert(element('#app').innerHTML.includes('View profile'));element('#conversation-input').value='Hello Leo, I would love to exchange portfolio feedback.';vm.runInContext('sendMessage()',ctx);let conversation=JSON.parse(data['proof-conversations'])['peer-2'];assert.equal(conversation.messages.at(-1).text,'Hello Leo, I would love to exchange portfolio feedback.');element('#conversation-input').value='';vm.runInContext('sendMessage(7)',ctx);conversation=JSON.parse(data['proof-conversations'])['peer-2'];assert.equal(conversation.messages.at(-1).projectId,7);vm.runInContext("toggleThread('saved')",ctx);assert(JSON.parse(data['proof-conversations'])['peer-2'].saved);vm.runInContext("toggleThread('archived')",ctx);assert(JSON.parse(data['proof-conversations'])['peer-2'].archived);vm.runInContext('messageCreator(7)',ctx);assert.equal(vm.runInContext('activePerson',ctx),'creator-7');vm.runInContext("showPersonProfile('peer-1')",ctx);assert(element('#modal').innerHTML.includes('Amara Okafor'));assert(element('#modal').innerHTML.includes('Figma'));console.log('People messaging, persisted threads, project sharing, saved/archive controls and profiles passed.');

ctx.location.hash='#home';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('Your next chapter'));assert(element('#app').innerHTML.includes('Free to join. Free to apply.'));assert(element('#app').innerHTML.includes('$9'));assert(element('#app').innerHTML.includes('No checkout or charge'));vm.runInContext('setPricing(true)',ctx);assert(element('#app').innerHTML.includes('$72 billed yearly'));assert(element('#app').innerHTML.includes('$6'));vm.runInContext('openPremiumPreview()',ctx);assert(element('#modal').innerHTML.includes('not subscribing'));ctx.location.hash='#tools';vm.runInContext('render()',ctx);element('#version-name').value='Frontend applications';element('#version-text').value=data['proof-resume'];element('#version-form').onsubmit({preventDefault(){}});assert.equal(JSON.parse(data['proof-resume-versions']).length,1);vm.runInContext('useResumeVersion(0)',ctx);assert.equal(ctx.location.hash,'resume');console.log('Public homepage, annual pricing, no-charge preview and resume version tools passed.');

ctx.location.hash='#pricing';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('Everything you use today stays free'));assert(element('#app').innerHTML.includes('employer-shared business emails'));ctx.location.hash='#tools';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('Included in Free'));assert(!element('#app').innerHTML.includes('Premium preview ·'));console.log('All existing tools remain Free; planned outreach and verification benefits are labeled.');

ctx.location.hash='#premium';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('Contacts & drafts'));assert(element('#app').innerHTML.includes('team@patchwork.example'));assert(element('#app').innerHTML.includes('not a deliverable inbox'));element('#outreach-subject').value='Booking flow introduction';element('#outreach-body').value='A focused introduction based on my project experience.';element('#outreach-date').value='2026-11-20';element('#outreach-form').onsubmit({preventDefault(){}});let growth=JSON.parse(data['nextwork-growth']);assert.equal(growth.outreach.length,1);assert.equal(growth.outreach[0].status,'Draft');assert.equal(vm.runInContext('growthTab',ctx),'tracker');const outreachId=growth.outreach[0].id;vm.runInContext("updateOutreach('"+outreachId+"','status','Replied')",ctx);assert.equal(JSON.parse(data['nextwork-growth']).outreach[0].status,'Replied');vm.runInContext("setGrowthTab('alerts')",ctx);element('#alert-name').value='React work';element('#alert-field').value='Development';element('#alert-query').value='React';element('#alert-form').onsubmit({preventDefault(){}});growth=JSON.parse(data['nextwork-growth']);assert.equal(growth.alerts.length,1);assert(vm.runInContext('alertMatches(growthState().alerts[0]).length',ctx)>0);vm.runInContext("setGrowthTab('verification');requestProfileReview()",ctx);assert.equal(JSON.parse(data['nextwork-growth']).review.status,'pending');assert(!JSON.parse(data['proof-profile']).verified);vm.runInContext('priorityPreview=true',ctx);assert(vm.runInContext('priorityApplicants()[0].own',ctx));vm.runInContext('priorityPreview=false',ctx);assert(!vm.runInContext('priorityApplicants()[0].own',ctx));vm.runInContext("setGrowthTab('insights')",ctx);assert(element('#app').innerHTML.includes('Not connected. Employer views'));console.log('Premium tracking, sample contacts, saved alerts, pending review and isolated priority preview passed.');

// The collapsed inbox keeps its toggle reachable without replacing the draft.
const sidebarToggle=element('.inbox-toggle');
sidebarToggle.setAttribute=(name,value)=>{sidebarToggle[name]=value};
element('#conversation-input').value='Keep this draft while browsing';
vm.runInContext('toggleMessagesSidebar()',ctx);
assert.equal(element('#messages-inbox-content').inert,true);
assert.equal(element('.new-conversation').inert,true);
assert.equal(sidebarToggle['aria-expanded'],'false');
assert.equal(sidebarToggle['aria-label'],'Expand conversations sidebar');
assert.equal(element('#conversation-input').value,'Keep this draft while browsing');
const collapsedMarkup=vm.runInContext('messages()',ctx);
assert(collapsedMarkup.indexOf('inbox-toggle')<collapsedMarkup.indexOf('conversation-main'));
assert(!collapsedMarkup.includes('bio-toggle'));
assert(!collapsedMarkup.includes('messages-bio'));
assert(!collapsedMarkup.includes('class="contact-panel"'));
assert(collapsedMarkup.includes('View profile'));
vm.runInContext('toggleMessagesSidebar()',ctx);
assert.equal(element('#messages-inbox-content').inert,false);
assert.equal(element('.new-conversation').inert,false);
assert.equal(sidebarToggle['aria-expanded'],'true');
assert.equal(element('#conversation-input').value,'Keep this draft while browsing');
vm.runInContext("showPersonProfile('peer-1')",ctx);
assert(element('#modal').innerHTML.includes('Amara Okafor'));
assert(element('#modal').innerHTML.includes('Figma'));
assert(element('#modal').innerHTML.includes('person-bio'));
console.log('Conversation rail preserves drafts, controls keyboard access, and keeps bio information in the profile dialog.');

assert.deepEqual(Array.from(vm.runInContext("canonicalSkills('react, JS, typescript, React')",ctx)),['React','JavaScript','TypeScript']);vm.runInContext("bindSkillSelect('test-skills','React');selectSkill('test-skills','TypeScript');selectSkill('test-skills','Reacct')",ctx);assert.equal(element('#test-skills-value').value,'React, TypeScript');assert(element('#test-skills-tags').innerHTML.includes('Remove TypeScript'));vm.runInContext('profileStep=2',ctx);ctx.location.hash='#profile';vm.runInContext('render()',ctx);assert(element('#app').innerHTML.includes('profile-resume-file'));assert(element('#app').innerHTML.includes('profile-skills-input'));assert(element('#app').innerHTML.includes('Resume text'));const live=vm.runInContext("liveJob({id:1001,organization_id:'org-one',title:'Real project',field:'Development',kind:'Contract project',skills:['React'],requirements:['Build tested components'],description:'A real organization brief',deliverables:'A useful dashboard',budget:1200,duration:'2 weeks',location:'Remote',status:'published',organizations:{name:'Startup',owner_id:'owner-one'}})",ctx);assert.equal(live.organizationId,'org-one');assert.equal(live.pay,1200);assert.equal(live.tags[0],'React');assert(vm.runInContext('orgGate()',ctx).includes('Create organization account'));ctx.Account={user:{id:'owner-one'}};vm.runInContext("Organization.owner='old-owner';Organization.profile={name:'Private old org'};Organization.loaded=true;organizationPage()",ctx);assert.equal(vm.runInContext('Organization.profile',ctx),null);console.log('Profile resume upload, canonical skill selection, organization mapping and owner-switch isolation passed.');

ctx.Account={ready:true,user:null,client:{auth:{}}};ctx.accountFeedback=()=>'';ctx.linkedinButton=()=>'<button>LinkedIn</button>';ctx.location.hash='#organization-signup';const orgSignupMarkup=vm.runInContext('organizationAuthPage()',ctx);assert(orgSignupMarkup.includes('Account & company'));assert(orgSignupMarkup.includes('Organization name'));assert(!orgSignupMarkup.includes('Your next chapter starts here.'));ctx.location.hash='#organization-login';assert(vm.runInContext('organizationAuthPage()',ctx).includes('Log in to hiring portal'));ctx.location.hash='#organization-signup';ctx.render=()=>{};ctx.FormData=class{constructor(form){this.form=form}*[Symbol.iterator](){yield* Object.entries(this.form.values||{})}};ctx.runAuth=async fn=>fn();ctx.authCallback=()=> 'https://nextwork-jobs.vercel.app/';ctx.checkAuthResult=r=>{if(r.error)throw r.error;return r.data};let organizationSignupRequest;ctx.Account.client.auth.signUp=async request=>{organizationSignupRequest=request;return {data:{session:null},error:null}};element('#organization-auth-form').values={full_name:'Casey Founder',organization_name:'Harbor Studio',email:'casey@example.com',password:'synthetic-test-password',website:'https://example.com',industry:'Software & technology'};vm.runInContext('bindOrganizationAuth()',ctx);element('#organization-auth-form').onsubmit({preventDefault(){}});assert.equal(vm.runInContext('organizationAuthStep',ctx),1);element('#organization-auth-form').values={team_size:'2–10 people',hiring_kind:'Contract project',focus_field:'Development',budget:'1500',start_window:'Within a month',work_style:'Remote',location:'Pacific Time'};vm.runInContext('bindOrganizationAuth()',ctx);Promise.resolve(element('#organization-auth-form').onsubmit({preventDefault(){}})).then(()=>{assert.equal(organizationSignupRequest.options.data.account_kind,'organization');assert.equal(organizationSignupRequest.options.data.organization_setup.budget,1500);assert(!('password' in organizationSignupRequest.options.data.organization_setup));assert.equal(vm.runInContext('Object.keys(organizationSignupDraft).length',ctx),0);assert.equal(ctx.location.hash,'organization-login');ctx.Account.user={id:'hiring-user',user_metadata:{organization_setup:organizationSignupRequest.options.data.organization_setup}};vm.runInContext("Organization.profile={name:'Harbor Studio',description:'Useful community products'};Organization.listings=[];Organization.applications=[];startOrganizationListing()",ctx);assert.equal(vm.runInContext('Organization.edit.budget',ctx),1500);assert.equal(vm.runInContext('Organization.edit.field',ctx),'Development');assert(vm.runInContext('organizationOverview()',ctx).includes('Your next hiring steps'));assert(vm.runInContext('organizationOverview()',ctx).includes('What makes a good brief?'));assert(vm.runInContext('organizationDetailsForm()',ctx).includes('Your hiring preferences'));console.log('Dedicated organization access, relevant signup questions, credential handling, preference defaults and hiring overview passed.');}).catch(error=>{console.error(error);process.exitCode=1});
// Isolate messaging checks from the asynchronous organization signup flow above.
const messageTestStorage=new Map();
const messageCtx=vm.createContext({...ctx,$:element,...Object.fromEntries(['jobs','esc','icon','logo','graduateProfile'].map(name=>[name,vm.runInContext(name,ctx)])),Account:{user:{id:'attachment-test'}},requireAccount:()=>true,render(){},workspacePayload:()=>({extras:{}}),workspaceLocal:{getItem:key=>messageTestStorage.get(key)||null,setItem:(key,value)=>messageTestStorage.set(key,String(value))}});
vm.runInContext(fs.readFileSync('dist/messaging.js','utf8'),messageCtx);
// Project sharing stays compact until the user searches the complete catalog.
vm.runInContext('shareProject()',messageCtx);
assert.equal((element('#modal').innerHTML.match(/class="project-share-option"/g)||[]).length,3);
assert(element('#modal').innerHTML.includes('share-project-search'));
vm.runInContext("searchShareProjects('Patchwork React')",messageCtx);
assert(element('#share-project-results').innerHTML.includes('accessible booking flow'));
vm.runInContext("searchShareProjects('no-matching-project-123')",messageCtx);
assert(element('#share-project-results').innerHTML.includes('No projects found'));
vm.runInContext("searchShareProjects('')",messageCtx);
assert.equal(element('#share-project-results').innerHTML,'');

(async()=>{
  messageCtx.TextEncoder=TextEncoder;
  messageCtx.FileReader=class{
    readAsDataURL(file){
      if(file.fail){this.onerror();return;}
      this.result='data:text/plain;base64,aGVsbG8=';this.onload();
    }
  };
  await vm.runInContext("attachMessageFiles([{name:'notes.txt',size:5}])",messageCtx);
  assert.equal(vm.runInContext('attachmentDraft().files.length',messageCtx),1);
  assert.equal(vm.runInContext('attachmentDraft().loading',messageCtx),false);
  element('#conversation-input').value='';
  vm.runInContext('updateMessageSendState()',messageCtx);
  assert.equal(element('#send-message').disabled,false);
  vm.runInContext('sendMessage()',messageCtx);
  const fileMessage=vm.runInContext('thread(activePerson).messages.at(-1)',messageCtx);
  assert.equal(fileMessage.attachments[0].name,'notes.txt');
  assert.equal(vm.runInContext('attachmentDraft().files.length',messageCtx),0);
  const download=vm.runInContext('messageAttachmentLink(thread(activePerson).messages.at(-1).attachments[0])',messageCtx);
  assert(download.includes('download="notes.txt"'));
  assert(download.includes('data:application/octet-stream;base64,'));
  assert.equal(vm.runInContext("messageAttachmentLink({name:'bad',data:'javascript:alert(1)'})",messageCtx),'');
  await vm.runInContext("attachMessageFiles([{name:'too-big.txt',size:1048577}])",messageCtx);
  assert.equal(vm.runInContext('attachmentDraft().files.length',messageCtx),0);
  await vm.runInContext("attachMessageFiles([{name:'unreadable.txt',size:5,fail:true}])",messageCtx);
  assert.equal(vm.runInContext('attachmentDraft().loading',messageCtx),false);
  await vm.runInContext("attachMessageFiles([{name:'remove.txt',size:5}])",messageCtx);
  vm.runInContext('removePendingAttachment(attachmentDraft().files[0].id)',messageCtx);
  assert.equal(vm.runInContext('attachmentDraft().files.length',messageCtx),0);
  assert.equal(vm.runInContext("attachmentsFitWorkspace(activePerson,{messages:[{text:'x'.repeat(1800001)}]})",messageCtx),false);
  messageCtx.URL=URL;
  messageCtx.location={href:'https://nextwork-jobs.vercel.app/?tracking=1#explore',hash:'#explore'};
  let copiedUrl,nativePayload;
  messageCtx.navigator={clipboard:{writeText:async url=>{copiedUrl=url}},share:async payload=>{nativePayload=payload}};
  vm.runInContext('shareListing(7)',messageCtx);
  assert(element('#modal').innerHTML.includes('Send in Messages'));
  assert(element('#modal').innerHTML.includes('Copy link'));
  assert(element('#modal').innerHTML.includes('mailto:'));
  assert(element('#modal').innerHTML.includes('More sharing options'));
  await vm.runInContext('copyListingLink(7)',messageCtx);
  assert.equal(copiedUrl,'https://nextwork-jobs.vercel.app/#project/7');
  await vm.runInContext('nativeShareListing(7)',messageCtx);
  assert.equal(nativePayload.url,copiedUrl);
  messageCtx.navigator.clipboard.writeText=async()=>{throw new Error('denied')};
  element('#listing-share-url').select=()=>{};
  await vm.runInContext('copyListingLink(7)',messageCtx);
  assert(element('#listing-share-status').textContent.includes('copy it'));
  vm.runInContext('shareListingRecipients(7)',messageCtx);
  vm.runInContext("renderListingRecipients(7,'Amara')",messageCtx);
  assert(element('#listing-recipients').innerHTML.includes('Amara Okafor'));
  assert(!element('#listing-recipients').innerHTML.includes('Maya Chen'));
  element('#conversation-input').value='Preserve my unsent draft';
  const beforeShare=vm.runInContext('activePerson',messageCtx);
  const shareButton={disabled:false};messageCtx.shareButton=shareButton;
  vm.runInContext("sendListingToConversation(7,'peer-1',shareButton)",messageCtx);
  assert.equal(vm.runInContext("thread('peer-1').messages.at(-1).projectId",messageCtx),7);
  assert.equal(vm.runInContext('activePerson',messageCtx),beforeShare);
  assert.equal(element('#conversation-input').value,'Preserve my unsent draft');
  const countAfterShare=vm.runInContext("thread('peer-1').messages.length",messageCtx);
  vm.runInContext("sendListingToConversation(7,'peer-1',shareButton)",messageCtx);
  assert.equal(vm.runInContext("thread('peer-1').messages.length",messageCtx),countAfterShare);
  console.log('Listing sharing covers canonical links, clipboard fallback, native sharing, recipient search, duplicate sends and draft preservation.');
  console.log('Project recommendations/search and file selection, removal, attachment-only sending, downloads, read errors and storage limits passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
