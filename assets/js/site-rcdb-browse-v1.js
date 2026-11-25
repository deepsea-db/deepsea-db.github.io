/* Existing RCDB membership, current compound facts, and exact source-profile links. */
(function(){'use strict';
 function select(compounds,view,sources,{q='',chemicalClass='',source='',evidence='',sort='name'}={}){
  const sourceBy=new Map(sources.map(s=>[s.id,s])),query=q.trim().toLocaleLowerCase('en');
  return compounds.filter(c=>{
   const r=view.members[c.file];if(!r)return false;
   const names=r.source_ids.flatMap(id=>{const s=sourceBy.get(id);return s?[s.name,...(s.metadata.source_identity.observed_names||[])]:[];});
   return (!chemicalClass||c.chemotype===chemicalClass)&&(!source||r.source_ids.includes(source))&&(!evidence||(evidence==='with'?r.admitted_count>0:evidence==='without'?r.admitted_count===0:false))&&(!query||[c.name,c.file,c.formula,c.organism,...names].some(v=>String(v||'').toLocaleLowerCase('en').includes(query)));
  }).sort((a,b)=>{const name=()=>a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.file.localeCompare(b.file,'en');return sort==='evidence'?view.members[b.file].admitted_count-view.members[a.file].admitted_count||name():name();});
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={select};
 if(typeof document==='undefined'||document.body.dataset.siteView!=='center')return;
 const db=window.DeepSeaSite,v=db.rcdb_browse,$=id=>document.getElementById(id),E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString('en');
 const items=db.compounds.filter(c=>v.members[c.file]),allSources=Object.values(db.entities.source),sourceBy=new Map(allSources.map(s=>[s.id,s])),params=new URLSearchParams(location.search),size=12;
 const search=$('rcdb-browse-search'),chemicalClass=$('rcdb-browse-class'),source=$('rcdb-browse-source'),sort=$('rcdb-browse-sort'),reset=$('rcdb-browse-reset'),choices=$('rcdb-browse-choices');
 const classes=[...new Set(items.map(c=>c.chemotype))].sort((a,b)=>a.localeCompare(b,'en')),profiles=v.source_profiles.slice().sort((a,b)=>sourceBy.get(a.id).name.localeCompare(sourceBy.get(b.id).name,'en'));
 chemicalClass.innerHTML='<option value="">All classes</option>'+classes.map(k=>'<option>'+E(k)+'</option>').join('');
 source.innerHTML='<option value="">All recorded sources</option>'+profiles.map(s=>'<option value="'+E(s.id)+'">'+E(sourceBy.get(s.id).name)+' ('+s.compound_count+')</option>').join('');
 search.value=params.get('q')||'';if(classes.includes(params.get('category')))chemicalClass.value=params.get('category');if(profiles.some(s=>s.id===params.get('source')))source.value=params.get('source');if(params.get('sort')==='evidence')sort.value='evidence';
 let evidence=['with','without'].includes(params.get('evidence'))?params.get('evidence'):'',page=Math.max(0,(Number(params.get('page'))||1)-1);
 $('rcdb-browse-summary').innerHTML=[[v.metrics.members,'member compounds'],[v.metrics.admitted_rows,'admitted evidence rows'],[v.metrics.source_profiles,'linked source profiles']].map(([n,label])=>'<div><strong>'+fmt(n)+'</strong><span>'+label+'</span></div>').join('');
 const compoundUrl=c=>'../1-Compounds/'+encodeURIComponent(c.file),researchUrl=c=>'rcdb-research.html?compound='+encodeURIComponent(c.file);
 function sourceLink(id){const s=sourceBy.get(id);return '<a href="../'+E(s.route)+'" data-source-profile="'+E(id)+'">'+E(s.name)+'</a>';}
 function card(c){
  const r=v.members[c.file],formula=E(c.formula).replace(/([A-Za-z)\]])(\d+)/g,'$1<sub>$2</sub>'),sources=r.source_ids.slice().sort((a,b)=>sourceBy.get(a).name.localeCompare(sourceBy.get(b).name,'en'));
  const inventory=r.inventory_confirmation,inventoryNote=inventory?'<p class="rcdb-record-state" data-inventory-confirmation="'+E(inventory.confirmation_id)+'" data-literature-role="'+E(inventory.relationship_role)+'" title="Reported by the center on '+E(inventory.confirmed_on)+'">Screening-associated · Center-confirmed material</p>':'';
  return '<article class="site-card rcdb-compound-card" data-compound-id="'+E(c.file)+'" data-admitted-count="'+r.admitted_count+'" data-structure-restricted="'+r.structure_restricted+'"><a class="rcdb-compound-identity" href="'+compoundUrl(c)+'"><div class="rcdb-structure"><img src="../assets/img/compounds/'+encodeURIComponent(c.file.replace(/\.html$/,''))+'.png" alt="Stored structure of '+E(c.name)+'" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>Structure image unavailable</span></div><h2>'+E(c.name)+'</h2></a><p class="rcdb-formula">'+formula+' <span>· '+E(c.mw)+'</span></p><div class="site-tags"><span>'+E(c.chemotype)+'</span><span>'+E(c.depth_band)+'</span></div>'+inventoryNote+(c.classification_status==='unverified'?'<p class="rcdb-record-state">Chemical class unverified</p>':'')+(r.structure_restricted?'<p class="rcdb-record-state" data-structure-analysis="restricted">Structure analysis restricted</p>':'')+'<p class="rcdb-card-count"><strong>'+fmt(r.admitted_count)+'</strong> admitted evidence '+(r.admitted_count===1?'row':'rows')+' · '+fmt(c.counts.displayed_references)+' '+(c.counts.displayed_references===1?'reference':'references')+'</p>'+(c.counts.activity_records!==r.admitted_count?'<p class="rcdb-record-state">'+fmt(c.counts.activity_records)+' displayed activity records on the compound page</p>':'')+'<section class="rcdb-card-sources"><h3>Recorded sources</h3>'+sources.slice(0,2).map(sourceLink).join('')+(sources.length>2?'<details><summary>Show '+(sources.length-2)+' more</summary>'+sources.slice(2).map(sourceLink).join('')+'</details>':'')+'</section>'+(r.scaffold_id?'<a class="rcdb-scaffold-link" href="rcdb-research.html?scaffold='+encodeURIComponent(r.scaffold_id)+'">Stored scaffold '+E(r.scaffold_id.replace(/^s/,''))+' →</a>':'')+'<div class="rcdb-card-actions"><a href="'+compoundUrl(c)+'">View compound →</a><a href="'+researchUrl(c)+'">Research records →</a></div></article>';
 }
 function render(){
  const selected=select(items,v,allSources,{q:search.value,chemicalClass:chemicalClass.value,source:source.value,evidence,sort:sort.value}),pages=Math.ceil(selected.length/size);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  $('rcdb-browse-grid').innerHTML=selected.slice(page*size,(page+1)*size).map(card).join('')||'<p class="site-empty">No RCDB members match. Try another name or source, or reset the filters.</p>';
  $('rcdb-browse-count').textContent='Showing '+fmt(selected.length?page*size+1:0)+'–'+fmt(Math.min((page+1)*size,selected.length))+' of '+fmt(selected.length)+' '+(selected.length===1?'member':'members');
  for(const suffix of ['','-top']){$('rcdb-browse-page'+suffix).textContent='Page '+(pages?page+1:0)+' of '+pages;$('rcdb-browse-prev'+suffix).disabled=page===0;$('rcdb-browse-next'+suffix).disabled=page+1>=pages;}
  choices.querySelectorAll('[data-rcdb-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.rcdbChoice===evidence));b.querySelector('span').textContent=fmt(select(items,v,allSources,{evidence:b.dataset.rcdbChoice}).length);});
  reset.disabled=!search.value&&!chemicalClass.value&&!source.value&&!evidence&&sort.value==='name';
  const u=new URL(location.href);for(const[k,value]of [['q',search.value],['category',chemicalClass.value],['source',source.value],['evidence',evidence],['sort',sort.value==='name'?'':sort.value],['page',page?String(page+1):'']]){if(value)u.searchParams.set(k,value);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);
 }
 [search,chemicalClass,source,sort].forEach(el=>el.addEventListener(el===search?'input':'change',()=>{page=0;render();}));
 choices.addEventListener('click',event=>{const b=event.target.closest('[data-rcdb-choice]');if(b){evidence=b.dataset.rcdbChoice;page=0;render();}});
 reset.addEventListener('click',()=>{search.value='';chemicalClass.value='';source.value='';sort.value='name';evidence='';page=0;render();});
 for(const suffix of ['','-top'])for(const[id,delta]of [['rcdb-browse-prev',-1],['rcdb-browse-next',1]])$(id+suffix).addEventListener('click',()=>{page+=delta;render();$('rcdb-browse-results').scrollIntoView({block:'start'});});
 render();
})();
