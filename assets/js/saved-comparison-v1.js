'use strict';
// Read-only adapter over version-bound public records. Condition tokens/normalized
// values come from the unchanged Python evidence engine; no chemistry is inferred.
window.SavedComparison=(()=>{
  let data=null,load=null,byId=new Map();
  const copy=x=>JSON.parse(JSON.stringify(x));
  const missingStates=new Set(['qualitative_positive','qualitative_no_activity','not_reported','not_tested','not_extracted','undetermined']);
  const has=x=>x!==null&&x!==undefined&&x!==''&&(!Array.isArray(x)||x.length>0)&&(typeof x!=='object'||Array.isArray(x)||Object.keys(x).length>0);
  const tok=(r,k)=>r.condition_tokens[k]??null;
  const same=(a,b,k)=>tok(a,k)!==null&&tok(a,k)===tok(b,k);
  function lexical(a,b){if(a===b)return 0;if(typeof a==='string'&&typeof b==='string'){const x=Array.from(a),y=Array.from(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i].codePointAt(0)-y[i].codePointAt(0);return x.length-y.length;}return Number(a)-Number(b);}
  function compareTuple(a,b){for(let i=0;i<a.length;i++){const d=lexical(a[i],b[i]);if(d)return d;}return 0;}
  const usable=r=>r.quantitative_allowed===true&&['exact','bound','range'].includes(r.result_state)&&(r.normalized.value!==null||r.normalized.lower_bound!==null);
  function priority(a,b){return [!same(a,b,'source_reference'),!same(a,b,'biological_system'),!same(a,b,'endpoint'),!(usable(a)&&usable(b)),!same(a,b,'unit_basis'),!same(a,b,'assay_method'),!same(a,b,'exposure_hours'),!(a.result_state===b.result_state&&a.result_state==='exact'),a.result_state!=='exact',b.result_state!=='exact',String(a.biological_system||''),String(a.source_reference||''),a.activity_id,b.activity_id];}
  function selectRecords(a,b,aid,bid){
    let aa=a.find(r=>r.activity_id===aid),bb=b.find(r=>r.activity_id===bid);
    if(aid&&!aa)throw Error('The selected A experiment does not belong to the current compound/snapshot');
    if(bid&&!bb)throw Error('The selected B experiment does not belong to the current compound/snapshot');
    if(aa&&bb)return [aa,bb];
    const candidates=[];for(const x of aa?[aa]:a)for(const y of bb?[bb]:b)if(same(x,y,'biological_system'))candidates.push([x,y]);
    candidates.sort((x,y)=>compareTuple(priority(...x),priority(...y)));
    return candidates[0]||[aa||a[0]||null,bb||null];
  }
  function compareAssays(a,b,rules=data.rules){
    const types=new Set([a.experimental_type,b.experimental_type]),required=new Set(rules.required_conditions.common);
    for(const type of types)for(const k of rules.required_conditions[type]||[])required.add(k);
    if([a,b].some(r=>r.normalized.unit_family==='percent'))required.add('test_concentration');
    if([a,b].some(r=>has(r.critical_conditions)))required.add('critical_conditions');
    const fields=[...new Set([...rules.required_conditions.common,...[...required].filter(k=>!rules.required_conditions.common.includes(k)).sort(),...rules.optional_conditions])];
    const conditions=fields.map(k=>{
      let applicable=true;
      if(k==='unit_basis'&&[a,b].every(r=>missingStates.has(r.result_state)))applicable=false;
      if(k==='test_concentration'&&[a,b].every(r=>['IC50','EC50','Ki','Kd','MIC'].includes(r.endpoint)))applicable=false;
      const source_a=a.field_evidence?.[k]||null,source_b=b.field_evidence?.[k]||null,sources=[source_a,source_b].filter(Boolean);
      const status=!applicable?'Not applicable':sources.some(s=>s.source_state==='reported_partial')?'Incomplete source detail':tok(a,k)===null||tok(b,k)===null?sources.some(s=>s.source_state==='not_reported')?'Not reported in source':'Not recorded':same(a,b,k)?'Match':'Different';
      return {condition:k,a:a.condition_values[k],b:b.condition_values[k],status,required:required.has(k),source_a,source_b};
    });
    const differences=conditions.filter(c=>c.status==='Different'&&(c.required||c.condition!=='source_reference')).map(c=>c.condition);
    const missing=conditions.filter(c=>c.required&&['Not recorded','Not reported in source','Incomplete source detail'].includes(c.status)).map(c=>c.condition);
    let status=differences.length?'Explicit condition differences':missing.length?'Insufficient information':'Conditions matched — candidate comparison';
    if(types.has('Computational prediction')){status='Insufficient information';missing.push('Experimental evidence; predictions are displayed separately');}
    return {status,conditions,differences,missing,rule_version:rules.version,a_activity_id:a.activity_id,b_activity_id:b.activity_id,interpretation:'Recorded condition matching identifies a candidate comparison; it does not establish the same experimental batch, statistical significance, causality or mechanism.'};
  }
  function assessPair(a,b,structure,series,rules=data.rules){
    const result=compareAssays(a,b,rules),reasons=[];
    if(a.compound_id===b.compound_id)reasons.push('The selection does not contain two distinct compound records');
    if(!series)reasons.push('No confirmed literature-defined series assignment for this pair');
    if(!structure.single_local_change)reasons.push('No unique supported single local structure change');
    if(result.status!=='Conditions matched — candidate comparison')reasons.push(result.status);
    for(const [label,row]of [['A',a],['B',b]]){
      if(row.result_state!=='exact'||row.normalized.value===null||row.normalized.value<=0)reasons.push(label+': no exact positive quantitative result');
      if(row.quantitative_allowed!==true)reasons.push(label+': quantitative use restricted');
      if(!row.source_reference||!row.source_location)reasons.push(label+': traceable primary result required');
    }
    return {...result,included:!reasons.length,exclusion_reasons:reasons,derived_ratio:reasons.length?null:{a_over_b:a.normalized.value/b.normalized.value,interpretation:'Ratio of recorded normalized endpoint values; not statistical significance or a causal effect.'},comparison_group_key:JSON.stringify([a.condition_tokens.assay_group,b.condition_tokens.assay_group,...[a.evidence_dedup_key||a.activity_id,b.evidence_dedup_key||b.activity_id].sort()])};
  }
  function similarity(a,b){if(!a.fingerprint||!b.fingerprint)return null;const other=new Set(b.fingerprint),intersection=a.fingerprint.filter(v=>other.has(v)).length;return intersection/(a.fingerprint.length+b.fingerprint.length-intersection)||0;}
  async function context(id){
    const entry=byId.get(id);if(!entry)throw Error('The requested compound is not in the current public catalog.');
    if(!window.RESEARCH_COMPOUND_CONTEXTS?.[id])await load(entry.chunk);
    const c=window.RESEARCH_COMPOUND_CONTEXTS?.[id];
    if(!c||c.snapshot_id!==data.manifest.snapshot_id)throw Error('Saved compound records need to be refreshed for the current snapshot.');
    return copy(c);
  }
  async function structureFor(a,b){
    if(!b)return {status:a.svg?'Single-compound view':'Structure unavailable',summary:'Choose a second compound to inspect structure differences.',single_local_change:false,changes:[],warnings:[],svg_a:a.svg,svg_b:null};
    const saved=data.mapped_pairs[a.compound.compound_id+'|'+b.compound.compound_id];
    if(saved)return {...copy(saved),saved_atom_mapping:true,mapping_pending:false};
    const pair=a.compound.compound_id+'|'+b.compound.compound_id,chunk=data.mapping_chunks?.[pair];
    if(chunk){
      if(!window.RESEARCH_PAIR_MAPPINGS?.[pair])await load(chunk.path);
      const packet=window.RESEARCH_PAIR_MAPPINGS?.[pair];
      if(!packet||packet.snapshot_id!==data.manifest.snapshot_id)throw Error('Saved atom mappings need to be refreshed for the current snapshot.');
      return {...copy(packet.structure),saved_atom_mapping:true,mapping_pending:false};
    }
    const x=byId.get(a.compound.compound_id),y=byId.get(b.compound.compound_id);
    if(!x.keys||!y.keys)return {status:'Structure unavailable',summary:'Existing structure restrictions retained; evidence and sources remain available.',single_local_change:false,changes:[],warnings:[],svg_a:a.svg,svg_b:b.svg,mapping_pending:false};
    const score=similarity(x,y),recorded=x.keys.recorded===y.keys.recorded,connected=x.keys.connectivity===y.keys.connectivity;
    return {status:'Stored structures',summary:`Morgan Tanimoto: ${score.toFixed(3)} · ${recorded?'Same encoded structure':connected?'Same connectivity; encoded stereochemistry differs':'Different recorded connectivity'}. Atom mapping has not been computed for this pair.`,single_local_change:false,changes:[],warnings:[],svg_a:a.svg,svg_b:b.svg,mapping_pending:true,similarity:score,recorded_match:recorded,connectivity_match:connected};
  }
  function relations(id,threshold=.35,limit=12){
    const a=byId.get(id);if(!a)throw Error('Unknown compound record');
    const groups={'Source-supported families':[],'Structure-related candidates':[],'Source-associated compounds':[],'Publication-associated compounds':[]};
    for(const series of data.series)if(series.members.includes(id))for(const other of series.members)if(other!==id&&byId.has(other))groups['Source-supported families'].push({compound_id:other,name:byId.get(other).name,basis:series});
    for(const b of data.catalog){if(b.compound_id===id)continue;const entry={compound_id:b.compound_id,name:b.name},score=similarity(a,b);
      if(score!==null&&score>=threshold)groups['Structure-related candidates'].push({...entry,similarity:score});
      if(a.strain_keys.some(x=>b.strain_keys.includes(x)))groups['Source-associated compounds'].push(entry);
      if(a.papers.some(x=>b.papers.includes(x)))groups['Publication-associated compounds'].push(entry);
    }
    groups['Structure-related candidates'].sort((a,b)=>b.similarity-a.similarity||lexical(a.compound_id,b.compound_id));
    return {groups:Object.entries(groups).map(([type,items])=>({type,total:items.length,items:items.slice(0,limit)}))};
  }
  async function comparison(q){
    const [a,b]=await Promise.all([context(q.get('a')),q.get('b')?context(q.get('b')):null]);
    if(!b&&q.get('activity_b'))throw Error('A B experiment requires a selected B compound');
    const structure=await structureFor(a,b),[aa,bb]=selectRecords(a.activities,b?.activities||[],q.get('activity_a'),q.get('activity_b'));
    const series=b?data.series.filter(s=>a.compound.compound_id!==b.compound.compound_id&&s.members.includes(a.compound.compound_id)&&s.members.includes(b.compound.compound_id)):[];
    const strictSeries=series.some(s=>s.relationship_type==='Literature-defined series');
    const selected=aa&&bb?assessPair(aa,bb,structure,strictSeries):null,qualifying=new Map();let examined=0,limited=false;
    if(b)outer:for(const x of a.activities)for(const y of b.activities){if(!same(x,y,'biological_system'))continue;if(++examined>10000){limited=true;break outer;}const assessment=assessPair(x,y,structure,strictSeries);if(assessment.included)qualifying.set(assessment.comparison_group_key,assessment);}
    const counts={scope:b?'Current two-compound selection, matching recorded biological systems':'Current single compound; no pair selected',unique_unordered_compound_pairs:qualifying.size?1:0,explicit_assay_comparison_groups:qualifying.size,candidate_assay_comparisons_examined:Math.min(examined,10000),complete_for_stated_scope:!limited};
    const interpretation=!aa||!bb?'No shared experiment pair is selected. The structures and each member’s source records remain available.':selected.included?'Recorded conditions support a candidate quantitative comparison. The result does not establish causality or statistical significance.':selected.differences.length?'Keep the experimental results separate: recorded conditions or endpoints differ.':selected.missing.length?'Shared experimental fields are recorded, but missing conditions prevent a firm quantitative comparison.':'Inspect the individual evidence; no strict structure–activity pair is established.';
    return {selection_mode:b?'pair':'single',a,b,structure,series,selected_activity_a:aa?.activity_id||null,selected_activity_b:bb?.activity_id||null,selected_comparison:selected,qualifying_comparisons:[...qualifying.values()],pair_counts:counts,takeaway:{interpretation,next_checks:structure.mapping_pending?['Atom mapping has not been computed for this pair.']:[]},provenance:{...data.provenance,snapshot:data.manifest,rules:data.rules,saved_records:true,generated_utc:data.generated_utc,reference_scope:'Reference matches are available separately under Reference coverage; this export does not include reference coverage.'}};
  }
  async function request(path,signal){
    if(window.PHARMACOLOGY_SYNC?.status!=='ready'||window.PHARMACOLOGY_SYNC.generation_id!==data.pharmacology_generation_id)throw Error('Saved comparison records need to be refreshed for the current database.');
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const url=new URL(path,'http://local.invalid'),q=url.searchParams;let result;
    if(url.pathname==='/api/compare')result=await comparison(q);
    else if(url.pathname==='/api/compound')result=await context(q.get('id'));
    else if(url.pathname==='/api/relations')result=relations(q.get('id'),Number(q.get('threshold')||.35),Math.min(Math.max(Number(q.get('limit')||12),1),50));
    else if(url.pathname==='/api/evidence-choices')result={items:copy(data.choices[q.get('id')]||[])};
    else throw Error('This operation requires the local research service.');
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    return result;
  }
  function exports(report){
    const quote=x=>{const text=typeof x==='string'?x:JSON.stringify(x??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"';};
    const rows=[['side','compound_id','name','activity_id','original_result_state','original_result','normalized','conditions_and_assessment','provenance']];
    for(const side of ['a','b']){const ctx=report[side];if(!ctx)continue;const r=ctx.activities.find(a=>a.activity_id===report['selected_activity_'+side]);rows.push([side.toUpperCase(),ctx.compound.compound_id,ctx.compound.name,r?.activity_id||'',r?.result_state||'',r?.raw_text||'',r?.normalized||{},report.selected_comparison||{},report.provenance]);}
    const brief=['# Compound comparison','',report.a.compound.name+(report.b?' / '+report.b.compound.name:''),'',report.structure.summary,'',report.takeaway.interpretation,''];
    for(const side of ['a','b']){const ctx=report[side];if(!ctx)continue;const r=ctx.activities.find(a=>a.activity_id===report['selected_activity_'+side]);brief.push('## '+side.toUpperCase()+': '+ctx.compound.name,r?JSON.stringify(r,null,2):'No experiment selected.','');}
    brief.push('## Provenance',JSON.stringify(report.provenance,null,2));
    return {'export-json':{text:JSON.stringify(report,null,2),type:'application/json',name:'compound-comparison.json'},'export-csv':{text:'\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),type:'text/csv;charset=utf-8',name:'compound-comparison.csv'},'export-brief':{text:brief.join('\n'),type:'text/markdown;charset=utf-8',name:'compound-evidence-brief.md'}};
  }
  return {init(snapshot,loader){data=snapshot;load=loader;byId=new Map(data.catalog.map(c=>[c.compound_id,c]));},request,exports,selectRecords,compareAssays,assessPair,similarity};
})();
