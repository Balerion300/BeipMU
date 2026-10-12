/* The same worker adapter is used in integration tests and by the app. MIT. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./command-pipeline.js'):root.BeipCommandPipeline);if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipCommandAdapter=api;})(typeof globalThis==='object'?globalThis:this,function(core){
'use strict';
function createAdapter(ports,limits){
 let pipeline;
 async function script(owner,type,value,execution){
  const runtime=ports.scripts(owner);if(!runtime)return false;
  const result=type==='eval'?await runtime.evaluate(value,ports.context(owner),{captureEffects:true}):await runtime.dispatch(type,value,ports.context(owner),{captureEffects:true});
  if(!execution.isCurrent())throw Error('Command owner changed during a script callback.');
  if(result.failed)throw Error('Script callback failed or was stopped.');
  await pipeline.drain(execution,result.effects);return result.handled;
 }
 pipeline=core.createPipeline({...ports,
  aliases:async(owner,text,execution)=>{
   const result=await ports.rules(owner).expandCommand(text,ports.scope(owner));
   if(!execution.isCurrent())throw Error('Command owner changed during alias expansion.');
   if(!result||!Array.isArray(result.commands)||!result.commands.length||result.diagnostics?.length)throw Error(result?.diagnostics?.[0]||'Alias expansion failed.');
   return {text:result.commands.join('\r\n'),matched:result.matched===true};
  },
  onCommand:(owner,value,execution)=>script(owner,'command',value,execution),
  onSend:(owner,value,execution)=>script(owner,'send',value,execution),
  evaluate:(owner,value,execution)=>script(owner,'eval',value,execution),
  effect:(owner,effect,execution)=>{
   if(effect.type==='timer-start'){ports.scripts(owner).schedule(effect,ports.context(owner));return;}
   if(effect.type==='timer-stop'){ports.scripts(owner).cancelTimer(effect.id);return;}
   return ports.effect(owner,effect,execution);
  }
 },limits);
 return pipeline;
}
return {createAdapter};
});
