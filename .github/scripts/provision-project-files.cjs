const fs = require('node:fs');
(async()=>{
 const token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!token)throw Error('SUPABASE_ACCESS_TOKEN is required to configure private project storage.');
 const query=fs.readFileSync('supabase/migrations/202611150008_project_files.sql','utf8');
 const response=await fetch('https://api.supabase.com/v1/projects/zkoqafidgromlbvczwzy/database/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query})});
 if(!response.ok)throw Error(`Project file storage provisioning failed (HTTP ${response.status}). Check the Actions token has access to the linked Supabase project.`);
 console.log('Private project file storage and ownership policies configured.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
