/* A local view over fully generated records; no uploads, inference or new joins. */
(function(){'use strict';
 if(document.body.dataset.siteView!=='source-taxon')return;
 const panels=[...document.querySelectorAll('[data-taxon-panel]')],params=new URLSearchParams(location.search),search=document.getElementById('taxon-search'),size=24;
 let view=panels.some(p=>p.dataset.taxonPanel===params.get('view'))?params.get('view'):'sources',page=Math.max(0,(Number(params.get('page'))||1)-1);
 search.value=params.get('q')||'';
 function render(){
  const panel=panels.find(p=>p.dataset.taxonPanel===view),rows=[...panel.querySelectorAll('tbody>tr')],q=search.value.trim().toLowerCase(),selected=rows.filter(r=>!q||r.textContent.toLowerCase().includes(q)),pages=Math.max(1,Math.ceil(selected.length/size));page=Math.min(page,pages-1);
  for(const p of panels)p.hidden=p!==panel;
  for(const row of rows)row.hidden=true;
  for(const row of selected.slice(page*size,(page+1)*size))row.hidden=false;
  for(const b of document.querySelectorAll('[data-taxon-view]'))b.setAttribute('aria-selected',String(b.dataset.taxonView===view));
  const label=view==='sources'?'source profiles':view==='compounds'?'compounds':'products with activity previews';
  document.getElementById('taxon-results-count').textContent=selected.length?'Showing '+(page*size+1)+'–'+Math.min((page+1)*size,selected.length)+' of '+selected.length+' '+label:'0 '+label;
  document.getElementById('taxon-page').textContent='Page '+(page+1)+' of '+pages;document.getElementById('taxon-prev').disabled=page===0;document.getElementById('taxon-next').disabled=page+1>=pages;document.getElementById('taxon-empty').hidden=!!selected.length;
  const url=new URL(location.href);for(const [k,v]of [['view',view==='sources'?'':view],['q',search.value],['page',page?String(page+1):'']]){if(v)url.searchParams.set(k,v);else url.searchParams.delete(k);}if(url.href!==location.href)history.replaceState(null,'',url);
 }
 document.querySelector('.source-taxon-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-taxon-view]');if(b){view=b.dataset.taxonView;page=0;render();}});
 search.addEventListener('input',()=>{page=0;render();});
 for(const [id,step]of [['taxon-prev',-1],['taxon-next',1]])document.getElementById(id).addEventListener('click',()=>{page+=step;render();document.querySelector('.source-taxon-tabs').scrollIntoView({block:'start'});});
 render();
 // The diagram reuses the catalog membership and the exact rendered result nodes.
 // No activity is joined to a strain, and no target is inferred from an assay.
 const flow=document.querySelector('[data-taxon-flow]'),db=window.DeepSeaSite;
 if(!flow||!db)return;
 const taxon=db.source_taxa.items[flow.dataset.taxonFlow],sourceBy=new Map(Object.values(db.entities.source).map(e=>[e.id,e])),compoundBy=new Map(db.compounds.map(c=>[c.file,c])),allowed=new Set(taxon.source_ids);
 const sourceRows=new Map([...document.querySelectorAll('[data-taxon-source-id]')].map(r=>[r.dataset.taxonSourceId,r])),productRows=new Map([...document.querySelectorAll('#associated-compounds [data-compound-id]')].map(r=>[r.dataset.compoundId,r])),resultRows=new Map([...document.querySelectorAll('#product-activities [data-connection-product-id]')].map(r=>[r.dataset.connectionProductId,r]));
 const genera=[...flow.querySelectorAll('[data-flow-genus]')].map(b=>b.dataset.flowGenus),sourceBox=document.getElementById('flow-sources'),productBox=document.getElementById('flow-products'),evidenceBox=document.getElementById('flow-evidence');
 let selectedGenus='',selectedSource='',selectedProduct='';
 const networkPages={genus:0,source:0,compound:0},networkAPI=window.DeepSeaSourceNetwork,networkView=networkAPI?.mount(document.getElementById('source-network'),selectNetworkNode);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const link=(text,href)=>{const n=el('a','',text);n.href=href;return n;};
 const placeholder=text=>el('p','taxon-flow-placeholder',text);
 function members(name){const id=db.source_taxa.lookup[taxon.group].genus[name];return db.source_taxa.items[id].source_ids.filter(id=>allowed.has(id)).map(id=>sourceBy.get(id)).sort((a,b)=>a.name.localeCompare(b.name,'en'));}
 function saveFlow(){const u=new URL(location.href);for(const [k,v]of [['genus_node',selectedGenus],['source_node',selectedSource],['product_node',selectedProduct]]){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}if(u.href!==location.href)history.replaceState(null,'',u);}
 function path(){document.getElementById('flow-path').textContent=[taxon.name,selectedGenus===taxon.name?'':selectedGenus,sourceBy.get(selectedSource)?.name,compoundBy.get(selectedProduct)?.name].filter(Boolean).join(' / ');saveFlow();renderNetwork();}
 function relations(kind,title,fn,host){
  const entries=Object.values(db.entities[kind]).filter(e=>e.compound_ids.includes(fn)).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const block=el('div','taxon-flow-relations');block.append(el('h4','',title+' ('+entries.length+')'));
  if(!entries.length)block.append(el('p','small muted','No '+(kind==='target'?'target annotation':'assay label')+' recorded.'));
  const list=el('div','taxon-flow-links');for(const e of entries)list.append(link(e.name,'../'+e.route));
  if(entries.length>4){const details=el('details');details.append(el('summary','','View recorded labels'),list);block.append(details);}else block.append(list);
  host.append(block);
 }
 function showEvidence(fn){
  selectedProduct=fn;
  for(const b of productBox.querySelectorAll('[data-flow-product]'))b.setAttribute('aria-pressed',String(b.dataset.flowProduct===fn));
  evidenceBox.replaceChildren();const compound=compoundBy.get(fn),row=productRows.get(fn),heading=el('div','taxon-flow-selected-product'),image=row.querySelector('img');
  if(image){const copy=image.cloneNode(true);copy.removeAttribute('loading');heading.append(copy);}
  const title=el('div');title.append(el('p','small muted','Selected product'),el('h3','',compound.name));
  const actions=el('div','taxon-flow-links');actions.append(link('Compound record & sampling sources','../1-Compounds/'+encodeURIComponent(fn)+'#sources'),link('All results & experimental conditions ('+compound.counts.activity_records+')','../1-Compounds/'+encodeURIComponent(fn)+'#phenotypes'));title.append(actions);
  heading.append(title);evidenceBox.append(heading,el('h3','','Recorded activity & evidence'),el('p','small muted','Up to two stored results are shown, prioritizing shared cited references. A shared reference does not establish a strain-specific experiment.'));
  const scoped=window.DeepSeaSourceNetworkData?.source_previews?.[selectedSource]?.[fn];const previews=[...resultRows.get(fn).querySelectorAll('[data-connection-view-id]')],cards=el('div','taxon-flow-result-grid');
  if(scoped){for(const r of scoped){const card=el('article','taxon-flow-result');card.dataset.flowViewId=r.id;card.dataset.flowRowSha256=r.source_row_sha256;card.dataset.flowRecordState=r.state;card.append(r.system_href?link(r.system,r.system_href):el('strong','',r.system),el('p','connection-result-value',r.value),el('p','small muted',r.state_caption));if(r.reference_context_label){const context=el('p','small muted',r.reference_context_label);context.dataset.referenceContext=r.reference_context;card.append(context);}const refs=el('div','connection-result-evidence');for(const ref of r.evidence)refs.append(link(ref.label,ref.href));if(!r.evidence.length)refs.append(el('span','small muted','No navigable source link recorded'));card.append(refs);cards.append(card);}}
  if(!scoped)for(const original of previews){
   const card=original.cloneNode(true);card.classList.add('taxon-flow-result');
   for(const name of ['view-id','row-sha256','record-state']){card.setAttribute('data-flow-'+name,card.getAttribute('data-connection-'+name));card.removeAttribute('data-connection-'+name);}
   const system=card.querySelector('strong'),entity=Object.values(db.entities.system).find(e=>e.name===system.textContent&&e.compound_ids.includes(fn));
   if(entity){system.replaceChildren(link(entity.name,'../'+entity.route));}
   for(const a of card.querySelectorAll('.connection-result-evidence a')){
    const u=new URL(a.href);if(u.hostname==='doi.org')a.textContent='DOI '+decodeURIComponent(u.pathname.slice(1));
    else if(u.hostname==='pubmed.ncbi.nlm.nih.gov')a.textContent='PubMed '+u.pathname.replaceAll('/','');
   }
   cards.append(card);
  }
  if(!(scoped||previews).length)cards.append(placeholder('No activity result recorded.'));evidenceBox.append(cards);
  const navigation=el('div','taxon-flow-relation-grid');relations('system','Experimental systems',fn,navigation);relations('target','Target annotations',fn,navigation);evidenceBox.append(navigation);path();
 }
 function showProducts(id){
  if(id!==selectedSource)networkPages.compound=0;
  selectedSource=id;selectedProduct='';for(const b of sourceBox.querySelectorAll('[data-flow-source]'))b.setAttribute('aria-pressed',String(b.dataset.flowSource===id));
  const source=sourceBy.get(id),ids=source.compound_ids.filter(fn=>productRows.has(fn));productBox.replaceChildren();document.getElementById('flow-product-count').textContent=ids.length+' associated products';
  const sourceLink=document.getElementById('flow-source-link');sourceLink.replaceChildren(link('Source records & sampling','../'+source.route+'#source-records'));
  for(const fn of ids){const b=el('button','taxon-flow-node taxon-flow-product');b.type='button';b.dataset.flowProduct=fn;b.setAttribute('aria-pressed','false');const image=productRows.get(fn).querySelector('img');if(image)b.append(image.cloneNode(true));else b.append(el('span','small muted','No stored image'));
   const text=el('span');text.append(el('strong','',compoundBy.get(fn).name),el('span','',compoundBy.get(fn).counts.activity_records+' activity records'));b.append(text);productBox.append(b);
  }
  if(!ids.length)productBox.append(placeholder('No associated public compound recorded.'));evidenceBox.replaceChildren(placeholder('Select a product to view its activity and original evidence.'));path();
 }
 function showSources(name){
  if(name!==selectedGenus){networkPages.source=0;networkPages.compound=0;}
  selectedGenus=name;selectedSource='';selectedProduct='';for(const b of flow.querySelectorAll('[data-flow-genus]'))b.setAttribute('aria-pressed',String(b.dataset.flowGenus===name));
  sourceBox.replaceChildren();document.getElementById('flow-source-link').replaceChildren();const sources=members(name);document.getElementById('flow-source-count').textContent=sources.length+' source profiles in this classification';
  for(const s of sources){const b=el('button','taxon-flow-node');b.type='button';b.dataset.flowSource=s.id;b.setAttribute('aria-pressed','false');b.append(el('strong','',s.name),el('span','',s.compound_count+' compounds'),el('span','taxon-flow-state',sourceRows.get(s.id).lastElementChild.textContent));sourceBox.append(b);}
  productBox.replaceChildren(placeholder('Select a source to see its products.'));document.getElementById('flow-product-count').textContent='Select a source';evidenceBox.replaceChildren(placeholder('Select a product to view its activity and original evidence.'));path();
 }
 flow.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-flow-genus'))showSources(b.dataset.flowGenus);else if(b.hasAttribute('data-flow-source'))showProducts(b.dataset.flowSource);else if(b.hasAttribute('data-flow-product'))showEvidence(b.dataset.flowProduct);});
 document.getElementById('flow-reset').addEventListener('click',()=>{selectedGenus='';selectedSource='';selectedProduct='';for(const b of flow.querySelectorAll('[data-flow-genus]'))b.setAttribute('aria-pressed','false');sourceBox.replaceChildren(placeholder('Sources in this classification appear here.'));productBox.replaceChildren(placeholder('See the products and their stored structures.'));document.getElementById('flow-source-count').textContent='Select a genus';document.getElementById('flow-product-count').textContent='Select a source';document.getElementById('flow-source-link').replaceChildren();evidenceBox.replaceChildren(placeholder('Select a product to view recorded activity, experimental systems and original evidence.'));path();});
 function citationLabel(href){const u=new URL(href,location.href);return u.hostname==='doi.org'?'DOI '+decodeURIComponent(u.pathname.slice(1)):u.hostname==='pubmed.ncbi.nlm.nih.gov'?'PubMed '+u.pathname.replaceAll('/',''):href;}
 function renderNetwork(){
  if(!networkView)return;
  const sources=Object.fromEntries([...sourceBy].filter(([id])=>allowed.has(id)).map(([id,s])=>[id,{...s,state:sourceRows.get(id).lastElementChild.textContent}]));
  const compounds=Object.fromEntries([...compoundBy].filter(([fn])=>productRows.has(fn)).map(([fn,c])=>[fn,{...c,image:productRows.get(fn).querySelector('img')?.getAttribute('src')||''}]));
  const groupData=genera.map(name=>({name,source_ids:members(name).map(s=>s.id),href:'../'+db.source_taxa.items[db.source_taxa.lookup[taxon.group].genus[name]].route}));
  const previews=selectedProduct?(window.DeepSeaSourceNetworkData?.source_previews?.[selectedSource]?.[selectedProduct]||[...resultRows.get(selectedProduct).querySelectorAll('[data-connection-view-id]')].map(n=>({id:n.dataset.connectionViewId,system:n.querySelector('strong').textContent,value:n.querySelector('.connection-result-value').textContent,state:n.dataset.connectionRecordState,evidence:[...n.querySelectorAll('.connection-result-evidence a')].map(a=>({href:a.getAttribute('href'),label:citationLabel(a.getAttribute('href'))}))}))):[];
  const targets=selectedProduct?Object.values(db.entities.target).filter(e=>e.compound_ids.includes(selectedProduct)):[];
  const graph=networkAPI.build({taxon,genera:groupData,sources,compounds,selected:{genus:selectedGenus,source:selectedSource,compound:selectedProduct},previews,targets,pages:networkPages});networkView.set(graph);
  document.getElementById('network-count').textContent=graph.nodes.length+' nodes · '+graph.edges.length+' stored links'+(graph.targetOverflow?' · '+graph.targetOverflow+' more target annotations in the full record':'');
  const pagers=document.getElementById('network-pagers');pagers.replaceChildren();
  for(const [kind,label]of [['genus','Genera'],['source','Sources'],['compound','Products']]){const w=graph.windows[kind];if(w.count<=1||kind==='genus'&&selectedGenus)continue;const group=el('div','source-network-pager');group.append(el('span','',label+' '+w.start+'–'+w.end+' of '+w.total+(w.extra?' + selected':'')));for(const [text,step,disabled]of [['Previous',-1,w.index===0],['Next',1,w.index+1===w.count]]){const b=el('button','',text);b.type='button';b.disabled=disabled;b.dataset.networkPage=kind;b.dataset.networkStep=step;group.append(b);}pagers.append(group);}
  document.getElementById('network-back').disabled=!selectedGenus;
  const record=document.getElementById('network-record');record.hidden=!selectedGenus;record.textContent=selectedProduct?'Compound & sampling sources':selectedSource?'Source records & sampling':'Genus details';record.href=selectedProduct?'../1-Compounds/'+encodeURIComponent(selectedProduct)+'#sources':selectedSource?'../'+sourceBy.get(selectedSource).route+'#source-records':selectedGenus?groupData.find(g=>g.name===selectedGenus).href:'';
 }
 function selectNetworkNode(n){
  if(n.action==='genus')showSources(n.key);
  else if(n.action==='source')showProducts(n.key);
  else if(n.action==='compound')showEvidence(n.key);
  else if(n.action==='reset')document.getElementById('flow-reset').click();
  else if(n.action==='result'){const card=[...evidenceBox.querySelectorAll('[data-flow-view-id]')].find(c=>c.dataset.flowViewId===n.key);if(card){card.scrollIntoView({block:'center',behavior:'smooth'});card.classList.add('source-network-result-focus');setTimeout(()=>card.classList.remove('source-network-result-focus'),1600);}}
  else if(n.action==='link'&&n.href){if(n.href.startsWith('https://'))window.open(n.href,'_blank','noopener,noreferrer');else location.href=n.href;}
 }
 for(const [id,fn]of [['network-zoom-in',()=>networkView?.zoom(.8)],['network-zoom-out',()=>networkView?.zoom(1.25)],['network-fit',()=>networkView?.fit()]])document.getElementById(id).addEventListener('click',fn);
 document.getElementById('network-back').addEventListener('click',()=>{if(selectedProduct)showProducts(selectedSource);else if(selectedSource)showSources(selectedGenus);else document.getElementById('flow-reset').click();});
 document.getElementById('network-pagers').addEventListener('click',e=>{const b=e.target.closest('[data-network-page]');if(b){networkPages[b.dataset.networkPage]+=Number(b.dataset.networkStep);renderNetwork();}});
 const networkSearch=document.getElementById('network-search'),networkResults=document.getElementById('network-search-results');
 networkSearch.addEventListener('input',()=>{const q=networkSearch.value.trim().toLowerCase();networkResults.replaceChildren();networkResults.hidden=!q;if(!q)return;const matches=[...genera.map(name=>({kind:'genus',id:name,name})),...[...sourceBy.values()].filter(s=>allowed.has(s.id)).map(s=>({kind:'source',id:s.id,name:s.name})),...taxon.compound_ids.map(fn=>({kind:'compound',id:fn,name:compoundBy.get(fn).name}))].filter(n=>n.name.toLowerCase().includes(q));
  networkResults.append(el('p','small muted',matches.length+' matches'+(matches.length>8?' · first 8 shown; refine the search':'')));for(const n of matches.slice(0,8)){const b=el('button','',n.name+' · '+(n.kind==='source'?'Source / strain':n.kind));b.type='button';b.dataset.networkMatchKind=n.kind;b.dataset.networkMatchId=n.id;networkResults.append(b);}});
 networkResults.addEventListener('click',e=>{const b=e.target.closest('[data-network-match-kind]');if(!b)return;const {networkMatchKind:kind,networkMatchId:id}=b.dataset;
  if(kind==='genus')showSources(id);else{const sid=kind==='source'?id:selectedSource&&sourceBy.get(selectedSource).compound_ids.includes(id)?selectedSource:taxon.source_ids.find(sid=>sourceBy.get(sid).compound_ids.includes(id)),name=genera.find(name=>members(name).some(s=>s.id===sid));showSources(name);showProducts(sid);if(kind==='compound')showEvidence(id);}
  networkResults.hidden=true;networkSearch.value='';networkView?.fit();});
 // Restore only a valid connected path. Stale or unrelated URL IDs cannot select records.
 const savedGenus=params.get('genus_node'),savedSource=params.get('source_node'),savedProduct=params.get('product_node');
 if(genera.includes(savedGenus)){showSources(savedGenus);if(members(savedGenus).some(s=>s.id===savedSource)){showProducts(savedSource);if(sourceBy.get(savedSource).compound_ids.includes(savedProduct)&&productRows.has(savedProduct))showEvidence(savedProduct);}}
 path();
})();
