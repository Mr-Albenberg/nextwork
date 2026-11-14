// Shared fuzzy search for select controls and skill tags. All values stay canonical.
function searchNormalize(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim(); }
function searchDistance(a,b,limit=3) {
  if(Math.abs(a.length-b.length)>limit)return limit+1;
  let previous=Array.from({length:b.length+1},(_,i)=>i), before=previous;
  for(let i=1;i<=a.length;i++){
    const row=[i];let min=i;
    for(let j=1;j<=b.length;j++){
      row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);
      min=Math.min(min,row[j]);
    }
    if(min>limit)return limit+1;
    before=previous;previous=row;
  }
  return previous[b.length];
}
const searchCatalogCache=new Map();
function searchRank(options, query, limit=30) {
  const q=searchNormalize(query), aliases={js:'javascript',ts:'typescript',nodejs:'node js',reactjs:'react',ai:'artificial intelligence',ml:'machine learning',fintech:'financial technology',saas:'saas',dev:'development',fulltime:'full time',parttime:'part time'};
  const term=aliases[q]||q, parts=term.split(' ').filter(Boolean);
  if(!term)return options.slice(0,limit);
  const threshold=term.length<4?0:term.length<8?2:3;
  return options.map((value,index)=>{
    let label=searchCatalogCache.get(value);if(label===undefined){label=searchNormalize(value);searchCatalogCache.set(value,label)}
    let score=Infinity;
    if(label===term)score=0;
    else if(label.startsWith(term))score=1;
    else if(label.includes(term))score=2;
    else if(parts.every(part=>label.includes(part)))score=3;
    else if(threshold){const words=label.split(' ');const distances=parts.map(part=>Math.min(searchDistance(part,label,threshold),...words.map(word=>searchDistance(part,word,threshold))));if(distances.every(d=>d<=threshold))score=4+distances.reduce((a,b)=>a+b,0)}
    return {value,index,score};
  }).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score||a.index-b.index).slice(0,limit).map(item=>item.value);
}
let searchableSequence=0;
const searchableControls=new WeakMap();
function enhanceSearchSelects(root=document) {
  for(const select of root.querySelectorAll('select')){
    const existing=searchableControls.get(select);
    if(existing){existing.sync();continue}
    if(select.multiple)continue;
    const label=select.closest('label'), fieldName=select.name||select.id||'', industry=fieldName==='industry';
    if(industry&&window.NextworkCatalogs){const values=new Set([...select.options].map(o=>o.value));for(const text of window.NextworkCatalogs.industries)if(!values.has(text))select.add(new Option(text,text));}
    const required=select.required, originalLabel=(select.getAttribute('aria-label')||label?.firstChild?.textContent||fieldName||'Choose an option').trim();
    const id='search-choice-'+(++searchableSequence), wrapper=document.createElement('span'), input=document.createElement('input'), toggle=document.createElement('button'), list=document.createElement('div'), status=document.createElement('span');
    wrapper.className='search-choice';input.type='text';input.className='search-choice-input';input.id=id;input.autocomplete='off';input.required=required;input.placeholder='Type to search…';
    input.setAttribute('role','combobox');input.setAttribute('aria-label',originalLabel);input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',id+'-list');input.setAttribute('aria-describedby',id+'-status');
    toggle.type='button';toggle.className='search-choice-toggle';toggle.setAttribute('aria-label','Show '+originalLabel+' options');toggle.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
    list.className='search-choice-options';list.id=id+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',originalLabel+' options');list.hidden=true;
    status.id=id+'-status';status.className='sr-only';status.setAttribute('aria-live','polite');
    select.before(wrapper);wrapper.append(input,toggle,list,status);select.hidden=true;select.required=false;select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    let matches=[],active=-1,querying=false;
    const current=()=>select.selectedOptions[0]?.textContent||'';
    const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
    const sync=()=>{input.disabled=select.disabled;toggle.disabled=select.disabled;if(list.hidden){input.value=select.value?current():'';input.setCustomValidity('')}};
    const choose=option=>{select.value=option.value;input.value=option.value?option.textContent:'';input.setCustomValidity('');close();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));};
    const paint=()=>{
      const options=[...select.options].filter(o=>!o.disabled), labels=searchRank([...new Set(options.map(o=>o.textContent))],querying?input.value:'',30);
      matches=labels.map(text=>options.find(o=>o.textContent===text));active=Math.min(active,matches.length-1);list.replaceChildren();
      matches.forEach((option,index)=>{const button=document.createElement('button');button.type='button';button.id=id+'-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected',String(active===index));button.className=active===index?'active':'';button.textContent=option.textContent;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(option);list.append(button);});
      if(!matches.length){const empty=document.createElement('p');empty.textContent='No matching options. Try a different search.';list.append(empty);}
      status.textContent=matches.length+' suggestions. Use arrow keys and Enter to choose.';list.hidden=false;input.setAttribute('aria-expanded','true');
      if(active>=0){input.setAttribute('aria-activedescendant',id+'-option-'+active);list.children[active]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    };
    input.onfocus=()=>{querying=false;paint()};input.oninput=()=>{querying=true;active=0;input.setCustomValidity('Choose a matching option from the list.');paint()};
    input.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden){querying=false;active=0;}else active=Math.max(0,Math.min(matches.length-1,active+(e.key==='ArrowDown'?1:-1)));paint();}else if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(matches[active<0?0:active])choose(matches[active<0?0:active]);}else if(e.key==='Escape'){e.preventDefault();close();sync();}else if(e.key==='Tab'){close();sync();}};
    input.onblur=()=>{close();sync()};toggle.onmousedown=e=>e.preventDefault();toggle.onclick=()=>{if(list.hidden){input.focus();querying=false;paint()}else{close();sync()}};
    select.addEventListener('change',()=>{close();sync()});searchableControls.set(select,{sync});sync();
  }
  // Optional occupation suggestions retain free-form role and listing titles.
  for(const input of root.querySelectorAll('input[data-search-catalog="roles"]')){
    if(input.dataset.catalogBound||!window.NextworkCatalogs)continue;
    input.dataset.catalogBound='true';const list=document.createElement('datalist');list.id='role-suggestions-'+(++searchableSequence);input.setAttribute('list',list.id);input.after(list);
    input.addEventListener('input',()=>{list.replaceChildren(...searchRank(window.NextworkCatalogs.roles,input.value,30).map(text=>{const option=document.createElement('option');option.value=text;return option}));});
  }
}
if(typeof MutationObserver!=='undefined'){
  let scheduled=false;
  new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('select, input[data-search-catalog]')||n.querySelector('select, input[data-search-catalog]')))||r.type==='attributes'&&r.target.tagName==='SELECT')&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;enhanceSearchSelects()});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
}
