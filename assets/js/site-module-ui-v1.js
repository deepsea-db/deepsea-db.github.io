 /* Shared module components: registered routes, source-bound statistics,
    declarative icons and scientific typography. No scientific values are written. */
(()=>{'use strict';
 const D=window.DeepSeaDisplayStatistics;if(!D)return;
 const base=new URL('../../',document.currentScript.src),fmt=n=>Number(n).toLocaleString('en-US');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let serial=0;
 const attrs=r=>r.path?`href="${esc(new URL(r.path,base).href)}"`:r.control?`type="button" data-pv-control="${esc(r.control)}" data-pv-value="${esc(r.selectValue??r.label)}"`:'';
 const tag=r=>r.path?'a':r.control?'button':'div';
 function bars(c){
  const max=c.max||Math.max(1,...c.rows.map(r=>r.value));
  return '<div class="pv-stat-bars">'+c.rows.map(r=>`<${tag(r)} class="pv-stat-row" ${attrs(r)} aria-label="${esc(r.label)}: ${fmt(r.value)} ${esc(c.unit||'compounds')}" title="${esc(r.label)}"><span class="pv-stat-label">${esc(r.label)}</span><span class="pv-stat-track"><span class="pv-stat-fill" style="width:${Math.max(0,r.value/max*100)}%;--pv-bar:${esc(r.color||c.color||'#087fb4')}"></span></span><span class="pv-stat-value">${fmt(r.value)}</span></${tag(r)}>`).join('')+'</div>';
 }
 function donut(c){
  const total=c.rows.reduce((n,r)=>n+r.value,0);let angle=0;
  const colors=c.rows.map(r=>{const start=angle;angle+=r.value/Math.max(total,1)*360;return`${r.color} ${start.toFixed(6)}deg ${angle.toFixed(6)}deg`;}).join(',');
  return `<div class="pv-stat-donut-layout"><div class="pv-stat-donut" role="img" aria-label="${esc(c.title)}: ${fmt(total)} ${esc(c.unit||'compounds')}" style="--pv-ring:conic-gradient(${colors})"><div class="pv-stat-center"><b>${fmt(total)}</b><span>${esc(c.unit||'compounds')}</span></div></div><div class="pv-stat-legend">${c.rows.map(r=>`<${tag(r)} class="pv-stat-legend-row" ${attrs(r)}><span class="pv-stat-dot" style="--pv-bar:${esc(r.color)}"></span><span>${esc(r.label)}</span><span class="pv-stat-legend-value">${fmt(r.value)} <span>(${(r.value/Math.max(total,1)*100).toFixed(1)}%)</span></span></${tag(r)}>`).join('')}</div></div>`;
 }
 function years(c){
  const max=Math.max(1,...c.rows.map(r=>r.value));
  return '<div class="pv-stat-year-chart" aria-label="Catalog entries by recorded publication year">'+c.rows.map((r,i)=>{
   const tick=i===0||i===c.rows.length-1||[1980,1990,2000,2010,2020].includes(Number(r.label));
   return `<button class="pv-stat-year" data-count="${r.value}" ${attrs(r)||'type="button"'} style="--pv-height:${r.value/max*100}%" aria-label="${esc(r.label)}: ${r.value} catalog entries"><span class="pv-stat-year-bar"></span><span class="pv-stat-year-tooltip">${esc(r.label)} · ${r.value}</span>${tick?`<span class="pv-stat-year-label">${esc(r.label)}</span>`:''}</button>`;
  }).join('')+'</div>';
 }
 function grouped(c){
  const max=Math.max(1,...c.groups.flatMap(g=>g.rows.map(r=>r.value)));
  return c.groups.map(g=>`<div class="pv-stat-matching-group"><h4 style="font-size:14px;margin:0 0 10px;color:#426780">${esc(g.label)}</h4>${bars({rows:g.rows,max,unit:c.unit})}</div>`).join('<div style="height:18px"></div>');
 }
 function card(c){
  const id='pv-stat-heading-'+(++serial),body=c.type==='donut'?donut(c):c.type==='years'?years(c):c.type==='grouped'?grouped(c):bars(c);
  return `<section class="pv-stat-card" aria-labelledby="${id}" data-pv-chart="${esc(c.key)}" data-pv-type="${esc(c.type)}"><h2 class="pv-stat-heading" id="${id}"><span class="pv-stat-symbol" aria-hidden="true">${c.type==='donut'?'◔':c.type==='years'?'▥':'▤'}</span>${esc(c.title)}</h2><div class="pv-stat-body">${body}</div>${c.note?`<p class="pv-stat-caption">${esc(c.note)}</p>`:''}</section>`;
 }
 function heatmap(h){
  const max=Math.max(1,...h.values.flat()),cell=(v)=>{
   const q=v/max,rgb=[243+(23-243)*q,248+(68-248)*q,251+(95-251)*q].map(Math.round);
   return `--pv-cell-bg:rgb(${rgb.join(',')});--pv-cell-ink:${q>.66?'#fff':'#183c54'}`;
  };
  return `<details class="pv-stat-relationships"><summary>${esc(h.title)}</summary><div class="pv-stat-heatmap-wrap"><table class="pv-stat-heatmap"><caption class="pv-stat-caption">${esc(h.note)}</caption><thead><tr><th scope="col">Chemical class</th>${h.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${h.rows.map((r,i)=>`<tr><th scope="row">${esc(r)}</th>${h.values[i].map((v,j)=>`<td style="${cell(v)}" title="${esc(r)} · ${esc(h.columns[j])}: ${v} compounds">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
 }
 function mount(config,anchor,{home=false,expander=false,open=true,before=false,inside=false}={}){
  if(!config||!anchor)return;
  const root=document.createElement('section');root.className='pv-statistics'+(home?' pv-home-statistics':'');root.dataset.pvStatistics='ready';root.setAttribute('aria-label','Collection statistics');
  root.innerHTML=(home?'<h2>Collection overview</h2>':'')+`<p class="pv-statistics-scope">${esc(config.scope||'Whole collection')}</p><div class="pv-statistics-grid">${config.cards.map(card).join('')}</div>`+(config.heatmaps||[]).map(heatmap).join('');
  if(expander){const box=document.createElement('details');box.className='pv-stat-expander';box.open=open;box.innerHTML='<summary>Collection statistics</summary>';box.append(root);if(inside)anchor.prepend(box);else if(before)anchor.before(box);else anchor.after(box);}
  else if(before)anchor.before(root);else anchor.after(root);
 }
 const policy=window.DeepSeaPageRules;
 if(!policy)throw new Error('Shared page composition rules are missing.');
 const view=document.body.dataset.siteView,isWorkbench=!!document.querySelector('#view-heading');
 const registration=Object.values(policy.module_pages).find(p=>p.view===(isWorkbench?'workbench':view));
 if(!registration)return;
 const generation=document.querySelector('meta[name="site-generation"]')?.content;
 if(generation&&generation!==D.base_generation)throw new Error('Statistics snapshot does not match this site generation.');
 if(registration.kind==='browse'){
  mount(D.pages[view],document.querySelector(registration.anchor));
  for(const selector of policy.hidden_original_statistics[view]||[])document.querySelectorAll(selector).forEach(e=>e.classList.add('pv-legacy-statistics'));
 }else{
  const query=new URLSearchParams(location.search),filtered=['compound','e_file','e_q','a','b'].some(k=>query.get(k));
  for(const spec of policy.workbench_statistics)mount(D.pages[spec.page],document.querySelector(spec.anchor),{expander:spec.expander,inside:spec.inside,open:spec.open_unfiltered?!filtered:false});
 }
 document.addEventListener('click',event=>{
  const row=event.target.closest('[data-pv-control]');if(!row)return;
  if(row.dataset.pvControl==='rcdb-choice'){document.querySelector(`[data-rcdb-choice="${CSS.escape(row.dataset.pvValue)}"]`)?.click();return;}
  const field=document.getElementById(row.dataset.pvControl);if(!field)return;
  const value=row.dataset.pvValue;
  if(field.tagName==='SELECT'&&![...field.options].some(o=>o.value===value))return;
  field.value=value;field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
  field.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});field.focus({preventScroll:true});
 });

 const re=/\b(?:IC|EC|CC|GI|LC|LD|ED|CTC)(?:50|90)\b|\bK(?:D|d)\b/g;
 const skip='script,style,pre,code,textarea,input,select,option,svg,math,[contenteditable],.pv-scientific-token,.identifier-value,.smiles-value';
 function formatNotation(root){
  if(!root||root.nodeType!==1||root.closest(skip))return;
  const nodes=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
   if(!n.parentElement||n.parentElement.closest(skip))return NodeFilter.FILTER_REJECT;
   re.lastIndex=0;return re.test(n.data)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
   re.lastIndex=0;let m,last=0,frag=document.createDocumentFragment();
   while((m=re.exec(node.data))){
    frag.append(document.createTextNode(node.data.slice(last,m.index)));
    const token=document.createElement('span');token.className='pv-scientific-token';
    const parts=/^([A-Z]+)(\d+)$/.exec(m[0]);
    token.append(document.createTextNode(parts?parts[1]:'K'));
    const sub=document.createElement('sub');sub.className='pv-scientific-sub';sub.textContent=parts?parts[2]:m[0].slice(1);token.append(sub);frag.append(token);
    last=m.index+m[0].length;
   }
   frag.append(document.createTextNode(node.data.slice(last)));node.replaceWith(frag);
  }
 }

 const {views,workbench,routeIcons,charts,drawings}=policy.icons;
 function svg(name,kind){
  const wrap=document.createElement('span');wrap.innerHTML=`<svg class="pv-module-icon ${kind}" data-pv-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[name]||drawings.activity}</svg>`;
  return wrap.firstElementChild;
 }
 function add(host,name,kind){
  if(!host)return;const prior=host.querySelector(':scope > .pv-module-icon');
  if(prior?.dataset.pvIcon===name)return;
  prior?.remove();host.prepend(svg(name,kind));
 }
 function decorateIcons(){
  const brand=document.querySelector(isWorkbench?'.sidebar>.brand':'.site-sidebar>.site-brand');
  if(brand&&!brand.classList.contains('pv-wave-brand')){
   const subtitle=brand.querySelector('small'),wave=document.createElement('span'),copy=document.createElement('span'),name=document.createElement('span'),db=document.createElement('span');
   wave.className='pv-wave-brand-icon';wave.setAttribute('aria-hidden','true');wave.textContent='🌊';
   copy.className='pv-wave-brand-copy';name.className='pv-wave-brand-name';name.append(document.createTextNode('Deep-Sea '));db.className='pv-wave-brand-db';db.textContent='DB';name.append(db);copy.append(name);if(subtitle)copy.append(subtitle);
   brand.replaceChildren(wave,copy);brand.classList.add('pv-wave-brand');
  }
  const heading=isWorkbench?document.querySelector('#view-heading'):document.querySelector('.site-page-header h1');
  const selected=isWorkbench?document.querySelector('[data-view-button].active')?.dataset.viewButton:null;
  if(heading){heading.classList.add('pv-module-heading');add(heading,isWorkbench?(workbench[selected]||'tools'):views[view],'pv-module-heading-icon');}
  document.querySelectorAll('.site-sidebar nav a').forEach(a=>{const key=a.getAttribute('href')?.split('/').pop()?.split('?')[0];if(routeIcons[key])add(a,routeIcons[key],'pv-module-nav-icon');});
  document.querySelectorAll('[data-view-button]').forEach(a=>{if(workbench[a.dataset.viewButton])add(a,workbench[a.dataset.viewButton],'pv-module-nav-icon');});
  document.querySelectorAll('[data-pv-chart]').forEach(c=>{
   const symbol=c.querySelector('.pv-stat-symbol'),key=c.dataset.pvChart,name=charts[key]||(c.dataset.pvType==='donut'?'ring':'activity');
   if(symbol&&symbol.querySelector('svg')?.dataset.pvIcon!==name)symbol.replaceChildren(svg(name,'pv-module-chart-icon'));
  });
  document.querySelectorAll('.pv-stat-relationships>summary').forEach(s=>add(s,'grid','pv-module-summary-icon'));
  document.querySelectorAll('.pv-stat-expander>summary').forEach(s=>add(s,'activity','pv-module-summary-icon'));
 }
 formatNotation(document.body);decorateIcons();
 let queued=false;
 const observer=new MutationObserver(()=>{
  if(queued)return;queued=true;
  queueMicrotask(()=>{queued=false;formatNotation(document.body);decorateIcons();});
 });
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 window.DeepSeaDisplayStatisticsReady=true;
 window.DeepSeaModuleIconsReady=true;
 window.DeepSeaScientificNotation={format:formatNotation};
 window.DeepSeaModuleUI={version:policy.version,format:formatNotation,refresh:decorateIcons};
})();
