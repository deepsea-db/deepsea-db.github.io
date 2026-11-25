/* One source-observation projection drives location maps, lists and detail joins. */
(function(global){'use strict';
 const fields=['ocean','sea','site'];
 function summarize(rows){return {rows,observation_count:rows.length,compound_ids:[...new Set(rows.map(r=>r.compound_id))].sort(),source_ids:[...new Set(rows.map(r=>r.source_id))].sort(),coordinate_observation_count:rows.filter(r=>r.coordinate_qualified).length};}
 function coordinates(rows){
  const groups=new Map();
  for(const row of rows){if(!row.coordinate_qualified||!Number.isFinite(row.latitude)||!Number.isFinite(row.longitude)||Math.abs(row.latitude)>90||Math.abs(row.longitude)>180)continue;const key=JSON.stringify([row.latitude,row.longitude]);if(!groups.has(key))groups.set(key,{latitude:row.latitude,longitude:row.longitude,rows:[]});groups.get(key).rows.push(row);}
  return [...groups.values()].map(g=>({...g,...summarize(g.rows)}));
 }
 function regions(rows,entities,level){
  const groups=new Map();for(const r of rows){if(!r[level])continue;const key=level+':'+r[level];if(!entities[key])throw Error('Location join missing: '+key);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  return [...groups].map(([key,members])=>({entity:entities[key],...summarize(members)}));
 }
 global.DeepSeaLocationCore={summarize,coordinates,regions};
 if(typeof document==='undefined')return;
 const db=global.DeepSeaSite,view=document.body.dataset.siteView;if(!db||!['location','location-detail'].includes(view))return;
 const data=db.location_browse,entities=db.entities.location,sourceBy=db.entities.source,compoundBy=new Map(db.compounds.map(c=>[c.file,c])),params=new URLSearchParams(location.search),byObservation=new Map(data.observations.map(r=>[r.id,r]));
 const levels=new Map(data.levels.map(l=>[l.id,l])),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=n=>Number(n).toLocaleString('en-US'),label=(n,s)=>num(n)+' '+s+(n===1?'':'s');
 const compoundLink=id=>'../1-Compounds/'+encodeURIComponent(id),sourceLink=id=>'../'+sourceBy[id].route;
 const coordinateLabel=g=>Math.abs(g.latitude).toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:8})+'°'+(g.latitude<0?'S':'N')+', '+Math.abs(g.longitude).toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:8})+'°'+(g.longitude<0?'W':'E');
 const sourceState=r=>r.state.held?'Held':r.state.checked?'Primary source checked':'Pending review';
 const coordinateByNumbers=new Map(data.coordinate_groups.map(g=>[JSON.stringify([g.latitude,g.longitude]),g]));
 function coordinateRows(rows){return coordinates(rows).map(g=>({...g,id:coordinateByNumbers.get(JSON.stringify([g.latitude,g.longitude])).id}));}
 function filteredRows(ocean,sea,q){const query=q.trim().toLowerCase();return data.observations.filter(r=>(!ocean||r.ocean===ocean)&&(!sea||r.sea===sea)&&(!query||[r.ocean,r.sea,r.site,r.location,r.recorded_source_name,sourceBy[r.source_id].name,compoundBy.get(r.compound_id).name].some(v=>String(v||'').toLowerCase().includes(query))));}
 function contextQuery(){const p=new URLSearchParams();for(const k of ['ocean','sea','q'])if(params.get(k))p.set(k,params.get(k));return p;}
 function entityLink(e){const q=contextQuery();if(!q.size)return '../'+e.route;q.set('id',e.key);return '../pages/location-detail.html?'+q.toString();}
 function coordinateLink(g){const q=contextQuery();q.set('coordinate',g.id);return '../pages/location-detail.html?'+q.toString();}
 function sourceTable(rows){
  const groups=new Map();for(const r of rows){if(!groups.has(r.source_id))groups.set(r.source_id,[]);groups.get(r.source_id).push(r);}
  return '<div class="site-table-wrap"><table class="site-table location-source-table"><thead><tr><th>Source / strain</th><th>Compounds</th><th>Source records</th><th>Source evidence</th></tr></thead><tbody>'+[...groups].sort(([a],[b])=>sourceBy[a].name.localeCompare(sourceBy[b].name,'en')).map(([id,members])=>{const s=summarize(members),counts={checked:0,held:0,pending:0};for(const r of members)counts[r.state.held?'held':r.state.checked?'checked':'pending']++;return '<tr data-location-source-id="'+esc(id)+'"><td><a href="'+esc(sourceLink(id))+'">'+esc(sourceBy[id].name)+'</a></td><td>'+s.compound_ids.length+'</td><td>'+members.length+'</td><td>'+[counts.checked?label(counts.checked,'primary checked record'):'',counts.held?label(counts.held,'held record'):'',counts.pending?label(counts.pending,'pending record'):''].filter(Boolean).join(' · ')+'</td></tr>';}).join('')+'</tbody></table></div>';
 }
 function compoundTable(ids){return '<section class="site-panel"><h2>Associated compounds · '+num(ids.length)+'</h2><div class="site-table-wrap"><table class="site-table"><thead><tr><th>Compound</th><th>Formula</th><th>Chemical class</th></tr></thead><tbody>'+ids.map(id=>{const c=compoundBy.get(id);return '<tr data-compound-id="'+esc(id)+'"><td><a href="'+compoundLink(id)+'">'+esc(c.name)+'</a></td><td>'+esc(c.formula)+'</td><td>'+esc(c.chemotype)+'</td></tr>';}).join('')+'</tbody></table></div></section>';}
 function detailHTML(title,rows,entity,includeCompounds){
  const s=summarize(rows),context=fields.map(field=>{const values=[...new Set(rows.map(r=>r[field]).filter(Boolean))];return values.length?'<div><dt>'+esc(levels.get(field).field_label)+'</dt><dd>'+values.sort().map(v=>'<a href="../'+esc(entities[field+':'+v].route)+'">'+esc(v)+'</a>').join(' · ')+'</dd></div>':'';}).join('');
  const observations=rows.map(r=>'<tr data-location-observation-id="'+esc(r.id)+'" data-source-sha256="'+esc(r.source_sha256)+'"><td><a href="'+compoundLink(r.compound_id)+'#sources">'+esc(compoundBy.get(r.compound_id).name)+'</a></td><td><a href="'+esc(sourceLink(r.source_id))+'">'+esc(r.recorded_source_name)+'</a></td><td>'+esc(r.location||'Not recorded')+'</td><td>'+(r.coordinate_qualified?esc(String(r.latitude)+', '+String(r.longitude)):'Not plotted')+'</td><td>'+esc(sourceState(r))+'</td></tr>').join('');
  return '<section class="site-panel location-detail-overview"><p class="location-field-label">'+esc(entity?levels.get(entity.metadata.level).field_label:'Reported coordinate group')+'</p><h2>'+esc(title)+'</h2><p class="location-detail-counts"><strong>'+label(s.compound_ids.length,'compound')+'</strong> · '+label(s.source_ids.length,'source profile')+' · '+label(s.observation_count,'source record')+'</p><dl class="location-context">'+context+'</dl><p class="location-scope-note">'+(entity?'This is a recorded region label; its illustrative map position is not a sampling coordinate.':'Only source-qualified coordinate records are included. Shared coordinates do not establish an independent sampling event.')+'</p></section><section class="site-panel"><h2>Sources · '+num(s.source_ids.length)+'</h2>'+sourceTable(rows)+'</section>'+(includeCompounds?compoundTable(s.compound_ids):'')+'<details class="site-panel location-observations"><summary>Source observations · '+num(rows.length)+'</summary><div class="site-table-wrap"><table class="site-table"><thead><tr><th>Compound</th><th>Recorded source</th><th>Original location</th><th>Latitude, longitude</th><th>Source evidence</th></tr></thead><tbody>'+observations+'</tbody></table></div></details>';
 }
 const mount=document.getElementById('location-details')||document.getElementById('dynamic-detail');
 if(mount){
  let entity=null,rows=[],title='';const pool=filteredRows(params.get('ocean')||'',params.get('sea')||'',params.get('q')||'');
  if(params.has('coordinate')){const group=data.coordinate_groups.find(g=>g.id===params.get('coordinate'));if(group){rows=pool.filter(r=>group.observation_ids.includes(r.id));title=coordinateLabel(group);}}
  else{const key=mount.dataset.locationKey||params.get('id')||params.get('loc')||params.get('name')||'',oldLevel=params.get('level'),level=['trench','seamount','feature'].includes(oldLevel)?'site':oldLevel;
   entity=entities[key]||Object.values(entities).find(e=>e.id===key)||null;
   if(!entity){const matches=Object.values(entities).filter(e=>e.name===key&&(!level||e.metadata.level===level));if(matches.length===1)entity=matches[0];else if(matches.length>1){mount.innerHTML='<section class="site-panel"><h2>Choose the recorded field</h2><p>This name occurs in more than one field.</p>'+matches.map(e=>'<p><a href="../'+esc(e.route)+'">'+esc(levels.get(e.metadata.level).field_label)+' · '+esc(e.name)+' ('+label(e.compound_count,'compound')+')</a></p>').join('')+'</section>';return;}}
   if(entity){rows=pool.filter(r=>r[entity.metadata.level]===entity.name);title=entity.name;}
  }
  if(title){if(view==='location-detail'){document.querySelector('h1').textContent=title;document.querySelector('.site-page-header p').textContent='Recorded collection context, source profiles and compound associations.';}mount.innerHTML=detailHTML(title,rows,entity,view==='location-detail');}
  else mount.innerHTML='<section class="site-panel"><p>No matching location is indexed under the current publication scope.</p><a href="../pages/browse-locations.html">Browse locations →</a></section>';
  return;
 }
 if(!document.getElementById('location-map'))return;
 const search=document.getElementById('location-search'),ocean=document.getElementById('location-ocean'),sea=document.getElementById('location-sea'),sort=document.getElementById('location-sort'),svg=document.getElementById('location-map'),grid=document.getElementById('location-grid'),levelHost=document.getElementById('location-levels'),selection=document.getElementById('location-selection');
 let mode=params.get('mode')==='coordinates'?'coordinates':'regions',level=levels.has(params.get('level')||params.get('category'))?(params.get('level')||params.get('category')):'ocean',selected=params.get('selected')||'',page=Math.max(0,(parseInt(params.get('page'),10)||1)-1),visibleGroups=[];const size=12;
 const options=(values,all)=>'<option value="">'+all+'</option>'+[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'en')).map(n=>'<option>'+esc(n)+'</option>').join('');
 ocean.innerHTML=options(data.observations.map(r=>r.ocean),'All recorded regions');if([...ocean.options].some(o=>o.value===params.get('ocean')))ocean.value=params.get('ocean');
 function updateSeas(value=sea.value){sea.innerHTML=options(data.observations.filter(r=>!ocean.value||r.ocean===ocean.value).map(r=>r.sea),'All recorded regions');sea.value=[...sea.options].some(o=>o.value===value)?value:'';}
 updateSeas(params.get('sea')||'');search.value=params.get('q')||'';if(params.get('sort')==='name')sort.value='name';
 levelHost.innerHTML=data.levels.map(l=>'<button type="button" data-location-level="'+l.id+'" aria-pressed="false">'+esc(l.label)+' <span>'+num(Object.values(entities).filter(e=>e.metadata.level===l.id).length)+'</span></button>').join('');
 const m=data.metrics;document.getElementById('location-coverage').innerHTML=num(m.without_structured_region_observations)+' source records have no structured region label. Their original descriptions remain available in <a href="../pages/browse-strains.html">Sources</a>.';document.getElementById('location-summary').innerHTML='<span><strong>'+num(m.location_labels)+'</strong> location labels</span><span><strong>'+num(m.located_source_profiles)+'</strong> linked source profiles</span><span><strong>'+num(m.located_compounds)+'</strong> associated compounds</span><span><strong>'+num(m.coordinate_observations)+'</strong> source records with usable coordinates</span>';
 function updateURL(){for(const [k,v]of [['mode',mode==='regions'?'':mode],['level',level==='ocean'?'':level],['ocean',ocean.value],['sea',sea.value],['q',search.value],['sort',sort.value==='name'?'name':''],['selected',selected],['page',page?String(page+1):'']]){if(v)params.set(k,v);else params.delete(k);}params.delete('category');const url=new URL(location.href);url.search=params.toString();if(url.href!==location.href)history.replaceState(null,'',url);}
 function detailLink(g){return mode==='regions'?entityLink(g.entity):coordinateLink(g);}
 function pickLabel(g){return mode==='regions'?g.entity.name:coordinateLabel(g);}
 function pickKey(g){return mode==='regions'?g.entity.key:g.id;}
 function map(groups){
  let h='<desc>'+(mode==='regions'?'Region circles are illustrative and are not sampling coordinates.':'Points include all qualifying source observations; no first-record-per-compound selection is used.')+'</desc><defs><pattern id="location-land-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#5b86a8"/></pattern><mask id="location-land-mask" mask-type="alpha"><image href="../assets/img/maps/world-land-only-v2.svg" width="1000" height="500"/></mask></defs><rect width="1000" height="500" fill="#0b1c2f"/><rect width="1000" height="500" fill="url(#location-land-dots)" mask="url(#location-land-mask)"/>';
  for(const [index,g]of groups.entries()){
   const anchor=mode==='regions'?g.entity.metadata.location_browse.illustration:{x:(g.longitude+180)/360*1000,y:(90-g.latitude)/180*500};if(!anchor)continue;
   const active=pickKey(g)===selected,r=mode==='regions'?Math.min(26,6+Math.sqrt(g.compound_ids.length)):Math.min(12,4+Math.sqrt(g.compound_ids.length)),fill=mode==='coordinates'?'#8ce0ed':{ocean:'#3188b5',sea:'#389f9c',site:'#d98b48'}[level];
   h+='<g role="button" tabindex="0" class="location-map-marker'+(active?' is-selected':'')+'" data-location-pick="'+esc(pickKey(g))+'" aria-label="'+esc(pickLabel(g)+'; '+label(g.compound_ids.length,'compound')+'; '+label(g.observation_count,'source record'))+'"><title>'+esc(pickLabel(g)+' · '+label(g.compound_ids.length,'compound'))+'</title><circle cx="'+anchor.x+'" cy="'+anchor.y+'" r="'+Math.max(9,r)+'" fill="transparent"/><circle cx="'+anchor.x+'" cy="'+anchor.y+'" r="'+r+'" fill="'+fill+'" fill-opacity=".8" stroke="'+(active?'#ffd166':'#e3f3fa')+'" stroke-width="'+(active?3:1)+'"/>';
   if(mode==='regions'&&active){const x=Math.max(100,Math.min(900,anchor.x)),y=anchor.y>450?anchor.y-r-12:anchor.y+r+21;h+='<text x="'+x+'" y="'+y+'" text-anchor="middle">'+esc(pickLabel(g).length>32?pickLabel(g).slice(0,31)+'…':pickLabel(g))+'</text>';}
   h+='</g>';
  }
  svg.innerHTML=h;svg.setAttribute('aria-label',mode==='regions'?'Illustrative positions for recorded regions':'Qualified reported coordinates');
  const placed=mode==='regions'?groups.filter(g=>g.entity.metadata.location_browse.illustration).length:groups.length;
  document.getElementById('location-map-note').textContent=mode==='regions'?'Region positions are illustrative. '+label(placed,'label')+' shown on the map; all '+num(groups.length)+' remain in the list.':'Reported coordinates only · '+label(groups.length,'coordinate group')+'. Shared coordinates do not establish independent sampling events.';
 }
 function render(){
  updateURL();const rows=filteredRows(ocean.value,sea.value,search.value);visibleGroups=mode==='regions'?regions(rows,entities,level):coordinateRows(rows);
  visibleGroups.sort(sort.value==='name'?(a,b)=>pickLabel(a).localeCompare(pickLabel(b),'en'):(a,b)=>b.compound_ids.length-a.compound_ids.length||pickLabel(a).localeCompare(pickLabel(b),'en'));
  if(!visibleGroups.some(g=>pickKey(g)===selected))selected=visibleGroups.length?pickKey(visibleGroups[0]):'';
  const pages=Math.ceil(visibleGroups.length/size);page=Math.min(page,Math.max(0,pages-1));
  for(const b of document.querySelectorAll('#location-modes button'))b.setAttribute('aria-pressed',String(b.dataset.locationMode===mode));
  levelHost.hidden=mode!=='regions';for(const b of levelHost.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.locationLevel===level));
  map(visibleGroups);const active=visibleGroups.find(g=>pickKey(g)===selected);
  selection.innerHTML=active?'<p class="location-field-label">'+esc(mode==='regions'?levels.get(level).field_label:'Reported coordinate group')+'</p><h2>'+esc(pickLabel(active))+'</h2><p class="location-selection-count"><strong>'+num(active.compound_ids.length)+'</strong> '+(active.compound_ids.length===1?'compound':'compounds')+'</p><p>'+label(active.source_ids.length,'source profile')+' · '+label(active.observation_count,'source record')+'</p><p class="location-selection-scope">'+(mode==='regions'?(active.entity.metadata.location_browse.illustration?'Illustrative region position; not a sampling coordinate.':'No map illustration is stored for this label; source records remain available.'):label(active.observation_count,'qualified coordinate record'))+'</p><a class="location-detail-link" href="'+esc(detailLink(active))+'">View sources & compounds →</a>':'<h2>No matching locations</h2><p>Try another region or source name, or reset the filters.</p>';
  grid.innerHTML=visibleGroups.slice(page*size,(page+1)*size).map(g=>'<article class="site-card location-card'+(pickKey(g)===selected?' is-selected':'')+'" data-location-key="'+esc(pickKey(g))+'"><p class="location-field-label">'+esc(mode==='regions'?levels.get(level).field_label:'Reported coordinate group')+'</p><h2><a href="'+esc(detailLink(g))+'">'+esc(pickLabel(g))+'</a></h2><p class="location-card-count"><strong>'+num(g.compound_ids.length)+'</strong> '+(g.compound_ids.length===1?'compound':'compounds')+'</p><p>'+label(g.source_ids.length,'source profile')+' · '+label(g.observation_count,'source record')+'</p><p class="site-card-meta">'+(mode==='regions'?label(g.coordinate_observation_count,'record')+' with usable coordinates':label(g.observation_count,'coordinate-qualified source record'))+'</p><div class="location-card-links"><button type="button" data-location-pick="'+esc(pickKey(g))+'">'+(mode==='regions'&&!g.entity.metadata.location_browse.illustration?'View summary':'Show on map')+'</button><a href="'+esc(detailLink(g))+'">View sources & compounds →</a></div></article>').join('')||(rows.length?'<p class="site-empty">These source records have no label in the selected region field. Try another field, or <a href="../pages/browse-strains.html?q='+encodeURIComponent(search.value)+'">browse matching sources</a>.</p>':'<p class="site-empty">No matching locations. Try another filter or reset the search.</p>');
  const shown=mode==='regions'?rows.filter(r=>r[level]):rows.filter(r=>r.coordinate_qualified),s=summarize(shown);
  document.getElementById('location-count').textContent=label(visibleGroups.length,mode==='regions'?'location label':'coordinate group')+' · '+label(s.compound_ids.length,'compound')+' · '+label(s.source_ids.length,'source profile')+' · '+label(s.observation_count,'source record');
  document.getElementById('location-page').textContent='Page '+(pages?page+1:0)+' of '+pages;document.getElementById('location-prev').disabled=page===0;document.getElementById('location-next').disabled=page+1>=pages;
  document.getElementById('location-reset').disabled=!ocean.value&&!sea.value&&!search.value&&mode==='regions'&&level==='ocean'&&page===0;
  updateURL();
 }
 function change(){selected='';page=0;render();}
 ocean.addEventListener('change',()=>{updateSeas('');change();});sea.addEventListener('change',change);search.addEventListener('input',change);sort.addEventListener('change',change);
 document.getElementById('location-modes').addEventListener('click',e=>{const b=e.target.closest('button[data-location-mode]');if(b){mode=b.dataset.locationMode;change();}});
 levelHost.addEventListener('click',e=>{const b=e.target.closest('button[data-location-level]');if(b){level=b.dataset.locationLevel;change();}});
 function pick(event){const b=event.target.closest('[data-location-pick]');if(!b)return;selected=b.dataset.locationPick;render();}
 svg.addEventListener('click',pick);svg.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-location-pick]')){event.preventDefault();pick(event);[...svg.querySelectorAll('[data-location-pick]')].find(n=>n.dataset.locationPick===selected)?.focus();}});grid.addEventListener('click',pick);
 document.getElementById('location-reset').addEventListener('click',()=>{ocean.value='';updateSeas('');search.value='';mode='regions';level='ocean';sort.value='count';change();});
 for(const [id,step]of [['location-prev',-1],['location-next',1]])document.getElementById(id).addEventListener('click',()=>{page+=step;render();document.getElementById('location-results').scrollIntoView({block:'start'});});
 render();
})(typeof window==='undefined'?globalThis:window);
