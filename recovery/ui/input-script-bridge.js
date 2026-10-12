/* Staged additional-input capabilities. No DOM or network access. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipInputScriptBridge=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function createBridge(ports){
 const tokens=new WeakMap();let serial=0;
 function token(pane){if(!pane||typeof pane!=='object')throw Error('Input pane is unavailable.');let value=tokens.get(pane);if(!value){value='input-generation-'+(++serial);tokens.set(pane,value);}return value;}
 function resolve(owner,id){if(id==='primary')return ports.primary(owner);const model=ports.model(owner);return model.get(id);}
 function snapshot(owner){const describe=(pane,id)=>({id,generation:token(pane),text:pane.text||'',start:pane.start||0,end:pane.end||0,title:pane.title||'',prefix:pane.prefix||''});return {input:describe(ports.primary(owner),'primary'),inputs:[...ports.model(owner).panes.values()].map(pane=>describe(pane,pane.id))};}
 function apply(owner,effect,execution){
  if(!effect||!['input-set','input-select','input-configure'].includes(effect.type))return false;
  if(!ports.valid(owner)||!execution?.isCurrent()||execution.owner!==owner)throw Error('Input effect owner is no longer current.');
  if(effect.id!=='primary'&&!/^input:[a-z0-9_-]{1,48}$/.test(effect.id||''))throw Error('Invalid input pane.');
  if(effect.type==='input-set'&&(typeof effect.value!=='string'||effect.value.length>65536||effect.value.includes('\0')))throw Error('Invalid input text.');
  if(effect.type==='input-select'&&(!Number.isSafeInteger(effect.start)||!Number.isSafeInteger(effect.end)||effect.start<0||effect.end<effect.start||effect.end>65536))throw Error('Invalid input selection.');
  if(effect.type==='input-configure'&&(!['title','prefix'].includes(effect.key)||typeof effect.value!=='string'||effect.value.length>(effect.key==='title'?160:2048)||/[\r\n\0]/.test(effect.value)))throw Error('Invalid input property.');
  const pane=resolve(owner,effect.id);if(typeof effect.generation!=='string'||effect.generation!==token(pane))throw Error('Input pane is closed or was replaced.');
  // The worker cannot bypass the model's range/text/property constraints.
  if(effect.id==='primary'){
   if(effect.type==='input-set')ports.setPrimary(owner,effect.value);
   else if(effect.type==='input-select')ports.selectPrimary(owner,effect.start,effect.end);
   else ports.configurePrimary(owner,{[effect.key]:effect.value});
  }else{const model=ports.model(owner);if(effect.type==='input-set')model.set(effect.id,effect.value);else if(effect.type==='input-select')model.select(effect.id,effect.start,effect.end);else model.configure(effect.id,{[effect.key]:effect.value});}
  ports.changed(owner,effect.id,{persist:effect.type==='input-configure'});return true;
 }
 return {snapshot,apply};
}
return {createBridge};
});
