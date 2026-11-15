/* EvidenceNet's shared, deterministic input features. These rules are not learned weights. */
(function (root) {
  'use strict';
  const concepts = {
    react: ['react', 'react.js', 'reactjs'],
    javascript: ['javascript', 'js', 'ecmascript'],
    typescript: ['typescript', 'ts'],
    node: ['node.js', 'nodejs', 'node js'],
    nextjs: ['next.js', 'nextjs'],
    python: ['python', 'pandas', 'numpy'],
    sql: ['sql', 'structured query language', 'sql queries'],
    postgres: ['postgresql', 'postgres'],
    api: ['rest api', 'restful', 'rest endpoints', 'http endpoints', 'rest services'],
    graphql: ['graphql'],
    html: ['html', 'semantic markup'],
    css: ['css', 'stylesheets', 'cascading style sheets'],
    git: ['git', 'github', 'version control', 'pull request', 'pull requests'],
    tests: ['testing', 'unit tests', 'unit testing', 'integration tests', 'jest', 'vitest', 'automated tests', 'regression tests'],
    accessibility: ['accessibility', 'accessible', 'wcag', 'screen reader', 'keyboard navigation', 'inclusive design'],
    collaboration: ['collaboration', 'collaborated', 'team collaboration', 'cross-functional', 'team', 'teammates'],
    research: ['user research', 'customer research', 'usability', 'usability tests', 'user interviews', 'customer interviews', 'interviewing'],
    figma: ['figma'],
    ux: ['ui/ux design', 'ux design', 'user experience', 'user-centered design'],
    ui: ['ui design', 'user interface'],
    prototype: ['prototyping', 'prototype', 'prototypes', 'interactive mockups'],
    handoff: ['design handoff', 'handoff', 'design system', 'component specifications'],
    documentation: ['documentation', 'documented', 'readme', 'handoff notes'],
    dashboard: ['dashboard', 'dashboards'],
    charts: ['data visualization', 'data visualisation', 'charts', 'chart', 'visualization', 'visualisation'],
    responsive: ['responsive', 'mobile layouts', 'responsive components'],
    analysis: ['data analysis', 'data analytics', 'analyzed', 'analysed', 'analytical reasoning'],
    quality: ['data quality', 'data cleaning', 'cleaned', 'validation', 'missing values', 'duplicate records'],
    statistics: ['statistics', 'statistical analysis', 'hypothesis testing'],
    privacy: ['privacy', 'anonymized', 'anonymised', 'responsible data handling', 'data ethics'],
    communication: ['communication', 'communicating findings', 'presented', 'presentation', 'communicate', 'stakeholders'],
    excel: ['excel', 'spreadsheets', 'pivot tables'],
    tableau: ['tableau'],
    powerbi: ['power bi', 'powerbi'],
    machinelearning: ['machine learning', 'predictive modeling', 'predictive modelling'],
    aws: ['aws', 'amazon web services'],
    docker: ['docker', 'containerization', 'containerisation'],
    marketing: ['marketing'],
    seo: ['seo', 'search engine optimization', 'search engine optimisation'],
    content: ['content strategy', 'content calendar', 'editorial calendar'],
    social: ['social media', 'social campaigns'],
    copy: ['copywriting', 'product copy', 'microcopy', 'ux writing', 'interface copy'],
    analytics: ['analytics', 'conversion', 'engagement', 'kpi', 'measuring outcomes', 'metrics'],
    experiment: ['experimentation', 'experiment', 'a/b', 'tested', 'test campaign'],
    audience: ['audience', 'segmentation', 'audience understanding'],
    strategy: ['strategy', 'strategic', 'roadmap', 'prioritization', 'prioritized'],
    discovery: ['problem framing', 'discovery', 'hypothesis', 'research question'],
    findings: ['findings', 'insights', 'recommendations', 'evidence-based decisions'],
    leadership: ['leadership', 'led', 'mentored'],
    projectmanagement: ['project management', 'project planning'],
    agile: ['agile', 'scrum'],
    communicationwriting: ['clear communication', 'writing', 'content'],
    launch: ['launch', 'go-to-market', 'community'],
    onboarding: ['onboarding', 'user journey', 'journey map', 'user flow'],
    reproducible: ['reproducible', 'notebook', 'data pipeline'],
  };
  const related = {
    react: ['vue', 'angular', 'svelte', 'jsx'],
    postgres: ['mysql', 'sqlite', 'sql'],
    python: ['r programming', 'julia'],
    figma: ['sketch', 'adobe xd'],
    tableau: ['power bi', 'looker'],
    powerbi: ['tableau', 'looker'],
    aws: ['azure', 'google cloud'],
    docker: ['kubernetes'],
    typescript: ['javascript'],
    graphql: ['rest api'],
  };
  const names = ['direct','concept','tokenCoverage','action','outcome','learning','negation','assistance','listOnly','related','future','teamOnly','experienceClaim','short','hasNumbers','knownConcept'];
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexCache = new Map();
  function regex(term) {
    const key = String(term).toLowerCase().trim();
    if (!regexCache.has(key)) {
      if (regexCache.size > 2000) regexCache.clear();
      regexCache.set(key, new RegExp('(^|[^a-z0-9])(' + escape(key) + ')(?=$|[^a-z0-9])', 'i'));
    }
    return regexCache.get(key);
  }
  function contains(text, term) {return Boolean(term && regex(term).test(text));}
  function tokens(text) {return (String(text).toLowerCase().match(/[a-z][a-z0-9+#.-]*/g)||[]).filter(t=>!['a','an','and','or','the','with','of','for','to','in','using','experience','required','skills','skill','ability','knowledge','proficiency','must','have','be'].includes(t));}
  function prepare(criterion) {
    const terms = (criterion.terms?.length ? criterion.terms : [criterion.label || criterion.text || '']).map(String).map(s=>s.trim()).filter(Boolean);
    const ids = Object.keys(concepts).filter(id=>terms.some(term=>concepts[id].some(alias=>alias.toLowerCase()===term.toLowerCase())));
    return {terms,ids,aliases:[...new Set([...terms,...ids.flatMap(id=>concepts[id])])],related:ids.flatMap(id=>related[id]||[]),tokens:[...new Set(terms.flatMap(tokens))]};
  }
  function passages(text) {
    // Keep evidence verbatim. Clause splitting prevents another skill's negation leaking across "but".
    return String(text||'').slice(0,80000).split(/\n|;|(?<=[.!?])\s+(?=[A-Z])|\s+but\s+/i).map(s=>s.trim()).filter(Boolean).slice(0,240);
  }
  function features(criterion, passage, prepared) {
    const c=prepared||prepare(criterion),line=String(passage).slice(0,1200),low=line.toLowerCase();
    let start=-1,end=-1;
    for(const alias of [...c.aliases,...c.related]){const m=regex(alias).exec(line);if(m){const at=m.index+m[1].length;if(start<0||at<start){start=at;end=at+m[2].length;}}}
    const direct=c.terms.some(t=>contains(line,t)),concept=c.ids.some(id=>concepts[id].some(a=>contains(line,a)));
    const overlap=c.tokens.length?c.tokens.filter(t=>contains(line,t)).length/c.tokens.length:0;
    const anchor=start>=0;
    const before=anchor?low.slice(Math.max(0,start-120),start):'',after=anchor?low.slice(end,end+85):'';
    const scope=anchor?before+low.slice(start,end)+after:'';
    const action=anchor&&/\b(built|build|developed|implemented|designed|created|analyzed|analysed|cleaned|validated|tested|conducted|interviewed|launched|delivered|reduced|increased|improved|maintained|deployed|wrote|authored|presented|collaborated|led|mentored|used|integrated|optimized|optimised|automated|evaluated|resolved|produced|mapped|documented|configured|managed|organized|organised|published|researched|prioritized|prioritised)\b/.test(scope);
    const negation=anchor&&(/\b(no|never|without|lack|lacking|haven't|hasn't|not)\b(?:\W+\w+){0,6}\W*$/.test(before.replace(/\bnot only\b/g,''))||/^\s*[:=-]?\s*(none|no experience|not used|not proficient|not yet)/.test(after));
    const learning=anchor&&/\b(learning|studying|beginner|introductory|introduction to|tutorial|familiar|exposure|basics)\b/.test(scope);
    const future=anchor&&/\b(want to|plan to|planning to|hope to|interested in|would like to|will learn|aim to|aspire to)\b/.test(before);
    const assistance=anchor&&/\b(helped|assisted|helping|assisting|observed|shadowed)\b/.test(scope);
    const teamOnly=anchor&&/\b(our team|my team|the team|team members|colleagues)\b/.test(before)&&!(/\b(i|personally|my contribution)\b/.test(before));
    const experienceClaim=anchor&&/\b(experience|experienced|proficient|expertise|skilled|competent)\b/.test(scope);
    return [Number(direct),Number(concept),overlap,Number(action),Number(anchor&&/\b(improved|reduced|increased|delivered|result|users|customers|volunteers|participants|published)\b/.test(scope)),Number(learning),Number(negation),Number(assistance),Number(anchor&&!action&&!experienceClaim&&!learning&&!future&&tokens(line).length<=18),Number(c.related.some(t=>contains(line,t))),Number(future),Number(teamOnly),Number(experienceClaim),Number(tokens(line).length<5),Number(anchor&&/\d/.test(scope)),Number(c.ids.length>0)];
  }
  const api={concepts,related,names,prepare,passages,features,contains};
  if(typeof module!=='undefined')module.exports=api;else root.NextworkFeatures=api;
})(typeof window!=='undefined'?window:globalThis);
