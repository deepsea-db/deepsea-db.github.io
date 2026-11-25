/* Public assay projection -> shared system summaries and original row-bound details. */
(function(){
 'use strict';
 const matchesState=(state,filter)=>!filter||state===filter||(filter==='restricted'&&state!=='checked');
 function selectSystems(entries,compounds,{q='',category='',endpoint='',evidence='',sort='count'}={}){
  const names=new Map(compounds.map(c=>[c.file,c.name])),query=q.trim().toLocaleLowerCase('en');
  return entries.filter(e=>{
   const v=e.metadata.assay_browse;
   const match=v.facets.some(f=>(!category||f.category===category)&&(!endpoint||f.endpoint===endpoint)&&matchesState(f.state,evidence));
   const terms=[e.name,e.key,...Object.keys(v.categories),...Object.keys(v.endpoints),...v.pmids,...v.dois,...e.compound_ids.flatMap(f=>[f,names.get(f)])];
   return match&&(!query||terms.some(t=>String(t||'').toLocaleLowerCase('en').includes(query)));
  }).sort((a,b)=>(sort==='name'?0:b.compound_count-a.compound_count)||a.name.localeCompare(b.name,'en'));
 }
 function selectRecords(rows,{q='',endpoint='',evidence='',sort='name'}={}){
  const query=q.trim().toLocaleLowerCase('en');
  return rows.filter(r=>(!endpoint||r.endpoint===endpoint)&&matchesState(r.state,evidence)&&(!query||r.search.toLocaleLowerCase('en').includes(query))).sort((a,b)=>(sort==='source'?0:a.compound.localeCompare(b.compound,'en'))||a.index-b.index);
 }
 const summarize=entries=>({systems:entries.length,compounds:new Set(entries.flatMap(e=>e.compound_ids)).size,records:entries.reduce((n,e)=>n+e.row_count,0)});
 const core={selectSystems,selectRecords,summarize};if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(typeof document==='undefined')return;
 const db=window.DeepSeaSite;if(!db||document.body.dataset.siteView!=='system')return;
 const N=value=>window.ActivityResultDisplay.notationHTML(value);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString('en'),params=new URLSearchParams(location.search),entries=Object.values(db.entities.system),by=new Map(db.compounds.map(c=>[c.file,c]));
 const search=document.getElementById('assay-search'),endpoint=document.getElementById('assay-endpoint'),sort=document.getElementById('assay-sort'),reset=document.getElementById('assay-reset'),choices=document.getElementById('assay-choices');if(!search)return;
 const detail=document.getElementById('assay-detail'),category=document.getElementById('assay-category');
 let evidence=params.get('evidence')||'',page=Math.max(0,(Number(params.get('page'))||1)-1);const size=detail?15:12;
 search.value=params.get('q')||'';
 function options(el,values,caption){el.innerHTML='<option value="">'+caption+'</option>'+[...new Set(values)].sort((a,b)=>a.localeCompare(b,'en')).map(v=>'<option>'+esc(v)+'</option>').join('');}
 function summary(host,pairs){host.innerHTML=pairs.map(([count,label])=>'<div><strong>'+fmt(count)+'</strong><span>'+label+'</span></div>').join('');}
 function writeURL(){const u=new URL(location.href);for(const[k,v]of [['q',search.value],['category',category?.value||''],['endpoint',endpoint.value],['evidence',evidence],['sort',sort.value===(detail?'name':'count')?'':sort.value],['page',page?String(page+1):'']]){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);}
 function paginate(count){const pages=Math.ceil(count/size);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));for(const s of ['','-top']){document.getElementById('assay-page'+s).textContent='Page '+(pages?page+1:0)+' of '+pages;document.getElementById('assay-prev'+s).disabled=page===0;document.getElementById('assay-next'+s).disabled=page+1>=pages;}}
 function common(render){
  [search,category,endpoint,sort].filter(Boolean).forEach(el=>el.addEventListener(el===search?'input':'change',()=>{page=0;render();}));
  choices.addEventListener('click',event=>{const b=event.target.closest('[data-assay-choice]');if(b){evidence=b.dataset.assayChoice;page=0;render();}});
  reset.addEventListener('click',()=>{search.value='';endpoint.value='';if(category)category.value='';evidence='';sort.value=detail?'name':'count';page=0;render();});
  for(const s of ['','-top'])for(const[id,delta]of [['assay-prev',-1],['assay-next',1]])document.getElementById(id+s).addEventListener('click',()=>{page+=delta;render();document.getElementById('assay-results').scrollIntoView({block:'start'});});
 }
 function updateChoices(count){choices.querySelectorAll('[data-assay-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.assayChoice===evidence));b.querySelector('span').textContent=fmt(count(b.dataset.assayChoice));});reset.disabled=!search.value&&!endpoint.value&&!category?.value&&!evidence&&sort.value===(detail?'name':'count');}
 if(detail){
  const nodes=[...document.querySelectorAll('#assay-records [data-view-id]')],rows=nodes.map((node,index)=>({node,index,endpoint:node.dataset.endpoint,state:node.dataset.recordState,compound:node.dataset.compoundName,compoundId:node.dataset.compoundId,search:[node.dataset.compoundName,node.dataset.compoundId,node.textContent,...[...node.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))].join(' ')}));
  options(endpoint,rows.map(r=>r.endpoint),'All endpoints');if([...endpoint.options].some(o=>o.value===params.get('endpoint')))endpoint.value=params.get('endpoint');sort.value=params.get('sort')==='source'?'source':'name';if(!['','checked','held','pending','restricted'].includes(evidence))evidence='';
  summary(document.getElementById('assay-detail-summary'),[[new Set(rows.map(r=>r.compoundId)).size,'associated compounds'],[rows.length,'displayed records']]);
  const host=document.getElementById('assay-records');
  function render(){
   const selected=selectRecords(rows,{q:search.value,endpoint:endpoint.value,evidence,sort:sort.value});paginate(selected.length);const visible=new Set(selected.slice(page*size,(page+1)*size));rows.forEach(r=>{r.node.hidden=!visible.has(r);});selected.forEach(r=>host.append(r.node));
   const first=selected.length?page*size+1:0,last=Math.min((page+1)*size,selected.length),compounds=new Set(selected.map(r=>r.compoundId)).size;
   document.getElementById('assay-count').textContent='Showing '+fmt(first)+'–'+fmt(last)+' of '+fmt(selected.length)+' '+(selected.length===1?'record':'records')+' · '+fmt(compounds)+' '+(compounds===1?'compound':'compounds');document.getElementById('assay-empty').hidden=selected.length>0;
   updateChoices(state=>rows.filter(r=>matchesState(r.state,state)).length);writeURL();
  }
  common(render);render();return;
 }
 if(!['','checked','restricted'].includes(evidence))evidence='';
 options(category,entries.flatMap(e=>Object.keys(e.metadata.assay_browse.categories)),'All recorded categories');options(endpoint,entries.flatMap(e=>Object.keys(e.metadata.assay_browse.endpoints)),'All endpoints');
 for(const[el,key]of [[category,'category'],[endpoint,'endpoint']])if([...el.options].some(o=>o.value===params.get(key)))el.value=params.get(key);
 sort.value=params.get('sort')==='name'?'name':'count';const metrics=db.assay_browse.metrics;
 summary(document.getElementById('assay-summary'),[[metrics.systems,'recorded system labels'],[metrics.compounds,'associated compounds'],[metrics.records,'displayed records']]);
 function card(e){
  const v=e.metadata.assay_browse,states=[['checked','primary checked'],['held','restricted'],['pending','pending']].filter(([k])=>v.state_counts[k]).map(([k,label])=>'<span class="assay-record-state '+k+'">'+fmt(v.state_counts[k])+' '+label+'</span>').join('');
  const cats=Object.keys(v.categories),eps=Object.keys(v.endpoints),p=v.preview,c=p&&by.get(p.compound_id),state=p?(p.state.held?'held':p.state.checked?'checked':'pending'):'';
  const sample=p&&c?'<div class="assay-card-preview" data-preview-view-id="'+esc(p.view_id)+'" data-preview-row-sha256="'+esc(p.source_row_sha256)+'"><p class="assay-preview-label">Example record · '+(state==='checked'?'primary result checked':state==='held'?'restriction retained':'review pending')+'</p><a href="../1-Compounds/'+encodeURIComponent(c.file)+'#phenotypes">'+esc(c.name)+'</a><div class="assay-preview-result" data-original-value="'+esc(p.result)+'">'+N(p.display_result)+'</div></div>':'<div class="assay-card-preview"><p class="assay-preview-label">Associated compounds</p>'+e.compound_ids.slice(0,3).map(f=>'<a href="../1-Compounds/'+encodeURIComponent(f)+'#phenotypes">'+esc(by.get(f)?.name||f)+'</a>').join('')+'</div>';
  return '<article class="site-card assay-browser-card" data-system-key="'+esc(e.key)+'" data-compound-count="'+e.compound_count+'" data-record-count="'+e.row_count+'"><h2><a href="../'+esc(e.route)+'">'+esc(e.name)+'</a></h2><p class="assay-card-count"><strong>'+fmt(e.compound_count)+'</strong> '+(e.compound_count===1?'compound':'compounds')+' <span>· '+fmt(e.row_count)+' '+(e.row_count===1?'record':'records')+'</span></p><div class="assay-card-states">'+states+'</div><p class="assay-card-category" title="'+esc(cats.join(' · '))+'">'+esc(cats.slice(0,2).join(' · '))+(cats.length>2?' · +'+(cats.length-2)+' categories':'')+'</p><div class="assay-card-endpoints"><span>Endpoints</span>'+eps.slice(0,4).map(ep=>'<span class="assay-endpoint-tag">'+N(ep)+'</span>').join('')+(eps.length>4?'<span title="'+esc(eps.join(' · '))+'">+'+(eps.length-4)+' more</span>':'')+'</div>'+sample+'<a class="site-record-link" href="../'+esc(e.route)+'#assay-detail">Browse results & conditions →</a></article>';
 }
 function render(){
  const selected=selectSystems(entries,db.compounds,{q:search.value,category:category.value,endpoint:endpoint.value,evidence,sort:sort.value}),counts=summarize(selected);paginate(selected.length);
  document.getElementById('assay-grid').innerHTML=selected.slice(page*size,(page+1)*size).map(card).join('')||'<p class="site-empty">No systems match. Try another term or reset the filters.</p>';
  document.getElementById('assay-count').textContent='Showing '+fmt(selected.length?page*size+1:0)+'–'+fmt(Math.min((page+1)*size,selected.length))+' of '+fmt(selected.length)+' '+(selected.length===1?'system':'systems')+' · '+fmt(counts.compounds)+' associated '+(counts.compounds===1?'compound':'compounds');
  updateChoices(state=>selectSystems(entries,db.compounds,{evidence:state}).length);writeURL();
 }
 common(render);render();
})();
