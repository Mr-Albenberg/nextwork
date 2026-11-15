// Explicit manual administration only. Never run from a push/deploy/migration.
'use strict';
const PROJECT='zkoqafidgromlbvczwzy';
const TABLES=['application_messages','chat_attachments','chat_messages','chat_memberships','chat_conversations','organization_applications','organization_listings','organizations','chat_profiles','account_workspaces','resume_review_usage','profile_photos','profile_import_state','profile_photo_limits','profile_photo_reservations'];
const BUCKETS=['account-resumes','application-resumes','message-attachments','profile-photo-staging','profile-photos','project-files'];
const fs=require('node:fs');
async function main(){
 const token=process.env.SUPABASE_ACCESS_TOKEN,mode=process.env.RESET_MODE||'inspect';
 if(!token)throw Error('The existing Supabase Actions token is required.');
 if(!['inspect','reset'].includes(mode))throw Error('Unknown reset mode.');
 if(mode==='reset'&&process.env.RESET_CONFIRMATION!=='DELETE ALL NEXTWORK USER DATA')throw Error('Explicit reset confirmation is required.');
 async function management(path,options={}){
  const r=await fetch('https://api.supabase.com/v1/projects/'+PROJECT+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});
  if(!r.ok)throw Error('Supabase management request failed (HTTP '+r.status+').');
  return r.status===204?null:r.json();
 }
 const sql=query=>management('/database/query',{method:'POST',body:JSON.stringify({query})});
 const schema=await sql("select tablename from pg_tables where schemaname='public' order by tablename");
 const present=new Set(schema.map(r=>r.tablename));
 const actual=TABLES.filter(t=>present.has(t));
 async function inventory(){
  const counts=await sql("select 'auth.users' as resource,count(*)::int as count from auth.users"+actual.map(t=>" union all select 'public."+t+"',count(*)::int from public.\""+t+"\"").join(''));
  const storage=await sql('select bucket_id,count(*)::int as count from storage.objects group by bucket_id order by bucket_id');
  return {project:PROJECT,counts,storage};
 }
 const before=await inventory();console.log('BEFORE '+JSON.stringify(before));
 if(mode==='inspect'){
  const relations=await sql("select conrelid::regclass::text as child,confrelid::regclass::text as parent,confdeltype as on_delete from pg_constraint where contype='f' and (confrelid='auth.users'::regclass or connamespace='public'::regnamespace) order by 1,2");
  console.log('PUBLIC_TABLES '+JSON.stringify([...present]));console.log('RELATIONS '+JSON.stringify(relations));return;
 }
 // Unknown tables/buckets require inspection, rather than guessing at their purpose.
 const unknownTables=[...present].filter(t=>!TABLES.includes(t));
 if(unknownTables.length)throw Error('Unrecognized public tables; inspect scope before reset: '+unknownTables.join(', '));
 if(before.storage.some(r=>!BUCKETS.includes(r.bucket_id)&&r.count>0))throw Error('Unrecognized nonempty storage bucket; inspect before deleting accounts.');
 const keys=await management('/api-keys');
 const service=keys.find(k=>k.name==='service_role')?.api_key;
 if(!service)throw Error('A server-side Supabase administration key could not be obtained. No data was deleted.');
 const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 async function serviceRequest(path,options={}){
  const r=await fetch('https://'+PROJECT+'.supabase.co'+path,{...options,headers});
  if(!r.ok)throw Error('Supabase account/storage administration failed (HTTP '+r.status+').');
  return r;
 }
 const users=await sql('select id::text from auth.users order by id');
 // Validate child deletion order and restrictive foreign keys without committing.
 const deletions=actual.map(t=>'delete from public."'+t+'";').join('\n');
 await sql('begin; set local lock_timeout=\'10s\';\n'+deletions+'\ndelete from auth.users;\nrollback;');
 let filesDeleted=0;
 for(const bucket of BUCKETS){
  for(;;){
   const objects=await sql("select name from storage.objects where bucket_id='"+bucket+"' order by name limit 100");
   if(!objects.length)break;
   await serviceRequest('/storage/v1/object/'+bucket,{method:'DELETE',body:JSON.stringify({prefixes:objects.map(x=>x.name)})});
   const remaining=await sql("select count(*)::int as count from storage.objects where bucket_id='"+bucket+"'");
   if(remaining[0].count>=(before.storage.find(x=>x.bucket_id===bucket)?.count||0))throw Error('Storage deletion did not reduce object count.');
   filesDeleted+=objects.length;
  }
 }
 // All structured application data is deleted transactionally before GoTrue removes auth identities/sessions.
 await sql('begin; set local lock_timeout=\'10s\';\n'+deletions+'\ncommit;');
 let usersDeleted=0;
 for(const user of users){await serviceRequest('/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE'});usersDeleted++;}
 const after=await inventory();console.log('AFTER '+JSON.stringify(after));
 if(after.counts.some(x=>x.count!==0)||after.storage.some(x=>BUCKETS.includes(x.bucket_id)&&x.count!==0))throw Error('Reset verification found remaining/new user data. Inspect before retrying.');
 const summary='Nextwork reset verified: '+usersDeleted+' user accounts and '+filesDeleted+' uploaded objects removed. All application tables are empty. Static sample listings, site code, model assets, schema, buckets, policies, and authentication configuration were preserved.';
 console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
