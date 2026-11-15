/* Nextwork Match / EvidenceNet v1. Original trained classifier; no remote inference. */
(function(root){
  'use strict';
  const F=typeof module!=='undefined'?require('./nextwork-features'):root.NextworkFeatures;
  const M=typeof module!=='undefined'?require('./nextwork-model'):root.NextworkModel;
  if(!F||!M||M.featureNames.join('|')!==F.names.join('|'))return;
  const labels={supported:'Supported by a contribution',partial:'Partial evidence',not_evidenced:'Not evidenced',contradictory:'Contradictory evidence',manual:'Needs manual review',conflicting:'Conflicting evidence'};
  let activeResume='',activePassages=[],cache=new Map();
  function predict(x){
    const hidden=M.biases[0].map((b,j)=>Math.tanh(b+x.reduce((n,v,i)=>n+v*M.weights[0][i][j],0)));
    const logits=M.biases[1].map((b,j)=>b+hidden.reduce((n,v,i)=>n+v*M.weights[1][i][j],0)),max=Math.max(...logits);
    const exp=logits.map(x=>Math.exp(x-max)),total=exp.reduce((a,b)=>a+b,0),probabilities=exp.map(x=>x/total),index=probabilities.indexOf(Math.max(...probabilities));
    return {label:M.classes[index],confidence:probabilities[index],probabilities};
  }
  function pair(criterion,passage,prepared){
    const x=F.features(criterion,passage,prepared),prediction=predict(x);
    // Do not promote a sentence without a requirement anchor to evidence.
    if(!x[0]&&!x[1]&&(!x[9]||x[6]))prediction.label='not_evidenced';
    if(!x[0]&&!x[1]&&x[9]&&prediction.label==='supported')prediction.label='partial';
    if(prediction.label==='supported'&&(!x[3]||x[5]||x[7]||x[10]||x[11]))prediction.label='partial';
    if(prediction.label==='supported'&&prediction.confidence<0.6)prediction.label='partial';
    let reason=prediction.label==='supported'?'This passage describes a specific contribution involving the requirement. It is self-reported evidence, not verified proficiency.':prediction.label==='contradictory'?'This passage explicitly states a lack of experience or use. Check it for accuracy and context.':prediction.label==='partial'?(x[9]&&!x[0]&&!x[1]?'Related-tool experience may transfer, but does not establish experience with the requested tool.':x[10]?'An intention to learn does not demonstrate completed work.':x[5]?'Learning or introductory exposure is mentioned; show a completed contribution if you have one.':x[11]?'The team’s work is described; explain your own contribution.':'The skill is mentioned without enough detail about your own completed work.'):'No relevant evidence was identified in this passage.';
    return {...prediction,status:labels[prediction.label],value:prediction.label==='supported'?100:prediction.label==='partial'?50:0,evidence:passage,reason};
  }
  function assess(criterion,passages){
    const prepared=F.prepare(criterion),results=passages.map(p=>pair(criterion,p,prepared));
    const supported=results.filter(r=>r.label==='supported').sort((a,b)=>b.confidence-a.confidence),negative=results.filter(r=>r.label==='contradictory').sort((a,b)=>b.confidence-a.confidence),partial=results.filter(r=>r.label==='partial').sort((a,b)=>b.confidence-a.confidence);
    let best=supported[0]||negative[0]||partial[0]||{label:'not_evidenced',status:labels.not_evidenced,value:0,evidence:'',reason:'No relevant passage was identified. Missing evidence does not mean you lack the skill.'};
    const keys=text=>[...prepared.terms.filter(t=>F.contains(text,t)).map(t=>'term:'+t.toLowerCase()),...prepared.ids.filter(id=>F.concepts[id].some(t=>F.contains(text,t))).map(id=>'concept:'+id)];
    const positiveKeys=new Set(supported.flatMap(r=>keys(r.evidence)));
    const conflict=negative.find(r=>keys(r.evidence).some(k=>positiveKeys.has(k)));
    if(supported.length&&conflict)best={...best,label:'conflicting',status:labels.conflicting,value:0,reason:'The resume contains both a contribution and an explicit negative statement for the same requirement. Review the context manually.',counterEvidence:conflict.evidence};
    if(/\b(\d+\s*\+?\s*years?|certifi(?:ed|cation)|licen[cs]e|degree|bachelor|master|doctorate|work authori[sz]ation|security clearance|gpa)\b/i.test(criterion.label||''))best={...best,label:'manual',status:labels.manual,value:0,reason:'Dates, credentials, eligibility, and exact experience thresholds require manual verification. This model does not verify them.'};
    const suggestion=best.label==='supported'?'Keep the specific contribution and add a work sample or verified outcome where useful.':best.label==='manual'?'Check the exact requirement and provide accurate dates or credentials if applicable.':best.label==='contradictory'||best.label==='conflicting'?'Review the quoted statements. Correct outdated or inaccurate wording; do not claim experience you do not have.':`If accurate, add: “Used ${criterion.label} to [your actual contribution], producing [a verifiable output or outcome].” Otherwise, build and document a relevant practice project first.`;
    return {id:criterion.id,text:criterion.label,kind:criterion.kind||'Requested skill',group:criterion.id?.startsWith('field-')?'field':'job',value:best.value,label:best.label,status:best.status,evidence:best.evidence.slice(0,1200),counterEvidence:best.counterEvidence||'',reason:best.reason,suggestion,model:M.id};
  }
  function evaluate(resume,criteria){
    if(activeResume!==resume){activeResume=String(resume||'');activePassages=F.passages(activeResume);cache.clear();}
    const key=JSON.stringify(criteria);
    if(cache.has(key))return cache.get(key);
    const rows=[...criteria.job,...criteria.baseline].map(c=>assess(c,activePassages));
    if(cache.size>=100)cache.clear();cache.set(key,rows);return rows;
  }
  function description(resume,job,skills){
    const named=skills.filter(s=>F.contains(job,s)),hard=F.passages(job).filter(s=>/\b(required|must|minimum)\b/i.test(s)&&/\b(years?|degree|certification|licen[cs]e|bachelor|master|gpa)\b/i.test(s)).slice(0,6);
    const criteria={job:[...named.map((s,i)=>({id:'skill-'+i,label:s,terms:[s],weight:2,kind:'Requested skill'})),...hard.map((s,i)=>({id:'hard-'+i,label:s,terms:[s],weight:2,kind:'Manual requirement'}))],baseline:[]};
    if(!criteria.job.length)return null;
    const requirements=evaluate(resume,criteria),score=Math.round(requirements.reduce((n,r)=>n+r.value,0)/requirements.length);
    return {score,requirements,matched:requirements.filter(r=>r.value===100).map(r=>r.text),partial:requirements.filter(r=>r.value===50).map(r=>r.text),missing:requirements.filter(r=>r.value<100).map(r=>r.text),method:M.id,modelVersion:M.version,summary:'Nextwork Match beta assesses resume evidence for explicit description requirements. Supported = 100, partial = 50, missing/conflicting/manual = 0. This is evidence coverage, not hiring likelihood or verified ability.'};
  }
  function reset(){activeResume='';activePassages=[];cache.clear();}
  const api={id:M.id,name:M.name,version:M.version,predict,pair,assess,evaluate,description,reset,labels};
  if(typeof module!=='undefined')module.exports=api;else root.NextworkMatch=api;
})(typeof window!=='undefined'?window:globalThis);

function showNextworkModel(){
  const modal=document.getElementById('modal');if(!modal)return;
  modal.hidden=false;modal.innerHTML=`<div class="dialog match-model-dialog" role="dialog" aria-modal="true" aria-labelledby="match-model-title"><button class="close" onclick="closeModal()" aria-label="Close">×</button><span class="eyebrow">BUILT FOR NEXTWORK · BETA</span><h2 id="match-model-title">Meet Nextwork Match</h2><p>EvidenceNet is our compact, trained model for comparing resume passages with individual project requirements.</p><div class="match-model-benefits"><span>Runs in your browser</span><span>No AI credits needed</span><span>Resume stays on your device for matching</span></div><h3>Evidence you can inspect</h3><ul><li><b>Supported:</b> a specific contribution involving the requirement.</li><li><b>Partial:</b> a mention, learning goal, or related-tool experience.</li><li><b>Not evidenced:</b> no relevant passage identified.</li><li><b>Contradictory:</b> an explicit statement of missing experience.</li></ul><p>Listing criteria make up 75% of compatibility; field foundations make up 25%. Partial evidence earns half credit. Conflicting statements and credentials are flagged for manual review.</p><div class="notice"><b>Early model, clear limits.</b> EvidenceNet v1 was trained on original synthetic examples. It has not been independently validated on real applicants. It does not verify proficiency, predict hiring, or make application decisions.</div><p class="resume-hint">General resume formatting checks use rules. Optional Gemini writing feedback is a separate service and requires your consent. Uploaded resumes are saved privately to your account; they are not used to train this model.</p><a class="text-link" href="nextwork-match-model-card.md" target="_blank" rel="noopener">Read the model card ↗</a><div class="dialog-actions"><button class="primary" onclick="closeModal()">Got it</button></div></div>`;
  modal.querySelector('.close').focus();
}
