/* Async host for a resumable, worker-owned trigger evaluation. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipTriggerContinuation=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const sideEffects=new Set(['command','script','sound','speech','notification','commandLink']);
function createRunner(ports){
 async function run(owner,input,options={}){
  const epoch=ports.epoch(owner),runtime=ports.rules(owner),worker=runtime.worker;
  let continuationId=null,appliedActions=0,steps=0,finalResult;
  const line={text:input,snapshot:null},spawns=[];
  const valid=()=>ports.valid(owner,epoch)&&ports.rules(owner)===runtime&&runtime.worker===worker;
  function check(execution){if(!valid()||!execution.isCurrent())throw Error('Trigger owner, worker, or connection changed.');if(++steps>128)throw Error('Trigger continuation step limit exceeded.');}
  async function evaluate(execution){
   check(execution);let result=await runtime.beginLine(input,ports.scope(owner),options.nowMs,{replay:!!options.replay,prompt:!!options.prompt,inSend:!!options.inSend});
   while(true){
    check(execution);if(result?.failed)throw Error(result.diagnostics?.[0]||'Trigger worker failed.');
    if(typeof result?.done!=='boolean'||typeof result.text!=='string'||!Array.isArray(result.actions)||result.actions.length>32)throw Error('Invalid trigger continuation result.');
    continuationId=result.continuationId;
    for(const action of result.actions){
     check(execution);if(++appliedActions>32)throw Error('Trigger action limit exceeded.');
     if(options.replay&&sideEffects.has(action.type))throw Error('Replay attempted a live trigger side effect.');
     if(action.type==='spawn')spawns.push(action);
     else if(action.type==='command')await execution.run(owner,action.text,{source:'trigger',inSend:true});
     else if(action.type==='script'){
      // The worker event finishes before any callback effects enter its host pipeline.
      const snapshot=ports.snapshot?.(owner,line);
      const changed=await ports.script(owner,{...action,...(snapshot?{line:snapshot}:{})},execution);check(execution);
      if(changed?.line){if(typeof changed.line.text!=='string'||changed.line.text.length>4096||!Array.isArray(changed.lineEdits))throw Error('Invalid script line result.');line.text=changed.line.text;line.snapshot=changed.line;await ports.replaceScriptLine?.(owner,changed.line,execution,changed.lineEdits);}
     }else{
      if(action.type==='filter'){
       if(!Number.isSafeInteger(action.start)||!Number.isSafeInteger(action.end)||action.start<0||action.end<action.start||action.end>line.text.length||typeof action.text!=='string')throw Error('Invalid filter range.');
       line.text=line.text.slice(0,action.start)+action.text+line.text.slice(action.end);line.snapshot=null;
      }
      await ports.effect(owner,action,execution,line);
     }
    }
    check(execution);
    if(result.done){if(result.text!==line.text)throw Error('Trigger text and displayed mutations diverged.');for(const spawn of spawns){check(execution);await ports.effect(owner,{...spawn,text:result.text},execution,line);}finalResult={...result,actions:[],appliedActions};await ports.finish?.(owner,finalResult,execution);return;}
    if(!Number.isSafeInteger(continuationId)||continuationId<1)throw Error('Invalid continuation identity.');
    const live=ports.scope(owner);
    result=await runtime.continueLine(continuationId,{variables:live.variables,text:line.text,away:live.away,awayEpoch:live.awayEpoch});
   }
  }
  try{
   if(options.execution)await evaluate(options.execution);
   else await ports.pipeline.transaction(owner,evaluate,{source:'trigger-line',replay:!!options.replay,prompt:!!options.prompt,inSend:!!options.inSend,validate:valid});
   return finalResult;
  }finally{
   if(continuationId&&ports.rules(owner)===runtime&&runtime.worker===worker)await runtime.cancelLine(continuationId);
  }
 }
 return {run};
}
return {createRunner};
});
