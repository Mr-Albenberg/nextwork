const fs=require('node:fs');
(async()=>{
 const token=process.env.SUPABASE_ACCESS_TOKEN;if(!token)throw Error('SUPABASE_ACCESS_TOKEN is required for private document setup.');
 const query=['202611150010_application_lifecycle.sql','202611150012_resume_documents.sql'].map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8')).join('\n');
 const result=await fetch('https://api.supabase.com/v1/projects/zkoqafidgromlbvczwzy/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});
 if(!result.ok)throw Error('Resume document setup failed (HTTP '+result.status+'). Check the Actions token can manage the linked Supabase project.');
 console.log('Private original resume storage and applicant/organization sharing configured.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
