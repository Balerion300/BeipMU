/* Connect templates remain credential-free until expansion inside the native host. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipConnectTemplate=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const MAX_TEXT=4096,MAX_ACTIONS=16,MAX_DELAY=60000;
function compile(source){
 if(typeof source!=='string'||source.length>MAX_TEXT||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(source))throw Error('Use up to 4,096 characters of plain command text.');
 const text=source.replace(/\r\n?/g,'\n'),actions=[];
 for(const raw of text.split('\n')){
  if(!raw.trim())continue;let command=raw,delayMs=0;
  if(/^\s*\/delay\s/i.test(command)){
   const match=/^\s*\/delay\s+(\d+(?:\.\d+)?)(ms|s|m)?\s+"((?:[^"\\]|\\["\\])*)"\s*$/i.exec(command);
   if(!match)throw Error('A delay must use /delay 3s "command".');
   delayMs=Math.round(Number(match[1])*({ms:1,s:1000,m:60000}[(match[2]||'s').toLowerCase()]));
   if(delayMs>MAX_DELAY)throw Error('Each connect delay must be at most 60 seconds.');
   command=match[3].replace(/\\(["\\])/g,'$1');
  }
  if(/^\s*\//.test(command))throw Error('Connect templates support server commands and /delay; other client commands need a startup script.');
  if(/%(?!NAME%|PASSWORD%)[A-Za-z_][A-Za-z0-9_]*%/.test(command))throw Error('Connect template tokens are %NAME% and %PASSWORD% (case-sensitive).');
  actions.push({text:command,delayMs});if(actions.length>MAX_ACTIONS)throw Error('Use at most 16 connect commands.');
 }
 if(!actions.length)throw Error('Enter at least one connect command.');
 return {text,actions,needsPassword:actions.some(action=>action.text.includes('%PASSWORD%'))};
}
function normalize(profile){
 const result={connectTemplate:'',connectTemplateEnabled:false,connectTemplateReviewed:false};
 try{const recipe=compile(profile?.connectTemplate);result.connectTemplate=recipe.text;result.connectTemplateReviewed=profile.connectTemplateReviewed===true;result.connectTemplateEnabled=profile.connectTemplateEnabled===true&&result.connectTemplateReviewed;}catch{}
 return result;
}
function importOriginal(source,password){
 if(!source)return {fields:null,reason:''};
 if(typeof source!=='string'||!/%(?:NAME|PASSWORD)%/.test(source))return {fields:null,reason:'Connect strings without credential placeholders omitted'};
 if(typeof password==='string'&&password&&source.includes(password))return {fields:null,reason:'Connect strings containing a saved password omitted'};
 try{return {fields:{connectTemplate:compile(source).text,connectTemplateEnabled:false,connectTemplateReviewed:false},reason:''};}
 catch{return {fields:null,reason:'Connect strings requiring other original commands omitted'};}
}
return Object.freeze({MAX_TEXT,MAX_ACTIONS,MAX_DELAY,compile,normalize,importOriginal});
});
