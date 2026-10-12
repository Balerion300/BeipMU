/* Session-owned scheduling; only unexpanded templates cross the WebView bridge. */
(function(root,factory){const model=typeof module==='object'&&module.exports?require('./connect-template.js'):root.BeipConnectTemplate;const api=factory(model);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipConnectTemplates=api;})(typeof globalThis==='object'?globalThis:this,function(model){
'use strict';
const pending=new WeakMap();
function cancel(session){const run=pending.get(session);if(run){run.cancelled=true;for(const timer of run.timers)clearTimeout(timer);pending.delete(session);}}
function encoded(value){const bytes=new TextEncoder().encode(value);let s='';for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s);}
function start(session,character,post){
 cancel(session);const fields=model.normalize(character);
 if(!fields.connectTemplateEnabled||!fields.connectTemplateReviewed)return false;
 if(!session?.connected||session.characterId!==character.id||session.worldId!==character.worldId)throw Error('Connect string belongs to a different connection.');
 if(!session.tls&&!character.allowPlainLogin)throw Error('Automatic login needs TLS or explicit plain-connection permission.');
 const recipe=model.compile(fields.connectTemplate),epoch=session.connectionEpoch,run={timers:[],cancelled:false};pending.set(session,run);
 const loginName=character.loginName||character.name;
 for(const action of recipe.actions){
  const execute=()=>{if(run.cancelled||pending.get(session)!==run||!session.connected||session.connectionEpoch!==epoch)return;post('logintemplate|'+session.id+'|'+character.id+'|'+encoded(loginName)+'|'+encoded(action.text)+'|'+(session.tls?'tls':'allow-plain'));};
  if(action.delayMs)run.timers.push(setTimeout(execute,action.delayMs));else execute();
 }
 return true;
}
return Object.freeze({start,cancel});
});
