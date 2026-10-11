(function(root){
'use strict';
class Runtime{
 constructor(onEffects,onError,WorkerClass=root.Worker){this.onEffects=onEffects;this.onError=onError;this.WorkerClass=WorkerClass;this.serial=0;this.queue=[];this.current=null;this.worker=null;this.timer=null;this.enabled=false;}
 start(source){this.stop();if(typeof source!=='string'||source.length>65536){this.onError('Script exceeds 64 KB.');return;}this.enabled=true;try{this.worker=new this.WorkerClass('script-worker.js');}catch(error){this.fail('Script worker could not start: '+String(error?.message||error));return;}this.worker.onmessage=e=>this.result(e.data);this.worker.onerror=e=>{e.preventDefault?.();this.fail('Script failed: '+(e.message||'worker error'));};this.enqueue('eval',source);}
 evaluate(source){if(!this.enabled)this.start(source);else this.enqueue('eval',source);}
 enqueue(type,value){if(!this.enabled)return;if(this.queue.length>=64){this.fail('Script stopped: event queue exceeded its limit.');return;}this.queue.push({id:++this.serial,type,value:String(value).slice(0,65536)});this.next();}
 next(){if(this.current||!this.worker||!this.queue.length)return;this.current=this.queue.shift();this.timer=setTimeout(()=>this.fail('Script stopped: execution time limit exceeded.'),this.current.type==='eval'?1000:500);try{this.worker.postMessage(this.current);}catch{this.fail('Script worker rejected an event.');}}
 result(data){if(!this.current||data?.id!==this.current.id)return;clearTimeout(this.timer);this.timer=null;this.current=null;if(data.error){this.fail('Script error: '+data.error);return;}const effects=Array.isArray(data.effects)?data.effects.slice(0,32).filter(e=>['send','output','html'].includes(e?.type)&&typeof e.value==='string'&&e.value.length<=8192):[];this.onEffects(effects);this.next();}
 fail(message){this.stop();this.onError(message);}
 stop(){clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;this.enabled=false;this.current=null;this.queue=[];}
}
const api={Runtime};if(typeof module!=='undefined')module.exports=api;else root.BeipScripts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
