'use strict';
const $=id=>document.getElementById(id), E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=[], byId=new Map(), selected={a:'sydowinin-a.html',b:'sydowinin-b.html'}, report=null, controller=null, relationsController=null, selectedReference='', examples=[], choiceData=[], choiceController=null, lastRelations=null;
let activeView='compare', localService=true, evidenceLoad=null, savedCompareLoad=null, savedCompareReady=false;
const analyzeEnabled=document.documentElement.dataset.analyzeEnabled!=='false';
const availableView=view=>view==='analyze'&&!analyzeEnabled?'explore':view;
let savedExportURLs=[];
const Selection=window.ResearchWorkbenchState;
let evidenceCompound=null,initializationReady=false,comparisonLoading=false;
const siteBase=new URL('../../',document.currentScript.src);
const selectionDirty={a:false,b:false}, suggestionIndex={a:-1,b:-1}, suggestionRows={a:[],b:[]};
const normalizedName=x=>String(x||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
function exactMatches(value){const key=normalizedName(value);return catalog.filter(c=>[c.name,c.compound_id,c.compound_id.replace(/\.html$/i,'')].some(alias=>normalizedName(alias)===key));}
function resultSections(){return ['structures','activities','comparability','sources','export'];}
function updateResultVisibility(){for(const id of resultSections())$(id).hidden=!report||activeView!=='compare'||selectionDirty.a||selectionDirty.b;}
function closeSuggestions(side){$('suggestions-'+side).hidden=true;$('compound-'+side).setAttribute('aria-expanded','false');$('compound-'+side).removeAttribute('aria-activedescendant');suggestionIndex[side]=-1;}
function searchSuggestions(side){
  const input=$('compound-'+side),q=normalizedName(input.value),exact=exactMatches(input.value);
  const words=q.split(/\s+/).filter(Boolean);
  suggestionRows[side]=(q?catalog.filter(c=>words.every(w=>normalizedName(c.name+' '+c.compound_id+' '+(c.formula||'')).includes(w))):catalog).sort((a,b)=>Number(exact.includes(b))-Number(exact.includes(a))||Number(normalizedName(b.name).startsWith(q))-Number(normalizedName(a.name).startsWith(q))||a.name.localeCompare(b.name)).slice(0,8);
  const rows=suggestionRows[side],box=$('suggestions-'+side);suggestionIndex[side]=-1;
  box.innerHTML=rows.map((c,i)=>`<button type="button" role="option" aria-selected="false" id="option-${side}-${i}" data-select-id="${E(c.compound_id)}" title="${E(c.name)}"><strong>${E(c.name)}</strong><small>${E(c.formula||'Formula not reported')} · ${E(c.compound_id)}</small></button>`).join('')||'<p class="small muted">No catalog match. Try a shorter keyword.</p>';
  box.hidden=false;input.setAttribute('aria-expanded','true');
}
function invalidateDraft(side){
  selectionDirty[side]=true;controller?.abort();$('busy').hidden=true;$('error').hidden=true;
  for(const id of ['export-brief','export-json','export-csv'])$(id).removeAttribute('href');
  $('quick-export').disabled=true;$('swap').disabled=true;
  $('selection-help-'+side).textContent='Choose a result below, or press Enter for an exact match.';
  if(side==='a'){choiceController?.abort();relationsController?.abort();}
  updateResultVisibility();
}
const conditionLabels={critical_conditions:'Other recorded critical conditions',experimental_type:'Evidence type',biological_system:'Biological system',assay_method:'Assay method',readout:'Readout',endpoint:'Endpoint',unit_basis:'Concentration basis',control:'Control',assay_group:'Original assay group',cell_line:'Cell line',exposure_hours:'Exposure (h)',medium:'Medium',protein_form:'Protein form',substrate:'Substrate',substrate_concentration:'Substrate concentration',pH:'pH',strain:'Strain',binding_method:'Binding method',temperature:'Temperature',experimental_classification:'Experimental classification',species:'Species',ATP:'ATP',test_concentration:'Test concentration',sample_form:'Sample form',replicate_number:'Replicate number',source_reference:'Source reference',model_version:'Model version'};
const display=x=>x===null||x===undefined||x===''?'Not reported':typeof x==='object'?JSON.stringify(x):String(x);
const statusClass=x=>['Match','Matched','Conditions matched — candidate comparison'].includes(x)?'good':x==='Not applicable'?'':'warn';
async function api(path,signal){if(!localService&&window.SavedComparison)return window.SavedComparison.request(path,signal);const response=await fetch(path,{signal});const data=await response.json();if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);return data;}
function error(err){if(err.name==='AbortError')return;$('error').hidden=false;$('error').textContent=err.message;}
function setSVG(id,text){const target=$(id);target.replaceChildren();if(!text)return;const parsed=new DOMParser().parseFromString(text,'image/svg+xml');const svg=parsed.documentElement;if(svg.localName!=='svg')return;for(const node of svg.querySelectorAll('script,foreignObject,image,use'))node.remove();for(const node of [svg,...svg.querySelectorAll('*')])for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||/href$/i.test(attr.name))node.removeAttribute(attr.name);svg.setAttribute('role','img');svg.setAttribute('aria-label',(id==='svg-a'?'Compound A structure':'Compound B structure')+(report?.structure.changes?.length?' with marked changes':''));target.append(document.importNode(svg,true));}
function clearComparison(clearChoices=true){
  for(const url of savedExportURLs)URL.revokeObjectURL(url);savedExportURLs=[];
  controller?.abort();report=null;
  for(const id of resultSections())$(id).hidden=true;
  for(const side of ['a','b']){
    setSVG('svg-'+side,'');$('name-'+side).textContent='—';$('formula-'+side).textContent='';
    $('evidence-'+side).innerHTML='';$('activity-'+side).innerHTML='';$('activity-'+side).disabled=true;
    $('detail-'+side).removeAttribute('href');$('hold-'+side).hidden=true;
  }
  for(const id of ['export-brief','export-json','export-csv'])$(id).removeAttribute('href');
  for(const id of ['conditions','source-results','change-details','pair-reasons'])$(id).innerHTML='';
  for(const id of ['structure-status','assay-status','assay-reason','next-check-summary','pair-inclusion','pair-counts','mapping-note'])$(id).textContent='';
  $('ratio').hidden=true;$('quick-export').disabled=true;
  $('difference-summary').textContent='Choose or prepare a comparison';$('structure-warnings').innerHTML='';
  if(clearChoices){$('choice-cards').innerHTML='<p class="small muted">Finding members with shared experimental records…</p>';choiceData=[];}
}
function params(extra={}){
  const q=Selection.viewParams({view:extra.view||activeView,selected,activities:{activity_a:report?.selected_activity_a,activity_b:report?.selected_activity_b},reference:selectedReference,coverageId,coverageReference,currentSearch:location.search,evidenceCompound});
  for(const [key,value]of Object.entries(extra))if(value!==undefined&&value!==null)q.set(key,value);
  return q;
}
function selectedExperiments(){return {activity_a:report?.selected_activity_a,activity_b:report?.selected_activity_b};}
async function validateExperiments(captured,requested,previous,signal){
  const contexts={};
  await Promise.all(['a','b'].map(async side=>{
    if(!requested['activity_'+side]||!captured[side])return;
    contexts[side]=previous?.[side]?.compound.compound_id===captured[side]?previous[side]:await api('/api/compound?'+new URLSearchParams({id:captured[side]}),signal);
  }));
  return Selection.ownedActivities(requested,contexts);
}
function notice(text){$('selection-notice').textContent=text;$('selection-notice').hidden=!text;}

function resultText(a){if(a.qualitative_evidence)return a.qualitative_evidence.qualitative_text;if(a.result_state==='range')return `${a.endpoint||''} ${a.value_min}–${a.value_max} ${a.unit||''}`;if(['exact','bound'].includes(a.result_state))return `${a.endpoint||''} ${a.relation||''} ${a.value}${a.error!==null&&a.error!==undefined?' ± '+a.error:''} ${a.unit||''}${a.error_type?' ('+a.error_type+')':''}`;return a.raw_text||a.result_state.replaceAll('_',' ');}
function referenceHTML(value){
  const dataset=String(value||'').match(/^PubChem:AID([1-9]\d*):SID([1-9]\d*)$/);
  if(dataset)return '<a href="https://pubchem.ncbi.nlm.nih.gov/bioassay/'+dataset[1]+'#sid='+dataset[2]+'" target="_blank" rel="noopener noreferrer">NCI original assay · PubChem AID '+dataset[1]+' · SID '+dataset[2]+' ↗</a>';
  const text=display(value),doi=text.match(/^(?:DOI\s*:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s<>]+)$/i);
  if(doi){const id=doi[1];return '<a href="https://doi.org/'+encodeURIComponent(id).replace(/%2F/gi,'/')+'" target="_blank" rel="noopener noreferrer">DOI '+E(id)+' ↗</a>';}
  const pmid=text.match(/^(?:PMID\s*:\s*|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)([1-9]\d{3,8})\/?$/i);
  return pmid?'<a href="https://pubmed.ncbi.nlm.nih.gov/'+pmid[1]+'/" target="_blank" rel="noopener noreferrer">PubMed '+pmid[1]+' ↗</a>':E(text);
}
function evidenceHTML(a,hasRecords=false){if(!a)return hasRecords?'<p class="muted">Choose an experimental record. No unrelated system has been selected automatically.</p>':'<p class="muted">No admitted experimental record is available for this member. This does not establish inactivity.</p>';const n=a.normalized;return `<span class="status">${E(a.experimental_type)}</span> <span class="small muted">${E(a.result_state.replaceAll('_',' '))}</span><p class="result-value ${['exact','bound','range'].includes(a.result_state)?'':'qualitative'}">${window.ActivityResultDisplay.notationHTML(resultText(a))}</p><dl class="evidence-data"><dt>Biological system</dt><dd>${E(display(a.biological_system))}</dd><dt>Method</dt><dd>${E(display(a.assay_method))}</dd><dt>Exposure</dt><dd>${a.exposure_hours===null?'Not reported':E(a.exposure_hours)+' h'}</dd><dt>Source</dt><dd>${referenceHTML(a.source_reference)}</dd><dt>Location</dt><dd>${E(a.qualitative_evidence?.source_location||display(a.source_location))}</dd></dl><details><summary>Raw result & evidence status</summary><p class="small">${window.ActivityResultDisplay.notationHTML(a.raw_text)}</p><p class="small">Original result status: ${E(a.original_result_status)}<br>Extraction status: ${E(a.extraction_status)}</p>${a.qualitative_evidence?'<p class="small">The separately sourced qualitative annotation retains the original database record and its status.</p>':''}<p class="small">Normalized: ${n.value===null?'No exact scalar supplied':E(n.value)+' '+E(n.unit)}${n.conversion?'<br>'+E(n.conversion):''}</p>${[...(a.notes||[]),...(n.warnings||[])].map(x=>`<p class="small warning">${E(window.ActivityResultDisplay.evidenceNoteText(x))}</p>`).join('')}<p class="small muted">${E(a.activity_id)}<br>${E(a.classification_basis)}</p></details>`;}
function renderEvidence(side,context,id){const select=$('activity-'+side);select.innerHTML=(context.activities.length?'<option value="" disabled>Choose an experimental record</option>':'')+context.activities.map(a=>`<option value="${E(a.activity_id)}">${E(a.biological_system)} · ${E(a.endpoint==='实验结果'?'Reported result':a.endpoint)} · ${E(a.result_state.replaceAll('_',' '))}</option>`).join('')||'<option value="">No admitted record</option>';select.value=id||'';select.disabled=!context.activities.length;const a=context.activities.find(x=>x.activity_id===id);$('evidence-'+side).innerHTML=evidenceHTML(a,context.activities.length>0);}
function conditionCell(value,source){
  const shown=value===null||value===undefined||value===''?(source?.source_state==='not_reported'?'Not reported in source':'Not recorded'):typeof value==='object'?Object.entries(value).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join('; '):String(value);
  return window.ActivityResultDisplay.notationHTML(shown)+(source?`<details class="condition-source"><summary>Source · ${E(source.locator)}</summary><p class="small">${E(source.evidence_summary)}</p><a href="https://doi.org/${encodeURIComponent(source.doi)}" target="_blank" rel="noopener noreferrer">DOI ${E(source.doi)} ↗</a></details>`:'');
}
function renderComparison(){const comparison=report.selected_comparison;$('assay-status').textContent=comparison?.status||(!report.b?'Choose a second compound':'No pair of experimental records available');$('pair-inclusion').textContent=!report.b?'Awaiting member B':comparison?.included?'Quantitative comparison available':'Keep results separate';$('pair-inclusion').className='status '+(comparison?.included?'good':'warn');$('assay-reason').textContent=report.takeaway?.interpretation||'Structure and source browsing remain available.';$('next-check-summary').textContent=report.takeaway?.next_checks[0]||'';$('conditions').innerHTML=(comparison?.conditions||[]).filter(c=>c.required||c.a!==null&&c.a!==undefined&&c.a!==''||c.b!==null&&c.b!==undefined&&c.b!=='').map(c=>`<tr><td>${E(conditionLabels[c.condition]||c.condition)}${c.required?'<span class="required-mark">Required for these assay types</span>':''}</td><td>${conditionCell(c.a,c.source_a)}</td><td>${conditionCell(c.b,c.source_b)}</td><td><span class="status ${statusClass(c.status)}">${E(c.status)}</span></td></tr>`).join('');const conditions=comparison?.conditions||[];$('condition-summary').innerHTML=[['Recorded matches',conditions.filter(c=>c.status==='Match').length],['Differences',(comparison?.differences||[]).length],['Missing required information',(comparison?.missing||[]).length]].map(([label,n])=>`<span><b>${n}</b> ${E(label)}</span>`).join('');$('condition-summary').hidden=!comparison;const counts=report.pair_counts;$('pair-counts').textContent=`${counts.unique_unordered_compound_pairs} unique unordered compound pairs · ${counts.explicit_assay_comparison_groups} explicit assay comparison groups. Scope: ${counts.scope}. ${counts.complete_for_stated_scope?'Complete for this scope.':'Partial candidate evaluation; counts are lower bounds.'}`;$('pair-reasons').innerHTML=(comparison?.exclusion_reasons||['No evidence pair selected']).map(r=>`<p class="small">${E(r)}</p>`).join('');$('ratio').hidden=!comparison?.derived_ratio;if(comparison?.derived_ratio)$('ratio').textContent=`A/B normalized endpoint value ratio: ${comparison.derived_ratio.a_over_b.toPrecision(4)}. ${comparison.derived_ratio.interpretation}`;}
function sourceHTML(side,context){
 const c=context.compound,sources=Array.isArray(c.sources)?c.sources:[];
 const field=(label,value)=>'<dt>'+E(label)+'</dt><dd>'+E(display(value))+'</dd>';
 const sourceDetails=sources.map((s,index)=>{
  const ev=s.evidence||{};
  const coordinates=s.coordinate_raw||(s.latitude!=null&&s.longitude!=null?String(s.latitude)+', '+String(s.longitude):null);
  const depth=s.depth_label||(s.depth_min_m!=null?(s.depth_max_m!=null&&s.depth_max_m!==s.depth_min_m?String(s.depth_min_m)+'–'+String(s.depth_max_m)+' m':String(s.depth_min_m)+' m'):null);
  return '<section class="source-occurrence"><h4>Reported source '+(index+1)+'</h4><dl class="evidence-data">'+field('Reported organism',s.organism_reported)+field('Strain',s.strain)+(s.specimen_code?field('Specimen code',s.specimen_code):'')+field('Sampling material',s.sample_type)+field('Sampling depth',depth)+field('Collection location',s.location_raw)+field('Reported coordinates',coordinates)+'</dl>'+(s.exclude_from_depth_analysis||s.exclude_from_coordinate_analysis?'<p class="small muted">Reported source values are retained as evidence. Existing depth or coordinate analysis restrictions remain in effect.</p>':'')+'<details><summary>Source evidence</summary><dl class="evidence-data">'+field('Evidence status',ev.status)+field('Primary location',ev.locator)+field('Source DOI',ev.DOI||ev.doi)+'</dl></details></section>';
 }).join('');
 const legacy='<dl class="evidence-data">'+field('Reported organism',c.organism)+field('Sampling depth',c.depth)+field('Collection location',c.location)+'</dl>';
 return `<article class="panel source-card"><h3><span class="member-label ${side}-label">${side.toUpperCase()}</span>${E(c.name)}</h3>${sources.length?sourceDetails:legacy}<dl class="evidence-data">${field('Collection scope',c.scope.replaceAll('_',' '))}</dl><a href="../1-Compounds/${encodeURIComponent(c.compound_id)}">Open compound record ↗</a><details><summary>Primary sources & references (${c.references.length})</summary>${c.references.map(ref=>`<p>${E(ref.title||ref.text||ref.doi||ref.pmid)}${ref.doi?`<br><a href="https://doi.org/${encodeURI(ref.doi)}" target="_blank" rel="noopener noreferrer">DOI ${E(ref.doi)} ↗</a>`:''}${localService&&String(ref.pmid)==='31817515'?'<br><a href="/api/primary?pmid=31817515#page=9" target="_blank" rel="noopener">Local primary PDF · p9 ↗</a>':''}${ref.evidence_locator?'<br>'+E(ref.evidence_locator):''}</p>`).join('')||'<p>No reference supplied.</p>'}</details></article>`;
}

function render(){$('quick-export').disabled=false;$('swap').disabled=!report.b;for(const side of ['a','b']){
  const context=report[side];
  if(!context){
    $('name-'+side).textContent='Choose a second compound';$('formula-'+side).textContent='';
    $('detail-'+side).removeAttribute('href');$('hold-'+side).hidden=true;setSVG('svg-'+side,'');
    $('svg-'+side).dataset.emptyMessage='Choose a member from Related compounds, or search by name';
    $('activity-'+side).innerHTML='<option value="">No comparison member selected</option>';$('activity-'+side).disabled=true;
    $('evidence-'+side).innerHTML='<p class="muted">Select a second compound to compare its experiments.</p>';continue;
  }
  $('svg-'+side).dataset.emptyMessage='Structure unavailable';const c=context.compound;$('name-'+side).textContent=c.name;$('formula-'+side).textContent=c.formula||'Formula not reported';$('detail-'+side).href='../1-Compounds/'+encodeURIComponent(c.compound_id);$('hold-'+side).hidden=!c.structure_holds.length;$('hold-'+side).textContent=c.structure_holds.length?'Existing structure analysis restriction retained. This is not a new finding that the structure is wrong.':'';setSVG('svg-'+side,report.structure['svg_'+side]);renderEvidence(side,report[side],report['selected_activity_'+side]);}$('structure-status').textContent=report.structure.status;$('difference-summary').textContent=report.structure.summary;$('structure-warnings').innerHTML=(report.structure.warnings||[]).map(w=>`<p class="small warning">${E(w)}</p>`).join('');$('change-details').innerHTML=(report.structure.changes||[]).map(c=>`<p class="change-line small"><b>${E(c.type.replaceAll('_',' '))}</b> · ${E(JSON.stringify(c))}</p>`).join('')||'<p class="small muted">No uniquely localized change is claimed.</p>';$('mapping-note').textContent=[report.structure.mapping_basis,report.structure.index_note,report.series.length?'Literature assignment: '+report.series.map(s=>s.series_name+'; '+s.supporting_reference).join('; '):'No confirmed literature-defined series assignment for this selection.'].filter(Boolean).join(' ');renderComparison();$('source-results').innerHTML=sourceHTML('a',report.a)+(report.b?sourceHTML('b',report.b):'');$('export-brief').href='/api/brief?'+params();$('export-json').href='/api/export?'+params({format:'json'});$('export-csv').href='/api/export?'+params({format:'csv'});const rules=report.provenance.rules;$('methods-content').innerHTML=`<p>Morgan radius ${rules.fingerprint.radius}, ${rules.fingerprint.bits} bits; chirality ignored. Tanimoto is a retrieval setting, not a series definition. RDKit ${E(report.provenance.snapshot.rdkit_version)}.</p><p>${E(rules.structure.recorded)}. Connectivity: ${E(rules.structure.connectivity)}. Scaffold: ${E(rules.structure.scaffold)}.</p><p>${E(rules.structure.normalization)}</p><p>Pair rule: ${E(rules.pair_rule)}</p><p>Shared paper, target or unit alone does not establish comparability. Missing fields remain Not recorded unless the primary source has been checked; source-confirmed omissions and incomplete detail are distinguished. Source-supported scaffold families do not establish a strict single-factor series. Ratios require exact positive numerical endpoints and matching required conditions; errors retain their recorded types.</p><p>Snapshot: <code>${E(report.provenance.snapshot.snapshot_id)}</code><br>Rules: ${E(rules.version)} · ${E(report.provenance.pair_rule_version)}</p>`;}
async function refresh(extra={}){
  if(!selected.a)return;
  const previous=report;clearComparison(false);controller=new AbortController();const current=controller;
  const captured={...selected};comparisonLoading=true;$('busy').hidden=activeView!=='compare';$('error').hidden=true;
  try{
    const checked=await validateExperiments(captured,extra,previous,current.signal);
    if(current!==controller)return;
    notice(checked.removed.length?'The saved experiment selection for '+checked.removed.join(' and ')+' is no longer available for this compound. Current records are shown below; inspect the selected experiments.':'');
    const q=new URLSearchParams({a:captured.a,...(captured.b?{b:captured.b}:{}),...(selectedReference?{reference:selectedReference}:{}),...checked.activities});
    const value=await api('/api/compare?'+q,current.signal);
    if(current!==controller||selected.a!==captured.a||selected.b!==captured.b||selectionDirty.a||selectionDirty.b)return;
    report=value;render();finishComparisonView();updateResultVisibility();if(activeView==='compare')history.replaceState(null,'','?'+params());
    for(const side of ['a','b'])$('name-'+side).title=report[side]?.compound.name||'';
  }catch(err){if(current===controller&&activeView==='compare')error(err);}
  finally{if(current===controller){comparisonLoading=false;$('busy').hidden=true;}}
}
async function relations(){const a=selected.a;relationsController?.abort();relationsController=new AbortController();try{const response=await api('/api/relations?'+new URLSearchParams({id:selected.a,threshold:$('threshold').value,limit:$('neighbor-limit').value}),relationsController.signal);if(a!==selected.a||selectionDirty.a)return;lastRelations={compound:a,response};$('relation-groups').innerHTML=response.groups.map(g=>`<div class="relation-group"><h3>${E(g.type)} <small>(${g.total})</small></h3>${g.items.map(r=>`<div class="relation-item"><button data-member="${E(r.compound_id)}" title="Select as compound B">${E(r.name)}</button>${r.similarity!==undefined?'<span>'+r.similarity.toFixed(3)+'</span>':''}${r.basis?.supporting_reference?'<small class="relation-basis">'+E(r.basis.relationship_type)+' · '+E(r.basis.supporting_reference)+'</small>':''}</div>`).join('')||'<p class="small muted">No recorded relation in this view.</p>'}</div>`).join('');$('related-count').textContent='Four distinct relation types';}catch(err){error(err);}}
async function recommendations(autoChoose=false){
  choiceController?.abort();choiceController=new AbortController();
  const current=choiceController,a=selected.a;
  try{
    const data=await api('/api/evidence-choices?'+new URLSearchParams({id:a}),current.signal);
    if(current!==choiceController||a!==selected.a||selectionDirty.a)return;
    choiceData=data.items;
    $('choice-cards').innerHTML=data.items.map(item=>{
      const shortResult=value=>value.length>90?'Qualified result; inspect the original record':value;
      return '<article class="choice-card"><h3>'+E(item.name)+'</h3><p>'+E(item.system)+' · '+window.ActivityResultDisplay.notationHTML(item.endpoint)+'</p><p class="choice-result">A: '+window.ActivityResultDisplay.notationHTML(shortResult(item.result_a))+'<br>B: '+window.ActivityResultDisplay.notationHTML(shortResult(item.result_b))+'</p><p class="choice-change">'+E(item.structure_change)+'</p><p>'+E(item.condition_status)+'</p><button class="secondary" data-choice="'+E(item.compound_id)+'">Compare these experiments →</button></article>';
    }).join('')||'<p class="small muted">No shared experimental candidate was found under this setting. Your compound remains available below. Open Related compounds to choose a member manually.</p>';
    if(autoChoose&&!selected.b&&data.items.length){
      const c=data.items[0];selected.b=c.compound_id;$('compound-b').value=byId.get(selected.b).name;
      await refresh({activity_a:c.activity_a,activity_b:c.activity_b});
    }
  }catch(err){if(current===choiceController&&a===selected.a)error(err);}
}
async function loadExample(id){const item=examples.find(e=>e.id===id);if(!item)return;clearComparison();selected={a:item.a,b:item.b};for(const side of ['a','b']){selectionDirty[side]=false;closeSuggestions(side);$('selection-help-'+side).textContent='';$('compound-'+side).value=byId.get(selected[side]).name;}return Promise.all([relations(),recommendations(),refresh({...item.activity_a?{activity_a:item.activity_a}:{},...item.activity_b?{activity_b:item.activity_b}:{}})]);}
$('example-select').addEventListener('change',()=>loadExample($('example-select').value));
$('choice-cards').addEventListener('click',event=>{const button=event.target.closest('[data-choice]');if(!button)return;const choice=choiceData.find(c=>c.compound_id===button.dataset.choice);if(!choice)return;selectionDirty.b=false;closeSuggestions('b');selected.b=choice.compound_id;$('compound-b').value=byId.get(selected.b).name;$('selection-help-b').textContent='';return refresh({activity_a:choice.activity_a,activity_b:choice.activity_b});});

const pendingCommits={a:null,b:null};
async function commitCompound(side,chosenId=null){
  const value=$('compound-'+side).value.trim();
  const matches=chosenId&&byId.has(chosenId)?[byId.get(chosenId)]:exactMatches(value);
  const emptyB=side==='b'&&!value&&!chosenId;
  if(!emptyB&&matches.length!==1){
    pendingCommits[side]=null;invalidateDraft(side);searchSuggestions(side);
    $('selection-help-'+side).textContent=matches.length>1?'Several records share this name. Choose the required record below.':'Choose a search result; partial names are welcome.';
    return;
  }
  const id=emptyB?'':matches[0].compound_id;
  if(pendingCommits[side]?.id===id&&!selectionDirty[side])return;
  if(selected[side]===id&&report&&!selectionDirty[side]&&$('error').hidden){closeSuggestions(side);return;}
  const operation={value,id};pendingCommits[side]=operation;
  selectionDirty[side]=false;closeSuggestions(side);$('selection-help-'+side).textContent='';
  $('compound-'+side).value=emptyB?'':matches[0].name;
  const transition=Selection.changeMember(selected,selectedExperiments(),side,id);
  clearComparison(side==='a');$('example-select').value='';selected=transition.selected;
  try{
    if(side==='a')await Promise.all([relations(),refresh(transition.activities),recommendations()]);
    else await refresh(transition.activities);
  }finally{if(pendingCommits[side]===operation)pendingCommits[side]=null;}
}
for(const side of ['a','b']){
  $('compound-'+side).addEventListener('change',()=>commitCompound(side));
  $('compound-'+side).addEventListener('focus',()=>searchSuggestions(side));
  $('compound-'+side).addEventListener('input',()=>{invalidateDraft(side);if(side==='b'&&!$('compound-b').value.trim())return commitCompound(side);searchSuggestions(side);});
  $('suggestions-'+side).addEventListener('mousedown',event=>event.preventDefault());
  $('suggestions-'+side).addEventListener('click',event=>{const button=event.target.closest('[data-select-id]');if(button)return commitCompound(side,button.dataset.selectId);});
  $('compound-'+side).addEventListener('keydown',event=>{
    const rows=suggestionRows[side];
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if($('suggestions-'+side).hidden)searchSuggestions(side);
      suggestionIndex[side]=Math.max(0,Math.min(rows.length-1,suggestionIndex[side]+(event.key==='ArrowDown'?1:-1)));
      const index=suggestionIndex[side];$('compound-'+side).setAttribute('aria-activedescendant',`option-${side}-${index}`);
      for(const [i,node]of [...$('suggestions-'+side).querySelectorAll('[role="option"]')].entries()){node.setAttribute('aria-selected',String(i===index));if(i===index)node.scrollIntoView({block:'nearest'});}return;
    }
    if(event.key==='Enter'){event.preventDefault();return commitCompound(side,suggestionIndex[side]>=0?rows[suggestionIndex[side]]?.compound_id:null);}
    if(event.key==='Escape'){event.preventDefault();$('compound-'+side).value=byId.get(selected[side])?.name||'';selectionDirty[side]=false;closeSuggestions(side);$('selection-help-'+side).textContent='';if(!selectionDirty.a&&!selectionDirty.b)return refresh();}
  });
}
document.addEventListener('click',event=>{for(const side of ['a','b'])if(!event.target.closest('.compound-picker'))closeSuggestions(side);});
for(const side of ['a','b'])$('activity-'+side).addEventListener('change',()=>refresh({activity_a:$('activity-a').value,activity_b:$('activity-b').value}));
$('relation-groups').addEventListener('click',ev=>{const b=ev.target.closest('[data-member]');if(!b)return;return commitCompound('b',b.dataset.member);});
$('swap').addEventListener('click',()=>{
  if(!selected.b)return;
  const oldA=report?.selected_activity_a,oldB=report?.selected_activity_b;
  clearComparison();[selected.a,selected.b]=[selected.b,selected.a];
  for(const side of ['a','b']){selectionDirty[side]=false;closeSuggestions(side);$('selection-help-'+side).textContent='';$('compound-'+side).value=byId.get(selected[side]).name;}
  return Promise.all([relations(),recommendations(),refresh({...(oldB?{activity_a:oldB}:{}),...(oldA?{activity_b:oldA}:{})})]);
});
$('refresh-related').addEventListener('click',relations);
function fillReferenceOptions(profiles){coverageProfiles=profiles;$('reference-filter').innerHTML='<option value="">All references</option>'+profiles.map(p=>`<option value="${E(p.id)}">${E(p.reference_name)}${p.version?' · '+E(p.version):' · Not loaded'}</option>`).join('');$('reference-filter').value=coverageReference;}
$('reference-filter').addEventListener('change',()=>{coverageReference=$('reference-filter').value;renderReferenceCoverage();saveCoverageURL();});
$('reference-import').addEventListener('submit',async ev=>{ev.preventDefault();const file=$('ref-file').files[0];if(!file)return;const button=ev.target.querySelector('button');button.disabled=true;$('import-result').textContent='Validating local file…';try{if(file.size>35*1024*1024)throw Error('Choose a reference file of 35 MB or less. Larger existing references can be imported with the local Python adapter.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));const payload={content_base64:btoa(binary),filename:file.name,format:file.name.split('.').pop().toLowerCase(),metadata:{reference_name:$('ref-name').value.trim(),version:$('ref-version').value.trim(),scope:$('ref-scope').value.trim(),license:$('ref-license').value.trim()}};const response=await fetch('/api/references/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error);coverageReference='';fillReferenceOptions(await api('/api/references'));$('import-result').textContent=`${data.status}. Read ${data.rows_read}; valid ${data.valid_record_count}; duplicate rows ${data.duplicate_record_rows}; invalid ${data.invalid_rows}; unique structures ${data.unique_recorded_structures}.`;if(data.invalid_rows){const link=document.createElement('a');link.href='/api/reference-failures?profile='+encodeURIComponent(data.id);link.textContent=' Inspect invalid rows';$('import-result').append(link);}await loadReferenceCoverage(coverageId,true);}catch(err){$('import-result').textContent=err.message;error(err);}finally{button.disabled=false;}});
function readInitialSelection(){
  const q=new URLSearchParams(location.search);
  const requestedView=location.hash==='#analyze'?'analyze':(['search','compare','explore','analyze','coverage'].includes(q.get('view'))?q.get('view'):'compare');
  activeView=availableView(requestedView);
  if(activeView!==requestedView){q.set('view',activeView);history.replaceState(null,'','?'+q.toString()+(location.hash==='#analyze'?'':location.hash));}
  if(q.get('compound'))selected={a:q.get('compound'),b:''};
  else{selected.a=q.get('a')||selected.a;selected.b=q.has('b')?q.get('b'):(q.has('a')?'':selected.b);}
  if(activeView==='explore')evidenceCompound=q.get('compound');
  selectedReference=q.get('reference')||'';
  return q;
}
async function startComparison(extra={}){
  if(!localService)return ensureSavedComparison();
  if(!byId.has(selected.a)||selected.b&&!byId.has(selected.b))throw Error('The requested compound is not in the current public catalog. Search for another record using Compound A or B.');
  for(const side of ['a','b'])$('compound-'+side).value=byId.get(selected[side])?.name||'';
  await Promise.all([relations(),recommendations(false),refresh(extra)]);
}
async function staticMode(){
  localService=false;readInitialSelection();initializationReady=true;
  $('snapshot-label').textContent='Saved research records';
  $('progress-items').textContent='Stored structures and evidence can be browsed here. New atom mappings use the local service.';
  showView(activeView,false);
}
async function init(){try{
  await staticMode();return; // Public static edition
  let data;
  try{data=await api('/api/bootstrap');}catch(err){
    const unavailable=err instanceof TypeError||err instanceof SyntaxError||/404|Unknown endpoint|Unexpected token|is not valid JSON/i.test(err.message);
    if(unavailable){await staticMode();return;}throw err;
  }
  catalog=data.compounds;examples=data.examples||[];
  $('example-select').innerHTML='<option value="">Open an example comparison</option>'+examples.map(e=>`<option value="${E(e.id)}">${E(e.label)}</option>`).join('');
  byId=new Map(catalog.map(c=>[c.compound_id,c]));fillReferenceOptions(data.references);
  $('catalog-count').textContent=`${data.manifest.metrics.public_records} public records · ${data.manifest.metrics.structure_analysis_available} available structures · ${data.manifest.metrics.activity_rows} admitted evidence rows`;
  $('snapshot-label').textContent=`Snapshot ${data.manifest.snapshot_id.slice(0,12)} · Rules ${data.rules.version}`;
  $('progress-items').textContent='Structures and admitted evidence use the current compound records. Scientific review status is retained on each record.';
  const q=readInitialSelection();initializationReady=true;showView(activeView,false);
  if(activeView==='compare')await startComparison({activity_a:q.get('activity_a'),activity_b:q.get('activity_b')});
}catch(err){error(err);}}

const scriptLoads=new Map([...document.scripts].filter(s=>s.src).map(s=>[s.src,Promise.resolve()]));
function loadEvidenceScript(path){
  const resource=new URL(path,siteBase),generation=document.querySelector('meta[name="site-generation"]')?.content;
  if(generation)resource.searchParams.set('site_generation',generation);
  const url=resource.href;
  if(scriptLoads.has(url))return scriptLoads.get(url);
  const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;const timeout=setTimeout(()=>reject(Error('Evidence resources are taking too long. Please retry.')),20000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(Error('Evidence resources could not be loaded. Please retry.'));};document.head.append(script);});
  scriptLoads.set(url,promise);promise.catch(()=>scriptLoads.delete(url));return promise;
}
function syncEvidenceTask(){
  const embedded=activeView==='explore'||activeView==='analyze';
  $('matrix').hidden=activeView!=='explore';$('analyze').hidden=activeView!=='analyze';$('snapshot-details').hidden=activeView!=='explore';
  if(embedded&&window.ResearchEvidence){window.ResearchEvidence.setTask(activeView,evidenceCompound,byId.get(evidenceCompound)?.name);if(activeView==='explore')evidenceCompound=null;}
}
async function ensureEvidenceTools(){
  if(window.ResearchEvidence){$('evidence-loading').hidden=true;syncEvidenceTask();return;}
  if(evidenceLoad)return evidenceLoad;
  $('evidence-loading').hidden=false;$('retry-evidence').hidden=true;
  evidenceLoad=(async()=>{
    try{
      await Promise.all(['assets/data/pharmacology_evidence_v1.js','assets/examples/pharmacology-example.js','assets/js/pharmacology-core-v1.js','assets/data/pharmacology_sync_v1.js','assets/data/activity-table-metadata-v1.js'].map(loadEvidenceScript));
      await loadEvidenceScript('assets/js/activity-result-display-v1.js');
      await loadEvidenceScript('assets/js/research-evidence-panel-v4.js');
      if(!window.ResearchEvidence)throw Error($('app-error').textContent||'Evidence tools did not initialize.');
      $('evidence-loading').hidden=true;syncEvidenceTask();
    }catch(err){$('evidence-loading').textContent=err.message;$('retry-evidence').hidden=false;evidenceLoad=null;}
  })();
  return evidenceLoad;
}
$('retry-evidence').addEventListener('click',()=>ensureEvidenceTools());
document.addEventListener('click',async event=>{
  const link=event.target.closest('[data-compare-compound]');
  if(!link)return;
  event.preventDefault();showView('compare');
  if(!localService)await ensureSavedComparison();
  if(byId.has(link.dataset.compareCompound))await commitCompound(link.dataset.compareSide||'a',link.dataset.compareCompound);
  window.scrollTo({top:0,behavior:'instant'});
});
document.addEventListener('click',async event=>{
  const link=event.target.closest('[data-evidence-compound]');if(!link||!byId.has(link.dataset.evidenceCompound))return;
  event.preventDefault();evidenceCompound=link.dataset.evidenceCompound;showView('explore');
  window.scrollTo({top:0,behavior:'instant'});
});
function showView(view,save=true){
  view=availableView(view);
  activeView=view;
  for(const section of document.querySelectorAll('[data-workbench-view]'))section.hidden=section.dataset.workbenchView!==view;
  for(const link of document.querySelectorAll('[data-view-button]')){link.classList.toggle('active',link.dataset.viewButton===view);if(link.dataset.viewButton===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  const title={search:'Structure search',compare:'Compare compounds',explore:'Explore evidence',analyze:'Analyze your data',coverage:'Reference coverage'}[view];
  $('task-title').textContent=title;$('view-heading').textContent=title;document.title=title+' · Research Workbench · Deep-Sea Compound Database';
  $('view-description').textContent={search:'Paste a SMILES string to find recorded structures, shared scaffolds and related chemical features.',compare:'Inspect two stored structures, their experimental results and the conditions needed for comparison.',explore:'Find original experimental results by compound, biological system and endpoint.',analyze:'Check your dataset, normalize units and inspect condition matches with stored evidence.',coverage:'Check a stored structure against the locally loaded reference versions.'}[view];
  $('error').hidden=true;$('selection-notice').hidden=view!=='compare'||!$('selection-notice').textContent;$('busy').hidden=view!=='compare'||!comparisonLoading;
  const embedded=view==='explore'||view==='analyze';$('pharmacology-panel').hidden=!embedded;
  $('comparison-methods').hidden=view!=='compare';$('quick-export').hidden=view!=='compare';
  $('service-notice').hidden=true;
  $('open-local-service').href=localServiceURL('compare');
  if(!localService&&view==='compare'&&initializationReady)ensureSavedComparison();
  if(view==='coverage')ensureReferenceCoverage();
  if(save&&selected.a)history.replaceState(null,'','?'+params());
  if(embedded){syncEvidenceTask();ensureEvidenceTools();}
  updateResultVisibility();
}
for(const link of document.querySelectorAll('[data-view-button]'))link.addEventListener('click',event=>{event.preventDefault();showView(link.dataset.viewButton);if(link.dataset.viewButton==='compare'&&localService&&initializationReady&&!report&&!selectionDirty.a&&!selectionDirty.b)startComparison().catch(error);window.scrollTo({top:0,behavior:'instant'});});
$('quick-export').addEventListener('click',()=>{showView('compare');$('export').scrollIntoView({behavior:'smooth'});});
// Reference lookup remains usable from the saved website, with explicit snapshot provenance.
let coverageCatalog=[],coverageProfiles=[],coverageId='',coverageReference='',coverageContext=null,
    coverageSource='',coverageSnapshot=null,coverageLoad=null,coverageRequest=null,
    coverageDraft=false,coverageRows=[],coverageIndex=-1,coverageInitialized=false;
function localServiceURL(view){return 'http://127.0.0.1:9371/pages/research-workbench.html?'+params({view,...(coverageId?{coverage_compound:coverageId}:{}),...(coverageReference?{coverage_reference:coverageReference}:{})});}
function saveCoverageURL(){
  $('coverage-local-link').href=localServiceURL('coverage');
  if(activeView==='coverage')history.replaceState(null,'','?'+params());
}
function coverageAliases(c){return [c.name,c.compound_id,c.compound_id.replace(/\.html$/i,'')];}
function closeCoverageSuggestions(){$('coverage-suggestions').hidden=true;$('coverage-compound').setAttribute('aria-expanded','false');$('coverage-compound').removeAttribute('aria-activedescendant');coverageIndex=-1;}
function searchCoverageSuggestions(){
  const q=normalizedName($('coverage-compound').value),words=q.split(/\s+/).filter(Boolean);
  coverageRows=coverageCatalog.filter(c=>!q||words.every(w=>normalizedName(c.name+' '+c.compound_id+' '+(c.formula||'')).includes(w))).sort((a,b)=>Number(coverageAliases(b).some(v=>normalizedName(v)===q))-Number(coverageAliases(a).some(v=>normalizedName(v)===q))||a.name.localeCompare(b.name)).slice(0,8);
  coverageIndex=-1;$('coverage-suggestions').innerHTML=coverageRows.map((c,i)=>`<button type="button" role="option" aria-selected="false" id="coverage-option-${i}" data-coverage-id="${E(c.compound_id)}" title="${E(c.name)}"><strong>${E(c.name)}</strong><small>${E(c.formula||'Formula not reported')} · ${E(c.compound_id)}</small></button>`).join('')||'<p class="small muted">No catalog match. Try a shorter keyword.</p>';
  $('coverage-suggestions').hidden=false;$('coverage-compound').setAttribute('aria-expanded','true');
}
function clearCoverageDraft(){
  coverageDraft=true;coverageRequest?.abort();$('coverage-results').innerHTML='';$('coverage-summary').hidden=true;
  $('coverage-help').textContent='Choose a result below, or press Enter for an exact match.';
}
async function chooseCoverageCompound(id){
  const value=$('coverage-compound').value,q=normalizedName(value);
  const found=id?coverageCatalog.filter(c=>c.compound_id===id):coverageCatalog.filter(c=>coverageAliases(c).some(v=>normalizedName(v)===q));
  if(found.length!==1){clearCoverageDraft();searchCoverageSuggestions();$('coverage-help').textContent=found.length>1?'Several records share this name. Choose the required record below.':'Choose a search result; partial names are welcome.';return;}
  coverageDraft=false;closeCoverageSuggestions();$('coverage-help').textContent='';$('coverage-compound').value=found[0].name;
  return loadReferenceCoverage(found[0].compound_id);
}
function renderReferenceCoverage(){
  if(!coverageContext||coverageDraft)return;
  const c=coverageContext.compound,all=coverageContext.coverage,items=coverageReference?all.filter(r=>r.reference.id===coverageReference):all.filter(r=>r.reference.status!=='Reference not loaded');
  $('coverage-summary').hidden=false;$('coverage-summary').innerHTML=`<h2>${E(c.name)}</h2><a href="../1-Compounds/${encodeURIComponent(c.compound_id)}">Compound record ↗</a>`;
  $('coverage-results').innerHTML=items.map(r=>{
    const p=r.reference;
    if(p.status!=='Loaded')return `<article class="panel coverage-reference-empty"><h3>${E(p.reference_name)}</h3><span class="status warn">${E(p.status)}</span><p>No matching result is available for this reference.</p></article>`;
    return `<article class="panel reference-card"><header><h3>${E(p.reference_name)} <small>${E(p.version)}</small></h3><small>${Number(p.valid_record_count).toLocaleString('en-US')} valid records</small></header>${r.levels.map(level=>`<div class="coverage-level"><div class="coverage-level-head"><strong>${E(level.level)}</strong><span class="status ${statusClass(level.status)}">${E(level.status)}</span>${level.match_count?`<span class="small muted">${level.match_count} hit${level.match_count===1?'':'s'}</span>`:''}</div>${level.reason?`<p class="muted">${E(level.reason)}</p>`:''}${level.warning?`<p class="warning">${E(level.warning)}</p>`:''}${level.matches.length?`<details><summary>View matching records${level.match_count>level.matches.length?` (first ${level.matches.length})`:''}</summary>${level.matches.map(m=>`<div class="coverage-hit"><b>${E(m.reference_record_id)}</b>${m.name?' · '+E(m.name):''}${m.reference?.doi?`<small><a href="https://doi.org/${encodeURIComponent(m.reference.doi)}" target="_blank" rel="noopener noreferrer">DOI ${E(m.reference.doi)} ↗</a></small>`:''}</div>`).join('')}</details>`:''}</div>`).join('')}</article>`;
  }).join('')||'<div class="panel coverage-reference-empty"><p>No reference data has been loaded for this snapshot.</p></div>';
  const unloaded=all.filter(r=>r.reference.status==='Reference not loaded');
  if(!coverageReference&&unloaded.length)$('coverage-results').innerHTML+=`<details class="coverage-unloaded"><summary>${unloaded.length} references not loaded</summary><p>${unloaded.map(r=>E(r.reference.reference_name)).join(' · ')}. No matching claim is made for these references.</p></details>`;
  const prefix=coverageSource==='saved'?'Saved results':'Local reference results';
  $('coverage-state').textContent=prefix+' · '+(coverageSource==='saved'?coverageSnapshot.generated_utc.slice(0,10)+' · ':'')+'Matching is limited to the loaded reference versions.';
  const profiles=coverageProfiles.filter(p=>p.status==='Loaded');
  $('coverage-provenance').innerHTML=profiles.map(p=>`<p><b>${E(p.reference_name)} ${E(p.version)}</b> · ${E(p.license)}${p.license_url?` · <a href="${E(p.license_url)}" target="_blank" rel="noopener noreferrer">License ↗</a>`:''}<br>${E(p.scope)}<br>${p.rows_read} rows read · ${p.valid_record_count} valid · ${p.invalid_rows} invalid · ${p.unique_recorded_structures} unique recorded structures.<br>${E(p.normalization)}</p>`).join('')+(coverageSource==='saved'?`<p class="muted">Saved snapshot: ${E(coverageSnapshot.snapshot_id)}<br>Generated: ${E(coverageSnapshot.generated_utc)}. Additional local imports are available in the local service; they are not included automatically in this saved snapshot.</p>`:'');
}
async function loadReferenceCoverage(id,force=false){
  if(!id)return;
  if(!force&&coverageContext?.compound.compound_id===id){coverageId=id;renderReferenceCoverage();return;}
  coverageId=id;coverageRequest?.abort();coverageRequest=new AbortController();const current=coverageRequest;
  coverageContext=null;$('coverage-results').innerHTML='';$('coverage-summary').hidden=true;$('coverage-state').textContent='Checking reference records…';$('coverage-state').classList.toggle('coverage-load-error',false);
  try{
    const context=localService?await api('/api/compound?'+new URLSearchParams({id}),current.signal):coverageSnapshot.compounds.find(c=>c.compound.compound_id===id);
    if(current!==coverageRequest||coverageDraft)return;
    if(!context)throw Error('This compound is not available in the saved reference snapshot.');
    coverageContext=context;renderReferenceCoverage();saveCoverageURL();
  }catch(err){if(err.name==='AbortError')return;$('coverage-state').textContent=err.message;$('coverage-state').classList.toggle('coverage-load-error',true);$('retry-coverage').hidden=false;}
}
async function ensureReferenceCoverage(){
  if(coverageLoad)return coverageLoad;
  if(coverageInitialized){renderReferenceCoverage();return;}
  coverageContext=null;coverageDraft=false;$('coverage-results').innerHTML='';$('coverage-summary').hidden=true;
  $('coverage-compound').disabled=true;$('reference-filter').disabled=true;$('retry-coverage').hidden=true;
  $('coverage-import-panel').hidden=!localService;$('coverage-import-unavailable').hidden=localService;
  $('coverage-local-link').href=localServiceURL('coverage');
  $('coverage-state').textContent=localService?'Checking reference records…':'Loading saved reference results…';
  $('coverage-state').classList.toggle('coverage-load-error',false);
  coverageLoad=(async()=>{try{
    const q=new URLSearchParams(location.search);coverageReference=q.get('coverage_reference')||q.get('reference')||'';
    if(localService){coverageCatalog=catalog;coverageSource='local';}
    else{
      if(!window.RESEARCH_REFERENCE_COVERAGE||!window.PHARMACOLOGY_SYNC)await Promise.all(['assets/data/research_reference_coverage_v1.js','assets/data/pharmacology_sync_v1.js'].map(loadEvidenceScript));
      coverageSnapshot=window.RESEARCH_REFERENCE_COVERAGE;const sync=window.PHARMACOLOGY_SYNC;
      if(!coverageSnapshot||sync?.status!=='ready'||sync.generation_id!==coverageSnapshot.pharmacology_generation_id)throw Error('Saved reference results need to be refreshed for the current database. Open the local service to rebuild them.');
      coverageCatalog=coverageSnapshot.compounds.map(c=>c.compound);fillReferenceOptions(coverageSnapshot.profiles);coverageSource='saved';
    }
    if(coverageReference&&!coverageProfiles.some(p=>p.id===coverageReference))throw Error('The requested reference is not in this reference snapshot.');
    $('reference-filter').value=coverageReference;
    const id=coverageId||q.get('coverage_compound')||selected.a;
    const compound=coverageCatalog.find(c=>c.compound_id===id);
    if(!compound)throw Error('The requested compound is not in the current public catalog.');
    $('coverage-compound').disabled=false;$('reference-filter').disabled=false;$('retry-coverage').hidden=true;
    $('coverage-import-panel').hidden=!localService;$('coverage-import-unavailable').hidden=localService;
    $('coverage-compound').value=compound.name;coverageInitialized=true;
    await loadReferenceCoverage(id);$('coverage-local-link').href=localServiceURL('coverage');
  }catch(err){$('coverage-state').textContent=err.message;$('coverage-state').classList.toggle('coverage-load-error',true);$('retry-coverage').hidden=false;coverageLoad=null;}})();
  return coverageLoad;
}
$('coverage-compound').addEventListener('focus',searchCoverageSuggestions);
$('coverage-compound').addEventListener('input',()=>{clearCoverageDraft();searchCoverageSuggestions();});
$('coverage-compound').addEventListener('change',()=>chooseCoverageCompound());
$('coverage-suggestions').addEventListener('mousedown',event=>event.preventDefault());
$('coverage-suggestions').addEventListener('click',event=>{const button=event.target.closest('[data-coverage-id]');if(button)return chooseCoverageCompound(button.dataset.coverageId);});
$('coverage-compound').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();return chooseCoverageCompound(coverageIndex>=0?coverageRows[coverageIndex]?.compound_id:null);}
  if(event.key==='Escape'){event.preventDefault();coverageDraft=false;closeCoverageSuggestions();$('coverage-help').textContent='';$('coverage-compound').value=coverageCatalog.find(c=>c.compound_id===coverageId)?.name||'';return loadReferenceCoverage(coverageId,true);}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if($('coverage-suggestions').hidden)searchCoverageSuggestions();coverageIndex=Math.max(0,Math.min(coverageRows.length-1,coverageIndex+(event.key==='ArrowDown'?1:-1)));
    $('coverage-compound').setAttribute('aria-activedescendant','coverage-option-'+coverageIndex);
    for(const [i,node]of [...$('coverage-suggestions').querySelectorAll('[role="option"]')].entries()){node.setAttribute('aria-selected',String(i===coverageIndex));if(i===coverageIndex)node.scrollIntoView({block:'nearest'});}
  }
});
document.addEventListener('click',event=>{if(!event.target.closest('.compound-picker'))closeCoverageSuggestions();});
$('retry-coverage').addEventListener('click',()=>{coverageInitialized=false;coverageLoad=null;return ensureReferenceCoverage();});

async function ensureSavedComparison(){
  if(savedCompareLoad)return savedCompareLoad;
  if(savedCompareReady)return;
  $('compare-state').hidden=false;$('compare-state').textContent='Loading saved compound records…';$('retry-compare').hidden=true;
  for(const side of ['a','b'])$('compound-'+side).disabled=true;
  savedCompareLoad=(async()=>{try{
    if(!window.SavedComparison||!window.RESEARCH_COMPARISON_SNAPSHOT||!window.PHARMACOLOGY_SYNC)await Promise.all(['assets/js/saved-comparison-v1.js','assets/data/research_comparison_snapshot_v1.js','assets/data/pharmacology_sync_v1.js'].map(loadEvidenceScript));
    const saved=window.RESEARCH_COMPARISON_SNAPSHOT,sync=window.PHARMACOLOGY_SYNC;
    if(!saved||sync?.status!=='ready'||sync.generation_id!==saved.pharmacology_generation_id)throw Error('Saved comparison records need to be refreshed for the current database.');
    window.SavedComparison.init(saved,loadEvidenceScript);
    catalog=saved.catalog;byId=new Map(catalog.map(c=>[c.compound_id,c]));examples=saved.examples;
    if(!byId.has(selected.a)||selected.b&&!byId.has(selected.b))throw Error('The requested compound is not in the current public catalog.');
    for(const side of ['a','b']){$('compound-'+side).value=byId.get(selected[side])?.name||'';$('compound-'+side).disabled=false;}
    $('example-select').innerHTML='<option value="">Open an example comparison</option>'+examples.map(e=>`<option value="${E(e.id)}">${E(e.label)}</option>`).join('');
    $('catalog-count').textContent=`${catalog.length} public records · Saved structures and evidence`;
    const q=new URLSearchParams(location.search);
    await Promise.all([relations(),recommendations(false),refresh({activity_a:q.get('activity_a'),activity_b:q.get('activity_b')})]);
    if(!report)throw Error($('error').textContent||'Saved comparison records did not load.');
    savedCompareReady=true;$('compare-state').textContent='Saved records · '+saved.generated_utc.slice(0,10)+'. Existing evidence and structure restrictions retained.';
    const coverage=saved.capability_coverage,mapping=coverage?.mapping;
    if(mapping)$('progress-items').textContent=`Prepared structure comparisons: ${mapping.candidate_pairs_with_source_family_exceptions} candidate pairs. ${mapping.statuses['Comparison failed']||0} ordered mappings reached a computation limit. Conditions: ${saved.manifest.metrics.primary_condition_reviewed_rows||0} existing rows reviewed against primary methods; ${coverage.condition_review.group_count} publication/type groups retain required gaps. This is capability coverage, not completion of scientific review.`;
  }catch(err){clearComparison();$('compare-state').textContent=err.message;$('retry-compare').hidden=false;savedCompareLoad=null;}})();
  return savedCompareLoad;
}
function finishComparisonView(){
  $('local-mapping-action').hidden=localService||!report?.structure.mapping_pending;
  $('compute-local-mapping').href=localServiceURL('compare');
  document.querySelector('.structure-caption .legend').hidden=!report.b||Boolean(report.structure.mapping_pending)||!report.structure.changes?.length;
  if(localService)return;
  const files=window.SavedComparison.exports(report);
  for(const [id,file]of Object.entries(files)){
    const url=URL.createObjectURL(new Blob([file.text],{type:file.type}));savedExportURLs.push(url);
    $(id).href=url;$(id).setAttribute('download',file.name);
  }
}
$('retry-compare').addEventListener('click',()=>{savedCompareReady=false;savedCompareLoad=null;return ensureSavedComparison();});

init();
