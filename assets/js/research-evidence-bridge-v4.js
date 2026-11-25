'use strict';
(() => {
  let mode='explore', lastCompound=null;
  const messageOrigin=location.protocol==='file:'?'*':location.origin;
  const fileInput=document.getElementById('dataset-file'),fileName=document.getElementById('dataset-file-name');
  document.getElementById('choose-dataset').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{fileName.textContent=fileInput.files[0]?.name||'No file selected';});
  for(const id of ['clear-analysis','load-example'])document.getElementById(id).addEventListener('click',()=>{fileName.textContent='No file selected';});
  function applyTask(message){
    mode=message.mode==='analyze'&&document.documentElement.dataset.analyzeEnabled!=='false'?'analyze':'explore';
    document.getElementById('matrix').hidden=mode!=='explore';
    document.getElementById('analyze').hidden=mode!=='analyze';
    document.getElementById('snapshot-details').hidden=mode!=='explore';
    if(mode==='explore'&&message.compound!==lastCompound){
      const filter=document.getElementById('compound-filter');
      const exists=[...filter.options].some(option=>option.value===message.compound);
      document.getElementById('reset-reference').click();
      if(exists){filter.value=message.compound;filter.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(message.compound){
        // A catalog member without admitted rows must not silently display all evidence.
        const option=document.createElement('option');option.value=message.compound;option.textContent=message.name||message.compound;filter.append(option);filter.value=message.compound;filter.dispatchEvent(new Event('change',{bubbles:true}));
      }
      lastCompound=message.compound;
    }
    parent.postMessage({type:'research-panel-view-ready',mode},messageOrigin);
    publishSize();
  }
  function publishSize(){parent.postMessage({type:'research-panel-height',height:Math.ceil(document.body.getBoundingClientRect().height)},messageOrigin);}
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='research-task')return;
    applyTask(event.data);
  });
  // Catalog links leave the panel and keep one shared application shell.
  document.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(link?.getAttribute('href')?.startsWith('../1-Compounds/'))link.target='_top';
  });
  new ResizeObserver(publishSize).observe(document.body);
  parent.postMessage({type:'research-panel-ready'},messageOrigin);
})();
