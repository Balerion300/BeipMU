/* Supported window preferences. Original character/global overrides plus a world layer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipProfilePreferences=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const DEFAULTS=Object.freeze({fontSize:13,fontFamily:'monospace',theme:'dark',scrollback:10000,inlineImages:true,localEcho:false,defaultLogging:false,mediaEnabled:false,inputHeight:40});
const OUTPUT_KEYS=Object.freeze(['fontSize','fontFamily','scrollback','inlineImages']);
const INPUT_KEYS=Object.freeze(['localEcho','inputHeight']);
const groups={output:OUTPUT_KEYS,input:INPUT_KEYS};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
function valid(key,value){
 if(key==='fontFamily')return value==='system'||value==='monospace'?value:undefined;
 if(key==='inlineImages'||key==='localEcho')return typeof value==='boolean'?value:undefined;
 const bounds={fontSize:[10,30],scrollback:[100,20000],inputHeight:[40,300]}[key];
 return bounds&&typeof value==='number'&&Number.isFinite(value)?Math.max(bounds[0],Math.min(bounds[1],Math.round(value))):undefined;
}
function normalizeOverrides(raw){
 raw=object(raw);const result={};
 for(const [name,keys] of Object.entries(groups)){
  const group=object(raw[name]),values={};
  for(const key of keys){const value=valid(key,object(group.values)[key]);if(value!==undefined)values[key]=value;}
  result[name]={useParent:group.useParent!==false,values};
 }
 return result;
}
function resolve(global,world,character){
 const result={...DEFAULTS,...object(global)};
 for(const key of [...OUTPUT_KEYS,...INPUT_KEYS])result[key]=valid(key,result[key])??DEFAULTS[key];
 for(const profile of [world,character]){
  const overrides=normalizeOverrides(profile?.preferences);
  for(const group of Object.values(overrides))if(!group.useParent)Object.assign(result,group.values);
 }
 return result;
}
function sourceOf(key,world,character){
 const name=OUTPUT_KEYS.includes(key)?'output':INPUT_KEYS.includes(key)?'input':null;
 if(name)for(const [level,profile] of [['character',character],['world',world]]){
  const group=normalizeOverrides(profile?.preferences)[name];
  if(!group.useParent&&Object.hasOwn(group.values,key))return level;
 }
 return 'global';
}
return Object.freeze({DEFAULTS,OUTPUT_KEYS,INPUT_KEYS,normalizeOverrides,resolve,sourceOf});
});
