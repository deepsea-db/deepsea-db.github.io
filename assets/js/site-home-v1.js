
/* ══════════════════════════════════════════════════════
   Deep-Sea Compound Database — Homepage (Dark Theme)
   ══════════════════════════════════════════════════════ */

(function(){ 'use strict';

// ── Microbes ──
var shapes = [
  '<svg viewBox="0 0 40 24"><ellipse cx="18" cy="14" rx="14" ry="7" fill="currentColor" opacity="0.55"/><ellipse cx="6" cy="14" rx="6" ry="5" fill="currentColor" opacity="0.6"/><circle cx="4" cy="12" r="1.2" fill="rgba(255,255,255,0.25)"/><path d="M28 10 Q38 6 37 3" stroke="currentColor" stroke-width="1" fill="none" opacity="0.5"/><circle cx="37" cy="3" r="2.5" fill="rgba(255,235,100,0.35)" stroke="rgba(255,235,100,0.15)" stroke-width="0.5"/><path d="M30 15 Q34 17 32 19" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/><path d="M30 17 Q34 19 32 21" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.2"/></svg>',
  '<svg viewBox="0 0 36 40"><path d="M8 14 Q8 4 18 4 Q28 4 28 14" stroke="currentColor" stroke-width="2.5" fill="currentColor" opacity="0.3"/><path d="M6 14 Q18 18 30 14" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/><path d="M10 14 Q10 26 8 34" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.2"/><path d="M15 14 Q15 28 14 36" stroke="currentColor" stroke-width="1" fill="none" opacity="0.25"/><path d="M20 14 Q21 24 19 32" stroke="currentColor" stroke-width="1.3" fill="none" opacity="0.2"/><path d="M26 14 Q26 26 28 34" stroke="currentColor" stroke-width="1.1" fill="none" opacity="0.18"/></svg>',
  '<svg viewBox="0 0 30 50"><ellipse cx="15" cy="16" rx="8" ry="14" fill="currentColor" opacity="0.45"/><path d="M15 2 Q15 0 20 2 Q25 5 22 10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/><path d="M15 2 Q15 0 10 2 Q5 5 8 10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/><path d="M10 26 Q6 34 4 40 Q3 44 5 46" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.2"/><path d="M13 28 Q11 36 10 42 Q9 46 12 48" stroke="currentColor" stroke-width="1.3" fill="none" opacity="0.18"/><path d="M15 29 Q15 38 15 44 Q15 48 14 50" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.22"/><path d="M18 28 Q20 36 21 42 Q22 46 19 48" stroke="currentColor" stroke-width="1.3" fill="none" opacity="0.18"/><path d="M20 26 Q24 34 26 40 Q27 44 25 46" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.2"/></svg>',
  '<svg viewBox="0 0 36 22"><path d="M4 12 Q10 2 22 4 Q30 5 34 10" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.45"/><path d="M4 12 Q10 14 16 13 Q24 12 34 10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.25"/><path d="M34 10 Q36 8 34 6" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/><path d="M2 10 Q0 6 4 4" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.3"/><path d="M4 12 Q2 16 6 18" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.25"/><circle cx="12" cy="6" r="1" fill="rgba(255,255,255,0.15)"/><circle cx="18" cy="5.5" r="0.8" fill="rgba(255,255,255,0.12)"/><circle cx="24" cy="6.5" r="0.8" fill="rgba(255,255,255,0.12)"/></svg>',
  '<svg viewBox="0 0 38 38"><circle cx="19" cy="19" r="5" fill="currentColor" opacity="0.6"/><path d="M19 14 Q20 8 17 4 Q15 1 18 0" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/><path d="M24 15 Q29 10 30 5 Q31 2 28 1" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/><path d="M24 24 Q30 28 34 28 Q37 28 37 25" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/><path d="M14 24 Q9 29 5 29 Q2 29 2 26" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/><path d="M14 14 Q10 9 8 5 Q7 2 10 1" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 24 48"><rect x="9" y="8" width="6" height="38" rx="3" fill="currentColor" opacity="0.2"/><path d="M12 8 Q18 6 20 10 Q22 14 16 14" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/><path d="M12 8 Q6 6 4 10 Q2 14 8 14" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/><path d="M16 14 Q18 18 14 18 Q10 18 8 14" fill="rgba(255,100,60,0.25)" opacity="0.35"/><rect x="11" y="0" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/></svg>',
  '<svg viewBox="0 0 48 14"><path d="M4 8 Q14 3 30 4 Q40 4 46 7" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.5"/><path d="M4 8 Q14 10 30 9 Q40 9 46 7" stroke="currentColor" stroke-width="1.8" fill="none" opacity="0.22"/><circle cx="8" cy="6" r="1.5" fill="rgba(255,255,255,0.2)"/><circle cx="14" cy="5.5" r="1" fill="rgba(255,235,100,0.25)"/><circle cx="20" cy="5" r="1" fill="rgba(255,235,100,0.2)"/><circle cx="26" cy="5.5" r="1" fill="rgba(255,235,100,0.2)"/><circle cx="32" cy="6" r="1" fill="rgba(255,235,100,0.2)"/><circle cx="38" cy="6.5" r="1" fill="rgba(255,235,100,0.2)"/><path d="M46 7 Q48 7 48 5" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/></svg>',
  '<svg viewBox="0 0 30 36"><ellipse cx="15" cy="18" rx="11" ry="16" fill="currentColor" opacity="0.18"/><ellipse cx="15" cy="18" rx="8" ry="12" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.2"/><path d="M6 16 Q8 14 10 16" stroke="rgba(100,200,255,0.25)" stroke-width="0.8" fill="none"/><path d="M6 20 Q8 18 10 20" stroke="rgba(100,200,255,0.25)" stroke-width="0.8" fill="none"/><path d="M20 16 Q22 14 24 16" stroke="rgba(100,200,255,0.25)" stroke-width="0.8" fill="none"/><path d="M20 20 Q22 18 24 20" stroke="rgba(100,200,255,0.25)" stroke-width="0.8" fill="none"/><path d="M15 2 Q15 0 14 4" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.2"/><path d="M15 34 Q15 36 16 32" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.2"/></svg>'
];
var colors = ['#4fc3f7','#26c6da','#64b5f6','#4dd0e1','#81d4fa','#29b6f6','#00acc1'];
var mc = document.getElementById('microbes');
for(var i=0;i<55;i++){
  var e=document.createElement('div');
  e.className='microbe';
  var sz=14+Math.random()*32;
  e.style.width=sz+'px';
  e.style.height=sz*0.75+'px';
  e.style.left=(3+Math.random()*94)+'%';
  e.style.setProperty('--m-op',(0.12+Math.random()*0.4));
  e.style.setProperty('--m-rot',(80+Math.random()*500)+'deg');
  e.style.animationDuration=(16+Math.random()*35)+'s';
  e.style.animationDelay=Math.random()*25+'s';
  e.style.color=colors[Math.floor(Math.random()*colors.length)];
  e.innerHTML=shapes[Math.floor(Math.random()*shapes.length)];
  mc.appendChild(e);
}

// ── Helpers ──
function esc(t){ if(!t)return''; var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function pngUrl(p){ p=String(p||'').replace(/\.html$/i,''); return p?'assets/img/compounds/'+p+'.png':''; }

// ── Inventory data ──
var INV = window.DeepSeaSite.inventory;

// Chemotype summary
var CT_SUMMARY = window.DeepSeaSite.chemotype_summary;
var CT_COLORS = DeepSeaChartTheme.chemotypes;
var DEPTH_COLORS = DeepSeaChartTheme.depth;
var DEPTH_ORDER = ['Shallow','Slope','Deep','Hadal','Unknown'];

// ── Render stat cards ──
function renderStats(){
  var stats = [
    {n:INV.total_compounds, metric:'public_records', en:'💊 Compounds', cn:'化合物', title:'Public compound records.', link:'pages/browse-compounds.html'},
    {n:INV.unique_strains, metric:'source_entries', en:'🧫 Biological Sources', cn:'生物来源', title:'Biological source profiles, including microbial strains and other recorded sources.', link:'pages/browse-strains.html'},
    {n:INV.target_annotation_nodes, metric:'target_annotation_nodes', en:'🎯 Target Annotations', cn:'靶标注释', title:'Distinct recorded target names or descriptions; this is not a count of verified drug targets.', link:'pages/browse-targets.html'},
    {n:INV.total_phenotype_entries, metric:'display_activity_records', en:'📊 Bioactivity Records', cn:'活性记录', title:window.DeepSeaSite.metrics.display_activity_records.toLocaleString('en-US')+' activity records displayed on public compound pages; '+window.DeepSeaSite.metrics.admitted_activity_rows.toLocaleString('en-US')+' evidence rows admitted to the pharmacology workbench.', link:'pages/browse-phenotypes.html'},
    {n:INV.unique_chemotypes, metric:'chemotype_labels', en:'🧪 Chemical Classes', cn:'化学分类', title:'Distinct recorded chemical classes.', link:'pages/browse-chemotypes.html'},
    {n:INV.unique_references, metric:'reference_catalog_records', en:'📚 References', cn:'参考文献', title:'Reference catalog entries.', link:'pages/browse-references.html'}
  ];
  var h='';
  stats.forEach(function(s){
    h+='<a href="'+s.link+'" class="stat-card" data-site-metric="'+s.metric+'" title="'+esc(s.title).replace(/"/g,'&quot;')+'"><div class="stat-num">'+s.n+'</div><div class="stat-lbl-en" style="max-width:100%;white-space:normal">'+s.en+'</div><div class="stat-arrow">→</div></a>';
  });
  document.getElementById('statRow').innerHTML=h;

  // Project current counts into the retained count nodes; preserve layout.
  var currentMetrics=window.DeepSeaSite.metrics;
  var scopeMetricFields={archive:'archive_records',public:'public_records',supported:'supported_records',pending:'scope_pending_records',withheld:'withheld_records'};
  Object.keys(scopeMetricFields).forEach(function(key){
    var node=document.querySelector('[data-scope-count="'+key+'"]');
    if(node) node.textContent=currentMetrics[scopeMetricFields[key]];
  });
  var centerCount=document.getElementById('centerCount');
  if(centerCount) centerCount.textContent=currentMetrics.center_records;

  // Update hero description with real numbers
  var desc=document.getElementById('heroDesc');
  if(desc) desc.innerHTML='A collection of <strong>'+INV.total_compounds+'</strong> public compound records · <strong>'+INV.source_index_items+'</strong> source index entries · <strong>'+INV.reference_catalog_records+'</strong> reference catalog records';
}

// ── Render bars ──
function renderBars(id,data,nameKey,valueKey,colorMap){
  var el=document.getElementById(id);if(!el)return;
  var mx=Math.max.apply(null,data.map(function(d){return d[valueKey];}));
  var h='';
  data.forEach(function(d){
    var p=mx>0?(d[valueKey]/mx)*100:0;
    var c=colorMap[d[nameKey]]||'#6a7a8a';
    h+='<div class="bar-row"><span class="bar-label">'+esc(d[nameKey])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+p+'%;background:'+c+'"></div></div><span class="bar-value">'+d[valueKey]+'</span></div>';
  });
  el.innerHTML=h;
}

function classifyDepth(d) { return DeepSeaDepth.classify(d); }

// ── Render depth bars ──
function renderDepthBars(id,compounds){
  var el=document.getElementById(id);if(!el)return;
  var dc={Shallow:0,Slope:0,Deep:0,Hadal:0,Unknown:0};
  compounds.forEach(function(c){
    var z=DeepSeaDepth.forRecord(c);
    if(dc[z]!==undefined) dc[z]++; else dc.Unknown++;
  });
  var mx=Math.max.apply(null,DEPTH_ORDER.map(function(k){return dc[k];}));
  var h='';
  DEPTH_ORDER.forEach(function(k){
    var v=dc[k]||0;
    var p=mx>0?(v/mx)*100:0;
    h+='<div class="bar-row"><span class="bar-label">'+k+'</span><div class="bar-track"><div class="bar-fill" style="width:'+p+'%;background:'+(DEPTH_COLORS[k]||'#6a7a8a')+'"></div></div><span class="bar-value">'+v+'</span></div>';
  });
  el.innerHTML=h;
}

// ── Render latest compounds ──
function renderLatest(compounds){
  var el=document.getElementById('latestStrip');if(!el)return;
  var latest=compounds.slice(-4).reverse();
  var h='';
  latest.forEach(function(c){
    var name=c.n||c.name||'';
    var formula=c.f||c.formula||'';
    var mw=c.w||c.mw||'';
    var ct=c.t||c.chemotype||'Unclassified';
    var cid=c.c||c.cid||'';
    var file=c.p||c.file||'';
    var ctColor=CT_COLORS[ct]||'#6a7a8a';
    var img=pngUrl(file);
    var meta=formula+(mw?' · MW '+(mw+'').replace(' g/mol','').replace(' g·mol−1',''):'');
    h+='<a href="1-Compounds/'+esc(file)+'" class="cpd-card">';
    h+='  <div class="cpd-card-row">';
    if(img){
      h+='    <div class="cpd-card-img"><img src="'+img+'" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.cfb\').style.display=\'flex\'"><span class="cfb" style="display:none">?</span></div>';
    } else {
      h+='    <div class="cpd-card-img"><span class="cfb">?</span></div>';
    }
    h+='    <div class="cpd-card-info">';
    h+='      <div class="cpd-card-name">'+esc(name)+'</div>';
    h+='      <div class="cpd-card-meta">'+esc(meta)+'</div>';
    h+='    </div>';
    h+='  </div>';
    h+='  <span class="cpd-card-ct" style="background:'+ctColor+'20;color:'+ctColor+'">'+esc(ct)+'</span>';
    h+='</a>';
  });
  el.innerHTML=h;
}

// ── Load data ──
function loadData(){
  renderStats();

  // Use COMPOUNDS_DATA from compounds_inline.js?v=npatlas-merge02 (file:// mode)
  if(typeof COMPOUNDS_DATA !== 'undefined' && COMPOUNDS_DATA.length){
    renderBars('chart-chemotype',CT_SUMMARY,'n','c',CT_COLORS);
    renderDepthBars('chart-depth',COMPOUNDS_DATA);
    renderLatest(COMPOUNDS_DATA);
    return;
  }

  // Fallback: fetch via HTTP
  Promise.all([
    fetch('assets/data/compounds.json').then(function(r){return r.json();}),
    fetch('assets/data/chemotypes.json').then(function(r){return r.json();})
  ]).then(function(results){
    var compounds=results[0];
    var chemotypes=results[1];
    var ctSimple=chemotypes.map(function(d){return {n:d.name||d.chemotype||'Other',c:d.compound_count||0};});
    renderBars('chart-chemotype',ctSimple,'n','c',CT_COLORS);
    renderDepthBars('chart-depth',compounds);
    renderLatest(compounds);
  }).catch(function(err){
    console.warn('Data load failed, showing stats only',err);
  });
}

// ── Init ──
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',loadData);
}else{
  loadData();
}

})();
