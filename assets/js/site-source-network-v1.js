/* A local node-link view. Edges are catalog associations, never inferred mechanisms. */
(function(root){'use strict';
 function build(input){
  const {taxon,genera,sources,compounds,selected,previews,targets}=input,nodes=[],edges=[],by=new Map(),allowed=new Set(taxon.source_ids),pages=input.pages||{};
  const add=(id,kind,label,data={})=>{if(!by.has(id)){const n={id,kind,label,...data};nodes.push(n);by.set(id,n);}return id;};
  const edge=(a,b,relation)=>{if(by.has(a)&&by.has(b)&&!edges.some(e=>e.a===a&&e.b===b&&e.relation===relation))edges.push({a,b,relation});};
  const windowed=(all,size,page,pinned)=>{const count=Math.max(1,Math.ceil(all.length/size)),index=Math.max(0,Math.min(Number(page)||0,count-1)),values=all.slice(index*size,(index+1)*size),extra=!!(pinned&&all.includes(pinned)&&!values.includes(pinned));if(extra)values.push(pinned);return {values,index,count,total:all.length,start:index*size+1,end:Math.min(all.length,(index+1)*size),extra};};
  const rootId=add('taxon:'+taxon.id,'taxon',taxon.name,{hint:'Current classification',action:'reset',selected:!selected.genus});
  const genusWindow=windowed(genera.map(g=>g.name),14,pages.genus,selected.genus),group=genera.find(g=>g.name===selected.genus),shownGenera=group?[group.name]:genusWindow.values;
  for(const name of shownGenera){if(input.directSources)continue;const g=genera.find(g=>g.name===name),id=add('genus:'+name,'genus',name,{key:name,hint:g.source_ids.length+' source profiles in this classification',selected:name===selected.genus,action:'genus',href:g.href});edge(rootId,id,'classification');}
  const sourcePool=group?group.source_ids.filter(id=>allowed.has(id)):[],sourceWindow=windowed(sourcePool,selected.compound?6:10,pages.source,selected.source);
  for(const sid of sourceWindow.values){const s=sources[sid];if(!s)continue;const id=add('source:'+sid,'source',s.name,{key:sid,hint:s.state,selected:sid===selected.source,action:'source',href:'../'+s.route+'#source-records'});edge(input.directSources?rootId:'genus:'+selected.genus,id,'classification');}
  const source=sourcePool.includes(selected.source)?sources[selected.source]:null,productPool=source?source.compound_ids.filter(fn=>taxon.compound_ids.includes(fn)):[],productWindow=windowed(productPool,selected.compound?6:10,pages.compound,selected.compound);
  for(const fn of productWindow.values){const c=compounds[fn];if(!c)continue;add('compound:'+fn,'compound',c.name,{key:fn,hint:c.counts.activity_records+' activity records'+(c.structure_holds?.length?'; existing structure restrictions retained':''),selected:fn===selected.compound,action:'compound',image:c.image,href:'../1-Compounds/'+encodeURIComponent(fn)+'#connections'});}
  // Shared product nodes receive every exact visible source/product edge, once.
  for(const n of nodes.filter(n=>n.kind==='source'))for(const fn of sources[n.key].compound_ids)edge(n.id,'compound:'+fn,'source_product');
  if(source&&allowed.has(source.id)){
   const id=add('sampling:'+source.id,'sampling','Sampling & provenance',{hint:'Stored source records; not unique sampling events',href:'../'+source.route+'#source-records',action:'link'});edge('source:'+source.id,id,'source_context');
  }
  if(selected.compound&&productPool.includes(selected.compound)){
   const cid='compound:'+selected.compound;
   for(const r of previews){
    const rid=add('result:'+r.id,'result',r.system||'Assay system not recorded',{key:r.id,hint:r.value+' · '+r.state,action:'result',state:r.state});edge(cid,rid,'compound_result');
    if(r.evidence.length){
     const key=JSON.stringify(r.evidence.map(e=>e.href).sort()),ref=add('citation:'+key,'reference',r.evidence[0].label,{hint:r.evidence.map(e=>e.label).join(' · '),href:r.evidence[0].href,action:'link'});edge(rid,ref,'result_citation');
    }
   }
   for(const t of targets.slice(0,4)){const id=add('target:'+t.id,'target',t.name,{hint:'Stored target annotation; direct binding is not established by this edge',href:'../'+t.route,action:'link'});edge(cid,id,'target_annotation');}
  }
  return {nodes,edges,windows:{genus:genusWindow,source:sourceWindow,compound:productWindow},targetOverflow:Math.max(0,targets.length-4)};
 }
 function layout(graph){
  const activeSource=graph.nodes.some(n=>n.kind==='source'&&n.selected),activeCompound=graph.nodes.some(n=>n.kind==='compound'&&n.selected),groups={};
  for(const n of graph.nodes)(groups[n.kind]??=[]).push(n);
  const radius=n=>n.kind==='compound'?(n.selected?43:29):n.kind==='taxon'?31:n.kind==='genus'?25:n.selected?23:17;
  for(const [kind,ns]of Object.entries(groups))for(const [i,n]of ns.entries()){
   const a=(i/Math.max(ns.length,1))*Math.PI*2-Math.PI/2;n.r=radius(n);
   if(kind==='taxon'){n.ax=activeSource?75:groups.source?100:550;n.ay=activeSource?65:groups.source?100:310;}
   if(kind==='genus'){n.ax=groups.source?activeSource?190:330:550+230*Math.cos(a);n.ay=groups.source?activeSource?150:310:310+215*Math.sin(a);}
   if(kind==='source'){n.ax=n.selected?(activeCompound?350:410):activeSource?210+130*Math.cos(a):650+230*Math.cos(a);n.ay=n.selected?325:activeSource?350+215*Math.sin(a):315+225*Math.sin(a);}
   if(kind==='compound'){n.ax=n.selected?600:activeCompound?510+150*Math.cos(a):735+200*Math.cos(a);n.ay=n.selected?310:315+220*Math.sin(a);}
   if(kind==='sampling'){n.ax=360;n.ay=575;}
   if(kind==='result'){n.ax=835;n.ay=i?425:155;}
   if(kind==='reference'){n.ax=1010;n.ay=300+i*100;}
   if(kind==='target'){n.ax=790+i*90;n.ay=560;}
   n.x=n.ax;n.y=n.ay;
  }
  const by=new Map(graph.nodes.map(n=>[n.id,n]));
  for(let iter=0;iter<180;iter++){
   const delta=new Map(graph.nodes.map(n=>[n.id,{x:(n.ax-n.x)*.06,y:(n.ay-n.y)*.06}]));
   for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
    const a=graph.nodes[i],b=graph.nodes[j];let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<.1){dx=1;dy=.5;d=1.12;}
    const min=a.r+b.r+64;if(d<min){const push=(min-d)*.18/d;delta.get(a.id).x+=dx*push;delta.get(a.id).y+=dy*push;delta.get(b.id).x-=dx*push;delta.get(b.id).y-=dy*push;}
   }
   for(const e of graph.edges){const a=by.get(e.a),b=by.get(e.b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-170)*.004/d;delta.get(a.id).x+=dx*f;delta.get(a.id).y+=dy*f;delta.get(b.id).x-=dx*f;delta.get(b.id).y-=dy*f;}
   for(const n of graph.nodes){const d=delta.get(n.id);n.x=Math.max(55,Math.min(1045,n.x+d.x));n.y=Math.max(55,Math.min(575,n.y+d.y));}
  }
  return graph;
 }
 function mount(svg,select){
  const NS='http://www.w3.org/2000/svg',colors={taxon:'#254f70',genus:'#7e6eab',source:'#398b89',compound:'#397da9',result:'#b88936',target:'#ab6883',reference:'#7a8998',sampling:'#668788'};
  let current,layer,positions=new Map(),drag=null,view={x:0,y:0,w:1100,h:650},moved=false;
  const make=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  function viewBox(){svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));}
  function position(){if(!current)return;for(const n of current.nodes)positions.get(n.id).setAttribute('transform','translate('+n.x+','+n.y+')');for(const p of layer.querySelectorAll('[data-net-edge]')){const a=current.nodes.find(n=>n.id===p.dataset.from),b=current.nodes.find(n=>n.id===p.dataset.to);p.setAttribute('d','M'+a.x+','+a.y+' L'+b.x+','+b.y);}}
  function set(graph){
   current=layout(graph);positions=new Map();svg.replaceChildren(make('title',{},'Source, product and evidence network'),make('desc',{},'Click nodes to expand stored relationships. Drag nodes or the background. Lines show catalog associations; dashed lines are target annotations.'));layer=make('g');svg.append(layer);
   for(const e of current.edges){const dashed=e.relation==='target_annotation';layer.append(make('path',{'data-net-edge':e.relation,'data-from':e.a,'data-to':e.b,fill:'none',stroke:dashed?'#be99aa':'#c5d6e2','stroke-width':e.relation==='source_product'?1.8:1.4,...(dashed?{'stroke-dasharray':'5 4'}:{})}));}
   for(const [i,n]of current.nodes.entries()){
    const g=make('g',{role:n.action==='link'?'link':'button',tabindex:'0','data-net-id':n.id,'data-net-kind':n.kind,'data-net-selected':String(!!n.selected),'aria-label':n.kind+': '+n.label+'. '+(n.hint||''),class:'source-network-node'});g.append(make('title',{},n.label+'\n'+(n.hint||'')),make('circle',{r:Math.max(n.r,34),fill:'transparent'}));
    if(n.selected)g.append(make('circle',{r:n.r+7,fill:colors[n.kind],'fill-opacity':'.11',stroke:colors[n.kind],'stroke-opacity':'.28'}));
    g.append(make('circle',{r:n.r,fill:n.kind==='compound'?'white':colors[n.kind],'fill-opacity':n.kind==='compound'?'1':'.94',stroke:colors[n.kind],'stroke-width':n.selected?2.5:1,...(n.state==='held'?{'stroke-dasharray':'4 3'}:{})}));
    if(n.image){const clip=make('clipPath',{id:'net-image-'+i});clip.append(make('circle',{r:n.r-3}));g.append(clip,make('image',{href:n.image,x:-n.r+3,y:-n.r+3,width:2*n.r-6,height:2*n.r-6,'clip-path':'url(#net-image-'+i+')',preserveAspectRatio:'xMidYMid meet'}));}
    else g.append(make('text',{'text-anchor':'middle',dy:'4',fill:'white','font-size':n.kind==='taxon'?16:12,'font-weight':'600','pointer-events':'none'},{taxon:'T',genus:'G',source:'S',compound:'C',result:'A',target:'T',reference:'R',sampling:'P'}[n.kind]));
    const label=make('text',{'text-anchor':'middle',y:n.r+18,fill:'#355b75','font-size':n.selected?14:12,'font-weight':n.selected?600:400,class:'source-network-label'}),words=n.label.match(/.{1,23}(?:\s|$)|.{1,23}/g)||[n.label];
    for(const [j,line]of words.slice(0,2).entries())label.append(make('tspan',{x:0,dy:j?15:0},line.trim()+(j===1&&words.length>2?'…':'')));
    g.append(label);layer.append(g);positions.set(n.id,g);
   }
   position();
  }
  function activate(target){const id=target.closest('[data-net-id]')?.dataset.netId,n=current?.nodes.find(n=>n.id===id);if(n)select(n);}
  svg.addEventListener('click',e=>{if(moved){moved=false;return;}activate(e.target);});
  svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target);}});
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const id=e.target.closest('[data-net-id]')?.dataset.netId;drag={id,x:e.clientX,y:e.clientY,view:{...view}};moved=false;});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const rect=svg.getBoundingClientRect(),dx=(e.clientX-drag.x)*view.w/rect.width,dy=(e.clientY-drag.y)*view.h/rect.height;if(!moved&&Math.abs(dx)+Math.abs(dy)>4){moved=true;svg.setPointerCapture(e.pointerId);}if(!moved)return;if(drag.id){const n=current.nodes.find(n=>n.id===drag.id);n.x=Math.max(30,Math.min(1070,n.x+dx));n.y=Math.max(30,Math.min(620,n.y+dy));drag.x=e.clientX;drag.y=e.clientY;position();}else{view.x=drag.view.x-dx;view.y=drag.view.y-dy;viewBox();}});
  svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
  return {set,zoom(factor){const w=Math.max(440,Math.min(1650,view.w*factor)),h=w*650/1100;view={x:view.x+(view.w-w)/2,y:view.y+(view.h-h)/2,w,h};viewBox();},fit(){view={x:0,y:0,w:1100,h:650};viewBox();}};
 }
 const api={build,layout,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeepSeaSourceNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
