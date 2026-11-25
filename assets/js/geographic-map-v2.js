(function(global){
  'use strict';
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function valid(lat,lng){return typeof lat==='number'&&typeof lng==='number'&&isFinite(lat)&&isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;}
  function project(lat,lng){return {x:(lng+180)/360*1000,y:(90-lat)/180*500};}
  function featureType(name){var s=name.toLowerCase();return s.indexOf('trench')>=0?'trench':(/seamount|ridge/.test(s)?'seamount':'site');}
  function coordinateText(lat,lng){return Math.abs(lat).toFixed(4)+'°'+(lat<0?'S':'N')+', '+Math.abs(lng).toFixed(4)+'°'+(lng<0?'W':'E');}
  function model(records,summary){
    var regions=[],coordinates=[],groups={},seen={};
    [['oceans','ocean','o'],['seas','sea','s'],['features','feature','feature']].forEach(function(cfg){
      (summary[cfg[0]]||[]).forEach(function(r){
        if(r.name==='Unknown')return;
        var p=valid(r.lat,r.lng)?project(r.lat,r.lng):null,level=cfg[1]==='feature'?featureType(r.name):cfg[1];
        var members=records.filter(function(v){return v[cfg[2]]===r.name;});
        regions.push({name:r.name,level:level,lat:r.lat,lng:r.lng,count:new Set(members.map(function(v){return v.f;})).size,declaredCount:r.count,x:p&&p.x,y:p&&p.y,placed:!!p});
      });
    });
    records.forEach(function(r){
      if(seen[r.f])return;seen[r.f]=true;
      if(r.geo_precision!=='exact_primary_source_coordinate'||r.exclude_from_coordinate_analysis||!valid(r.lat,r.lng))return;
      var key=String(r.lat)+'|'+String(r.lng);
      if(!groups[key]){var p=project(r.lat,r.lng);groups[key]={id:'c'+coordinates.length,lat:r.lat,lng:r.lng,x:p.x,y:p.y,records:[]};coordinates.push(groups[key]);}
      groups[key].records.push(r);
    });
    return {regions:regions,coordinates:coordinates,coordinateRecords:coordinates.reduce(function(n,g){return n+g.records.length;},0)};
  }
  function radius(r){return Math.min(r.level==='ocean'?27:25,(r.level==='ocean'?5:7)+Math.sqrt(r.count)*(r.level==='ocean'?.95:1.6));}
  function colour(level){return {ocean:'#0077b6',sea:'#0077b6',trench:'#5e35b1',seamount:'#00897b',site:'#e65100'}[level];}
  function labels(markers){
    var boxes=[],named={};
    markers.slice().sort(function(a,b){return b.count-a.count||a.name.localeCompare(b.name);}).forEach(function(m){
      if(boxes.length>=16||named[m.name])return;
      var text=m.name.replace(/ sampling site$/,'').replace('（原报）',' (reported)')+' ('+m.count+')',w=text.length*5.1+8,h=14,r=radius(m);
      // Labels remain close to their own circle. Dense locations retain native hover labels.
      var positions=[[m.x-w/2,m.y-r-h-6],[m.x-w/2,m.y+r+6],[m.x+r+7,m.y-h/2],[m.x-r-w-7,m.y-h/2]];
      for(var i=0;i<positions.length;i++){
        var x=positions[i][0],y=positions[i][1];
        if(x<8||y<8||x+w>992||y+h>492)continue;
        if(boxes.some(function(b){return x<b.x+b.w+5&&x+w+5>b.x&&y<b.y+b.h+4&&y+h+4>b.y;}))continue;
        if(markers.some(function(p){return p.x+radius(p)>x&&p.x-radius(p)<x+w&&p.y+radius(p)>y&&p.y-radius(p)<y+h;}))continue;
        boxes.push({marker:m,x:x,y:y,w:w,h:h,text:text});named[m.name]=true;break;
      }
    });
    return boxes;
  }
  function render(options){
    var svg=options.svg,root=svg.closest('.classic-map'),selection=root.querySelector('[data-classic-map-selection]'),data=model(options.records,options.summary),id=svg.id;
    var markers=data.regions.filter(function(r){return r.placed;}),layout=labels(markers);
    var h='<desc>Region circles are illustrative, not sampling coordinates or geographic boundaries. Small points show qualified reported coordinates; shared coordinates do not establish independent sampling events.</desc><defs><pattern id="'+id+'-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.65" fill="#4a7ba8"/></pattern><mask id="'+id+'-land" mask-type="alpha"><image href="'+esc(options.landAsset)+'" width="1000" height="500"/></mask></defs><rect width="1000" height="500" fill="#0b1a2e"/><rect width="1000" height="500" fill="url(#'+id+'-dots)" mask="url(#'+id+'-land)"/>';
    markers.forEach(function(m){
      h+='<a class="classic-region-marker" href="'+options.locationBase+encodeURIComponent(m.name)+'&level='+m.level+'" aria-label="'+esc(m.name+'; '+m.count+' compound records; regional illustration')+'"><title>'+esc(m.name+' · '+m.count+' compound records (regional illustration)')+'</title><circle cx="'+m.x+'" cy="'+m.y+'" r="'+radius(m)+'" fill="'+colour(m.level)+'" fill-opacity="'+(m.level==='ocean'||m.level==='sea'?0.55:0.8)+'"/></a>';
    });
    layout.forEach(function(b){var m=b.marker,y=b.y+b.h-3;h+='<a class="classic-region-label" href="'+options.locationBase+encodeURIComponent(m.name)+'&level='+m.level+'"><text x="'+(b.x+b.w/2)+'" y="'+y+'">'+esc(b.text)+'</text><title>'+esc(m.name+' · '+m.count+' compound records')+'</title></a>';});
    data.coordinates.forEach(function(g){var title=coordinateText(g.lat,g.lng)+' · '+g.records.length+' compound records';h+='<g class="classic-coordinate-marker" tabindex="0" role="button" data-coordinate-group="'+g.id+'" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title><circle class="classic-coordinate-hit" cx="'+g.x+'" cy="'+g.y+'" r="6"/><circle class="classic-coordinate-dot" cx="'+g.x+'" cy="'+g.y+'" r="3"/></g>';});
    svg.setAttribute('viewBox','0 0 1000 500');svg.innerHTML=h;
    function choose(id){
      var g=data.coordinates.filter(function(c){return c.id===id;})[0];if(!g)return;
      selection.innerHTML='<button type="button" data-close-map-selection aria-label="Close coordinate details">×</button><strong>'+coordinateText(g.lat,g.lng)+'</strong> <span>· '+g.records.length+' compound records</span><div class="classic-coordinate-links">'+g.records.map(function(r){return '<a href="'+options.compoundBase+encodeURIComponent(r.f)+'">'+esc(r.n)+'</a>';}).join('')+'</div><p class="classic-coordinate-note">Shared coordinates do not establish independent sampling events.</p>';
      selection.hidden=false;
    }
    root.addEventListener('click',function(e){var t=e.target.closest('[data-coordinate-group],[data-close-map-selection]');if(!t||!root.contains(t))return;if(t.hasAttribute('data-coordinate-group'))choose(t.getAttribute('data-coordinate-group'));else selection.hidden=true;});
    root.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.hasAttribute('data-coordinate-group')){e.preventDefault();choose(e.target.getAttribute('data-coordinate-group'));}});
    return {data:data,labelLayout:layout,plottedRegions:markers.length,coordinateGroups:data.coordinates.length,choose:choose};
  }
  global.DeepSeaClassicGeo={render:render,model:model,labels:labels,project:project,valid:valid,radius:radius};
})(window);
