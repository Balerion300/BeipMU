/* Asynchronous rule runner. A stalled regex never runs on the UI thread. MIT. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeipRegexRules=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
 'use strict';
 const DEADLINE_MS=500,MAX_QUEUE=64;
 function fallback(job,reason){
  const diagnostics=[reason];
   if(job.type==='cancel-capture')return {cancelled:false,diagnostics};
  if(job.type==='expand')return {commands:[],matched:false,diagnostics};
  return {text:job.value,actions:[],matches:[],gagged:false,logGagged:false,diagnostics};
 }
 class Runtime{
  constructor(onError=()=>{},WorkerClass=root.Worker,options={}){
   this.onError=onError;this.WorkerClass=WorkerClass;this.deadline=Math.max(1,Math.min(DEADLINE_MS,Number(options.timeoutMs)||DEADLINE_MS));
   this.worker=null;this.ready=false;this.queue=[];this.current=null;this.timer=null;this.serial=0;this.disabledReason='Rules are not running.';this.reported=new Set();
  }
  report(message){if(this.reported.has(message))return;this.reported.add(message);try{this.onError(message);}catch{}}
  shutdown(reason,notify){
   clearTimeout(this.timer);this.timer=null;
   const worker=this.worker;this.worker=null;this.ready=false;
   try{worker?.terminate();}catch{}
   const jobs=[...(this.current?[this.current]:[]),...this.queue];this.current=null;this.queue=[];
   this.disabledReason=reason;
   for(const job of jobs)job.resolve(fallback(job,reason));
   if(notify)this.report(reason);
  }
  stop(){this.shutdown('Rules stopped.',false);}
  start(config={}){
   this.shutdown('Rules restarted.',false);this.reported.clear();
   if(typeof this.WorkerClass!=='function'){this.shutdown('Rules worker is unavailable.',true);return false;}
   let worker;
   try{worker=new this.WorkerClass('rules-worker.js');}catch(error){this.shutdown('Rules worker could not start: '+String(error?.message||error),true);return false;}
   this.worker=worker;this.disabledReason='';
   worker.onmessage=event=>{if(this.worker===worker)this.message(event.data);};
   worker.onerror=event=>{if(this.worker!==worker)return;event?.preventDefault?.();this.shutdown('Rules worker failed.',true);};
   worker.onmessageerror=()=>{if(this.worker===worker)this.shutdown('Rules worker sent an unreadable result.',true);};
   this.timer=setTimeout(()=>this.shutdown('Rules worker did not start within its time limit.',true),this.deadline);
   try{worker.postMessage({type:'start',aliases:Array.isArray(config.aliases)?config.aliases:[],triggers:Array.isArray(config.triggers)?config.triggers:[]});}
   catch(error){this.shutdown('Rules could not be loaded: '+String(error?.message||error),true);return false;}
   return true;
  }
  message(data){
   if(data?.type==='ready'){if(this.ready)return;clearTimeout(this.timer);this.timer=null;this.ready=true;this.next();return;}
   if(data?.type==='start-error'){this.shutdown('Rules could not be loaded: '+String(data.error||'unknown error'),true);return;}
   const job=this.current;
   if(!job||data?.id!==job.id)return;
   clearTimeout(this.timer);this.timer=null;this.current=null;
   if(data.error||!data.result){this.shutdown('Rules worker failed: '+String(data.error||'invalid result'),true);job.resolve(fallback(job,this.disabledReason));return;}
   if(Array.isArray(data.result.diagnostics))for(const diagnostic of data.result.diagnostics)
    if(typeof diagnostic==='string'&&(diagnostic.startsWith('Invalid regex')||diagnostic.startsWith('Invalid capture-until regex')))this.report(diagnostic);
   job.resolve(data.result);this.next();
  }
  next(){
   if(!this.worker||!this.ready||this.current||!this.queue.length)return;
   const job=this.current=this.queue.shift();
   this.timer=setTimeout(()=>this.shutdown('Rules stopped: a pattern exceeded '+this.deadline+' ms.',true),this.deadline);
   try{this.worker.postMessage({id:job.id,type:job.type,value:job.value,scope:job.scope,nowMs:job.nowMs});}
   catch(error){this.shutdown('Rules worker rejected a job: '+String(error?.message||error),true);}
  }
  enqueue(type,value,scope,nowMs){
   if(!this.worker)return Promise.resolve(fallback({type,value},this.disabledReason));
   if(this.queue.length+(this.current?1:0)>=MAX_QUEUE){
    this.shutdown('Rules stopped: pending work limit reached.',true);
    return Promise.resolve(fallback({type,value},this.disabledReason));
   }
   return new Promise(resolve=>{this.queue.push({id:++this.serial,type,value,scope:scope||{},nowMs,resolve});this.next();});
  }
  expandCommand(input,scope){return this.enqueue('expand',input,scope);}
  processLine(text,scope,nowMs){return this.enqueue('line',text,scope,nowMs);}
  cancelCapture(scope){return this.enqueue('cancel-capture','',scope);}
 }
 return {Runtime,DEADLINE_MS,MAX_QUEUE};
});
