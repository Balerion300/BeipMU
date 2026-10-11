/* User-authored scripts run in an isolated, disposable worker. MIT. */
'use strict';
let effects=[],receiveCallback=null,gmcpCallback=null,receiveData=null;
const post=postMessage.bind(self);
function effect(type,value){if(effects.length>=32)throw Error('Script action limit exceeded.');value=String(value);if(value.length>8192)throw Error('Script output is too long.');effects.push({type,value});}
const output=Object.freeze({write:value=>effect('output',value),writeHTML:value=>effect('html',value)});
const connection=Object.freeze({send:value=>effect('send',value),display:value=>effect('output',value),SetOnReceive:(fn,data)=>{if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');receiveCallback=fn;receiveData=data;},SetOnGMCP:fn=>{if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');gmcpCallback=fn;}});
const client=Object.freeze({send:connection.send,write:output.write,on:(name,fn)=>{if(name==='line')connection.SetOnReceive(fn);else if(name==='gmcp')connection.SetOnGMCP(fn);else throw Error('Supported events: line, gmcp.');}});
Object.defineProperty(self,'window',{value:Object.freeze({connection,output}),writable:false,configurable:false});
Object.defineProperty(self,'client',{value:client,writable:false,configurable:false});
// This compatibility subset is synchronous and has no independent networking.
for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','BroadcastChannel','setTimeout','setInterval'])Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});
self.onmessage=async e=>{
 const {id,type,value}=e.data;effects=[];
 try{
  if(type==='eval'){const result=(0,eval)(String(value));if(result&&typeof result.then==='function')await result;}
  else if(type==='line'&&receiveCallback)receiveCallback(String(value),receiveData);
  else if(type==='gmcp'&&gmcpCallback){const at=String(value).indexOf(' ');gmcpCallback(at<0?String(value):String(value).slice(0,at),at<0?null:JSON.parse(String(value).slice(at+1)));}
  post({id,effects});
 }catch(error){post({id,effects:[],error:String(error?.message||error).slice(0,512)});}
};
