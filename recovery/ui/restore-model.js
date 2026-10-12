/* Recovery restore snapshots are structured data, never persisted DOM HTML. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipRestoreModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const DEFAULTS=Object.freeze({enabled:true,bufferKiB:256}),MAX_RECORD_BYTES=60*1024,MAX_PARTS=2048;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
function normalizeGlobal(raw){const value=object(raw),requested=typeof value.bufferKiB==='number'&&Number.isFinite(value.bufferKiB)?value.bufferKiB:256;return {enabled:value.enabled!==false,bufferKiB:Math.max(64,Math.min(4096,Math.ceil(requested/64)*64))};}
function normalizeCharacter(raw){return {enabled:object(raw).enabled!==false};}
function enabled(preferences,character){return normalizeGlobal(preferences?.restore).enabled&&normalizeCharacter(character?.restore).enabled;}
function text(value,max,label){if(typeof value!=='string'||value.length>max||value.includes('\0'))throw Error('Invalid restore '+label+'.');return value;}
function url(value){text(value,4096,'URL');let parsed;try{parsed=new URL(value);}catch{throw Error('Invalid restore URL.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Restore links require HTTP or HTTPS without embedded credentials.');return value;}
function style(raw){const value=object(raw),result={};for(const key of ['color','background'])if(value[key]!=null){const color=text(value[key],64,'color');if(!/^(?:#[\da-f]{3,8}|[a-z]{1,30}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\))$/i.test(color))throw Error('Invalid restore color.');result[key]=color;}for(const key of ['bold','italic','underline','strike'])if(typeof value[key]==='boolean')result[key]=value[key];return result;}
function link(raw){const value=object(raw);if(value.kind!=='url'&&value.kind!=='command')throw Error('Invalid restore link kind.');const result={kind:value.kind,value:value.kind==='url'?url(value.value):text(value.value,8192,'command link')};if(value.kind==='command'&&/[\r\n]/.test(result.value))throw Error('A restore command link cannot contain line breaks.');if(value.hint!=null)result.hint=text(value.hint,4096,'link hint');if(value.prompt===true)result.prompt=true;return result;}
function part(raw){const value=object(raw);if(value.type==='text'){const result={type:'text',text:text(value.text,32768,'text')};if(value.style!=null)result.style=style(value.style);if(value.link!=null)result.link=link(value.link);return result;}if(value.type==='image'){const result={type:'image',url:url(value.url),alt:text(value.alt??'',4096,'image description')};if(value.link!=null)result.link=link(value.link);for(const key of ['width','height'])if(value[key]!=null){if(!Number.isInteger(value[key])||value[key]<0||value[key]>4096)throw Error('Invalid restore image size.');result[key]=value[key];}return result;}throw Error('Invalid restore part.');}
function normalizeRecord(raw){
 const value=object(raw);if(value.v!==1)throw Error('Unknown restore record version.');if(!Number.isSafeInteger(value.time)||Math.abs(value.time)>8640000000000000)throw Error('Invalid restore record timestamp.');
 const result={v:1,kind:value.kind,time:value.time};
 if(value.kind==='line'){if(!Array.isArray(value.parts)||value.parts.length>MAX_PARTS)throw Error('Invalid restore line parts.');result.parts=value.parts.map(part);}
 else if(value.kind==='history'){result.text=text(value.text,8192,'history');if(/[\r\n]/.test(result.text))throw Error('A restore history item must be one line.');}
 else if(value.kind==='gmcp'){result.package=text(value.package,256,'GMCP package');if(!/^[a-z][a-z\d_]*(?:\.[a-z][a-z\d_]*)*$/i.test(result.package))throw Error('Invalid restore GMCP package.');result.data=text(value.data,32768,'GMCP data');if(result.data)try{JSON.parse(result.data);}catch{throw Error('Invalid restore GMCP JSON.');}}
 else if(value.kind!=='reset')throw Error('Unknown restore record kind.');
 if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_RECORD_BYTES)throw Error('Restore record exceeds 60 KiB.');return result;
}
function serialize(raw){return JSON.stringify(normalizeRecord(raw));}
function deserialize(source){if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_RECORD_BYTES)throw Error('Restore record exceeds 60 KiB.');let raw;try{raw=JSON.parse(source);}catch{throw Error('Invalid restore record JSON.');}return normalizeRecord(raw);}
return Object.freeze({DEFAULTS,MAX_RECORD_BYTES,MAX_PARTS,normalizeGlobal,normalizeCharacter,enabled,normalizeRecord,serialize,deserialize});
});
