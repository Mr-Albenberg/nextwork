// Deploy the existing Nextwork API without reading or changing runtime configuration.
const token=process.env.VERCEL_TOKEN;
let project=process.env.VERCEL_PROJECT_ID,team=process.env.VERCEL_ORG_ID;
if(!token)throw Error('API deployment requires the VERCEL_TOKEN repository secret.');
async function api(path,method='GET',body,scope=team){const url=new URL('https://api.vercel.com'+path);if(scope)url.searchParams.set('teamId',scope);const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!response.ok){const error=Error('API deployment request failed with HTTP '+response.status);error.status=response.status;throw error;}return response.json();}
(async()=>{
 let metadata;
 if(project)metadata=await api('/v9/projects/'+project);
 else{
  const scopes=[team||null];
  if(!team){try{const result=await api('/v2/teams','GET',undefined,null);scopes.push(...(result.teams||[]).map(t=>t.id));}catch(error){if(error.status===401)throw Error('VERCEL_TOKEN is rejected by Vercel (HTTP 401). Replace the repository secret with a valid Vercel access token.');console.log('Team discovery returned HTTP '+error.status);}}
  for(const scope of scopes){
   const candidates=[];
   try{candidates.push(await api('/v9/projects/nextwork-jobs','GET',undefined,scope));}catch(error){if(error.status===401)throw Error('Vercel rejected the deployment token (HTTP 401).');if(![403,404].includes(error.status))throw error;}
   if(!candidates.length){let until='';for(let page=0;page<3;page++){const listed=await api('/v9/projects?limit=100'+until,'GET',undefined,scope);candidates.push(...(listed.projects||[]).filter(p=>/nextwork|prooflane/i.test(p.name)||p.link?.repo==='nextwork'));if(!listed.pagination?.next)break;until='&until='+listed.pagination.next;}}
   for(const candidate of candidates){const domains=await api('/v9/projects/'+candidate.id+'/domains','GET',undefined,scope);if((domains.domains||[]).some(d=>d.name==='nextwork-jobs.vercel.app')){metadata=candidate;project=candidate.id;team=scope;break;}}
   if(metadata)break;
  }
 }
 if(!metadata||metadata.id!==project)throw Error('Could not identify the existing Nextwork API project. Configure VERCEL_PROJECT_ID and VERCEL_ORG_ID repository secrets.');
 const domains=await api('/v9/projects/'+project+'/domains');if(!(domains.domains||[]).some(d=>d.name==='nextwork-jobs.vercel.app'))throw Error('Project does not own the Nextwork API domain');
 const deployment=await api('/v13/deployments','POST',{name:metadata.name,project,target:'production',gitSource:{type:'github',repoId:Number(process.env.GITHUB_REPOSITORY_ID),ref:process.env.GITHUB_SHA}});
 for(let attempt=0;attempt<60;attempt++){const state=await api('/v13/deployments/'+deployment.id);if(state.readyState==='READY'){const response=await fetch('https://nextwork-jobs.vercel.app/api/resume');const info=await response.json();if(!Object.hasOwn(info,'profileImportAvailable'))throw Error('Production API did not expose the updated profile processor');console.log('Updated profile processor deployed. AI configured: '+info.profileImportAvailable);return;}if(['ERROR','CANCELED'].includes(state.readyState))throw Error('API deployment ended in '+state.readyState);await new Promise(resolve=>setTimeout(resolve,5000));}
 throw Error('API deployment timed out');
})().catch(error=>{console.error(error.message);process.exitCode=1});
