// Authored synthetic bootstrap data. No users, scraped resumes, or hiring outcomes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const F=require('../../dist/nextwork-features');
const templates={
 train:[
 ['supported','Built a working project using {skill} for 24 volunteers.'],
 ['supported','Developed {skill} deliverables for a community partner and documented the result.'],
 ['supported','Implemented {skill} in an academic project and tested the output.'],
 ['supported','Used {skill} to deliver a working prototype for a student society.'],
 ['supported','Designed a solution with {skill}, then evaluated it with participants.'],
 ['supported','Maintained a project using {skill} and resolved reported issues.'],
 ['supported','Built {skill} components.'],
 ['supported','Implemented {skill}.'],
 ['supported','Used {skill} without assistance.'],
 ['supported','Authored {skill} deliverables.'],
 ['supported','Documented {skill} decisions.'],
 ['supported','Developed a project using {skill} for coursework.'],
 ['partial','Skills: {skill}.'],
 ['partial','Currently learning {skill} through a tutorial.'],
 ['partial','Interested in {skill} and planning to learn it.'],
 ['partial','Assisted a colleague with {skill}.'],
 ['partial','Our team built a deliverable using {skill}.'],
 ['partial','Experienced in {skill}.'],
 ['contradictory','No experience with {skill}.'],
 ['contradictory','I have never used {skill}.'],
 ['contradictory','Not proficient in {skill}.'],
 ['contradictory','I built the project without {skill}.'],
 ['contradictory','{skill}: no experience.'],
 ['contradictory','Lacking practical knowledge of {skill}.'],
 ['not_evidenced','Built a working project using {other} for 24 volunteers.'],
 ['not_evidenced','Currently learning {other} through a tutorial.'],
 ['not_evidenced','No experience with {other}.'],
 ['not_evidenced','EDUCATION: completed a university program.'],
 ['not_evidenced','Worked on a club fundraiser and wrote meeting minutes.'],
 ['not_evidenced','Portfolio available on request.'],
 ],
 validation:[
 ['supported','Created a community tool with {skill} and delivered the handoff.'],
 ['supported','Automated an internal workflow using {skill}, reducing repetitive work.'],
 ['partial','My technical toolkit includes {skill}.'],
 ['partial','Studying the basics of {skill} in a short course.'],
 ['contradictory','I have not yet used {skill} in a project.'],
 ['contradictory','Without any knowledge of {skill}.'],
 ['not_evidenced','Created a community tool with {other} and delivered the handoff.'],
 ['not_evidenced','My technical toolkit includes {other}.'],
 ],
 test:[
 ['supported','Configured {skill} for a volunteer project and validated its behavior.'],
 ['supported','Produced a deliverable using {skill}; documented the findings for the partner.'],
 ['partial','I am familiar with {skill} from introductory lessons.'],
 ['partial','{skill} is among my listed interests.'],
 ['contradictory','I lack experience in {skill}.'],
 ['contradictory','{skill}: not used.'],
 ['not_evidenced','Configured {other} for a volunteer project and validated its behavior.'],
 ['not_evidenced','I am familiar with {other} from introductory lessons.'],
 ]
};
const heldout={validation:['graphql','privacy','tableau','content','agile','launch'],test:['figma','statistics','seo','projectmanagement','docker','onboarding']};
const root=path.join(__dirname,'data');fs.mkdirSync(root,{recursive:true});
const counts={},all=[];
for(const split of ['train','validation','test']){
 const rows=[];
 const ids=Object.keys(F.concepts).filter(id=>split==='train'?!Object.values(heldout).flat().includes(id):heldout[split].includes(id));
 const custom={train:['Rust','Elixir','HubSpot','Zotero','Notion','Jira','C++'],validation:['SAS','Blender'],test:['Stata','SolidWorks']}[split];
 for(const id of [...ids,...custom]){
   const aliases=F.concepts[id]||[id];
   for(let a=0;a<aliases.length;a++)for(let n=0;n<templates[split].length;n++){
     const [label,template]=templates[split][n],c={label:aliases[0],terms:[aliases[0]]},prepared=F.prepare(c);
     // Ensure an unrelated tool does not share a concept or token with the requested one.
     const other=Object.values(F.concepts).map(x=>x[0]).find(x=>!prepared.aliases.some(t=>F.contains(x,t))&&!prepared.tokens.some(t=>F.contains(x,t)))||'event logistics';
     let passage=template.replaceAll('{skill}',aliases[a]).replaceAll('{other}',other);
     if(label==='not_evidenced'&&F.features(c,passage).slice(0,2).some(Boolean))passage=`Used ${other}.`;
     if(label==='not_evidenced'&&F.features(c,passage).slice(0,2).some(Boolean))throw Error('Unrelated example contains a requirement alias: '+id);
     rows.push({id:`${split}:${id}:${a}:${n}`,split,family:id,template:`${split}-${n}`,criterion:c,passage,label,source:'authored-synthetic-v1'});
   }
   // Adjacent skills count as partial transferable evidence, never proof of the exact tool.
   for(const [n,term] of (F.related[id]||[]).entries())rows.push({id:`${split}:${id}:related:${n}`,split,family:id,template:`${split}-related`,criterion:{label:aliases[0],terms:[aliases[0]]},passage:`Built a project using ${term} for a community group.`,label:'partial',source:'authored-synthetic-v1'});
 }
 fs.writeFileSync(path.join(root,split+'.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 counts[split]=rows.length;all.push(...rows);
}
fs.writeFileSync(path.join(root,'features.json'),JSON.stringify(all.map(r=>({id:r.id,split:r.split,label:r.label,x:F.features(r.criterion,r.passage)}))));
const hash=crypto.createHash('sha256').update(all.map(r=>JSON.stringify(r)).join('\n')).digest('hex');
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:'synthetic-v1',sha256:hash,featuresSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../dist/nextwork-features.js'))).digest('hex'),counts,heldout,featureNames:F.names,provenance:'Original authored synthetic examples; no real resumes. Splits separate concept families and sentence templates. Not independent human evaluation.'},null,2)+'\n');
console.log({counts,sha256:hash});
