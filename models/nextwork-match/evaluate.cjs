const fs=require('node:fs'),assert=require('node:assert/strict');
const Match=require('../../dist/nextwork-match'),F=require('../../dist/nextwork-features'),Engine=require('../../dist/resume-engine');
const read=split=>fs.readFileSync(__dirname+'/data/'+split+'.jsonl','utf8').trim().split('\n').map(JSON.parse);
function metrics(rows,predict){
 const labels=[...new Set(rows.map(r=>r.label))].sort(),confusion=labels.map(()=>labels.map(()=>0));let correct=0;
 const errors=[];
 for(const row of rows){const label=predict(row),a=labels.indexOf(row.label),b=labels.indexOf(label);if(row.label===label)correct++;else errors.push({id:row.id,expected:row.label,actual:label});if(b>=0)confusion[a][b]++;}
 const f1=labels.map((_,i)=>{const tp=confusion[i][i],fp=confusion.reduce((n,r)=>n+r[i],0)-tp,fn=rows.filter(r=>r.label===labels[i]).length-tp;return 2*tp/(2*tp+fp+fn)||0});
 return {count:rows.length,accuracy:+(correct/rows.length).toFixed(4),macroF1:+(f1.reduce((a,b)=>a+b,0)/f1.length).toFixed(4),labels,confusion,errors};
}
const splits=['train','validation','test'].map(read),sets=splits.map(rows=>new Set(rows.map(r=>r.family)));
for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++)assert(![...sets[i]].some(x=>sets[j].has(x)),'Concept families must not cross splits');
const passages=splits.map(rows=>new Set(rows.map(r=>JSON.stringify(r.criterion)+r.passage)));
for(let i=0;i<passages.length;i++)for(let j=i+1;j<passages.length;j++)assert(![...passages[i]].some(x=>passages[j].has(x)),'No exact pair leakage');
const report={model:Match.id,version:Match.version,scope:'Synthetic/developer-authored evaluation only; not independently validated real-applicant accuracy.',splits:{}};
for(const split of ['validation','test','challenge']){
 const rows=read(split);
 report.splits[split]={model:metrics(rows,r=>Match.assess(r.criterion,F.passages(r.passage)).label),keywordBaseline:metrics(rows,r=>r.criterion.terms.some(t=>Engine.has(r.passage,t))?'supported':'not_evidenced')};
}
fs.writeFileSync(__dirname+'/benchmark.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.splits).map(([k,v])=>[k,{model:v.model.accuracy,keywordBaseline:v.keywordBaseline.accuracy,errors:v.model.errors}])),null,2));
assert(report.splits.test.model.macroF1>=0.85,'Synthetic holdout quality regression');
assert(report.splits.challenge.model.macroF1>=0.8,'Authored challenge quality regression');
