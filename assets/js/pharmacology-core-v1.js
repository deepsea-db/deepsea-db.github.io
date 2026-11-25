/* Pharmacology Evidence Workbench analytical core. SPDX-License-Identifier: MIT */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PharmacologyCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.0.0';
const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const norm=v=>clean(v).toLowerCase();
const present=v=>v!==null&&v!==undefined&&v!=='';
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:(typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())?Number(v):null);
function unitInfo(v){
 const u=clean(v).replace(/[µμ]/g,'u').replace(/\s/g,'');
 const units={M:['molar',1e6,'uM'],mM:['molar',1e3,'uM'],uM:['molar',1,'uM'],nM:['molar',1e-3,'uM'],pM:['molar',1e-6,'uM'],'mg/mL':['mass',1e3,'ug/mL'],'ug/mL':['mass',1,'ug/mL'],'ng/mL':['mass',1e-3,'ug/mL'],'mg/L':['mass',1,'ug/mL'],'ug/L':['mass',1e-3,'ug/mL'],'%':['percent',1,'%']};
 const x=units[u];return x?{family:x[0],factor:x[1],unit:x[2],original:u}:null;
}
function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');if(text.length>5e6)throw Error('Input exceeds 5 MB.');
 const lines=[];let row=[],field='',quoted=false,after=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;after=true;}else field+=c;continue;}
  if(c==='"'){if(field||after)throw Error('Unexpected quote in CSV.');quoted=true;}
  else if(c===','){row.push(field);field='';after=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))lines.push(row);row=[];field='';after=false;}
  else{if(after&&!/\s/.test(c))throw Error('Unexpected text after a closing quote.');if(!after)field+=c;}
 }
 if(quoted)throw Error('Unclosed CSV quote.');row.push(field);if(row.some(v=>v!==''))lines.push(row);
 if(lines.length<2)throw Error('Include column headers and at least one data row.');
 const headers=lines.shift().map(clean);if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Column names must be nonempty and unique.');
 if(lines.length>1000)throw Error('At most 1,000 input rows are supported.');
 return lines.map((r,i)=>{if(r.length!==headers.length)throw Error(`CSV row ${i+2} has ${r.length} cells; expected ${headers.length}.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
function readInput(text){
 if(String(text).length>5e6)throw Error('Input exceeds 5 MB.');
 if(/^\s*[\[{]/.test(String(text))){let d=JSON.parse(text);if(!Array.isArray(d))d=d.rows;if(!Array.isArray(d)||!d.length||d.length>1000||d.some(x=>!x||Array.isArray(x)||typeof x!=='object'))throw Error('JSON must contain 1–1,000 row objects or {rows:[...]}.');return d;}
 return parseCSV(text);
}
function identity(input,compounds){
 const keys=['file','cid','inchikey','smiles'];let candidates=null;let supplied=0;const reasons=[];
 for(const k of keys){if(!present(input[k]))continue;supplied++;const value=clean(input[k]);
  const matches=compounds.filter(c=>clean(c[k])===value&&present(c[k]));
  if(!matches.length)return {status:'unresolved_identifier',file:null,name:clean(input.name),reasons:[`The supplied ${k} has no exact catalog match; no name fallback was applied.`]};
  const ids=new Set(matches.map(c=>c.file));candidates=candidates===null?ids:new Set([...candidates].filter(x=>ids.has(x)));
 }
 if(supplied){
  if(!candidates.size)return {status:'conflicting_identifiers',file:null,name:clean(input.name),reasons:['Supplied identifiers point to different records.']};
  if(candidates.size>1)return {status:'ambiguous_identifier',file:null,name:clean(input.name),reasons:['The identifier is shared by several stored records; provide an additional exact identifier.']};
  const file=[...candidates][0],c=compounds.find(c=>c.file===file);
  if(present(input.name)&&norm(input.name)!==norm(c.name))reasons.push('The supplied name differs from the stored name; confirm sample identity.');
  if(present(input.smiles))reasons.push('SMILES matched as literal stored text; graph equivalence and stereochemistry were not newly verified.');
  if(!c.scope.startsWith('supported_'))reasons.push('This catalog record has pending collection scope and supplies no admitted reference results.');
  return {status:reasons.some(x=>x.startsWith('The supplied name'))?'identifier_name_conflict':'matched_record',file,name:c.name,reasons};
 }
 const matches=compounds.filter(c=>norm(c.name)===norm(input.name)&&present(input.name));
 return {status:matches.length===1?'name_candidate':matches.length>1?'ambiguous_name':'unmatched',file:matches.length===1?matches[0].file:null,name:clean(input.name),reasons:[matches.length===1?'Name-only match requires independent sample identity confirmation.':'No unique exact name match. No fuzzy chemical identity was inferred.']};
}
function normalizeResult(row){
 const errors=[],warnings=[];const unit=unitInfo(row.unit),relation=clean(row.relation||'=').replace('≤','<=').replace('≥','>=');
 const value=present(row.value)?num(row.value):null,lo=present(row.value_min)?num(row.value_min):null,hi=present(row.value_max)?num(row.value_max):null;
 const error=present(row.error)?num(row.error):null;
 for(const [k,v]of [['value',value],['value_min',lo],['value_max',hi],['error',error]])if(present(row[k])&&v===null)errors.push(`Invalid finite numeric ${k}.`);
 if(!['=','<','<=','>','>=','range'].includes(relation))errors.push('Unsupported relation; use =, <, <=, >, >= or range.');
 if((lo!==null)!==(hi!==null))errors.push('A range requires both value_min and value_max.');
 if(lo!==null&&hi!==null&&lo>hi)errors.push('Range bounds are reversed.');
 if(lo!==null&&value!==null)errors.push('Do not supply both a scalar and a range.');
 if(lo!==null&&relation!=='range')errors.push('Use relation=range for value_min/value_max.');
 if(relation==='range'&&lo===null)errors.push('relation=range requires two bounds.');
 if(error!==null&&error<0)errors.push('Uncertainty must be nonnegative.');
 if(unit&&['molar','mass'].includes(unit.family)&&[value,lo,hi].some(v=>v!==null&&v<0))errors.push('A concentration cannot be negative.');
 if(!unit)warnings.push('Unit is absent or unsupported; the raw result is retained without conversion.');
 if(row.quantitative_allowed===false||row.quantitative_allowed==='false')warnings.push('Source restricts quantitative analysis; raw result retained only.');
 if(error!==null&&!present(row.error_type))warnings.push('Uncertainty type is unspecified; it is not treated as a confidence interval.');
 const blocked=row.quantitative_allowed===false||row.quantitative_allowed==='false'||['not_tested','not_determined'].includes(row.status||row.activity_status);
 const allowed=!!unit&&!errors.length&&!blocked&&(value!==null||lo!==null);
 return {valid:!errors.length,quantitative:allowed,errors,warnings,relation,value,value_min:lo,value_max:hi,error,error_type:clean(row.error_type),original_unit:clean(row.unit),unit:unit?.unit??null,family:unit?.family??null,
  normalized_value:allowed&&value!==null?value*unit.factor:null,normalized_min:allowed&&lo!==null?lo*unit.factor:null,normalized_max:allowed&&hi!==null?hi*unit.factor:null,normalized_error:allowed&&error!==null?error*unit.factor:null};
}
function paper(v){return norm(v).replace(/^https?:\/\/(dx\.)?doi\.org\//,'').replace(/^pmid\s*:?\s*/,'pmid:');}
function dose(r){const v=num(r.dose_value),u=unitInfo(r.dose_unit);return v!==null&&u?{value:v*u.factor,family:u.family,unit:u.unit}:null;}
function sameNumber(a,b){return Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10;}
function compare(a,b,ia={status:'matched_record'},ib={status:'matched_record'}){
 const mismatch=[],missing=[];
 const na=normalizeResult(a),nb=normalizeResult(b);
 if(ia.status!=='matched_record'||ib.status!=='matched_record')missing.push('confirmed record identity');
 for(const key of ['system','endpoint','method','sample_form','layer']){
  if(!present(a[key])||!present(b[key])||['实验结果','检测对象未报告','unknown','not reported','未报告'].includes(clean(a[key]))||['实验结果','检测对象未报告','unknown','not reported','未报告'].includes(clean(b[key])))missing.push(key);
  else if(norm(a[key])!==norm(b[key]))mismatch.push(key);
 }
 const ta=num(a.exposure_hours),tb=num(b.exposure_hours);
 if(ta===null||tb===null)missing.push('exposure_hours');else if(!sameNumber(ta,tb))mismatch.push('exposure_hours');
 if(!na.valid||!nb.valid)missing.push('valid numeric representation');
 if(!na.quantitative||!nb.quantitative)missing.push('quantitative result permission / recognized units');
 if(na.family&&nb.family&&na.family!==nb.family)mismatch.push('unit family (mass and molar units are not interconverted)');
 const da=dose(a),db=dose(b),needsDose=na.family==='percent'||nb.family==='percent'||present(a.dose_value)||present(b.dose_value);
 if(needsDose){if(!da||!db)missing.push('fixed test dose');else if(da.family!==db.family||!sameNumber(da.value,db.value))mismatch.push('fixed test dose');}
 if(present(a.control)&&present(b.control)&&norm(a.control)!==norm(b.control))mismatch.push('control');
 if(!present(a.control)||!present(b.control))missing.push('control');
 const sameStudy=present(a.paper)&&present(b.paper)&&paper(a.paper)===paper(b.paper);
 const tier=mismatch.length?'incompatible':missing.length?'insufficient_metadata':sameStudy?'same_study_candidate':'matched_conditions';
 return {tier,same_study:sameStudy,mismatches:[...new Set(mismatch)],missing:[...new Set(missing)],reason:mismatch.length?'Reported conditions differ.':missing.length?'Required information is absent or not admitted.':sameStudy?'Recorded conditions and source agree; sample design and replicates still require review.':'Recorded conditions agree across sources; study effects remain unresolved.',a_normalized:na,b_normalized:nb};
}
function analyze(inputs,data){
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>1000)throw Error('Supply 1–1,000 rows.');
 const seen=new Set();const normalized=inputs.map((raw,i)=>{
  const id=clean(raw.row_id||`user-${i+1}`);if(seen.has(id))throw Error(`Duplicate row_id: ${id}`);seen.add(id);
  if(!['file','cid','inchikey','smiles','name'].some(k=>present(raw[k])))throw Error(`Row ${i+1} needs at least one compound identifier or name.`);
  const ident=identity(raw,data.compounds),result=normalizeResult(raw);const warnings=[...result.warnings];
  const time=num(raw.exposure_hours);if(present(raw.exposure_hours)&&(time===null||time<0))result.errors.push('Exposure hours must be nonnegative and numeric.');
  if(present(raw.dose_value)&&(num(raw.dose_value)===null||num(raw.dose_value)<0))result.errors.push('Test dose must be nonnegative and numeric.');
  if(!present(raw.system)||!present(raw.endpoint))warnings.push('System or endpoint is missing; comparisons remain incomplete.');
  result.valid=result.errors.length===0;if(!result.valid)result.quantitative=false;
  const matches=ident.file?data.activities.filter(a=>a.file===ident.file&&(!present(raw.system)||norm(a.system)===norm(raw.system))&&(!present(raw.endpoint)||norm(a.endpoint)===norm(raw.endpoint))):[];
  return {row_id:id,input:{...raw},identity:ident,result,warnings,reference_candidates:matches.map(r=>r.id)};
 });
 const by=new Map(data.activities.map(r=>[r.id,r]));const comparisons=[];
 for(const r of normalized)for(const rid of r.reference_candidates){const ref=by.get(rid),c=compare(r.input,ref,r.identity);if(!r.result.valid){c.tier='insufficient_metadata';c.missing.push('valid user input');}comparisons.push({user_row_id:r.row_id,reference_id:rid,...c,paper:ref.paper,locator:ref.locator});}
 // User-only grouping uses explicit local sample IDs, never a guessed database identity.
 const userComparisons=[];if(normalized.length<=150){for(let i=0;i<normalized.length;i++)for(let j=i+1;j<normalized.length;j++){
  const a=normalized[i],b=normalized[j];if(norm(a.input.system)!==norm(b.input.system)||norm(a.input.endpoint)!==norm(b.input.endpoint))continue;
  const c=compare(a.input,b.input);if(!a.result.valid||!b.result.valid)c.tier='insufficient_metadata';
  if(['same_study_candidate','matched_conditions'].includes(c.tier))c.tier='user_reported_conditions_match';
  userComparisons.push({user_row_id:a.row_id,other_user_row_id:b.row_id,...c,identity_basis:'User-supplied identities and conditions; not independently verified.'});
 }}
 const tiers={};for(const c of comparisons)tiers[c.tier]=(tiers[c.tier]||0)+1;
 return {version:VERSION,snapshot:data.as_of,source_database_sha256:data.source_database_sha256,counts:{input_rows:normalized.length,invalid_rows:normalized.filter(r=>!r.result.valid).length,matched_records:normalized.filter(r=>r.identity.status==='matched_record').length,reference_comparisons:comparisons.length,user_comparisons:userComparisons.length,tiers},rows:normalized,comparisons,user_comparisons:userComparisons,warnings:normalized.length>150?['User pair comparisons are limited to uploads of at most 150 rows; reference comparisons remain available.']:[],interpretation:'Condition matching supplies review candidates, not pooled effect estimates, statistical significance, drug recommendations or new source verification.'};
}
function csv(rows,columns){const quote=(v)=>{if(v==null)v='';else if(Array.isArray(v))v=v.join('; ');else if(typeof v==='object')v=JSON.stringify(v);if(typeof v!=='number'&&!['=','<','>','<=','>=','≤','≥'].includes(String(v))&&/^[=+@\-\t\r]/.test(String(v)))v="'"+v;return '"'+String(v).replace(/"/g,'""')+'"';};return '\ufeff'+[columns.map(quote).join(','),...rows.map(r=>columns.map(k=>quote(r[k])).join(','))].join('\r\n');}
return {VERSION,clean,norm,num,unitInfo,parseCSV,readInput,identity,normalizeResult,compare,analyze,csv};
});
