/* Allowlisted persistent profile data. Live credentials, history and transcripts stay out. */
(function(root,factory){
 const macros=typeof module==='object'&&module.exports?require('./macros.js'):root.BeipMacros;
 const mapper=typeof module==='object'&&module.exports?require('./mapper.js'):root.BeipMapper;
 const shortcuts=typeof module==='object'&&module.exports?require('./shortcut-model.js'):root.BeipShortcuts;
 const preferences=typeof module==='object'&&module.exports?require('./profile-preferences.js'):root.BeipProfilePreferences;
 const rules=typeof module==='object'&&module.exports?require('./rules.js'):root.BeipRules;
 const dock=typeof module==='object'&&module.exports?require('./dock-layout.js'):root.BeipDockLayout;
 const templates=typeof module==='object'&&module.exports?require('./connect-template.js'):root.BeipConnectTemplate;
 const logging=typeof module==='object'&&module.exports?require('./logging-model.js'):root.BeipLogging;
 const api=factory(macros,mapper,shortcuts,preferences,rules,dock,templates,logging);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeipProfiles=api;
})(typeof globalThis==='object'?globalThis:this,function(macros,mapper,shortcuts,profilePreferences,ruleModel,dock,templates,logging){
 'use strict';
 const DEFAULTS=profilePreferences.DEFAULTS;
 const ID=/^[A-Za-z0-9_-]{1,64}$/;
 function text(value,max){return typeof value==='string'?value.slice(0,max):'';}
 function number(value,defaultValue,min,max){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):defaultValue;}
 function bool(value){return value===true;}
 function normalizeCommandSettings(value,legacy=false){
  if(!value||typeof value!=='object')return {active:legacy,echo:!legacy,processCommands:false,sendUnknown:false,legacyVariableAliases:legacy};
  return {active:bool(value.active),echo:value.echo!==false,processCommands:bool(value.processCommands),sendUnknown:bool(value.sendUnknown),legacyVariableAliases:bool(value.legacyVariableAliases)};
 }
 function normalizeIdle(value){
  const minutes=Number(value?.minutes),command=value?.text;
  if(!Number.isSafeInteger(minutes)||minutes<0||minutes>1440||typeof command!=='string'||/[\r\n\x00]/.test(command)||new TextEncoder().encode(command).length>8192)return {enabled:false,minutes:1,text:''};
  return {enabled:value.enabled===true,minutes:Math.max(1,minutes),text:command};
 }
 function array(value,max){return Array.isArray(value)?value.slice(0,max):[];}
 function scopeOf(value,worlds,characters){
  const input=value&&typeof value==='object'?value:{},level=input.level||'global';
  if(level==='global')return {level:'global'};
  if(level==='server'&&worlds.has(input.serverId))return {level:'server',serverId:input.serverId};
  if(level==='character'){
   const character=characters.get(input.characterId);
   if(character&&character.worldId===input.serverId)return {level:'character',serverId:input.serverId,characterId:input.characterId};
  }
  return null;
 }
 function unique(items){
  const seen=new Set();
  return items.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
 }
 function normalizeSettings(raw){
  raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const worlds=unique(array(raw.worlds,128).map(item=>{
   if(!item||typeof item!=='object'||!ID.test(item.id))return null;
   const name=text(item.name,80).trim(),host=text(item.host,253).trim(),port=String(item.port??'').trim();
   if(!name||!host||/[\s|]/.test(host)||!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535)return null;
   return {id:item.id,name,host,port,tls:bool(item.tls),autoConnect:bool(item.autoConnect),openAtStartup:bool(item.openAtStartup),notes:text(item.notes,16384),...(item.dockLayout&&dock?{dockLayout:dock.normalize(item.dockLayout)}:{}),preferences:profilePreferences.normalizeOverrides(item.preferences)};
  }).filter(Boolean));
  const worldIds=new Set(worlds.map(x=>x.id));
  const characters=unique(array(raw.characters,512).map(item=>{
   if(!item||typeof item!=='object'||!ID.test(item.id)||!worldIds.has(item.worldId))return null;
   const name=text(item.name,80).trim();if(!name)return null;
   const candidate=text(item.loginName,128).trim(),loginName=/[\x00-\x1f\x7f]/.test(candidate)||new TextEncoder().encode(candidate).length>128?'':candidate;
   return {id:item.id,worldId:item.worldId,name,loginName,restore:(typeof module==='object'&&module.exports?require('./restore-model.js'):globalThis.BeipRestoreModel).normalizeCharacter(item.restore),logging:logging.normalizeCharacter(item.logging),...(item.idle?{idle:normalizeIdle(item.idle)}:{}),...templates.normalize(item),autoLogin:bool(item.autoLogin)&&!!loginName,
    allowPlainLogin:bool(item.allowPlainLogin),openAtStartup:bool(item.openAtStartup),autoConnect:bool(item.autoConnect),notes:text(item.notes,16384),variables:ruleModel.normalizeVariables(item.variables),...(item.dockLayout&&dock?{dockLayout:dock.normalize(item.dockLayout)}:{}),preferences:profilePreferences.normalizeOverrides(item.preferences)};
  }).filter(Boolean));
  const characterIds=new Map(characters.map(x=>[x.id,x]));
  const source=raw.preferences&&typeof raw.preferences==='object'?raw.preferences:{};
  const preferences={...profilePreferences.normalizeGlobal(source),shortcuts:shortcuts?.normalizeOverrides(source.shortcuts)||{}};
  function rules(input,kind){
   const sanitized=unique(ruleModel.normalizeHierarchy(array(input,128)).items.map(item=>{
    if(!item||typeof item!=='object'||!ID.test(item.id))return null;
    if(item.parentId&&!ID.test(item.parentId))return null;
    const scope=scopeOf(item.scope,worldIds,characterIds),match=text(item.match,128);
    if(!scope||(!match&&!item.folder))return null;
    const result={id:item.id,enabled:item.enabled!==false,scope,match,matchType:['simple','exact','wildcard','regex'].includes(item.matchType)?item.matchType:'simple',matchCase:bool(item.matchCase),stopProcessing:bool(item.stopProcessing)};
    result.description=text(item.description,80);
    result.parentId=ID.test(item.parentId)?item.parentId:'';result.folder=bool(item.folder);result.processChildren=item.processChildren!==false;
    result.phase=item.phase==='after'?'after':'before';
    if(kind==='alias'){result.replacement=text(item.replacement,65536);result.expandVariables=bool(item.expandVariables);}
    else{
     result.awayCondition=['away','present'].includes(item.awayCondition)?item.awayCondition:'';result.awayOnce=bool(item.awayOnce);result.oncePerLine=item.oncePerLine!==false;
     result.multiline=bool(item.multiline);result.multilineLines=number(item.multilineLines,0,0,9999);result.multilineMs=number(item.multilineMs,0,0,86400000);
     result.sendExpandVariables=bool(item.sendExpandVariables);result.filterExpandVariables=bool(item.filterExpandVariables);
     if(item.sound&&typeof item.sound==='object')result.sound={enabled:bool(item.sound.enabled),path:text(item.sound.path,1024)};
     if(item.speech&&typeof item.speech==='object')result.speech={enabled:bool(item.speech.enabled),wholeLine:bool(item.speech.wholeLine),text:text(item.speech.text,2048)};
     result.lineStart=bool(item.lineStart);result.lineEnd=bool(item.lineEnd);result.wholeWord=bool(item.wholeWord);
     result.scriptName=typeof item.scriptName==='string'&&/^[A-Za-z_$][\w$]{0,79}$/.test(item.scriptName)?item.scriptName:'';
     result.sendText=text(item.sendText,4096);result.gag=bool(item.gag);result.logGag=bool(item.logGag);
     result.sendOnClick=bool(item.sendOnClick);result.sendCaptureIndex=number(item.sendCaptureIndex,1,0,99);
     result.spawnTitle=text(item.spawnTitle,80);result.spawnGroup=text(item.spawnGroup,80);
     result.spawnCopy=bool(item.spawnCopy);result.spawnGagLog=bool(item.spawnGagLog);
     result.captureUntil=text(item.captureUntil,256);result.notify=bool(item.notify);
     result.captureOnlyChildren=bool(item.captureOnlyChildren);
     if(typeof item.filterText==='string')result.filterText=text(item.filterText,4096);
     result.cooldownMs=number(item.cooldownMs,0,0,86400000);result.once=bool(item.once);
     if(item.highlight&&typeof item.highlight==='object'){
      const h=item.highlight,highlight={wholeLine:bool(h.wholeLine)};
      for(const key of ['captureGroups','styleExplicit','colorWholeLine','styleWholeLine'])if(typeof h[key]==='boolean')highlight[key]=h[key];
      for(const key of ['color','background'])if(typeof h[key]==='string'&&/^(#[0-9a-f]{3,8}|[a-z]{1,24})$/i.test(h[key]))highlight[key]=h[key];
      for(const key of ['bold','italic','underline','strike'])if(h.styleExplicit){if(typeof h[key]==='boolean')highlight[key]=h[key];}else highlight[key]=bool(h[key]);
      result.highlight=highlight;
     }
    }
    return result;
   }).filter(Boolean));
   return ruleModel.normalizeHierarchy(sanitized).items;
  }
  const macroItems=unique(array(raw.macros,macros.MAX_MACROS).map(item=>{
   if(!item||typeof item!=='object'||!ID.test(item.id))return null;
   const scope=scopeOf(item.scope,worldIds,characterIds),key=macros.normalizeCombo(item.key),body=text(item.text,macros.MAX_TEXT);
   if(!scope||!key||!body)return null;
   return {id:item.id,enabled:item.enabled!==false,scope,key,mode:item.mode==='type'||item.type===true?'type':'send',text:body,overrideBuiltins:bool(item.overrideBuiltins),description:text(item.description,80)};
  }).filter(Boolean));
  const scriptSource=text(raw.scriptSource??raw.scripts?.source,65536);
  const scriptEnabled=bool(raw.scriptEnabled??raw.scripts?.enabled)&&!!scriptSource;
  const maps={};if(raw.maps&&typeof raw.maps==='object')for(const [id,value] of Object.entries(raw.maps).slice(0,16)){if(worldIds.has(id))try{maps[id]=mapper.normalize(value);}catch{}}
  return {version:2,worlds,characters,preferences,maps,commandSettings:normalizeCommandSettings(raw.commandSettings,raw.version===2||Array.isArray(raw.aliases)&&raw.aliases.length>0),aliases:rules(raw.aliases,'alias'),triggers:rules(raw.triggers,'trigger'),macros:macroItems,scriptSource,scriptEnabled};
 }
 function serializeSettings(state){return normalizeSettings(state);}
 function startupPlan(settings){
  const data=normalizeSettings(settings),plan=[],handled=new Set();
  for(const character of data.characters){
   if(!character.openAtStartup&&!character.autoConnect)continue;
   plan.push({worldId:character.worldId,characterId:character.id,connect:character.autoConnect});
   handled.add(character.worldId);
  }
  for(const world of data.worlds){
   if(handled.has(world.id))continue;
   if(world.autoConnect||world.openAtStartup)plan.push({worldId:world.id,characterId:'',connect:world.autoConnect});
  }
  return plan;
 }
 return {DEFAULTS,normalizeSettings,serializeSettings,startupPlan,normalizeIdle,normalizeCommandSettings};
});
