/* UI selection contract only. Scientific comparison rules remain in the adapters. */
(function(root){'use strict';
 function changeMember(selection,activities,side,id){
  if(!['a','b'].includes(side))throw Error('Unknown compound side');
  const next={...selection,[side]:id},keep={...activities};
  if(selection[side]!==id)delete keep['activity_'+side];
  if(!next.b)delete keep.activity_b;
  return {selected:next,activities:keep};
 }
 function ownedActivities(requested,contexts){
  const activities={},removed=[];
  for(const side of ['a','b']){
   const key='activity_'+side,id=requested[key];if(!id)continue;
   if(contexts[side]?.activities?.some(row=>row.activity_id===id))activities[key]=id;
   else removed.push(side.toUpperCase());
  }
  return {activities,removed};
 }
 function viewParams(state){
  const view=state.view||'compare',q=new URLSearchParams();
  q.set('view',view);
  if(view==='compare'){
   q.set('a',state.selected.a||'');q.set('b',state.selected.b||'');
   for(const key of ['activity_a','activity_b'])if(state.activities?.[key])q.set(key,state.activities[key]);
   if(state.reference)q.set('reference',state.reference);
  }else if(view==='coverage'){
   if(state.coverageId||state.selected.a)q.set('coverage_compound',state.coverageId||state.selected.a);
   if(state.coverageReference)q.set('coverage_reference',state.coverageReference);
  }else if(view==='explore'){
   for(const [key,value]of new URLSearchParams(state.currentSearch||''))if(key.startsWith('e_'))q.set(key,value);
   if(state.evidenceCompound!==null&&state.evidenceCompound!==undefined){
    for(const key of [...q.keys()])if(key.startsWith('e_'))q.delete(key);
    if(state.evidenceCompound)q.set('e_file',state.evidenceCompound);
   }
  }
  return q;
 }
 const api={changeMember,ownedActivities,viewParams};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchWorkbenchState=api;
})(typeof window==='object'?window:this);
