/* Sources filters own the scope; the network is a view over their exact IDs. */
(function(root){'use strict';
 function scopedData(db,ids,fields){
  const all=new Map(Object.values(db.entities.source).map(s=>[s.id,s]));
  if(ids.some(id=>!all.has(id)))throw Error('Unknown source in network scope');
  const members=[...new Set(ids)].map(id=>all.get(id)),buckets=new Map(),groups=new Map(db.source_browse.groups.map(g=>[g.id,g.label])),roots=new Set(members.map(s=>s.metadata.browse_taxonomy.parent||s.metadata.browse_taxonomy.group)),qualify=!fields.group||roots.size>1;
  for(const s of members){const t=s.metadata.browse_taxonomy,base=t.parent||t.group;
   for(const raw of t.genera.length?t.genera:['Unresolved']){const name=qualify?(groups.get(base)||base)+' · '+raw:raw,key=base+'\n'+raw;
    if(!buckets.has(key))buckets.set(key,{name,raw,rootGroup:base,source_ids:[],href:'../pages/browse-strains.html?'+new URLSearchParams({group:base,genus:raw==='Unresolved'?'__unresolved':raw})});buckets.get(key).source_ids.push(s.id);}
  }
  return {members,compound_ids:[...new Set(members.flatMap(s=>s.compound_ids))],genera:[...buckets.values()].sort((a,b)=>b.source_ids.length-a.source_ids.length||a.name.localeCompare(b.name,'en'))};
 }
 function create({db,data,onGenus}){
  const host=document.getElementById('source-connections');if(!host)return null;
  const by=new Map(db.compounds.map(c=>[c.file,c])),sourcesBy=new Map(Object.values(db.entities.source).map(s=>[s.id,s])),svg=document.getElementById('source-network'),renderer=root.DeepSeaSourceNetwork.mount(svg,choose),initial=new URLSearchParams(location.search);
  let context=null,scope=null,fingerprint='',first=true,selected={genus:'',source:'',compound:''},pages={genus:0,source:0,compound:0};
  const detail=document.getElementById('inline-network-detail'),matches=document.getElementById('inline-network-matches'),search=document.getElementById('inline-network-search');
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const link=(label,href)=>{const n=el('a','',label);n.href=href;if(href.startsWith('https://')){n.target='_blank';n.rel='noopener noreferrer';}return n;};
  function branchFor(sid){return scope.genera.find(g=>g.name===selected.genus&&g.source_ids.includes(sid))||scope.genera.find(g=>g.source_ids.includes(sid));}
  function focusSource(sid,compound=''){
   if(!scope.members.some(s=>s.id===sid))return false;
   const branch=branchFor(sid);if(!branch)return false;
   selected={genus:branch.name,source:sid,compound:sourcesBy.get(sid).compound_ids.includes(compound)&&scope.compound_ids.includes(compound)?compound:''};pages={genus:0,source:0,compound:0};draw();return true;
  }
  function baseline(){selected={genus:'',source:'',compound:''};pages={genus:0,source:0,compound:0};if(context.fields.genus){const raw=context.fields.genus==='__unresolved'?'Unresolved':context.fields.genus,groups=scope.genera.filter(g=>g.raw===raw);if(groups.length===1)selected.genus=groups[0].name;}if(scope.members.length===1){selected.source=scope.members[0].id;selected.genus=branchFor(selected.source).name;}}
  function setScope(next){
   const key=JSON.stringify({ids:[...next.ids].sort(),fields:next.fields});context=next;scope=scopedData(db,next.ids,next.fields);
   if(key!==fingerprint){fingerprint=key;baseline();search.value='';matches.hidden=true;renderer.fit();if(first){const sid=initial.get('source_node'),fn=initial.get('product_node');if(scope.members.some(s=>s.id===sid)){const b=branchFor(sid);selected={genus:b.name,source:sid,compound:sourcesBy.get(sid).compound_ids.includes(fn)&&scope.compound_ids.includes(fn)?fn:''};}else if(scope.genera.some(g=>g.name===initial.get('network_branch')))selected.genus=initial.get('network_branch');}first=false;}
   draw();
  }
  function save(){const u=new URL(location.href);for(const [k,v]of [['network_branch',selected.genus],['source_node',selected.source],['product_node',selected.compound]]){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);}
  function draw(){
   if(!scope)return;
   host.dataset.scopeSourceIds=scope.members.map(s=>s.id).join(' ');host.dataset.scopeSourceCount=scope.members.length;
   const sources=Object.fromEntries(scope.members.map(s=>[s.id,{...s,state:data.source_states[s.id]}])),compounds=Object.fromEntries(scope.compound_ids.map(fn=>[fn,{...by.get(fn),image:data.compounds[fn].image}])),previews=selected.compound?(data.source_previews?.[selected.source]?.[selected.compound]||data.compounds[selected.compound].previews):[],targets=selected.compound?Object.values(db.entities.target).filter(e=>e.compound_ids.includes(selected.compound)):[];
   const graph=root.DeepSeaSourceNetwork.build({taxon:{id:'sources-inline',name:context.label,source_ids:scope.members.map(s=>s.id),compound_ids:scope.compound_ids},genera:scope.genera,sources,compounds,selected,previews,targets,pages,directSources:!!selected.genus&&(!!context.fields.genus||scope.members.length===1)});renderer.set(graph);
   svg.toggleAttribute('hidden',!scope.members.length);document.getElementById('inline-network-empty').hidden=!!scope.members.length;
   const selectionPath=document.getElementById('inline-network-path');selectionPath.textContent=[context.label,selected.genus&&!context.fields.genus?selected.genus:'',sourcesBy.get(selected.source)?.name,by.get(selected.compound)?.name].filter(Boolean).join(' / ');selectionPath.hidden=!selected.genus&&!selected.source&&!selected.compound;
   document.getElementById('inline-network-count').textContent=(scope.members.length?graph.nodes.length:0)+' visible nodes · '+graph.edges.length+' links';
   const pagers=document.getElementById('inline-network-pagers');pagers.replaceChildren();
   for(const [key,label]of [['genus','Genera'],['source','Sources'],['compound','Products']]){const w=graph.windows[key];if(w.count<=1||key==='genus'&&selected.genus)continue;const bar=el('div','source-network-pager');bar.append(el('span','',label+' '+w.start+'–'+w.end+' of '+w.total+(w.extra?' + selected':'')));for(const [caption,step,disabled]of [['Previous',-1,w.index===0],['Next',1,w.index+1===w.count]]){const b=el('button','',caption);b.type='button';b.disabled=disabled;b.dataset.inlinePage=key;b.dataset.inlineStep=step;bar.append(b);}pagers.append(bar);}
   document.getElementById('inline-network-back').disabled=!selected.genus&&!selected.source&&!selected.compound;
   const record=document.getElementById('inline-network-record');record.hidden=!selected.source;record.textContent=selected.compound?'Compound & sampling sources':'Source records & sampling';record.href=selected.compound?'../1-Compounds/'+encodeURIComponent(selected.compound)+'#sources':selected.source?'../'+sourcesBy.get(selected.source).route+'#source-records':'';
   renderDetail();save();
  }
  function renderDetail(){
   detail.replaceChildren();
   if(!selected.source){detail.append(el('p','small muted','Select a genus or source node to explore its products. The selected classification stays on this page.'));return;}
   const s=sourcesBy.get(selected.source),title=el('div','source-inline-detail-heading');title.append(el('h3','',selected.compound?by.get(selected.compound).name:s.name));
   const actions=el('div','taxon-flow-links');actions.append(link('Source records & sampling','../'+s.route+'#source-records'));
   if(!selected.compound){title.append(el('p','small muted',s.compound_count+' associated compounds · source records: '+data.source_states[s.id]),actions);detail.append(title);return;}
   const fn=selected.compound,m=by.get(fn),snapshot={...data.compounds[fn],previews:data.source_previews?.[selected.source]?.[fn]||data.compounds[fn].previews};
   if(snapshot.image){const image=el('img');image.src=snapshot.image;image.alt=m.name+' stored structure';title.prepend(image);}
   actions.append(link('Compound & all sampling sources','../1-Compounds/'+encodeURIComponent(fn)+'#sources'),link('All '+m.counts.activity_records+' results & conditions','../1-Compounds/'+encodeURIComponent(fn)+'#phenotypes'));title.append(actions);detail.append(title,el('p','small muted','Up to two stored results are shown, prioritizing shared cited references. These are compound-level activities; a shared reference does not establish the same strain-specific experiment.'));
   const cards=el('div','taxon-flow-result-grid');
   for(const r of snapshot.previews){const card=el('article','taxon-flow-result');card.dataset.inlineViewId=r.id;card.dataset.inlineRowSha256=r.source_row_sha256;card.dataset.inlineRecordState=r.state;card.append(r.system_href?link(r.system,r.system_href):el('strong','',r.system),el('p','connection-result-value',r.value),el('p','small muted',r.state_caption||(r.state==='checked'?'Primary result checked':r.state==='held'?'Evidence restriction retained':'Evidence review pending')));
    if(r.reference_context_label){const context=el('p','small muted',r.reference_context_label);context.dataset.referenceContext=r.reference_context;card.append(context);}const refs=el('div','connection-result-evidence');for(const ref of r.evidence)refs.append(link(ref.label,ref.href));if(!r.evidence.length)refs.append(el('span','small muted','No literature link recorded'));card.append(refs);cards.append(card);}
   if(!snapshot.previews.length)cards.append(el('p','small muted','No activity result recorded.'));detail.append(cards);
   const related=el('div','taxon-flow-relation-grid');
   for(const [kind,label]of [['system','Experimental systems'],['target','Target annotations']]){const entries=Object.values(db.entities[kind]).filter(e=>e.compound_ids.includes(fn)),part=el('div','taxon-flow-relations');part.append(el('h4','',label+' ('+entries.length+')'));const links=el('div','taxon-flow-links');for(const e of entries)links.append(link(e.name,'../'+e.route));if(entries.length>4){const disclosure=el('details');disclosure.append(el('summary','','View recorded labels'),links);part.append(disclosure);}else part.append(links);if(!entries.length)part.append(el('p','small muted','No '+(kind==='target'?'target annotation':'assay label')+' recorded.'));related.append(part);}detail.append(related);
  }
  function choose(n){
   if(n.action==='genus'){const g=scope.genera.find(g=>g.name===n.key);onGenus(g);return;}
   if(n.action==='source'){focusSource(n.key);return;}
   if(n.action==='compound'){if(sourcesBy.get(selected.source)?.compound_ids.includes(n.key)){selected.compound=n.key;draw();}return;}
   if(n.action==='reset'){baseline();draw();return;}
   if(n.action==='result'){const card=[...detail.querySelectorAll('[data-inline-view-id]')].find(c=>c.dataset.inlineViewId===n.key);if(card)card.scrollIntoView({block:'center',behavior:'smooth'});return;}
   if(n.action==='link'&&n.href){if(n.href.startsWith('https://'))window.open(n.href,'_blank','noopener,noreferrer');else location.href=n.href;}
  }
  document.getElementById('inline-network-reset').addEventListener('click',()=>{baseline();renderer.fit();draw();});
  document.getElementById('inline-network-back').addEventListener('click',()=>{if(selected.compound)selected.compound='';else if(selected.source)selected.source='';else if(context.fields.genus){onGenus({rootGroup:context.fields.group,raw:''});return;}else selected.genus='';draw();});
  for(const [id,fn]of [['inline-network-plus',()=>renderer.zoom(.8)],['inline-network-minus',()=>renderer.zoom(1.25)],['inline-network-fit',()=>renderer.fit()]])document.getElementById(id).addEventListener('click',fn);
  document.getElementById('inline-network-pagers').addEventListener('click',e=>{const b=e.target.closest('[data-inline-page]');if(b){pages[b.dataset.inlinePage]+=Number(b.dataset.inlineStep);draw();}});
  search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();matches.replaceChildren();matches.hidden=!q;if(!q)return;const found=[...scope.genera.map(g=>({kind:'genus',id:g.name,name:g.name})),...scope.members.map(s=>({kind:'source',id:s.id,name:s.name})),...scope.compound_ids.map(fn=>({kind:'compound',id:fn,name:by.get(fn).name}))].filter(v=>v.name.toLowerCase().includes(q));matches.append(el('p','small muted',found.length+' matches'+(found.length>8?' · first 8 shown; refine the search':'')));for(const v of found.slice(0,8)){const b=el('button','',v.name+' · '+v.kind);b.type='button';b.dataset.inlineMatchKind=v.kind;b.dataset.inlineMatchId=v.id;matches.append(b);}});
  matches.addEventListener('click',e=>{const b=e.target.closest('[data-inline-match-kind]');if(!b)return;const kind=b.dataset.inlineMatchKind,id=b.dataset.inlineMatchId;if(kind==='genus')onGenus(scope.genera.find(g=>g.name===id));else if(kind==='source')focusSource(id);else{const sid=selected.source&&sourcesBy.get(selected.source).compound_ids.includes(id)?selected.source:scope.members.find(s=>s.compound_ids.includes(id))?.id;if(sid)focusSource(sid,id);}matches.hidden=true;search.value='';renderer.fit();});
  return {setScope,focusSource};
 }
 const api={scopedData,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeepSeaSourceDirectoryNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
