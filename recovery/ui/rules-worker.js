/* Rule evaluation lives here so the UI can terminate a slow regex. MIT. */
'use strict';
importScripts('rules.js');
let engine=null;
self.onmessage=event=>{
 const job=event.data||{};
 if(job.type==='start'){
  try{
   engine=BeipRules.createEngine({aliases:job.aliases,triggers:job.triggers,allowRegex:true,workerEngine:true});
   self.postMessage({type:'ready'});
  }catch(error){self.postMessage({type:'start-error',error:String(error?.message||error).slice(0,512)});}
  return;
 }
 if(!engine||!Number.isSafeInteger(job.id)||job.id<1)return;
 try{
  const result=job.type==='expand'
   ?engine.expandCommand(job.value,job.scope)
   :job.type==='line'
    ?engine.processLine(job.value,job.scope,job.nowMs)
    :null;
  if(result)self.postMessage({id:job.id,result});
 }catch(error){self.postMessage({id:job.id,error:String(error?.message||error).slice(0,512)});}
};
