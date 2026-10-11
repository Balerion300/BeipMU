/* User-authored, opt-in scripts run in an isolated, disposable worker. MIT. */
'use strict';
(function(){
const post=postMessage.bind(self),MAX_EFFECTS=32,MAX_VALUE=8192,MAX_TIMERS=16;
let effects=[],context={},windowData=null,nextTimer=1,clientGMCP=null;
const hooks=new Map(),timers=new Map();
function emit(type,value){
 if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');
 value=String(value);if(value.length>MAX_VALUE)throw Error('Script output is too long.');
 effects.push({type,value});
}
function timerEffect(type,timer){if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');effects.push(type==='timer-start'?{type,id:timer.id,delay:timer.delay,repeat:timer.repeat}:{type,id:timer.id});}
function hook(name,fn,data){if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');if(fn===null)hooks.delete(name);else hooks.set(name,{fn,data});}
function call(name,...args){const item=hooks.get(name);return item?item.fn(...args,item.data)===true:false;}
function outputLine(type,value){emit(type,value);}
const output=Object.freeze({write:value=>outputLine('output',value),Write:value=>outputLine('output',value),writeHTML:value=>outputLine('html',value),WriteHTML:value=>outputLine('html',value)});
function collection(items){
 const list=Array.isArray(items)?items:[];
 const get=value=>typeof value==='number'?list[value]||null:list.find(item=>item.name?.toLocaleLowerCase()===String(value).toLocaleLowerCase())||null;
 const result=value=>get(value);result.Item=get;Object.defineProperty(result,'Count',{get:()=>list.length});return Object.freeze(result);
}
function characterObject(item){if(!item)return null;return Object.freeze({id:item.id,name:item.name,Name:item.name,info:item.notes||'',Info:item.notes||''});}
function worldObject(item){if(!item)return null;const characters=collection((item.characters||[]).map(characterObject));return Object.freeze({id:item.id,name:item.name,Name:item.name,host:item.host,Host:item.host,info:item.notes||'',Info:item.notes||'',characters,Characters:characters});}
function windowSummary(item){return Object.freeze({id:item.id,name:item.title,title:item.title,Title:item.title});}
const input=Object.freeze({
 Get:()=>context.input?.text||'',get:()=>context.input?.text||'',
 Set(value){value=String(value);if(value.length>MAX_VALUE)throw Error('Input text is too long.');if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');effects.push({type:'input-set',value});context.input={text:value,start:value.length,end:value.length};},
 set(value){return input.Set(value);},
 SetSel(start,end){const length=context.input?.text?.length||0;start=Number(start);end=Number(end);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))throw Error('Invalid input selection.');start=Math.max(0,Math.min(length,start));end=Math.max(start,Math.min(length,end));if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');effects.push({type:'input-select',start,end});context.input={...context.input,start,end};},
 GetSelStart:()=>context.input?.start||0,GetSelEnd:()=>context.input?.end||0,
 get Length(){return context.input?.text?.length||0;}
});
const connection={
 send(value){value=String(value);if(!call('send',value))emit('send',value);},
 Send(value){return connection.send(value);},
 transmit:value=>emit('send',value),Transmit:value=>emit('send',value),
 display:value=>emit('display',value),Display:value=>emit('display',value),
 SetOnSend:(fn,data)=>hook('send',fn,data),SetOnReceive:(fn,data)=>hook('receive',fn,data),
 SetOnGMCP:(fn,data)=>hook('gmcp',fn,data),
 SetOnConnect:(fn,data)=>hook('connect',fn,data),SetOnDisconnect:(fn,data)=>hook('disconnect',fn,data),
 IsConnected:()=>!!context.connected,IsLogging:()=>!!context.logging,
 isconnected:()=>!!context.connected,islogging:()=>!!context.logging,
 get World(){return worldObject(context.world);},get Character(){return characterObject(context.character);}
};
Object.freeze(connection);
const windowObject={output,Output:output,input,Input:input,connection,Connection:connection,
 SetOnCommand:(fn,data)=>hook('command',fn,data),Run:source=>{source=String(source);if(source.length>65536)throw Error('Script exceeds 64 KB.');return (0,eval)(source);},
 get UserData(){return windowData;},set UserData(value){windowData=value;},
 get userdata(){return windowData;},set userdata(value){windowData=value;},
 get Title(){return context.title||context.character?.name||context.world?.name||'';}};
Object.freeze(windowObject);
function newTimer(delay,fn,data,repeat){
 delay=Number(delay);
 if(!Number.isSafeInteger(delay)||delay<100||delay>3600000)throw Error('Timer interval must be 100–3600000 ms.');
 if(typeof fn!=='function')throw Error('Expected a timer callback.');
 if(timers.size>=MAX_TIMERS)throw Error('Script timer limit exceeded.');
 const timer={id:nextTimer++,delay,repeat,fn,data};timerEffect('timer-start',timer);timers.set(timer.id,timer);
 const result={get UserData(){return timer.data;},set UserData(value){timer.data=value;},Kill(){if(!timers.has(timer.id))return;timerEffect('timer-stop',timer);timers.delete(timer.id);}};
 return Object.freeze(result);
}
const app={
 CreateTimeout:(ms,fn,data)=>newTimer(ms,fn,data,false),
 CreateInterval:(ms,fn,data)=>newTimer(ms,fn,data,true),
 createtimeout:(ms,fn,data)=>newTimer(ms,fn,data,false),
 createinterval:(ms,fn,data)=>newTimer(ms,fn,data,true),
 get Worlds(){return collection(context.worlds.map(worldObject));},get worlds(){return collection(context.worlds.map(worldObject));},
 get Windows(){return collection(context.windows.map(windowSummary));},get windows(){return collection(context.windows.map(windowSummary));},
 OutputDebugText:value=>emit('debug',String(value).slice(0,512)),outputdebugtext:value=>emit('debug',String(value).slice(0,512)),
 get BuildNumber(){return Number(context.buildNumber)||0;},get buildnumber(){return Number(context.buildNumber)||0;}
};
Object.freeze(app);
const client=Object.freeze({send:connection.send,write:output.write,on:(name,fn)=>{
 if(name==='line')connection.SetOnReceive(fn);
 else if(name==='gmcp'){if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');clientGMCP=fn;}
 else if(name==='send')connection.SetOnSend(fn);
 else throw Error('Supported events: line, gmcp, send.');
}});
for(const [name,value] of [['window',windowObject],['app',app],['client',client]])Object.defineProperty(self,name,{value,writable:false,configurable:false});
// Keep all native I/O and scheduling behind the host's allowlisted effect bridge.
for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','BroadcastChannel','Worker','SharedWorker','setTimeout','setInterval','postMessage']){
 try{Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}catch{}
}
if(typeof self.postMessage==='function')throw Error('Script worker could not isolate messaging.');
function triggerRanges(values){
 const list=Array.isArray(values)?values:[];
 const at=index=>list[Number(index)]||0;at.Item=at;Object.defineProperty(at,'Count',{get:()=>list.length});return Object.freeze(at);
}
async function run(type,value){
 if(type==='eval'){const result=(0,eval)(String(value));if(result&&typeof result.then==='function')await result;return false;}
 if(type==='line')return call('receive',String(value));
 if(type==='send')return call('send',String(value));
 if(type==='gmcp'){
  const raw=String(value),item=hooks.get('gmcp');let handled=item?item.fn(raw,item.data)===true:false;
  if(clientGMCP){const at=raw.indexOf(' ');if(clientGMCP(at<0?raw:raw.slice(0,at),at<0?null:JSON.parse(raw.slice(at+1)))===true)handled=true;}
  return handled;
 }
 if(type==='connect'||type==='disconnect')return call(type);
 if(type==='command'){const raw=String(value).replace(/^\/(?!\/)/,''),space=raw.indexOf(' ');return call('command',space<0?raw:raw.slice(0,space),space<0?'':raw.slice(space+1));}
 if(type==='timer'){
  const timer=timers.get(Number(value));if(!timer)return false;
  if(!timer.repeat)timers.delete(timer.id);
  if(timer.fn(timer.data)===true&&timer.repeat){timers.delete(timer.id);timerEffect('timer-stop',timer);}
  return false;
 }
 if(type==='trigger'){
  const name=String(value?.name||'');if(!/^[A-Za-z_$][\w$]{0,79}$/.test(name))throw Error('Trigger script name is invalid.');
  const fn=self[name];if(typeof fn!=='function')throw Error('Trigger script '+name+' was not found.');
  const text=String(value?.text||'');
  const line=Object.freeze({string:text,length:text.length});
  return fn(windowObject,line,triggerRanges(value?.ranges))===true;
 }
 return false;
}
self.onmessage=async event=>{
 const {id,type,value}=event.data||{};effects=[];
 try{
  if(event.data?.context&&typeof event.data.context==='object')context=event.data.context;
  const handled=await run(type,value);
  post({id,handled,effects});
 }catch(error){
  // No partial commands or display updates escape a failed script event.
  effects=[];post({id,handled:false,effects,error:String(error?.message||error).slice(0,512)});
 }
};
})();
