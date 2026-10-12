/* Original logging commands, with one active log per recovery session. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipLoggingRuntime=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function handle(text,session,app=globalThis.BeipPreview){
 const match=/^\s*\/(log|logall|logtop|stoplogs|autolog)(?:\s+([\s\S]*))?$/i.exec(text);if(!match)return false;
 const command=match[1].toLowerCase();let file=(match[2]||'').trim();if(file.startsWith('"')&&file.endsWith('"'))file=file.slice(1,-1);
 const stop=()=>{session.logWanted=false;app.stopLogging?app.stopLogging(session):globalThis.chrome?.webview?.postMessage('logstop|'+session.id);};
 if(command==='stoplogs'){if(file)throw Error('Use /stoplogs without a filename.');stop();return true;}
 if(command==='log'&&!file){if(session.logging||session.logStarting)stop();else app.startLogging(session,'now');return true;}
 if(command==='autolog'){
  if(file)throw Error('Use /autolog without a filename.');const character=app.state.characters.find(c=>c.id===session.characterId),options=globalThis.BeipLogging.options(app.state.preferences,character);
  if(!options.fileName)throw Error('No reviewed automatic log filename is configured.');if(!session.logging)app.startLogging(session,'now');return true;
 }
 if(!file&&command==='logtop')throw Error('Use /logtop "filename".');
 if(!session.connected)throw Error('Connect before starting a log.');if(session.logging||session.logStarting)throw Error('Stop the current session log before starting another file.');
 if(file.length>1024||/[\r\n\x00]/.test(file))throw Error('Use a single log filename of at most 1,024 characters.');
 app.startLogging(session,command==='logall'?'beginning':command==='logtop'?'window':'now',file||undefined);return true;
}
return Object.freeze({handle});
});
