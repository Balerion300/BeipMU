/* Independent implementation of the documented BeipMU GMCP packages. MIT. */
(function(root){
'use strict';
const MAX_PANES=16,MAX_VALUES=256,MAX_IDS=512;
function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function object(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function color(value){if(typeof value!=='string')return null;if(/^(#[a-f\d]{3,8}|transparent)$/i.test(value))return value;const m=/^ansi256\((\d{1,3})\)$/i.exec(value);if(!m)return null;const n=Number(m[1]);if(n>255)return null;const basic=['#000000','#800000','#008000','#808000','#000080','#800080','#008080','#c0c0c0','#808080','#ff0000','#00ff00','#ffff00','#0000ff','#ff00ff','#00ffff','#ffffff'];if(n<16)return basic[n];if(n>=232){const v=8+(n-232)*10;return `rgb(${v},${v},${v})`;}const v=n-16,l=[0,95,135,175,215,255];return `rgb(${l[Math.floor(v/36)]},${l[Math.floor(v/6)%6]},${l[v%6]})`;}
class State{
 constructor(){this.panes=new Map();this.ids=new Map();this.nextLine=null;this.requests=new Set();}
 receive(message){
  if(typeof message!=='string'||message.length>65536)return {error:'GMCP message is too large.'};
  const at=message.indexOf(' '),name=(at<0?message:message.slice(0,at)).toLowerCase();let data;
  try{data=at<0?null:JSON.parse(message.slice(at+1));}catch{return {error:'Invalid GMCP JSON.'};}
  if(name==='beip.stats'){
   if(!object(data))return {error:'Invalid stats package.'};
   for(const [title,update] of Object.entries(data).slice(0,MAX_PANES)){
    if(title.length>128)continue;
    if(update===null){this.panes.delete(title);continue;}
    if(!object(update))continue;
    let pane=this.panes.get(title);if(!pane){if(this.panes.size>=MAX_PANES)continue;pane={title,values:new Map(),background:null};this.panes.set(title,pane);}
    if('background-color' in update)pane.background=color(update['background-color']);
    if(update.values===null)pane.values.clear();
    else if(object(update.values))for(const [key,value] of Object.entries(update.values).slice(0,MAX_VALUES)){
     if(key.length>256)continue;
     if(value===null||(object(value)&&Object.keys(value).length===0)){pane.values.delete(key);continue;}
     if(!object(value))continue;
     if(!pane.values.has(key)&&pane.values.size>=MAX_VALUES)continue;
     const previous=pane.values.get(key)||{};const next={...previous};
     for(const property of ['prefix-length','color','name-color','value-color','name-alignment'])if(property in value)next[property]=value[property];
     for(const kind of ['int','string','range','progress'])if(kind in value){next.kind=kind;next.value=object(value[kind])?{...(previous.kind===kind&&object(previous.value)?previous.value:{}),...value[kind]}:value[kind];}
     if(next.kind)pane.values.set(key,next);
    }
   }
   return {stats:true};
  }
  if(name==='beip.ids'){
   if(!object(data))return {error:'Invalid avatar package.'};
   for(const [id,value] of Object.entries(data).slice(0,MAX_IDS)){
    if(id.length>128)continue;
    if(value===null){this.ids.delete(id);this.requests.delete(id);continue;}
    if(!object(value))continue;
    if(!this.ids.has(id)&&this.ids.size>=MAX_IDS)this.ids.delete(this.ids.keys().next().value);
    const entry={...this.ids.get(id)};
    if('url' in value)entry.url=safeURL(value.url);
    if('click-url' in value)entry.clickURL=safeURL(value['click-url']);
    if('hover-text' in value)entry.hint=String(value['hover-text']).slice(0,2048);
    this.ids.set(id,entry);this.requests.delete(id);
   }
   return {avatars:true};
  }
  if(name==='beip.line.image-url'&&typeof data==='string'){this.nextLine={url:safeURL(data)};return {line:true};}
  if(name==='beip.line.id'&&typeof data==='string'&&data.length<=128){this.nextLine={id:data};if(!this.ids.has(data)&&!this.requests.has(data)){
   if(this.requests.size>=MAX_IDS)this.requests.delete(this.requests.values().next().value);
   this.requests.add(data);return {line:true,send:'beip.id.request '+JSON.stringify(data)};
  }return {line:true};}
  return {};
 }
 takeLine(){const value=this.nextLine;this.nextLine=null;return value;}
 avatar(value){return value?.id?this.ids.get(value.id)||null:value;}
 rows(){return [...this.panes.values()].map(p=>({title:p.title,background:p.background,rows:[...p.values].sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>{
  const prefix=Math.max(0,Math.min(key.length,Number(v['prefix-length'])||0));let text='',fraction=null,fill=null,empty=null;
  if(v.kind==='string')text=String(v.value).slice(0,4096);
  if(v.kind==='int')text=Number.isFinite(Number(v.value))?String(Math.trunc(Number(v.value))):'';
  if(v.kind==='range'&&object(v.value)){const min=Number(v.value.min)||0,max=Number(v.value.max)||0,n=Number(v.value.value)||0;text=String(n)+' / '+String(max);fraction=max>min?Math.max(0,Math.min(1,(n-min)/(max-min))):0;fill=color(v.value['fill-color']||v.value['bar-fill']);empty=color(v.value['empty-color']);}
  if(v.kind==='progress'&&object(v.value)){text=String(v.value.label||'').slice(0,4096);fraction=Math.max(0,Math.min(1,Number(v.value.value)||0));fill=color(v.value['fill-color']);empty=color(v.value['empty-color']);}
  return {key,name:key.slice(prefix),text,fraction,fill,empty,color:color(v.color),nameColor:color(v['name-color']),valueColor:color(v['value-color']),alignment:['left','right','center'].includes(v['name-alignment'])?v['name-alignment']:'left'};
 })}));}
}
const api={State,color,safeURL};if(typeof module!=='undefined')module.exports=api;else root.BeipGMCP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
