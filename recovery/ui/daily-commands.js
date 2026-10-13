/* Bounded original client commands. All host effects use explicit owner ports. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipDailyCommands=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Commands.cpp WordList splits only spaces; a quote is special only at a word start.
function words(text){const out=[];for(let i=0;i<text.length;i++){if(text[i]===' ')continue;let delimiter=' ';if(['"',"'",'`'].includes(text[i])){delimiter=text[i];if(++i===text.length)return out;}let end=text.indexOf(delimiter,i);if(end<0)end=text.length;out.push(text.slice(i,end));i=end;}return out;}
function findString(value){let lineStart=false,lineEnd=false;if(value.startsWith('*')){lineEnd=true;value=value.slice(1);}if(value.endsWith('*')){lineStart=true;value=value.slice(0,-1);}if(!value||value.length>128)throw Error('Gag: Invalid Gag String (maximum 128 characters).');if(lineStart&&lineEnd)lineStart=lineEnd=false;return {match:value,matchType:'simple',matchCase:false,lineStart,lineEnd,wholeWord:false};}
function sameFind(rule,find){return !rule.parentId&&(typeof rule.scope==='string'?rule.scope:rule.scope?.level||'global')==='global'&&(!rule.matchType||rule.matchType==='simple')&&rule.match===find.match&&!!rule.matchCase===find.matchCase&&!!rule.lineStart===find.lineStart&&!!rule.lineEnd===find.lineEnd&&!rule.wholeWord;}
function createCommands(ports){
 const grabs=new WeakMap();let serial=0;
 const known=new Set(['/repeat','/gag','/grab','/tabcolor','/resetscript']);
 const check=(owner,epoch,execution)=>{if(!ports.valid(owner,epoch)||!execution?.isCurrent())throw Error('Command owner or connection changed.');};
 async function handle(value,owner,execution,options={}){
  const tokens=words(value),name=(tokens[0]||'').toLowerCase();if(!known.has(name))return false;
  const epoch=ports.epoch(owner),say=message=>{check(owner,epoch,execution);ports.display(owner,message);};
  check(owner,epoch,execution);
  if(name==='/repeat'){
   if(tokens.length!==3||!/^\d+$/.test(tokens[1])||!Number.isSafeInteger(Number(tokens[1]))){say("Usage: '/repeat {count} {command}' (quote a command containing spaces)");return true;}
   const count=Number(tokens[1]);if(count>64){say('Repeat is limited to 64 iterations and the shared command budget.');return true;}
   for(let i=0;i<count;i++){check(owner,epoch,execution);await execution.run(owner,tokens[2],{source:'repeat'});}return true;
  }
  if(name==='/gag'){
   if(tokens.length!==2){say('Usage: /gag (text to search for)');return true;}
   let find;try{find=findString(tokens[1]);}catch(error){say(error.message);return true;}
   const rules=ports.triggers(),existing=rules.find(rule=>sameFind(rule,find));
   if(!existing&&rules.length>=128){say('The trigger limit is 128.');return true;}
   if(existing)existing.gag=true;else{let id;do{id='gag'+(++serial).toString(36);}while(rules.some(rule=>rule.id===id));rules.unshift({id,...find,gag:true,enabled:true,scope:{level:'global'},phase:'before',oncePerLine:false});}
   // Updating the rule tree invalidates pending old-tree continuations at the host.
   if(!options.silent){if(existing)say('Gag: Trigger already exists, enabling gag on existing trigger');say('Gag: Trigger Activated');}
   ports.saveRules(owner);return true;
  }
  if(name==='/grab'){
   if(tokens.length!==2){say('Usage: /grab (object)/(property to grab)');return true;}
   const at=tokens[1].indexOf('/');if(at<0){say('Grab: Missing / in param, type /grab for help');return true;}
   const object=tokens[1].slice(0,at),property=tokens[1].slice(at+1),prefix=ports.grabPrefix();
   if(!/^[0-9a-fA-F]{8} $/.test(prefix))throw Error('Invalid grab prefix.');
   const command='@pemit me='+prefix+'&'+property+' '+object+'=[get('+object+'/'+property+')]';
   if(/[\r\n\0]/.test(command)||command.length>4096){say('Grab command must fit one bounded line.');return true;}
   if(!ports.connected(owner)){say('Connect before grabbing a property.');return true;}
   const pending={prefix,epoch};grabs.set(owner,pending);
   try{await ports.send(owner,command,execution);}catch(error){if(grabs.get(owner)===pending)grabs.delete(owner);throw error;}return true;
  }
  if(name==='/tabcolor'){
   const character=ports.character(owner);if(!character||owner.puppetId)return true;
   const color=tokens.length===2?ports.parseColor(tokens[1]):'#ffffff';
   if(color!==null&&!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid parsed tab color.');
   character.tabColor=color||'#ffffff';ports.saveSettings();ports.refreshTabs();return true;
  }
  // Original destroys one process-wide scripter. Recovery deliberately keeps session isolation.
  const runtime=ports.scripts(owner);
  if(runtime?.enabled){runtime.stop();say('Scripting Engine Reset');}else say("Can't reset scripting engine as it's not running");
  return true;
 }
 function captureGrab(owner,text,{replay=false}={}){const pending=grabs.get(owner);if(!pending)return false;if(!ports.valid(owner,pending.epoch)){grabs.delete(owner);return false;}if(replay||typeof text!=='string'||!text.startsWith(pending.prefix))return false;grabs.delete(owner);if(text.length-pending.prefix.length>8192){ports.display(owner,'Grab response exceeds the input limit.');return true;}ports.setInput(owner,text.slice(pending.prefix.length));return true;}
 function previewGrab(owner,text){const pending=grabs.get(owner);return !!pending&&ports.valid(owner,pending.epoch)&&typeof text==='string'&&(pending.prefix.startsWith(text)||text.startsWith(pending.prefix));}
 function closed(owner){grabs.delete(owner);}
 return {handle,captureGrab,previewGrab,closed};
}
return {words,findString,sameFind,createCommands};
});
