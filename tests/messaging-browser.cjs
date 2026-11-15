const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const {ChatFixture,ids}=require('./helpers/chat-fixture.cjs');
const base=process.env.NEXTWORK_TEST_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const fixture=new ChatFixture(),pages=[],errors=[];
 const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${base}/style.css"><link rel="stylesheet" href="${base}/polish.css"><link rel="stylesheet" href="${base}/ui.css"><link rel="stylesheet" href="${base}/org-portal.css"><link rel="stylesheet" href="${base}/workspace.css"></head><body class="messages-page" data-auth="member"><aside><b>Nextwork</b><nav id="nav"></nav></aside><div class="shell"><header>Messages</header><main id="app"></main></div><div id="modal" class="modal" hidden></div><script>
 const $=selector=>document.querySelector(selector),esc=value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 const Account={user:null,client:null};const jobs=[{id:7,title:'Build a tested booking flow',c:'Startup',tags:['React'],cat:'Development',pay:1200,weeks:'2 weeks',bg:'#edf2ff'}];
 function icon(name,size=18){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" stroke="currentColor"/></svg>'}function logo(){return '<span class="company-logo">S</span>'}function graduateProfile(){return {skills:'React'}}function requireAccount(){return Boolean(Account.user)}function closeModal(){$('#modal').hidden=true}function toast(text){window.lastToast=text}function workspaceNav(){return '<a href="#messages">Messages '+unreadCount()+'</a>'}function render(){if(location.hash==='#messages'){$('#app').innerHTML=messages();bindMessages()}else{$('#app').innerHTML='<h1>Find work</h1><label>Keep working<input id="other-page-input"></label>'}if(typeof renderMessageWidget==='function')renderMessageWidget()}
 const channelCallbacks=[];window.testEmit=()=>channelCallbacks[0]?.();
 function client(){return {rpc:(name,args)=>window.__rpc(name,args),from(){const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},or(){return this},then(resolve){return window.__rows(filters.conversation_id).then(data=>resolve({data,error:null}))}}},storage:{from(){return {async upload(path,file){return window.__upload(path,Array.from(new Uint8Array(await file.arrayBuffer())))},async download(path){const bytes=await window.__download(path);return {data:new Blob([new Uint8Array(bytes)]),error:null}},remove:paths=>window.__remove(paths)}}},channel(){return {on(type,filter,callback){channelCallbacks.push(callback);return this},subscribe(status){status('SUBSCRIBED');return this}}},removeChannel(){channelCallbacks.length=0;return Promise.resolve()}}}
 </script><script src="${base}/ui-state.js"></script><script src="${base}/chat-service.js"></script><script src="${base}/messaging.js"></script><script src="${base}/message-widget.js"></script><script>window.addEventListener('hashchange',render)</script></body></html>`;
 async function open(actor){const context=await browser.newContext({viewport:{width:1360,height:900},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.exposeFunction('__rpc',(name,args)=>fixture.rpc(actor,name,args));await page.exposeFunction('__rows',conv=>fixture.rows(actor,conv));
 await page.exposeFunction('__upload',(path,bytes)=>{fixture.blobs.set(path,Buffer.from(bytes));return {data:{path},error:null}});await page.exposeFunction('__download',path=>Array.from(fixture.blobs.get(path)||[]));await page.exposeFunction('__remove',paths=>{for(const p of paths)fixture.blobs.delete(p);return {data:paths,error:null}});
 await page.route(base+'/messaging-test',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto(base+'/messaging-test#messages');await page.evaluate(async actor=>{Account.user={id:actor};Account.client=client();await connectMessaging()},actor);pages.push(page);return page}
 fixture.listeners.add(()=>{for(const page of pages)if(!page.isClosed())page.evaluate(()=>window.testEmit()).catch(()=>{})});
 try{
 fixture.profiles.find(p=>p.user_id===ids.taylor).company='Taylor';
 const a=await open(ids.alex),b=await open(ids.taylor),c=await open(ids.outsider);
 await a.getByRole('button',{name:'New conversation',exact:true}).click();await a.locator('.people-row').filter({hasText:'Taylor'}).getByRole('button',{name:'Message',exact:true}).click();
 await a.locator('#conversation-input').waitFor();await b.evaluate(()=>refreshMessaging(true));await b.locator('#conversation-input').waitFor();
 // Check the actual composer controls at desktop and narrow phone widths.
 for(const width of [1360,768,390,320]){
  await a.setViewportSize({width,height:900});
  await a.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
  const frame=await a.locator('.messenger').evaluate(el=>{
   const style=getComputedStyle(el),app=getComputedStyle(document.querySelector('#app'));
   return {radius:style.borderRadius,border:style.borderTopWidth,shadow:style.boxShadow,padding:app.padding};
  });
  assert.deepEqual(frame,{radius:'0px',border:'0px',shadow:'none',padding:'0px'},`Messages has no outer card at ${width}px`);
  const layout=await a.evaluate(()=>{
   const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
   return {form:rect('#conversation-form'),input:rect('#conversation-input'),tools:rect('#composer-add'),send:rect('#send-message'),buttons:[...document.querySelectorAll('#composer-add')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}),width:innerWidth,height:innerHeight};
  });
  for(const r of [layout.input,layout.send,...layout.buttons]){
   assert(r.left>=0&&r.right<=layout.width,`Control stays inside viewport at ${width}px`);
   assert(r.left>=layout.form.left&&r.right<=layout.form.right,`Control stays inside composer at ${width}px`);
   assert(r.bottom<=layout.form.bottom&&r.bottom<=layout.height,`Control stays above bottom edge at ${width}px`);
  }
  assert(layout.tools.right<=layout.input.left&&layout.input.right<=layout.send.left,`Text area clears controls at ${width}px`);
  for(const r of layout.buttons)assert(r.right<=layout.send.left||r.bottom<=layout.send.top||r.top>=layout.send.bottom,`Tools clear Send at ${width}px`);
 }
 await a.setViewportSize({width:1360,height:900});
 assert.equal(await a.locator('#inbox-search').getAttribute('placeholder'),'Search conversations:');
 assert.equal(await a.locator('.new-message-button').count(),0);assert.equal(await a.locator('.new-conversation').count(),1);
 const surfaces=await a.evaluate(()=>({composer:getComputedStyle(document.querySelector('.conversation-composer')).backgroundColor,pane:getComputedStyle(document.querySelector('.conversation-main')).backgroundColor,chat:getComputedStyle(document.querySelector('.chat-scroll')).backgroundColor}));assert.equal(surfaces.composer,'rgba(0, 0, 0, 0)');assert.equal(surfaces.pane,surfaces.chat);

 assert.equal(await a.locator('.inbox-person.selected small').textContent(),'Member');assert.equal(await a.locator('.person-heading small').textContent(),'Member · View profile');
 assert(await a.locator('#send-message').isDisabled());await a.locator('#conversation-input').fill('  \n  ');assert(await a.locator('#send-message').isDisabled());
 await a.locator('#conversation-input').fill('One line');const short=await a.locator('.composer-pill').boundingBox();
 const radius=await a.locator('.composer-pill').evaluate(el=>getComputedStyle(el).borderRadius);
 await a.locator('#conversation-input').fill('First line\nSecond line\nThird line');const tall=await a.locator('.composer-pill').boundingBox();assert(tall.height>short.height);assert.equal(await a.locator('.composer-pill').evaluate(el=>getComputedStyle(el).borderRadius),radius);
 await a.getByRole('button',{name:'Add attachment',exact:true}).click();assert(await a.locator('#composer-menu').isVisible());assert.equal(await a.locator('#composer-menu button').count(),2);
 await a.screenshot({path:'test-artifacts/composer-pill-desktop.png'});
 await a.keyboard.press('Escape');assert(await a.locator('#composer-menu').isHidden());
 await a.locator('#conversation-input').fill('Hello from a real member');await a.locator('#send-message').click();await b.locator('.message-bubble').filter({hasText:'Hello from a real member'}).waitFor();
 assert.equal(await a.getByRole('button',{name:'Delete your message'}).count(),0);
 const edge=await a.evaluate(()=>({bubble:document.querySelector('.outgoing .message-bubble').getBoundingClientRect().right,pane:document.querySelector('#chat-scroll').getBoundingClientRect().right}));
 const gutter=await a.locator('#chat-scroll').evaluate(el=>parseFloat(getComputedStyle(el).paddingRight));
 assert(gutter>0&&Math.abs(edge.pane-edge.bubble-gutter)<2,'Sent message retains gutter');
 const metadataRight=await a.locator('.outgoing .message-meta').first().evaluate(el=>el.getBoundingClientRect().right);assert(Math.abs(metadataRight-edge.bubble)<2,'Bubble aligns with metadata');

 assert.equal(await b.getByRole('button',{name:'Edit your message'}).count(),0);
 await a.locator('#conversation-input').fill('Another editable message');await a.locator('#send-message').click();await a.locator('.message-bubble').filter({hasText:'Another editable message'}).waitFor();
 await a.locator('#conversation-input').hover();
 assert.equal(await a.locator('.message-edit-slot').first().evaluate(el=>getComputedStyle(el).opacity),'0');
 const timeBefore=await a.locator('.outgoing .message-time').first().boundingBox();
 await a.locator('.message-line.outgoing').first().hover();
 const timeAfter=await a.locator('.outgoing .message-time').first().boundingBox();assert.equal(timeBefore.x,timeAfter.x);assert.equal(timeBefore.y,timeAfter.y);
 await a.waitForFunction(()=>{const slot=document.querySelector('.message-edit-slot');return slot&&getComputedStyle(slot).opacity==='1'});

 const originalBubble=await a.evaluate(()=>{const r=document.querySelector('.outgoing .message-bubble').getBoundingClientRect();return {width:r.width,height:r.height}});
 await a.locator('.message-line.outgoing').first().hover();await a.getByRole('button',{name:'Edit your message'}).first().click();
 assert.equal(await a.locator('#edit-message-input').inputValue(),'Hello from a real member');
 const editingBubble=await a.evaluate(()=>{const r=document.querySelector('.outgoing .message-bubble').getBoundingClientRect();return {width:r.width,height:r.height}});assert(Math.abs(originalBubble.height-editingBubble.height)<2,'Editing keeps the original bubble height');assert(Math.abs(originalBubble.width-editingBubble.width)<2,'Editing keeps the original bubble width');
 assert.equal(await a.locator('.message-bubble #save-message-edit,.message-bubble [aria-label="Cancel edit"]').count(),0);assert.equal(await a.locator('.message-meta #save-message-edit').count(),1);
 const editStyle=await a.locator('#edit-message-input').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopWidth,padding:s.padding,color:s.color,bubbleColor:getComputedStyle(el.closest('.message-bubble')).color}});assert.equal(editStyle.background,'rgba(0, 0, 0, 0)');assert.equal(editStyle.border,'0px');assert.equal(editStyle.padding,'0px');assert.equal(editStyle.color,editStyle.bubbleColor);
 await a.screenshot({path:'test-artifacts/message-edit-rail.png'});

 assert.equal(await a.locator('#modal:not([hidden])').count(),0,'Edits are inline');
 assert.equal(await a.getByRole('button',{name:'Edit your message',exact:true}).count(),await a.locator('.message-edit:disabled').count());
 await a.evaluate(()=>editMessage(Messaging.messages.get(conversationFor().id)[1].id));assert.equal(await a.locator('#edit-message-input').count(),1);
 await a.locator('#edit-message-input').fill('Draft edit survives refresh');await a.evaluate(()=>refreshMessaging(true));assert.equal(await a.locator('#edit-message-input').inputValue(),'Draft edit survives refresh');
 assert.equal(await a.evaluate(()=>document.activeElement.id),'edit-message-input');

 await a.locator('#edit-message-input').fill('Hello, edited by Alex');await a.getByRole('button',{name:'Save changes',exact:true}).click();
 await b.locator('.message-bubble').filter({hasText:'Hello, edited by Alex'}).waitFor();assert.equal(await b.locator('.message-edited').count(),1);
 await a.locator('.message-line.outgoing').first().hover();await a.getByRole('button',{name:'Edit your message'}).first().click();await a.locator('#edit-message-input').fill('Discard this change');await a.getByRole('button',{name:'Cancel edit',exact:true}).click();
 assert.equal(fixture.messages[0].body,'Hello, edited by Alex');
 await a.locator('#conversation-input').fill('Keep this unsent draft');await b.locator('#conversation-input').fill('A reply from Taylor');await b.locator('#send-message').click();await a.locator('.message-bubble').filter({hasText:'A reply from Taylor'}).waitFor();assert.equal(await a.locator('#conversation-input').inputValue(),'Keep this unsent draft');
 const jordan='00000000-0000-0000-0000-000000000004';fixture.profiles.push({user_id:jordan,name:'Jordan',role:'Member',company:'',skills:[]});await fixture.rpc(ids.alex,'chat_start_conversation',{recipient:jordan});await a.evaluate(()=>refreshMessaging(true));
 await a.locator('.inbox-toggle').click();assert.equal(await a.locator('.inbox-toggle').getAttribute('aria-expanded'),'false');
 await a.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
 assert(await a.locator('.conversation-shortcuts').isVisible());assert.equal(await a.locator('.conversation-shortcut').count(),2);
 const railLayout=await a.evaluate(()=>{const add=document.querySelector('.new-conversation').getBoundingClientRect(),expand=document.querySelector('.inbox-toggle').getBoundingClientRect(),list=document.querySelector('.conversation-shortcuts').getBoundingClientRect();return {addBottom:add.bottom,expandTop:expand.top,expandBottom:expand.bottom,listTop:list.top,border:getComputedStyle(document.querySelector('.conversation-shortcuts')).borderTopWidth}});
 assert(railLayout.addBottom<=railLayout.expandTop&&railLayout.expandBottom<railLayout.listTop);assert.equal(railLayout.border,'1px');
 await a.getByRole('button',{name:'Chat with Jordan',exact:true}).click();await a.locator('.person-heading b').filter({hasText:'Jordan'}).waitFor();assert.equal(await a.getByRole('button',{name:'Chat with Jordan',exact:true}).getAttribute('aria-pressed'),'true');
 await a.getByRole('button',{name:'Chat with Taylor',exact:true}).click();await a.locator('.person-heading b').filter({hasText:'Taylor'}).waitFor();
 assert.equal(await a.locator('#conversation-input').inputValue(),'Keep this unsent draft');
 await a.getByRole('button',{name:'New message',exact:true}).click();await a.locator('#people-search').waitFor();await a.evaluate(()=>closeModal());
 await a.screenshot({path:'test-artifacts/conversation-rail-desktop.png'});
 await a.setViewportSize({width:390,height:844});await a.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
 const shortcut=await a.getByRole('button',{name:'Chat with Taylor',exact:true}).boundingBox();assert(shortcut.x>=0&&shortcut.x+shortcut.width<=390);await a.screenshot({path:'test-artifacts/conversation-rail-mobile.png'});
 await a.setViewportSize({width:1360,height:900});await a.locator('.inbox-toggle').click();

 await a.locator('#conversation-input').fill('');await a.locator('#message-file').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('hello')});assert(await a.locator('#send-message').isDisabled());await a.locator('#conversation-input').fill('Here are my notes');await a.locator('#send-message').click();await b.getByRole('button',{name:'Download notes.txt',exact:true}).waitFor();const downloadPromise=b.waitForEvent('download');await b.getByRole('button',{name:'Download notes.txt',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'notes.txt');assert.equal(fs.readFileSync(await download.path(),'utf8'),'hello');
 await a.getByRole('button',{name:'Add attachment',exact:true}).click();await a.getByRole('button',{name:'Share a project',exact:true}).click();await a.locator('.project-share-option').first().click();await b.locator('.shared-project').filter({hasText:'Build a tested booking flow'}).waitFor();
 await c.evaluate(()=>refreshMessaging(true));assert.equal(await c.locator('#app').getByText('Hello from a real member').count(),0);assert.equal(await c.locator('.inbox-person').count(),0);
 fixture.failAfterCommit=true;await a.locator('#conversation-input').fill('Retry without duplicates');await a.locator('#send-message').click();await a.locator('#message-feedback').filter({hasText:'Connection lost after commit'}).waitFor();assert.equal(await a.locator('#conversation-input').inputValue(),'Retry without duplicates');await a.locator('#send-message').click();await a.waitForFunction(()=>document.querySelector('#conversation-input').value==='');assert.equal(fixture.messages.filter(m=>m.body==='Retry without duplicates').length,1);
 await a.reload();await a.evaluate(async()=>{Account.user={id:'00000000-0000-0000-0000-000000000001'};Account.client=client();await connectMessaging()});await a.locator('.message-bubble').filter({hasText:'A reply from Taylor'}).waitFor();
 await a.setViewportSize({width:390,height:844});await a.getByRole('button',{name:'Add attachment',exact:true}).click();await a.getByRole('button',{name:'Share a project',exact:true}).click();await a.locator('#share-project-search').fill('React');await a.waitForTimeout(100);const fit=await a.locator('.project-share-dialog').evaluate(el=>({height:el.getBoundingClientRect().height,scroll:el.scrollHeight,client:el.clientHeight,bottom:el.getBoundingClientRect().bottom,viewport:innerHeight}));assert(fit.bottom<=fit.viewport);assert(fit.scroll<=fit.client+1);

 await a.evaluate(()=>closeModal());await a.setViewportSize({width:1360,height:900});
 assert(await a.locator('#message-widget').isHidden());
 await a.evaluate(()=>{location.hash='explore'});await a.locator('#other-page-input').fill('Keep working on this page');
 await b.locator('#conversation-input').fill('Incoming while browsing');await b.locator('#send-message').click();
 await a.locator('#message-widget').filter({hasText:'Taylor sent you a message'}).waitFor();
 assert.equal(await a.evaluate(()=>document.activeElement.id),'other-page-input');
 assert.equal(await a.locator('#message-widget-launcher,.mini-chat,#mini-chat-input').count(),0,'No floating messaging bar or reply composer remains');
 assert.equal(new URL(a.url()).hash,'#explore');assert.equal(await a.locator('#other-page-input').inputValue(),'Keep working on this page');
 await a.getByRole('button',{name:'Dismiss message notification',exact:true}).click();assert(await a.locator('#message-widget').isHidden());
 await a.evaluate(()=>refreshMessaging(true));assert(await a.locator('#message-widget').isHidden(),'Unchanged unread counts must not repeat the notice');
 await b.locator('#conversation-input').fill('Another message');await b.locator('#send-message').click();
 await a.locator('#message-widget:not([hidden])').waitFor();
 await a.setViewportSize({width:390,height:844});const bounds=await a.locator('#message-widget').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
 await a.screenshot({path:'test-artifacts/message-notification-mobile.png'});
 await a.getByRole('button',{name:'View',exact:true}).click();await a.locator('#conversation-input').waitFor();await a.locator('.message-bubble').filter({hasText:'Another message'}).waitFor();assert(await a.locator('#message-widget').isHidden());
 await a.evaluate(()=>resetMessaging());assert.equal(await a.locator('#message-widget').count(),0);
 console.log('Incoming message notices: no launcher or composer, no stolen focus, dismiss, no duplicate notices, mobile fit, inbox navigation and account cleanup passed.');
 assert.deepEqual(errors,[]);console.log('Chrome messaging: two-account send/reply and live UI, draft preservation, collapsible inbox, attachment download, listing share, outsider isolation, retry without duplicates, reload and mobile dialog fit passed.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
