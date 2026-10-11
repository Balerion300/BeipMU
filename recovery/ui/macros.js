/* Keyboard macro matching. Pure data in, bounded effects out. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeipMacros=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const MAX_MACROS=128,MAX_TEXT=65536,MAX_COMMANDS=16,MAX_COMMAND=8192;
 const MODIFIERS=['Ctrl','Alt','Shift','Meta'];
 const KEY_ALIASES={control:'Ctrl',ctrl:'Ctrl',option:'Alt',alt:'Alt',shift:'Shift',meta:'Meta',command:'Meta',cmd:'Meta',esc:'Escape',escape:'Escape',return:'Enter',enter:'Enter',space:'Space',spacebar:'Space',pgup:'PageUp',pageup:'PageUp',pgdn:'PageDown',pagedown:'PageDown',up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',del:'Delete',delete:'Delete',ins:'Insert',insert:'Insert','[':'BracketLeft',']':'BracketRight'};
 const KEY_NAMES=new Set(['Tab','Enter','Escape','Space','Backspace','Delete','Insert','Home','End','PageUp','PageDown','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','BracketLeft','BracketRight','Backquote','Minus','Equal','Backslash','Semicolon','Quote','Comma','Period','Slash','Pause','PrintScreen','ScrollLock']);
 const RESERVED=new Set(['Ctrl+Tab','Ctrl+Shift+Tab','Ctrl+F4','Ctrl+BracketLeft','Ctrl+BracketRight','Ctrl+L','Ctrl+T','Ctrl+N','Ctrl+F','Ctrl+H','Ctrl+U','Ctrl+A','Ctrl+V','Ctrl+Shift+V','Ctrl+End','Ctrl+Home','Ctrl+PageUp','Ctrl+PageDown','Alt+Z','F1','Shift+F1','Enter','ArrowUp','ArrowDown']);
 for(let i=1;i<=9;i++)RESERVED.add('Alt+'+i);
 function keyName(value){
  if(typeof value!=='string'||!value)return null;
  const key=value.length===1?/^[a-z]$/i.test(value)?value.toUpperCase():/^[0-9]$/.test(value)?value:null:null;
  if(key)return key;
  if(/^Key[A-Z]$/.test(value))return value.slice(3);
  if(/^Digit[0-9]$/.test(value))return value.slice(5);
  if(/^Numpad[0-9]$/.test(value))return value;
  if(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(value))return value;
  if(KEY_NAMES.has(value))return value;
  const alias=KEY_ALIASES[value.toLowerCase()];
  return alias&& !MODIFIERS.includes(alias)?alias:null;
 }
 function normalizeCombo(value){
  if(value&&typeof value==='object'){
   const key=keyName(value.code)||keyName(value.key);
   if(!key)return null;
   return [...MODIFIERS.filter(mod=>({Ctrl:value.ctrlKey,Alt:value.altKey,Shift:value.shiftKey,Meta:value.metaKey})[mod]),key].join('+');
  }
  if(typeof value!=='string'||value.length>80)return null;
  const parts=value.split('+').map(x=>x.trim()).filter(Boolean),modifiers=new Set();let key=null;
  for(const part of parts){
   const alias=KEY_ALIASES[part.toLowerCase()];
   if(alias&&MODIFIERS.includes(alias)){if(modifiers.has(alias))return null;modifiers.add(alias);continue;}
   const resolved=keyName(part);if(!resolved||key)return null;key=resolved;
  }
  return key?[...MODIFIERS.filter(x=>modifiers.has(x)),key].join('+'):null;
 }
 function isEditableOtherThanCommand(target,inputElement){
  if(!target||typeof target!=='object')return false;
  if(String(target.type||'').toLowerCase()==='password')return true;
  if(target===inputElement)return false;
  if(target.isContentEditable||target.closest?.('[contenteditable="true"],[contenteditable=""]'))return true;
  const tag=String(target.tagName||'').toLowerCase();
  if(tag==='textarea'||tag==='select')return true;
  if(tag==='input'){const type=String(target.type||'text').toLowerCase();return type!=='button'&&type!=='submit'&&type!=='reset';}
  return false;
 }
 function applicable(rule,scope){
  const location=rule.scope||{level:'global'},level=typeof location==='string'?location:location.level||'global';
  if(level==='global')return 1;
  const serverId=scope.serverId||scope.worldId,characterId=scope.characterId||scope.charId;
  if(level==='server'&&serverId&&location.serverId===serverId)return 2;
  if(level==='character'&&serverId&&characterId&&location.serverId===serverId&&location.characterId===characterId)return 3;
  return 0;
 }
 function match(event,scope,macroarray){
  scope=scope||{};
  if(!event||event.defaultPrevented||event.type==='keyup'||event.repeat||event.isComposing||event.keyCode===229||['Dead','Process','Unidentified'].includes(event.key)||isEditableOtherThanCommand(event.target,scope.inputElement))return null;
  const key=normalizeCombo(event);if(!key||!Array.isArray(macroarray))return null;
  let selected=null,priority=0;
  for(const rule of macroarray.slice(0,MAX_MACROS)){
   if(!rule||rule.enabled===false||rule.folder||normalizeCombo(rule.key)!==key)continue;
   const rank=applicable(rule,scope);if(!rank||rank<=priority)continue;
   if((scope.reservedCombos?.has?.(key)??RESERVED.has(key))&&rule.overrideBuiltins!==true)continue;
   if(typeof rule.text!=='string'||rule.text.length>MAX_TEXT)continue;
   selected=rule;priority=rank;
  }
  if(!selected)return null;
  const mode=selected.mode==='type'||selected.type===true?'type':'send';
  if(mode==='type')return selected.text.length<=MAX_COMMAND?{commands:[],input:selected.text,macroId:String(selected.id||''),overrideBuiltins:selected.overrideBuiltins===true}:null;
  const commands=selected.text.split(/\r\n|\n|\r/);
  if(commands.length>MAX_COMMANDS||commands.some(x=>x.length>MAX_COMMAND))return null;
  return {commands,input:null,macroId:String(selected.id||''),overrideBuiltins:selected.overrideBuiltins===true};
 }
 return {normalizeCombo,match,RESERVED,MAX_MACROS,MAX_TEXT};
});
