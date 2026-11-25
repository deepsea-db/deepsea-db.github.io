/* Read-only citation metadata and evidence links from the shared compound model. */
(function(){
 'use strict';
 const term=q=>q.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?$/i,'$1').replace(/^PMID:\s*/i,'').toLocaleLowerCase('en');
 function select(entries,compounds,sources,{q='',year='',links='',sort='year'}={}){
  const names=new Map(compounds.map(c=>[c.file,c.name])),sourceNames=new Map(sources.map(s=>[s.id,s.name])),query=term(q);
  return entries.filter(e=>{
   const v=e.reference_browse,linkMatch=!links||(links==='source'?v.source_ids.length>0:links==='assay'?v.assay_matches.length>0:links==='restricted'?v.restricted_citation_count>0:false);
   const yearMatch=!year||(year==='unknown'?!v.years.length:v.years.includes(Number(year)));
   const text=[v.heading,...v.titles,...v.dois,...v.pmids,...v.years,...v.citations.flatMap(r=>[r.text,...Object.values(r.context).flat()]),...e.compound_ids.flatMap(f=>[f,names.get(f)]),...v.source_ids.map(id=>sourceNames.get(id))];
   return linkMatch&&yearMatch&&(!query||text.some(t=>String(t??'').toLocaleLowerCase('en').includes(query)));
  }).sort((a,b)=>{const title=()=>a.reference_browse.heading.localeCompare(b.reference_browse.heading,'en');return sort==='title'?title():sort==='count'?b.compound_ids.length-a.compound_ids.length||title():Math.max(-1,...b.reference_browse.years)-Math.max(-1,...a.reference_browse.years)||title();});
 }
 const summarize=entries=>({entries:entries.length,compounds:new Set(entries.flatMap(e=>e.compound_ids)).size,citations:entries.reduce((n,e)=>n+e.reference_browse.citations.length,0)});
 if(typeof module!=='undefined'&&module.exports)module.exports={select,summarize};
 if(typeof document==='undefined'||document.body.dataset.siteView!=='reference')return;
 const db=window.DeepSeaSite;if(!db)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString('en'),formatValue=v=>Array.isArray(v)?v.map(formatValue).join('; '):v&&typeof v==='object'?JSON.stringify(v):String(v??'');
 const entries=db.references,sources=Object.values(db.entities.source),sourceBy=new Map(sources.map(s=>[s.id,s])),by=new Map(db.compounds.map(c=>[c.file,c])),systems=new Map(Object.values(db.entities.system).map(s=>[s.key,s])),params=new URLSearchParams(location.search);
 const search=document.getElementById('reference-search'),year=document.getElementById('reference-year'),sort=document.getElementById('reference-sort'),reset=document.getElementById('reference-reset'),choices=document.getElementById('reference-choices');
 const years=[...new Set(entries.flatMap(e=>e.reference_browse.years))].sort((a,b)=>b-a);year.innerHTML='<option value="">All recorded years</option>'+years.map(y=>'<option>'+y+'</option>').join('')+'<option value="unknown">Year not recorded</option>';
 search.value=params.get('q')||'';const initialYear=params.get('year')||params.get('category')||'';year.value=years.includes(Number(initialYear))?initialYear:['unknown','Year not recorded'].includes(initialYear)?'unknown':'';
 sort.value=['count','title'].includes(params.get('sort'))?params.get('sort'):'year';let linkFilter=['source','assay','restricted'].includes(params.get('links'))?params.get('links'):'',page=Math.max(0,(Number(params.get('page'))||1)-1);const size=10;
 const m=db.reference_browse.metrics;document.getElementById('reference-summary').innerHTML=[[m.entries,'reference entries'],[m.compounds,'associated compounds'],[m.citation_occurrences,'compound citation records']].map(([n,label])=>'<div><strong>'+fmt(n)+'</strong><span>'+label+'</span></div>').join('');
 const compoundLink=(f,section='references')=>'../1-Compounds/'+encodeURIComponent(f)+'#'+section;
 const external=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';
 function qualifierRows(v){
  const visible=Object.entries(v.qualification_counts).filter(([status])=>db.reference_browse.qualification_labels[status]);
  return visible.map(([status,n])=>'<p class="reference-qualification'+(status.includes('withdrawn')||status.includes('conflict')?' is-restricted':'')+'">'+esc(db.reference_browse.qualification_labels[status])+' <span>('+fmt(n)+' citation '+(n===1?'record':'records')+')</span></p>').join('')+(v.restricted_citation_count&&!visible.some(([s])=>s.includes('withdrawn')||s.includes('conflict'))?'<p class="reference-qualification is-restricted">Identifier use is restricted on '+fmt(v.restricted_citation_count)+' citation '+(v.restricted_citation_count===1?'record':'records')+'.</p>':'');
 }
 function sourceList(v,limit){
  const list=v.source_ids.map(id=>sourceBy.get(id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  return list.slice(0,limit??list.length).map(s=>'<a href="../'+esc(s.route)+'">'+esc(s.name)+'</a>').join('');
 }
 function originalRecords(v){
  return v.citations.map(r=>{
   const ctx=r.context,fields=[['Recorded year',r.year===9999?'Not recorded':r.year],['DOI',r.doi],['PubMed ID',r.pmid],['Reference role',ctx.reference_role],['Paper role',ctx.paper_role],['Reported compound number',ctx.compound_number],['Comparison compound number',ctx.compound_number_in_comparison],['Reported compound name',ctx.compound_name],['Identifier restriction',ctx.identifier_use_restriction],['Relationship checked',ctx.relationship_checked],['Recorded citation status',r.reference_status]];
   return '<article class="reference-citation-record" data-citation-compound="'+esc(r.compound_id)+'" data-citation-index="'+r.source_index+'" data-citation-sha256="'+esc(r.source_sha256)+'"><h4><a href="'+compoundLink(r.compound_id)+'">'+esc(by.get(r.compound_id)?.name||r.compound_id)+'</a></h4><p class="reference-original-text">'+esc(r.text)+'</p><dl>'+fields.filter(([label,value])=>value!==undefined&&value!==null&&value!=='').map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(formatValue(value))+'</dd></div>').join('')+'</dl>'+(r.evidence_locator?'<p class="reference-locator">'+esc(formatValue(r.evidence_locator))+'</p>':'')+'</article>';
  }).join('');
 }
 function card(e){
  const v=e.reference_browse,compounds=e.compound_ids.map(f=>by.get(f)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'en')),sourceCount=v.source_ids.length;
  const identifiers=[...v.dois.map(doi=>external('https://doi.org/'+encodeURIComponent(doi).replace(/%2F/gi,'/'),'DOI '+doi)),...v.pmids.map(pm=>external('https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(pm)+'/','PubMed '+pm))].join('');
  const author=(v.fields.authors[0]??v.fields.author[0]),journal=v.fields.journal[0],byline=[author?formatValue(author):'',journal?formatValue(journal):''].filter(Boolean).join(' · ');
  const assayGroups=new Map();v.assay_matches.forEach(r=>assayGroups.set(r.system,(assayGroups.get(r.system)||0)+1));
  const relatedSystems=[...assayGroups].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'en')).map(([name,n])=>{const s=systems.get(name);return s?'<li><a href="../'+esc(s.route)+'">'+esc(name)+'</a> · '+fmt(n)+' '+(n===1?'record':'records')+'</li>':'';}).join('');
  const sourceStates=v.source_matches.reduce((a,r)=>{a[r.state.held?'held':r.state.checked?'checked':'pending']++;return a;},{checked:0,held:0,pending:0});
  return '<article class="site-card reference-card" data-reference-id="'+esc(e.id)+'" data-reference-compound-count="'+e.compound_ids.length+'" data-reference-citation-count="'+v.citations.length+'"><div class="reference-card-main"><p class="reference-year">'+(v.years.length?esc(v.years.join(' / ')):'Year not recorded')+'</p><h2>'+esc(v.heading)+'</h2>'+(byline?'<p class="reference-byline">'+esc(byline)+'</p>':'')+'<div class="reference-identifiers">'+(identifiers||'<span>No DOI or PubMed identifier recorded</span>')+'</div>'+qualifierRows(v)+'</div><aside class="reference-card-related"><h3>'+fmt(e.compound_ids.length)+' '+(e.compound_ids.length===1?'compound':'compounds')+'</h3><div class="reference-compound-preview">'+compounds.slice(0,3).map(c=>'<a href="'+compoundLink(c.file)+'">'+esc(c.name)+'</a>').join('')+(compounds.length>3?'<span>+'+fmt(compounds.length-3)+' more</span>':'')+'</div><h3>'+fmt(sourceCount)+' linked source '+(sourceCount===1?'profile':'profiles')+'</h3><div class="reference-source-preview">'+sourceList(v,2)+(sourceCount>2?'<span>+'+fmt(sourceCount-2)+' more</span>':'')+'</div><p class="reference-assay-count">'+fmt(v.assay_matches.length)+' linked assay '+(v.assay_matches.length===1?'record':'records')+'</p></aside><details class="reference-record-details"><summary>Related records & original citations <span>('+fmt(v.citations.length)+')</span></summary><div class="reference-related-lists"><section><h3>All associated compounds</h3>'+compounds.map(c=>'<a href="'+compoundLink(c.file)+'">'+esc(c.name)+'</a>').join('')+'</section>'+(sourceCount?'<section><h3>Identifier-linked source profiles</h3>'+sourceList(v)+'<p class="reference-link-scope">Source record states: '+Object.entries(sourceStates).filter(([k,n])=>n).map(([k,n])=>fmt(n)+' '+k).join(' · ')+'</p></section>':'')+(relatedSystems?'<section><h3>Identifier-linked assay systems</h3><ul>'+relatedSystems+'</ul></section>':'')+'</div><h3>Original compound citation records</h3><p class="reference-link-scope">Roles, identifiers and qualifications apply to individual stored citations; identifier matching does not upgrade them.</p>'+originalRecords(v)+'</details></article>';
 }
 function render(){
  const selected=select(entries,db.compounds,sources,{q:search.value,year:year.value,links:linkFilter,sort:sort.value}),stats=summarize(selected),pages=Math.ceil(selected.length/size);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  document.getElementById('reference-grid').innerHTML=selected.slice(page*size,(page+1)*size).map(card).join('')||'<p class="site-empty">No references match. Try a title, identifier, compound or source name, or reset the filters.</p>';
  document.getElementById('reference-count').textContent='Showing '+fmt(selected.length?page*size+1:0)+'–'+fmt(Math.min((page+1)*size,selected.length))+' of '+fmt(stats.entries)+' '+(stats.entries===1?'entry':'entries')+' · '+fmt(stats.compounds)+' associated '+(stats.compounds===1?'compound':'compounds');
  for(const s of ['','-top']){document.getElementById('reference-page'+s).textContent='Page '+(pages?page+1:0)+' of '+pages;document.getElementById('reference-prev'+s).disabled=page===0;document.getElementById('reference-next'+s).disabled=page+1>=pages;}
  choices.querySelectorAll('[data-reference-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.referenceChoice===linkFilter));b.querySelector('span').textContent=fmt(select(entries,db.compounds,sources,{links:b.dataset.referenceChoice}).length);});
  reset.disabled=!search.value&&!year.value&&!linkFilter&&sort.value==='year';
  const u=new URL(location.href);u.searchParams.delete('category');for(const[k,v]of [['q',search.value],['year',year.value],['links',linkFilter],['sort',sort.value==='year'?'':sort.value],['page',page?String(page+1):'']]){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);
 }
 [search,year,sort].forEach(el=>el.addEventListener(el===search?'input':'change',()=>{page=0;render();}));
 choices.addEventListener('click',event=>{const b=event.target.closest('[data-reference-choice]');if(b){linkFilter=b.dataset.referenceChoice;page=0;render();}});
 reset.addEventListener('click',()=>{search.value='';year.value='';sort.value='year';linkFilter='';page=0;render();});
 for(const s of ['','-top'])for(const[id,delta]of [['reference-prev',-1],['reference-next',1]])document.getElementById(id+s).addEventListener('click',()=>{page+=delta;render();document.getElementById('reference-results').scrollIntoView({block:'start'});});
 render();
})();
