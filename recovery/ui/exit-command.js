/* A native save receipt must precede normal close; cancelled owners cannot exit. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeipExitCommand=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 let pending=false,nextId=0;
 async function run({bridge,valid,save,timeoutMs=5000}){
  const check=()=>{if(!valid())throw Error('Exit command owner is no longer current.');};
  check();if(pending)throw Error('An exit request is already saving settings.');
  pending=true;const requestId="exit-"+(++nextId);
  let listener,timer;
  try{
   await new Promise((resolve,reject)=>{
    listener=event=>{if(event.data==='exit:saved:'+requestId)resolve();else if(typeof event.data==='string'&&event.data.startsWith('exit:error:'+requestId+':'))reject(Error('Could not save settings before exit: '+event.data.slice(12+requestId.length)));};
    bridge.addEventListener('message',listener);
    timer=setTimeout(()=>reject(Error('Settings save timed out; window remains open.')),timeoutMs);
    try{check();save(requestId);}catch(error){reject(error);}
   });
   check();bridge.postMessage('window:exit');
  }finally{
   clearTimeout(timer);if(listener)bridge.removeEventListener('message',listener);pending=false;
  }
 }
 return {run};
});
