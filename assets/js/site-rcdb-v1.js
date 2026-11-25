/* Read-only research tools for the existing RCDB collection and admitted projection. */
(function(){'use strict';
 function selectActivities(activities,scaffolds,{q='',compound='',scaffold=''}={}){
  const query=q.trim().toLocaleLowerCase('en'),members=scaffold?new Set(scaffolds[scaffold]||[]):null;
  return activities.filter(a=>(!compound||a.file===compound)&&(!members||members.has(a.file))&&(!query||[a.name,a.file,a.system,a.endpoint,a.method,a.result,a.conditions,a.doi,...a.pmids,...(a.qualifications||[])].some(v=>String(v??'').toLocaleLowerCase('en').includes(query))));
 }
 const exportColumns=['id','file','name','system','result','endpoint','relation','value','value_min','value_max','unit','method','exposure_hours','source_row_sha256','locator','category','pmids','doi','conditions','qualifications','state','error','error_type','replicate_number','source_projection'];
 function toCSV(rows){
  const cell=value=>{let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value!=='number'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\ufeff'+[exportColumns.map(cell).join(','),...rows.map(a=>exportColumns.map(k=>cell(a[k])).join(','))].join('\r\n');
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={selectActivities,toCSV,exportColumns};
 if(typeof document==='undefined'||document.body.dataset.siteView!=='center-research')return;
 const db=window.DeepSeaSite,d=db.rcdb_research,$=id=>document.getElementById(id),by=new Map(db.compounds.map(c=>[c.file,c])),E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString('en'),link=fn=>'../1-Compounds/'+encodeURIComponent(fn);
 const N=value=>window.ActivityResultDisplay.notationHTML(value);
 const params=new URLSearchParams(location.search),members=d.members.map(fn=>by.get(fn)).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true})),groups=Object.entries(d.scaffold_members).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],'en')),size=20;
 const search=$('rcdb-search'),compound=$('rcdb-compound'),scaffold=$('rcdb-scaffold');let page=Math.max(0,(Number(params.get('page'))||1)-1),filtered=[];
 compound.innerHTML='<option value="">All RCDB members</option>'+members.map(c=>'<option value="'+E(c.file)+'">'+E(c.name)+'</option>').join('');
 scaffold.innerHTML='<option value="">All eligible groups & ungrouped members</option>'+groups.map(([id,ids])=>'<option value="'+E(id)+'">Scaffold '+E(id.replace(/^s/,''))+' ('+ids.length+' '+(ids.length===1?'member':'members')+')</option>').join('');
 search.value=params.get('q')||'';if(d.members.includes(params.get('compound')))compound.value=params.get('compound');if(d.scaffold_members[params.get('scaffold')])scaffold.value=params.get('scaffold');
 $('rcdb-metrics').innerHTML=[[d.members.length,'member compounds'],[d.activities.length,'admitted evidence rows'],[d.scaffold_count,'eligible stored scaffold groups']].map(([n,label])=>'<div><strong>'+fmt(n)+'</strong><span>'+label+'</span></div>').join('');
 function evidenceLink(a){return [...a.pmids.map(p=>'<a href="https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(p)+'/" target="_blank" rel="noopener noreferrer">PubMed '+E(p)+' ↗</a>'),...(a.doi?['<a href="https://doi.org/'+encodeURIComponent(a.doi).replace(/%2F/gi,'/')+'" target="_blank" rel="noopener noreferrer">DOI '+E(a.doi)+' ↗</a>']:[])].join(' · ');}
 function activityRow(a){
  return '<tr data-activity-id="'+E(a.id)+'" data-source-row-sha256="'+E(a.source_row_sha256)+'" data-compound-id="'+E(a.file)+'" data-evidence-status="'+E(a.state.raw)+'"><td><a href="'+link(a.file)+'#phenotypes">'+E(a.name)+'</a></td><td>'+E(a.system)+'<span class="evidence-state">'+N(a.endpoint)+'</span></td><td><span class="rcdb-original-result">'+N(a.result)+'</span><span class="evidence-state">'+E(a.state.held?'Evidence held; restrictions retained':a.state.checked?'Primary result checked':'Recorded evidence; review state retained')+'</span></td><td>'+E(a.method||'Method not recorded')+' · '+E(a.exposure_hours==null?'Time not recorded':a.exposure_hours+' h')+'<details><summary>Evidence & conditions</summary><p>'+E(a.conditions||'Conditions not recorded')+'</p>'+(a.qualifications||[]).map(n=>'<p>'+E(window.ActivityResultDisplay.evidenceNoteText(n))+'</p>').join('')+'<p>'+evidenceLink(a)+'</p><p>'+E(a.locator)+'</p><p class="rcdb-raw-status">Recorded state: '+E(a.state.raw)+'</p></details></td></tr>';
 }
 function groupMembers(){
  const ids=d.scaffold_members[scaffold.value]||[];
  return scaffold.value?'<section class="rcdb-selected-scaffold"><h3>Scaffold '+E(scaffold.value.replace(/^s/,''))+' · '+ids.length+' '+(ids.length===1?'member':'members')+'</h3><div class="rcdb-scaffold-member-links">'+ids.map(fn=>'<a href="'+link(fn)+'">'+E(by.get(fn).name)+'</a>').join('')+'</div></section>':'<p class="rcdb-scope">'+fmt(d.graph_members)+' members have eligible stored scaffold links. Select a group above or browse the gallery below.</p>';
 }
 function relations(){
  const fn=compound.value,rel=d.relations[fn];
  if(!fn){$('rcdb-relations').innerHTML='<p class="rcdb-empty-note">Select a compound in the evidence filters to view its stored relationships.</p>';return;}
  const definitions=[['neighbors','2D structural neighbors','Descriptive similarity; no activity is inferred.'],['same_scaffold','Stored scaffold group','Grouping does not merge compound identities.'],['strains','Shared reported source label','Stored source association; no new strain synonym is inferred.'],['papers','Shared source paper','Shared citation does not establish comparable assay conditions.']];
  $('rcdb-relations').innerHTML='<h3><a href="'+link(fn)+'">'+E(by.get(fn).name)+'</a></h3>'+(rel?'<div class="rcdb-relation-grid">'+definitions.map(([key,title,note])=>{const rows=rel[key]||[],record=x=>'<li data-related-compound="'+E(x.file)+'" data-relation-kind="'+key+'"><a href="'+link(x.file)+'">'+E(by.get(x.file).name)+'</a>'+(x.tanimoto!=null?' <span>· Tanimoto '+Number(x.tanimoto).toFixed(3)+'</span>':'')+(x.reason?'<details><summary>Stored annotation</summary><p>'+E(x.reason)+'</p></details>':'')+'</li>';return '<article><h3>'+title+' <span>('+rows.length+')</span></h3><p class="rcdb-scope">'+note+'</p><ul>'+rows.slice(0,5).map(record).join('')+'</ul>'+(rows.length>5?'<details><summary>Show '+(rows.length-5)+' more</summary><ul>'+rows.slice(5).map(record).join('')+'</ul></details>':'')+(!rows.length?'<p class="rcdb-empty-note">No current association is indexed.</p>':'')+'</article>';}).join('')+'</div>':'<p class="rcdb-empty-note">No eligible stored relationship annotation is indexed for this member. Its current compound record remains available.</p>');
 }
 function render(){
  filtered=selectActivities(d.activities,d.scaffold_members,{q:search.value,compound:compound.value,scaffold:scaffold.value});const pages=Math.ceil(filtered.length/size);page=Math.max(0,Math.min(page,Math.max(0,pages-1)));
  $('rcdb-count').textContent=fmt(filtered.length)+' admitted evidence '+(filtered.length===1?'row':'rows')+' · '+fmt(new Set(filtered.map(a=>a.file)).size)+' '+(new Set(filtered.map(a=>a.file)).size===1?'compound':'compounds');
  $('rcdb-results').innerHTML=filtered.length?'<div class="site-table-wrap"><table class="site-table"><thead><tr><th>Compound</th><th>Assay system / endpoint</th><th>Result & original qualifiers</th><th>Conditions & source</th></tr></thead><tbody>'+filtered.slice(page*size,(page+1)*size).map(activityRow).join('')+'</tbody></table></div>':'<p class="site-empty">No admitted evidence rows match. Other qualified or restricted records may remain on the compound page; missing rows do not establish inactivity.</p>';
  $('rcdb-page').textContent='Page '+(pages?page+1:0)+' of '+pages;$('rcdb-prev').disabled=page===0;$('rcdb-next').disabled=page+1>=pages;
  const exportLink=$('rcdb-export');exportLink.setAttribute('aria-disabled',String(!filtered.length));if(filtered.length)exportLink.href='data:text/csv;charset=utf-8,'+encodeURIComponent(toCSV(filtered));else exportLink.removeAttribute('href');
  $('rcdb-reset').disabled=!search.value&&!compound.value&&!scaffold.value;
  const selected=$('rcdb-selected-group');if(selected)selected.innerHTML=groupMembers();
  $('rcdb-scaffolds').querySelectorAll('[data-scaffold]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scaffold===scaffold.value)));
  const u=new URL(location.href);for(const[k,value]of [['q',search.value],['compound',compound.value],['scaffold',scaffold.value],['page',page?String(page+1):'']]){if(value)u.searchParams.set(k,value);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);
 }
 const scaffoldCard=([id,ids])=>'<button type="button" class="rcdb-scaffold-card" data-scaffold="'+E(id)+'" aria-pressed="false"><span>Scaffold '+E(id.replace(/^s/,''))+' · '+ids.length+' '+(ids.length===1?'member':'members')+'</span><img src="../assets/img/rcdb-scaffolds/'+encodeURIComponent(id)+'.svg" alt="Stored Murcko scaffold '+E(id)+'; chirality ignored" loading="lazy"></button>';
 $('rcdb-scaffolds').innerHTML='<div id="rcdb-selected-group"></div><details class="rcdb-scaffold-gallery"><summary>Browse all '+groups.length+' stored scaffold groups</summary><div class="rcdb-scaffold-grid">'+groups.map(scaffoldCard).join('')+'</div></details>';
 $('rcdb-scaffolds').addEventListener('click',event=>{const b=event.target.closest('[data-scaffold]');if(b){scaffold.value=b.dataset.scaffold;page=0;render();}});
 search.addEventListener('input',()=>{page=0;render();});compound.addEventListener('change',()=>{page=0;render();relations();});scaffold.addEventListener('change',()=>{page=0;render();});
 $('rcdb-reset').addEventListener('click',()=>{search.value='';compound.value='';scaffold.value='';page=0;render();relations();});$('rcdb-prev').addEventListener('click',()=>{page--;render();});$('rcdb-next').addEventListener('click',()=>{page++;render();});
 render();relations();
})();
