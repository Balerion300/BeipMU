/* Session-owned bridge for opt-in scripts running in a disposable worker. MIT. */
(function(root){
'use strict';
const MAX_SOURCE=65536,MAX_VALUE=8192,MAX_QUEUE=64,MAX_EFFECTS=32,MAX_TIMERS=16;
const empty=()=>({handled:false,effects:[]});
function label(value,max=160){return typeof value==='string'?value.slice(0,max):'';}
function contextOf(input){
 const value=input&&typeof input==='object'?input:{};
 const character=item=>item&&typeof item==='object'?{id:label(item.id,64),name:label(item.name),notes:label(item.notes,1024)}:null;
 const profile=item=>item&&typeof item==='object'?{id:label(item.id,64),name:label(item.name),host:label(item.host,256),notes:label(item.notes,1024),characters:Array.isArray(item.characters)?item.characters.slice(0,64).map(character).filter(Boolean):[]}:null;
 const inputValue=value.input&&typeof value.input==='object'?value.input:{};
 const inputText=label(inputValue.text,MAX_VALUE),start=Number.isSafeInteger(inputValue.start)?inputValue.start:0,end=Number.isSafeInteger(inputValue.end)?inputValue.end:start;
 return {sessionId:label(value.sessionId,64),connected:!!value.connected,logging:!!value.logging,
  world:profile(value.world),character:profile(value.character),
  worlds:Array.isArray(value.worlds)?value.worlds.slice(0,32).map(profile).filter(Boolean):[],
  windows:Array.isArray(value.windows)?value.windows.slice(0,32).map(item=>({id:label(item?.id,64),title:label(item?.title)})):[],
  title:label(value.title),input:{text:inputText,start:Math.max(0,Math.min(inputText.length,start)),end:Math.max(0,Math.min(inputText.length,end))},
  buildNumber:Number.isSafeInteger(value.buildNumber)?value.buildNumber:0};
}
function validEffect(item){
 if(!item||typeof item!=='object')return null;
 if(['send','output','html','display'].includes(item.type))
  return typeof item.value==='string'&&item.value.length<=MAX_VALUE&&
   (item.type!=='send'||!/[\r\n]/.test(item.value))?{type:item.type,value:item.value}:null;
 if(item.type==='debug')return typeof item.value==='string'&&item.value.length<=512?{type:'debug',value:item.value}:null;
 if(item.type==='input-set')return typeof item.value==='string'&&item.value.length<=MAX_VALUE?{type:'input-set',value:item.value}:null;
 if(item.type==='input-select'&&Number.isSafeInteger(item.start)&&Number.isSafeInteger(item.end)&&item.start>=0&&item.end>=item.start&&item.end<=MAX_VALUE)
  return {type:'input-select',start:item.start,end:item.end};
 if(item.type==='timer-start'&&Number.isSafeInteger(item.id)&&item.id>0&&Number.isSafeInteger(item.delay)&&item.delay>=100&&item.delay<=3600000&&typeof item.repeat==='boolean')
  return {type:item.type,id:item.id,delay:item.delay,repeat:item.repeat};
 if(item.type==='timer-stop'&&Number.isSafeInteger(item.id)&&item.id>0)return {type:item.type,id:item.id};
 return null;
}
class Runtime{
 constructor(onEffects,onError,WorkerClass=root.Worker,timerAPI={}){
  this.onEffects=typeof onEffects==='function'?onEffects:()=>{};
  this.onError=typeof onError==='function'?onError:()=>{};
  this.WorkerClass=WorkerClass;
  this.setTimer=(callback,delay)=>timerAPI.setTimer?timerAPI.setTimer(callback,delay):root.setTimeout(callback,delay);
  this.clearTimer=handle=>timerAPI.clearTimer?timerAPI.clearTimer(handle):root.clearTimeout(handle);
  this.contextProvider=typeof timerAPI.contextProvider==='function'?timerAPI.contextProvider:null;
  this.serial=0;this.queue=[];this.current=null;this.worker=null;this.watchdog=null;this.enabled=false;this.context=contextOf();this.timers=new Map();
 }
 start(source,context={}){
  this.stop();
  if(typeof source!=='string'||source.length>MAX_SOURCE){this.onError('Script exceeds 64 KB.');return Promise.resolve(empty());}
  this.context=contextOf(context);this.enabled=true;
  try{this.worker=new this.WorkerClass('script-worker.js');}
  catch(error){this.fail('Script worker could not start: '+String(error?.message||error));return Promise.resolve(empty());}
  this.worker.onmessage=event=>this.result(event.data);
  this.worker.onerror=event=>{event.preventDefault?.();this.fail('Script failed: '+(event.message||'worker error'));};
  return this.enqueue('eval',source);
 }
 evaluate(source,context){if(!this.enabled)return this.start(source,context||this.context);return this.enqueue('eval',source,context);}
 dispatch(type,value='',context){
  if(!['send','line','gmcp','connect','disconnect','trigger','command'].includes(type))return Promise.resolve(empty());
  return this.enqueue(type,value,context);
 }
 setContextProvider(provider){this.contextProvider=typeof provider==='function'?provider:null;}
 enqueue(type,value='',context){
  if(!this.enabled)return Promise.resolve(empty());
  if(this.queue.length+(this.current?1:0)>=MAX_QUEUE){this.fail('Script stopped: event queue exceeded its limit.');return Promise.resolve(empty());}
  if(context!==undefined)this.context=contextOf(context);
  if(type==='trigger'){
   const trigger=value&&typeof value==='object'?value:{};
   value={name:label(trigger.name,80),text:label(trigger.text,MAX_VALUE),ranges:Array.isArray(trigger.ranges)?trigger.ranges.slice(0,32).map(x=>Number.isSafeInteger(x)?x:0):[]};
  }else value=String(value).slice(0,type==='eval'?MAX_SOURCE:MAX_VALUE);
  return new Promise(resolve=>{this.queue.push({id:++this.serial,type,value,context:this.context,resolve});this.next();});
 }
 next(){
  if(this.current||!this.worker||!this.queue.length)return;
  this.current=this.queue.shift();
  this.watchdog=this.setTimer(()=>this.fail('Script stopped: execution time limit exceeded.'),this.current.type==='eval'?1000:500);
  try{this.worker.postMessage({id:this.current.id,type:this.current.type,value:this.current.value,context:this.current.context});}
  catch{this.fail('Script worker rejected an event.');}
 }
 schedule(effect,context){
  if(this.timers.has(effect.id)||this.timers.size>=MAX_TIMERS)throw Error('Script timer limit exceeded.');
  const timer={...effect,context,handle:null};this.timers.set(effect.id,timer);
  const arm=()=>{timer.handle=this.setTimer(()=>{
   timer.handle=null;if(!this.enabled||this.timers.get(timer.id)!==timer)return;
   if(!timer.repeat)this.timers.delete(timer.id);
   let live=timer.context;
   if(this.contextProvider){try{live=contextOf(this.contextProvider());}catch(error){this.fail('Script timer context failed: '+String(error?.message||error));return;}}
   if(live.sessionId!==timer.context.sessionId){this.cancelTimer(timer.id);return;}
   this.enqueue('timer',timer.id,live).then(()=>{if(timer.repeat&&this.enabled&&this.timers.get(timer.id)===timer)arm();});
  },timer.delay);};
  arm();
 }
 cancelTimer(id){const timer=this.timers.get(id);if(!timer)return;this.clearTimer(timer.handle);this.timers.delete(id);}
 result(data){
  const job=this.current;if(!job||data?.id!==job.id)return;
  this.clearTimer(this.watchdog);this.watchdog=null;this.current=null;
  if(data.error){this.fail('Script error: '+String(data.error).slice(0,512));job.resolve(empty());return;}
  if(!Array.isArray(data.effects)||data.effects.length>MAX_EFFECTS){this.fail('Script action limit exceeded.');job.resolve(empty());return;}
  const effects=[];
  try{
   for(const raw of data.effects){const effect=validEffect(raw);if(!effect)continue;
    if(effect.type==='timer-start')this.schedule(effect,job.context);
    else if(effect.type==='timer-stop')this.cancelTimer(effect.id);
    else effects.push(effect);
   }
   if(effects.length)this.onEffects(effects,{type:job.type,context:job.context});
  }catch(error){this.fail('Script effect failed: '+String(error?.message||error));job.resolve(empty());return;}
  job.resolve({handled:data.handled===true,effects});this.next();
 }
 fail(message){this.stop();this.onError(message);}
 stop(){
  this.clearTimer(this.watchdog);this.watchdog=null;
  for(const timer of this.timers.values())this.clearTimer(timer.handle);
  this.timers.clear();this.worker?.terminate?.();this.worker=null;this.enabled=false;
  const jobs=[this.current,...this.queue];this.current=null;this.queue=[];
  for(const job of jobs)job?.resolve(empty());
 }
}
const api={Runtime,contextOf,validEffect};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BeipScripts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
