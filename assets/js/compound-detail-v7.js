(function(){
  'use strict';
  var toast=document.getElementById('copy-status');
  function message(text){toast.textContent=text;toast.hidden=false;window.setTimeout(function(){toast.hidden=true;},1800);}
  function fallback(text){var field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.left='-9999px';document.body.appendChild(field);field.select();var ok=document.execCommand('copy');field.remove();return ok;}
  document.addEventListener('click',async function(e){
    var button=e.target.closest('[data-copy]');if(!button)return;
    var text=button.getAttribute('data-copy');
    try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else if(!fallback(text))throw new Error('copy unavailable');message('Copied');}
    catch(error){message('Select the identifier text to copy.');}
  });
})();

(function(){
  'use strict';
  var nav=document.getElementById('compound-sections');
  if(!nav)return;
  var links=Array.from(nav.querySelectorAll('a[href^="#"]'));
  var targets=links.map(function(link){return document.getElementById(link.hash.slice(1));});
  if(!targets.length||targets.some(function(target){return !target;}))return;
  var frame=0;
  function update(){
    frame=0;
    var current=targets[0];
    var boundary=Math.max(100,window.innerHeight*.2);
    targets.forEach(function(target){if(target.getBoundingClientRect().top<=boundary)current=target;});
    if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2)current=targets[targets.length-1];
    links.forEach(function(link,index){
      if(targets[index]===current)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule(){if(!frame)frame=window.requestAnimationFrame(update);}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  update();
})();

/* Shared research entry; scientific fields and their statuses are untouched. */
(()=>{const add=()=>{const aside=document.querySelector('aside');if(!aside||document.querySelector('[data-research-workbench-entry],[data-cew-entry]'))return;const file=decodeURIComponent(location.pathname.split('/').pop());if(!/\.html$/i.test(file))return;const link=document.createElement('a');link.dataset.researchWorkbenchEntry='';link.href='../pages/research-workbench.html?compound='+encodeURIComponent(file);link.textContent='Research Workbench →';link.style.cssText='display:block;margin:12px 16px;padding:10px 12px;border:1px solid #c9dce9;border-radius:7px;color:#17647e;font:600 14px/1.5 Arial,sans-serif;text-decoration:none';aside.prepend(link);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();})();
