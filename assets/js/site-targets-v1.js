(function(){
 'use strict';
 const kinds={primary_assay:'Primary assay records',withheld:'Unverified annotations · values withheld',identity_held:'Records with compound identity restrictions',recorded:'Recorded annotations'};
 const records=e=>e.metadata.target_browse.records;
 function select(entries,compounds,{q='',evidence='',category='',sort='count'}={}){
  const names=new Map(compounds.map(c=>[c.file,c.name])),query=q.trim().toLocaleLowerCase('en');
  return entries.filter(e=>{
   const v=e.metadata.target_browse;
   const matchesEvidence=!evidence||(evidence==='primary'?v.kind_counts.primary_assay>0:evidence==='pending'?v.kind_counts.withheld+v.kind_counts.identity_held+v.kind_counts.recorded>0:evidence==='binding'?records(e).some(r=>r.direct_binding_confirmed):false);
   const matchesCategory=!category||(category==='__not_reported'?records(e).some(r=>!r.category):v.categories.includes(category));
   const terms=[e.name,e.key,...v.categories,...v.genes,...v.uniprot_ids,...e.compound_ids.flatMap(f=>[f,names.get(f)]),...records(e).flatMap(r=>[r.reported_name,r.reference.pmid,r.reference.doi])];
   return matchesEvidence&&matchesCategory&&(!query||terms.some(t=>String(t||'').toLocaleLowerCase('en').includes(query)));
  }).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'en'):sort==='primary'?b.metadata.target_browse.kind_counts.primary_assay-a.metadata.target_browse.kind_counts.primary_assay||a.name.localeCompare(b.name,'en'):b.compound_count-a.compound_count||a.name.localeCompare(b.name,'en'));
 }
 const summarize=entries=>({labels:entries.length,compounds:new Set(entries.flatMap(e=>e.compound_ids)).size,records:entries.reduce((n,e)=>n+e.row_count,0)});
 const core={select,summarize};if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(typeof document==='undefined')return;
 const db=window.DeepSeaSite,view=document.body.dataset.siteView;if(!db||!['target','target-detail'].includes(view))return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const by=new Map(db.compounds.map(c=>[c.file,c])),entries=Object.values(db.entities.target),params=new URLSearchParams(location.search),fmt=n=>n.toLocaleString('en');
 const compoundLink=(f,section='targets')=>'../1-Compounds/'+encodeURIComponent(f)+'#'+section;
 if(view==='target-detail'){
  const query=params.get('id')||params.get('target')||params.get('name')||'',entry=entries.find(e=>[e.id,e.key,e.name].includes(query)),host=document.getElementById('dynamic-detail');
  if(entry){document.querySelector('h1').textContent=entry.name;host.innerHTML='<p>Open the current target page to inspect its compound-linked records and evidence states.</p><a href="../'+esc(entry.route)+'">View target records →</a>';location.replace('../'+entry.route+location.hash);}
  else host.innerHTML='<p>Choose a recorded target label.</p><a href="browse-targets.html">Browse target annotations →</a>';
  return;
 }
 const grid=document.getElementById('target-grid');if(!grid)return;
 const search=document.getElementById('target-search'),filter=document.getElementById('target-evidence'),category=document.getElementById('target-category'),sort=document.getElementById('target-sort'),reset=document.getElementById('target-reset');
 const cats=[...new Set(entries.flatMap(e=>e.metadata.target_browse.categories))].sort();
 category.innerHTML='<option value="">All recorded categories</option>'+cats.map(c=>'<option>'+esc(c)+'</option>').join('')+'<option value="__not_reported">Category not recorded</option>';
 search.value=params.get('q')||'';filter.value=['primary','pending','binding'].includes(params.get('evidence'))?params.get('evidence'):'';sort.value=['name','primary'].includes(params.get('sort'))?params.get('sort'):'count';
 const initialCategory=params.get('category');category.value=cats.includes(initialCategory)||initialCategory==='__not_reported'?initialCategory:initialCategory==='Other'?'__not_reported':'';
 let page=Math.max(0,(Number(params.get('page'))||1)-1),size=12;
 const metrics=db.target_browse.metrics;
 document.getElementById('target-summary').innerHTML='<div><strong>'+fmt(metrics.labels)+'</strong><span>recorded target labels</span></div><div><strong>'+fmt(metrics.compounds)+'</strong><span>associated compounds</span></div><div><strong>'+fmt(metrics.records)+'</strong><span>annotation records</span></div><div><strong>'+fmt(metrics.direct_binding_records)+'</strong><span>binding evidence records</span></div>';
 const bars=(rows,labelKey,countKey,kind)=>{
  const max=Math.max(1,...rows.map(r=>r[countKey]));
  return rows.map(r=>'<button type="button" class="target-distribution-row" data-target-chart-'+kind+'="'+esc(r[labelKey])+'"><span>'+esc(r[labelKey])+'</span><span class="target-distribution-track" aria-hidden="true"><span style="width:'+100*r[countKey]/max+'%"></span></span><span>'+fmt(r[countKey])+'</span></button>').join('');
 };
 document.getElementById('target-category-bars').innerHTML=bars(db.target_browse.category_distribution,'category','records','category');
 document.getElementById('target-label-bars').innerHTML=bars([...entries].sort((a,b)=>b.row_count-a.row_count||a.name.localeCompare(b.name,'en')).slice(0,8),'name','row_count','label');
 document.querySelector('.target-distributions').addEventListener('click',event=>{
  const node=event.target.closest('[data-target-chart-category],[data-target-chart-label]');if(!node)return;
  if(node.dataset.targetChartCategory!==undefined){category.value=node.dataset.targetChartCategory==='Category not recorded'?'__not_reported':node.dataset.targetChartCategory;search.value='';}
  else{search.value=node.dataset.targetChartLabel;category.value='';}
  page=0;render();document.getElementById('target-results').scrollIntoView({block:'start'});
 });
 function card(e){
  const v=e.metadata.target_browse,counts=Object.entries(kinds).filter(([k])=>v.kind_counts[k]).map(([k,label])=>'<p class="target-record-state '+k+'" data-record-kind="'+k+'">'+fmt(v.kind_counts[k])+' '+esc((v.kind_counts[k]===1?{primary_assay:'primary assay record',withheld:'unverified annotation · values withheld',identity_held:'record with compound identity restrictions',recorded:'recorded annotation'}[k]:label.toLowerCase()))+'</p>').join('');
  const examples=e.compound_ids.map(f=>by.get(f)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const refs=[...new Set(records(e).filter(r=>r.kind==='primary_assay').map(r=>r.reference.pmid).filter(Boolean))];
  const identifiers=[v.genes.length?'Gene: '+v.genes.join(' / '):'',v.uniprot_ids.length?'UniProt: '+v.uniprot_ids.join(' / '):''].filter(Boolean);
  return '<article class="site-card target-card" data-target-id="'+esc(e.id)+'" data-target-key="'+esc(e.key)+'" data-compound-count="'+e.compound_count+'" data-record-count="'+e.row_count+'"><h2><a href="../'+esc(e.route)+'">'+esc(e.name)+'</a></h2>'+(v.categories.length?'<p class="target-category">'+esc(v.categories.join(' · '))+'</p>':'')+(identifiers.length?'<p class="small">'+esc(identifiers.join(' · '))+'</p>':'')+'<p class="target-compound-count"><strong>'+fmt(e.compound_count)+'</strong> '+(e.compound_count===1?'compound':'compounds')+'</p><div class="target-record-states">'+counts+'</div><div class="target-compound-preview"><h3>Associated compounds</h3>'+examples.slice(0,3).map(c=>'<a href="'+compoundLink(c.file)+'">'+esc(c.name)+'</a>').join('')+(examples.length>3?'<a class="target-more" href="../'+esc(e.route)+'">+'+fmt(examples.length-3)+' more compounds</a>':'')+'</div>'+(refs.length?'<p class="target-citations">'+refs.slice(0,2).map(p=>'<a href="https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(p)+'/" target="_blank" rel="noopener noreferrer">PubMed '+esc(p)+' ↗</a>').join(' · ')+(refs.length>2?' · +'+(refs.length-2)+' more':'')+'</p>':'')+'<a class="site-record-link" href="../'+esc(e.route)+'#target-records">View records & evidence →</a></article>';
 }
 function render(){
  const selected=select(entries,db.compounds,{q:search.value,evidence:filter.value,category:category.value,sort:sort.value}),summary=summarize(selected),pages=Math.ceil(selected.length/size);
  page=Math.max(0,Math.min(page,Math.max(0,pages-1)));grid.innerHTML=selected.slice(page*size,(page+1)*size).map(card).join('')||'<div class="site-empty">No target labels match. Try another term or reset the filters.</div>';
  document.getElementById('target-count').textContent='Showing '+(selected.length?fmt(page*size+1):0)+'–'+fmt(Math.min((page+1)*size,selected.length))+' of '+fmt(summary.labels)+' target '+(summary.labels===1?'label':'labels')+' · '+fmt(summary.compounds)+' associated '+(summary.compounds===1?'compound':'compounds');
  for(const suffix of ['','-top']){document.getElementById('target-page'+suffix).textContent='Page '+(pages?page+1:0)+' of '+pages;document.getElementById('target-prev'+suffix).disabled=page===0;document.getElementById('target-next'+suffix).disabled=page+1>=pages;}
  reset.disabled=!search.value&&!filter.value&&!category.value&&sort.value==='count';
  document.querySelectorAll('[data-target-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.targetChoice===filter.value));const pool=select(entries,db.compounds,{evidence:b.dataset.targetChoice});b.querySelector('span').textContent=fmt(pool.length);});
  const url=new URL(location.href);for(const[k,v]of [['q',search.value],['evidence',filter.value],['category',category.value],['sort',sort.value==='count'?'':sort.value],['page',page?String(page+1):'']]){if(v)url.searchParams.set(k,v);else url.searchParams.delete(k);}if(url.href!==location.href)history.replaceState(null,'',url);
 }
 [search,filter,category,sort].forEach(el=>el.addEventListener(el===search?'input':'change',()=>{page=0;render();}));
 document.getElementById('target-choices').addEventListener('click',event=>{const b=event.target.closest('[data-target-choice]');if(b){filter.value=b.dataset.targetChoice;page=0;render();}});
 reset.addEventListener('click',()=>{search.value='';filter.value='';category.value='';sort.value='count';page=0;render();});
 for(const suffix of ['','-top'])for(const[id,delta]of [['target-prev',-1],['target-next',1]])document.getElementById(id+suffix).addEventListener('click',()=>{page+=delta;render();document.getElementById('target-results').scrollIntoView({block:'start'});});
 render();
})();
