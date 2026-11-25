/* Browser-only interface. SPDX-License-Identifier: MIT */
(()=>{'use strict';
const D=window.PHARMACOLOGY_EVIDENCE,C=window.PharmacologyCore,F=window.ActivityResultDisplay,M=window.ActivityTableMetadata,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!D||!C||!F||!M||M.generation!==document.querySelector('meta[name="site-generation"]')?.content){$('app-error').hidden=false;$('app-error').textContent='The local reference snapshot or display metadata did not load from the current release. Please reload the page.';return;}
const sync=window.PHARMACOLOGY_SYNC;
if(!sync||sync.status!=='ready'||!D.integration||sync.generation_id!==D.integration.generation_id){
 $('app-error').hidden=false;$('app-error').textContent='The reference tables are being refreshed or do not belong to the same release. Please reload after synchronization.';
 for(const el of document.querySelectorAll('#evidence-tools button,#evidence-tools input,#evidence-tools textarea,#evidence-tools select'))el.disabled=true;
 return;
}
for(const el of document.querySelectorAll('#evidence-tools [data-evidence-loading]')){el.disabled=false;el.removeAttribute('data-evidence-loading');}
const pageSize=25,byCompound=new Map(D.compounds.map(c=>[c.file,c])),byRow=new Map(D.activities.map(a=>[a.id,a]));
const state={page:1,filtered:[],report:null,downloadUrls:[]};
const filters={file:'compound-filter',system:'system-filter',endpoint:'endpoint-filter',layer:'layer-filter',method:'method-filter',exposure_hours:'time-filter',unit:'unit-filter',paper:'paper-filter'};
const labels={same_study_candidate:'Same-study candidate',matched_conditions:'Recorded conditions match',insufficient_metadata:'Insufficient metadata',incompatible:'Incompatible conditions',user_reported_conditions_match:'User-reported conditions match'};
const token=v=>v===null||v===undefined||v===''?'__missing__':String(v);
const fmt=v=>typeof v==='number'?Number(v.toPrecision(9)).toString():String(v??'');
const link=fn=>'../1-Compounds/'+encodeURIComponent(fn);
function sourceLink(r){if(r.source_kind==='original_assay_dataset'&&/^\d+$/.test(String(r.pubchem_aid))&&/^\d+$/.test(String(r.pubchem_sid)))return `<a href="https://pubchem.ncbi.nlm.nih.gov/bioassay/${r.pubchem_aid}#sid=${r.pubchem_sid}" target="_blank" rel="noopener noreferrer">NCI original assay · PubChem AID ${esc(r.pubchem_aid)} · SID ${esc(r.pubchem_sid)} ↗</a>`;if(r.doi)return `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer">DOI ${esc(r.doi)} ↗</a>`;if(r.pmid)return `<a href="https://pubmed.ncbi.nlm.nih.gov/${esc(r.pmid)}/" target="_blank" rel="noopener noreferrer">PMID ${esc(r.pmid)} ↗</a>`;return esc(r.paper||'Source not supplied');}
function metric(n,label){return `<div class="metric"><strong>${esc(n)}</strong><span>${esc(label)}</span></div>`;}
function clearDownloads(){for(const url of state.downloadUrls)URL.revokeObjectURL(url);state.downloadUrls=[];$('download-links').replaceChildren();$('download-links').hidden=true;}
function invalidateAnalysis(){state.report=null;$('analysis-output').hidden=true;for(const id of ['export-analysis','export-normalized','export-comparisons'])$(id).removeAttribute('href');clearDownloads();}
function saveFilters(){
 if(new URLSearchParams(location.search).get('view')!=='explore')return;
 const q=new URLSearchParams({view:'explore'});
 for(const [key,id]of Object.entries(filters))if($(id).value)q.set('e_'+key,$(id).value);
 for(const [key,id,defaultValue]of [['q','reference-search',''],['collection','collection-filter','all'],['coverage','coverage-filter','all']])if($(id).value!==defaultValue)q.set('e_'+key,$(id).value);
 if(state.page>1)q.set('e_page',state.page);history.replaceState(null,'','?'+q);
}
function restoreFilters(){
 const q=new URLSearchParams(location.search);
 for(const [key,id]of Object.entries(filters)){const value=q.get('e_'+key)|| (key==='file'?q.get('compound'):'');if(key==='file'&&value&&byCompound.has(value)&&![...$(id).options].some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=byCompound.get(value).name;$(id).append(o);}if(value&&[...$(id).options].some(o=>o.value===value))$(id).value=value;}
 $('reference-search').value=q.get('e_q')||'';
 for(const [key,id]of [['collection','collection-filter'],['coverage','coverage-filter']]){const value=q.get('e_'+key);if(value&&[...$(id).options].some(o=>o.value===value))$(id).value=value;}
 return Math.max(1,parseInt(q.get('e_page'),10)||1);
}
function complete(a){return ['system','endpoint','method','exposure_hours','unit','sample_form','control'].every(k=>token(a[k])!=='__missing__');}
function coverage(id,items,total){$(id).innerHTML=items.map(([name,count])=>`<div class="coverage-item"><span>${esc(name)}<b>${count}/${total}</b></span><progress max="${Math.max(total,1)}" value="${count}" aria-label="${esc(name)}"></progress></div>`).join('');}
function populate(){
 for(const [k,id]of Object.entries(filters)){
  const values=[...new Set(D.activities.map(a=>token(a[k])))].sort((a,b)=>a.localeCompare(b));
  $(id).innerHTML='<option value="">All</option>'+values.map(v=>`<option value="${esc(v)}">${esc(k==='file'?byCompound.get(v).name:v==='__missing__'?'Not recorded':v)}</option>`).join('');
 }
 const m=D.metrics;$('metrics').innerHTML=metric(m.public_records,'Public catalog records')+metric(m.compounds_with_evidence,'Compounds with admitted results')+metric(m.evidence_rows,'Admitted evidence rows')+metric(m.RCDB_evidence_rows,'RCDB evidence rows');
 $('snapshot').textContent=`Reference snapshot ${D.as_of} · Paired database tables ${D.integration.generation_id.slice(0,12)} · ${m.supported_records} scope-supported / ${m.scope_pending_records} scope pending · ${m.archive_records-m.public_records} archived records withheld · Analytical engine ${C.VERSION}. Pending-scope records remain catalog identifiers; their results are not admitted.`;
}
function filter(){
 const q=C.norm($('reference-search').value),rcdb=$('collection-filter').value==='rcdb',cov=$('coverage-filter').value;
 state.filtered=D.activities.filter(a=>(!rcdb||a.center)&&(!q||C.norm(`${a.name} ${a.system} ${a.endpoint} ${a.category}`).includes(q))&&Object.entries(filters).every(([k,id])=>!$(id).value||token(a[k])===$(id).value)&&(cov==='all'||complete(a)===(cov==='complete')));
 clearDownloads();state.page=1;renderReference();
 coverage('coverage-chart',[['Method',state.filtered.filter(a=>a.method).length],['Exposure time',state.filtered.filter(a=>a.exposure_hours!==null).length],['Sample form',state.filtered.filter(a=>a.sample_form).length],['Control',state.filtered.filter(a=>a.control).length]],state.filtered.length);
}
function resultRow(a){
 const display=F.format(a),conditionTime=a.exposure_hours==null?'Exposure not recorded':fmt(a.exposure_hours)+' h';
 const meta=M.compounds[a.file],notation=F.notationHTML;
 const thumbnail=meta?.structure_image?`<a class="activity-structure" href="${link(a.file)}" aria-label="${esc(a.name)} stored structure"><img src="../${esc(meta.structure_image)}" alt="${esc(a.name)} stored structure" width="56" height="56" loading="lazy" decoding="async"></a>`:'<span class="activity-structure activity-structure-missing">Image unavailable</span>';
 const classification=meta?.chemotype?`<span class="tag activity-chemotype">${esc(meta.chemotype)}</span>${meta.classification_status==='unverified'?'<span class="activity-classification-state">Classification unverified</span>':''}`:'';
 const quantitative=!a.quantitative_allowed?'<span class="tag warn">Quantitative use restricted</span>':'';
 const sourceLinks=[a.doi?`<a href="https://doi.org/${esc(a.doi)}" target="_blank" rel="noopener noreferrer">DOI ${esc(a.doi)} ↗</a>`:'',a.pmid?`<a href="https://pubmed.ncbi.nlm.nih.gov/${esc(a.pmid)}/" target="_blank" rel="noopener noreferrer">PubMed ${esc(a.pmid)} ↗</a>`:''].filter(Boolean).join(' · ')||sourceLink(a);
 const evidence=`<div class="activity-source-link">${sourceLinks}</div><details class="activity-evidence"><summary>Evidence & qualifications</summary><p>${esc(D.references[a.paper]?.title||a.paper)}</p><p>${esc(a.locator||'See the compound evidence page.')}</p>${a.notes.map(n=>`<p>${esc(F.evidenceNoteText(n))}</p>`).join('')}<p>Field: ${esc(a.id)}</p><a href="${link(a.file)}#phenotypes">Compound evidence ↗</a></details>`;
 const conditions=`<div class="activity-condition-summary"><span>${esc(a.method||'Method not recorded')}</span><span>${esc(conditionTime)}</span></div><details class="activity-extra-conditions"><summary>More conditions</summary><p>Method: ${esc(a.method||'not recorded')}<br>Exposure: ${a.exposure_hours==null?'not recorded':esc(a.exposure_hours)+' h'}<br>Sample: ${esc(String(a.sample_form||'not recorded').replace('; exact identity retained without changing the accepted structure.',''))}<br>Control: ${esc(a.control||'not recorded')}</p>${a.dose_value!=null&&a.dose_value!==''?`<p>Dose: ${esc(a.dose_value)} ${esc(a.dose_unit)}</p>`:''}${a.error_type?`<p>Uncertainty type: ${esc(a.error_type)}</p>`:''}</details>`;
 const conversion=display.converted?`<details class="activity-unit-display"><summary>Molar unit display</summary><p>${notation(display.endpoint)}: ${notation(display.display_text)}</p></details>`:'';
 return `<tr data-evidence-id="${esc(a.id)}" data-display-status="${esc(display.status)}"><td><div class="activity-compound">${thumbnail}<div class="activity-compound-copy"><a class="activity-compound-name" href="${link(a.file)}">${esc(a.name)}</a><p class="activity-tags">${classification}<span class="tag">${esc(a.layer)}</span>${a.center?' <span class="tag">RCDB</span>':''}</p>${meta?.structure_restricted?'<span class="activity-structure-state">Structure analysis restricted</span>':''}<a class="activity-compare-link" href="research-workbench.html?a=${encodeURIComponent(a.file)}&b=" data-compare-compound="${esc(a.file)}">Compare structure →</a></div></div></td><td><strong class="activity-system">${esc(a.system)}</strong><span class="activity-endpoint">${notation(a.endpoint)}</span>${conditions}</td><td class="activity-display-cell"><div class="activity-original-value">${notation(display.original_text)}</div>${quantitative}${conversion}</td><td>${evidence}</td></tr>`;
}
function renderReference(){
 const pages=Math.max(1,Math.ceil(state.filtered.length/pageSize));state.page=Math.max(1,Math.min(state.page,pages));
 const rows=state.filtered.slice((state.page-1)*pageSize,state.page*pageSize);
 prepareEvidenceExport();saveFilters();$('reference-count').textContent=`Evidence rows: ${state.filtered.length} · Compounds: ${new Set(state.filtered.map(a=>a.file)).size}`;
 const endpoints=[...new Set(state.filtered.map(a=>String(a.endpoint||'').trim()))];
 const heading='Activity';
 $('reference-display-heading').textContent=heading;
 $('reference-page').textContent=`${state.page} / ${pages}`;$('reference-prev').disabled=state.page<=1;$('reference-next').disabled=state.page>=pages;
 $('reference-body').innerHTML=rows.map(resultRow).join('')||'<tr><td colspan="4">No admitted results match these filters. This is not evidence of inactivity.</td></tr>';
}
function normalizedText(r){const n=r.result;if(!n.valid)return 'Invalid input';if(!n.quantitative)return 'Raw result retained';const val=n.normalized_min!==null?`${fmt(n.normalized_min)}–${fmt(n.normalized_max)}`:`${n.relation} ${fmt(n.normalized_value)}`;return `${val}${n.normalized_error!==null?' ± '+fmt(n.normalized_error):''} ${n.unit}${n.error_type?' ('+n.error_type+')':''}`;}
function originalText(r){const a=r.input;const scalar=C.num(a.value);const interval=C.num(a.value_min)!==null&&C.num(a.value_max)!==null;const value=interval?`${a.value_min}–${a.value_max}`:scalar!==null?`${a.relation||'='} ${a.value}`:a.value||a.result||'No individual numeric value';return `${a.endpoint||''} ${value}${C.num(a.error)!==null?' ± '+a.error:''} ${a.unit||''}${a.error_type?' ('+a.error_type+')':''}`;}
function renderAnalysis(report){
 report.reference_generation_id=D.integration.generation_id;report.reference_rowset_sha256=D.integration.rowset_sha256;report.working_database_sha256=D.integration.inputs.working.sha256;state.report=report;$('analysis-output').hidden=false;prepareAnalysisExports();
 const c=report.counts;$('analysis-metrics').innerHTML=metric(c.input_rows,'Input rows')+metric(c.matched_records,'Exact catalog record matches')+metric(c.invalid_rows,'Rows requiring correction')+metric(c.reference_comparisons,'Reference comparisons');
 $('analysis-summary').textContent=`${c.user_comparisons} within-upload condition comparisons. ${report.interpretation} ${report.warnings.join(' ')}`;
 coverage('tier-chart',Object.entries(labels).filter(([k])=>k!=='user_reported_conditions_match').map(([k,v])=>[v,c.tiers[k]||0]),c.reference_comparisons);
 $('normalized-body').innerHTML=report.rows.map(r=>`<tr><td><strong>${esc(r.row_id)}</strong>${esc(r.input.name||r.identity.name)}</td><td><span class="tag ${r.identity.status==='matched_record'?'':'warn'}">${esc(r.identity.status.replace(/_/g,' '))}</span>${r.identity.file?`<p><a href="${link(r.identity.file)}">${esc(r.identity.name)} ↗</a></p>`:''}${r.identity.reasons.map(x=>`<p>${esc(x)}</p>`).join('')}</td><td>${F.notationHTML(originalText(r))}</td><td>${esc(normalizedText(r))}</td><td>${[...r.result.errors,...r.warnings].map(x=>`<p>${esc(x)}</p>`).join('')||'No input representation errors detected.'}</td></tr>`).join('');
 $('comparison-body').innerHTML=report.comparisons.slice(0,200).map(p=>{const a=byRow.get(p.reference_id);return `<tr><td><strong>${esc(p.user_row_id)}</strong><a href="${link(a.file)}">${esc(a.name)}</a><p>${esc(a.system)} · ${F.notationHTML(a.endpoint)}<br>${F.notationHTML(a.result)}</p></td><td><span class="tag ${['insufficient_metadata','incompatible'].includes(p.tier)?'warn':''}">${esc(labels[p.tier])}</span></td><td>${esc(p.reason)}${p.mismatches.length?`<p>Different: ${esc(p.mismatches.join('; '))}</p>`:''}${p.missing.length?`<p>Missing / restricted: ${esc(p.missing.join('; '))}</p>`:''}</td><td>${sourceLink(a)}<p>${esc(a.locator)}</p><p>${esc(a.id)}</p></td></tr>`;}).join('')||'<tr><td colspan="4">No reference result was matched for the supplied compound, system and endpoint. Within-upload validation and unit normalization are still available.</td></tr>';
 $('comparison-truncation').textContent=report.comparisons.length>200?'First 200 comparisons displayed. Download the report for every comparison.':'';
 $('user-comparisons').innerHTML=report.user_comparisons.length?`<div class="table-wrap"><table><thead><tr><th>Input pair</th><th>Assessment</th><th>Reasons / missing information</th></tr></thead><tbody>${report.user_comparisons.slice(0,150).map(p=>`<tr><td>${esc(p.user_row_id)} ↔ ${esc(p.other_user_row_id)}</td><td>${esc(labels[p.tier])}</td><td>${esc([...p.mismatches,...p.missing].join('; ')||p.identity_basis)}</td></tr>`).join('')}</tbody></table></div><p class="small">First ${Math.min(report.user_comparisons.length,150)} pairs shown. All pairs are in the JSON report. User-supplied identity and study claims are not independently verified.</p>`:'<p>No same-system, same-endpoint pairs were available in the upload, or the 150-row pair-analysis limit was exceeded.</p>';
}
function run(){invalidateAnalysis();try{$('input-error').hidden=true;const text=$('dataset-text').value;if(!text.trim())throw Error('Load a sample, choose a file or paste data first.');renderAnalysis(C.analyze(C.readInput(text),D));$('analysis-output').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){$('input-error').hidden=false;$('input-error').textContent=e.message;$('analysis-output').hidden=true;state.report=null;}}
populate();const initialPage=restoreFilters();filter();state.page=initialPage;renderReference();
$('dataset-text').addEventListener('input',invalidateAnalysis);
for(const id of [...Object.values(filters),'collection-filter','coverage-filter'])$(id).addEventListener('change',filter);
$('reference-search').addEventListener('input',filter);
$('reset-reference').addEventListener('click',()=>{for(const id of Object.values(filters))$(id).value='';$('reference-search').value='';$('collection-filter').value='all';$('coverage-filter').value='all';filter();});
$('reference-prev').addEventListener('click',()=>{state.page--;renderReference();});$('reference-next').addEventListener('click',()=>{state.page++;renderReference();});
$('load-example').addEventListener('click',()=>{invalidateAnalysis();$('dataset-text').value=window.PHARMACOLOGY_EXAMPLE_CSV;$('dataset-file').value='';$('input-error').hidden=true;});
$('run-analysis').addEventListener('click',run);
$('dataset-file').addEventListener('change',async event=>{try{const file=event.target.files?.[0];if(!file)return;invalidateAnalysis();if(file.size>5e6)throw Error('File exceeds 5 MB.');$('dataset-text').value=await file.text();$('input-error').hidden=true;$('analysis-output').hidden=true;state.report=null;}catch(e){$('input-error').hidden=false;$('input-error').textContent=e.message;}});
$('clear-analysis').addEventListener('click',()=>{invalidateAnalysis();$('dataset-text').value='';$('dataset-file').value='';$('input-error').hidden=true;for(const id of ['normalized-body','comparison-body','user-comparisons','analysis-metrics','analysis-summary','tier-chart','download-links'])$(id).replaceChildren();});
function fileLink(id,filename,text,type){const a=$(id);a.href='data:'+type+','+encodeURIComponent(text);a.download=filename;}
function prepareEvidenceExport(){fileLink('export-reference','pharmacology_filtered_evidence.csv',C.csv(state.filtered,['id','name','file','category','layer','system','endpoint','result','value','value_min','value_max','relation','unit','error','error_type','method','exposure_hours','dose_value','dose_unit','sample_form','control','paper','locator','quantitative_allowed','notes']),'text/csv;charset=utf-8');}
function prepareAnalysisExports(){
 if(!state.report)return;
 fileLink('export-analysis','pharmacology_analysis.json',JSON.stringify(state.report,null,2),'application/json');
 const rows=state.report.rows.map(r=>({row_id:r.row_id,...r.input,identity_status:r.identity.status,matched_file:r.identity.file,...r.result,unit:r.input.unit,normalized_unit:r.result.unit,validation_errors:r.result.errors,warnings:r.warnings}));
 fileLink('export-normalized','pharmacology_normalized_rows.csv',C.csv(rows,['row_id','name','file','cid','inchikey','system','endpoint','value','value_min','value_max','relation','unit','error','error_type','identity_status','matched_file','valid','quantitative','normalized_value','normalized_min','normalized_max','normalized_error','normalized_unit','original_unit','family','validation_errors','warnings']),'text/csv;charset=utf-8');
 fileLink('export-comparisons','pharmacology_condition_comparisons.csv',C.csv(state.report.comparisons,['user_row_id','reference_id','tier','same_study','reason','mismatches','missing','paper','locator']),'text/csv;charset=utf-8');
}


const fileInput=$('dataset-file'),fileName=$('dataset-file-name');
if($('evidence-tools')){
  $('choose-dataset').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{fileName.textContent=fileInput.files[0]?.name||'No file selected';});
  for(const id of ['clear-analysis','load-example'])$(id).addEventListener('click',()=>{fileName.textContent='No file selected';});
}
window.ResearchEvidence={
  setTask(mode,compound,name){
    if(mode==='analyze'&&document.documentElement.dataset.analyzeEnabled==='false')mode='explore';
    $('matrix').hidden=mode!=='explore';$('analyze').hidden=mode!=='analyze';$('snapshot-details').hidden=mode!=='explore';
    if(mode==='explore'&&compound!==null&&compound!==undefined){
      $('reset-reference').click();
      if(compound){
        const select=$('compound-filter');
        if(![...select.options].some(option=>option.value===compound)){
          const option=document.createElement('option');option.value=compound;option.textContent=name||compound;select.append(option);
        }
        select.value=compound;filter();
      }
    }
    if(mode==='explore')saveFilters();
  }
};
})();
