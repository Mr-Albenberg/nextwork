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
  const q=searchNormalize(query), aliases={js:'javascript',ts:'typescript',nodejs:'node js',reactjs:'react',ai:'artificial intelligence',ml:'machine learning',fintech:'financial technology',saas:'saas',dev:'development',frontend:'front end',backend:'back end',fulltime:'full time',parttime:'part time'};
  const term=aliases[q]||q, parts=term.split(' ').filter(Boolean);
  if(!term)return options.slice(0,limit);
  const threshold=term.length<3?0:term.length<5?1:term.length<8?2:3;
  return options.map((value,index)=>{
    let label=searchCatalogCache.get(value);if(label===undefined){label=searchNormalize(value);searchCatalogCache.set(value,label)}
    let score=Infinity;
    if(label===term)score=0;
    else if(label.startsWith(term))score=1;
    else if(label.includes(term))score=2;
    else if(label.replace(/ /g,'').includes(term.replace(/ /g,'')))score=2.5;
    else if(parts.every(part=>label.includes(part)))score=3;
    else if(threshold){const words=label.split(' ');const distances=parts.map(part=>{const allowed=part.length<3?0:part.length<5?1:part.length<8?2:3;const distance=Math.min(searchDistance(part,label,allowed),...words.map(word=>searchDistance(part,word,allowed)));return {distance,allowed}});const totalDistance=distances.reduce((sum,d)=>sum+d.distance,0);if(distances.every(d=>d.distance<=d.allowed)&&(parts.length===1||totalDistance<=2))score=4+totalDistance}
    return {value,index,score};
  }).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score||a.index-b.index).slice(0,limit).map(item=>item.value);
}
let searchableSequence=0;
const searchableControls=new WeakMap();
const comboIcons={search:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>',chevron:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>'};
function makeSearchUI(input,label,id){
 const wrapper=document.createElement('span'),leading=document.createElement('span'),toggle=document.createElement('button'),popup=document.createElement('div'),head=document.createElement('div'),list=document.createElement('div'),foot=document.createElement('div'),status=document.createElement('span');
 wrapper.className='search-choice';leading.className='search-choice-leading';leading.innerHTML=comboIcons.search;toggle.type='button';toggle.className='search-choice-toggle';toggle.innerHTML=comboIcons.chevron;toggle.setAttribute('aria-label','Show '+label+' options');
 popup.className='search-choice-popup';popup.hidden=true;head.className='search-choice-menu-heading';list.className='search-choice-options';list.id=id+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',label+' options');foot.className='search-choice-footer';foot.innerHTML='<span>↑ ↓ Move</span><span>↵ Select</span><span>Esc Close</span>';status.id=id+'-status';status.className='sr-only';status.setAttribute('aria-live','polite');
 input.before(wrapper);wrapper.append(leading,input,toggle,popup,status);popup.append(head,list,foot);input.classList.add('search-choice-input');input.setAttribute('role','combobox');input.setAttribute('aria-label',label);input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-describedby',status.id);input.autocomplete='off';
 return {wrapper,input,toggle,popup,head,list,foot,status};
}
function placeSearchPopup(ui){const rect=ui.input.getBoundingClientRect();ui.popup.dataset.placement=window.innerHeight-rect.bottom<260&&rect.top>300?'above':'below';}
function paintSearchRows(ui,items,active,selected,choose,query,total){
 ui.list.replaceChildren();ui.head.replaceChildren();const label=document.createElement('b'),count=document.createElement('span');label.textContent=query?'Search results':'Suggested options';count.textContent=items.length+' shown';ui.head.append(label,count);
 items.forEach((item,index)=>{const row=document.createElement('button');row.type='button';row.id=ui.list.id+'-'+index;row.setAttribute('role','option');row.setAttribute('aria-selected',String(selected(item)));row.className='search-choice-option '+(active===index?'active':'')+(selected(item)?' selected':'');const text=document.createElement('span'),check=document.createElement('span');text.textContent=item.label;check.className='search-option-check';check.innerHTML=comboIcons.check;row.append(text,check);row.onmousedown=e=>e.preventDefault();row.onclick=()=>choose(item);ui.list.append(row)});
 if(!items.length){const empty=document.createElement('div');empty.className='search-choice-empty';empty.innerHTML=comboIcons.search;const title=document.createElement('b'),note=document.createElement('p');title.textContent='No matches found';note.textContent='Try a shorter word or a different spelling.';empty.append(title,note);ui.list.append(empty)}
 ui.status.textContent=items.length+' suggestions from '+total+' options. Use arrow keys and Enter to select.';ui.popup.hidden=false;ui.wrapper.dataset.open='true';ui.input.setAttribute('aria-expanded','true');placeSearchPopup(ui);
 if(active>=0&&items[active]){ui.input.setAttribute('aria-activedescendant',ui.list.id+'-'+active);ui.list.children[active]?.scrollIntoView({block:'nearest'});}else ui.input.removeAttribute('aria-activedescendant');
}
function closeSearchUI(ui){ui.popup.hidden=true;ui.wrapper.dataset.open='false';ui.input.setAttribute('aria-expanded','false');ui.input.removeAttribute('aria-activedescendant');}
function enhanceSearchSelects(root=document){
 for(const select of root.querySelectorAll('select')){
  const previous=searchableControls.get(select);if(previous){previous.sync();continue}if(select.multiple)continue;
  const labelNode=select.closest('label'),field=select.name||select.id||'',label=(select.getAttribute('aria-label')||labelNode?.firstChild?.textContent||field||'Choose an option').trim();
  if(field==='industry'&&window.NextworkCatalogs){const existing=new Set([...select.options].map(o=>o.value));for(const value of window.NextworkCatalogs.industries)if(!existing.has(value))select.add(new Option(value,value));}
  const required=select.required,input=document.createElement('input');input.type='text';input.id='search-choice-'+(++searchableSequence);input.required=required;input.placeholder='Select '+label.toLowerCase()+'…';select.before(input);const ui=makeSearchUI(input,label,input.id);select.hidden=true;select.required=false;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  let items=[],active=-1,querying=false;
  const sync=()=>{input.disabled=select.disabled;ui.toggle.disabled=select.disabled;if(ui.popup.hidden){input.value=select.value?select.selectedOptions[0]?.textContent||'':'';input.setCustomValidity('')}};
  const choose=item=>{select.value=item.value;input.value=item.value?item.label:'';input.setCustomValidity('');closeSearchUI(ui);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));};
  const paint=()=>{const options=[...select.options].filter(o=>!o.disabled&&(!required||o.value)),names=searchRank([...new Set(options.map(o=>o.textContent))],querying?input.value:'',30);items=names.map(label=>({label,value:options.find(o=>o.textContent===label).value}));active=Math.min(active,items.length-1);paintSearchRows(ui,items,active,item=>item.value===select.value,choose,querying?input.value:'',options.length);};
  input.onfocus=()=>{querying=false;active=-1;paint();input.select()};input.oninput=()=>{querying=true;active=0;input.setCustomValidity('Choose a matching option from the list.');paint()};
  input.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1)));paint()}else if(e.key==='Enter'&&!ui.popup.hidden){e.preventDefault();if(items[active<0?0:active])choose(items[active<0?0:active]);}else if(e.key==='Escape'){e.preventDefault();closeSearchUI(ui);sync()}else if(e.key==='Tab'){closeSearchUI(ui);sync()}};
  input.onblur=()=>{closeSearchUI(ui);sync()};ui.toggle.onmousedown=e=>e.preventDefault();ui.toggle.onclick=()=>{if(ui.popup.hidden){input.focus();querying=false;paint()}else{closeSearchUI(ui);sync()}};select.addEventListener('change',()=>{closeSearchUI(ui);sync()});searchableControls.set(select,{sync});sync();
 }
 for(const input of root.querySelectorAll('input[data-search-catalog="roles"]')){
  if(input.dataset.catalogBound||!window.NextworkCatalogs)continue;input.dataset.catalogBound='true';input.removeAttribute('list');const id='role-choice-'+(++searchableSequence),label=input.getAttribute('aria-label')||input.closest('label')?.firstChild?.textContent?.trim()||'Target role',ui=makeSearchUI(input,label,id);let items=[],active=-1;
  const choose=item=>{input.value=item.label;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));closeSearchUI(ui);};
  const paint=()=>{items=searchRank(window.NextworkCatalogs.roles,input.value,10).map(label=>({label}));active=Math.min(active,items.length-1);paintSearchRows(ui,items,active,item=>item.label===input.value,choose,input.value,window.NextworkCatalogs.roles.length);ui.head.firstChild.textContent='Suggested roles';};
  input.addEventListener('focus',()=>{active=-1;paint()});input.addEventListener('input',()=>{active=0;paint()});input.addEventListener('blur',()=>closeSearchUI(ui));input.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1)));paint()}else if(e.key==='Enter'&&!ui.popup.hidden&&active>=0&&items[active]){e.preventDefault();choose(items[active])}else if(e.key==='Escape'){e.preventDefault();closeSearchUI(ui)}});ui.toggle.onmousedown=e=>e.preventDefault();ui.toggle.onclick=()=>{if(ui.popup.hidden){input.focus();paint()}else closeSearchUI(ui)};
 }
}
if(typeof MutationObserver!=='undefined'){
 let scheduled=false;new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('select,input[data-search-catalog]')||n.querySelector('select,input[data-search-catalog]')))||r.type==='attributes'&&r.target.tagName==='SELECT')&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;enhanceSearchSelects()});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
}
