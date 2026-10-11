/* Documented client commands and session-owned timers. MIT. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeipClientCommands=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function words(source){
  const result=[];let value='',quote=null,started=false;
  for(const char of source){
   if(quote){if(char===quote)quote=null;else value+=char;started=true;}
   else if(char==='"'||char==="'"||char==='`'){quote=char;started=true;}
   else if(/\s/.test(char)){if(started){result.push(value);value='';started=false;}}
   else {value+=char;started=true;}
  }
  if(quote)throw new Error('Close the quoted parameter.');
  if(started)result.push(value);return result;
 }
 function duration(value,random=Math.random){
  const match=/^(\d+(?:\.\d+)?|\.\d+)(?:-(\d+(?:\.\d+)?|\.\d+))?([hms])$/i.exec(value);
  if(!match)throw new Error('Use a duration such as 2s, 3.5m, or 1-5s.');
  const scale={s:1000,m:60000,h:3600000}[match[3].toLowerCase()],first=Number(match[1])*scale,last=match[2]===undefined?first:Number(match[2])*scale;
  if(first<100||last<first||last>86400000)throw new Error('Delays must be between 0.1 seconds and 24 hours.');
  return Math.round(first+(last-first)*Math.max(0,Math.min(1,random())));
 }
 function createScheduler({setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now,random=Math.random,isAlive=()=>true,execute=()=>{},report=()=>{}}={}){
  const jobs=new Map();let nextId=1;
  function cancel(id){const job=jobs.get(Number(id));if(!job)return false;clearTimer(job.timer);jobs.delete(job.id);return true;}
  function cancelSession(sessionId){for(const job of [...jobs.values()])if(job.sessionId===sessionId)cancel(job.id);}
  function add(sessionId,interval,command,repeat=false){
   if(jobs.size>=64)throw new Error('At most 64 delayed commands may be pending.');
   if(typeof command!=='string'||!command||/[\r\n]/.test(command)||new TextEncoder().encode(command).length>8192)throw new Error('A delayed command must be one line, up to 8192 bytes.');
   if(command.trim().toLowerCase().startsWith('/delay'))throw new Error('A delayed command cannot create another delay.');
   duration(interval,()=>0);
   const job={id:nextId++,sessionId,interval,command,repeat,due:0,timer:null};
   function arm(){const wait=duration(interval,random);job.due=now()+wait;job.timer=setTimer(fire,wait);}
   function fire(){
    if(!jobs.has(job.id))return;
    if(!isAlive(sessionId)){cancel(job.id);report(sessionId,'Delayed command '+job.id+' canceled: session disconnected.');return;}
    if(!repeat)jobs.delete(job.id);
    try{execute(sessionId,command);}catch(error){cancel(job.id);report(sessionId,error.message);return;}
    if(repeat&&jobs.has(job.id))arm();
   }
   jobs.set(job.id,job);arm();return job.id;
  }
  function list(sessionId){return [...jobs.values()].filter(job=>sessionId===undefined||job.sessionId===sessionId).map(({id,sessionId,command,repeat,due})=>({id,sessionId,command,repeat,due}));}
  return {add,cancel,cancelSession,list};
 }
 function pasteLines(source,prefix='',suffix=''){
  if(typeof source!=='string'||source.length>262144)throw new Error('Paste text must be no larger than 256 KiB.');
  const lines=source.replace(/\r\n?/g,'\n').split('\n');if(lines.at(-1)==='')lines.pop();
  if(!lines.length||lines.length>500)throw new Error('Smart Paste accepts 1 to 500 lines.');
  if(/[\r\n]/.test(prefix+suffix))throw new Error('Prefix and suffix must each be one line.');
  return lines.map(line=>{const value=prefix+line+suffix;if(new TextEncoder().encode(value).length>8192)throw new Error('A pasted command exceeds 8192 bytes.');return value;});
 }
 const browser=typeof window==='object'&&typeof document==='object';
 const getApi=()=>browser?window.BeipPreview:null;
 function display(session,text){const api=getApi();if(!api||!session||api.sessions.get(session.id)!==session)return;const old=session.suppressAutomation;session.suppressAutomation=true;api.appendText(session,text+'\n',{color:'#a6c9d5'});session.suppressAutomation=old;}
 const scheduler=createScheduler({
  isAlive:id=>{const session=getApi()?.sessions.get(id);return !!session?.connected;},
  execute:(id,value)=>{const api=getApi(),session=api.sessions.get(id);if(session)api.command(value,false,session);},
  report:(id,value)=>display(getApi()?.sessions.get(id),value)
 });
 let pasteDialog=null,pasteJob=null;
 function cancelPaste(sessionId){if(pasteJob&&(!sessionId||pasteJob.sessionId===sessionId)){clearTimeout(pasteJob.timer);pasteJob=null;}}
 function closed(session){scheduler.cancelSession(session.id);cancelPaste(session.id);}
 function incoming(session,payload){if(payload==='ended:'||payload==='reset:')closed(session);}
 function handle(value,session){
  if(!browser||typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return false;
  const match=/^(\/\S+)(?:\s+([\s\S]*))?$/.exec(value);if(!match)return false;
  const name=match[1].toLowerCase(),arg=match[2]||'',api=getApi();
  try{
   if(name==='/delay'){
    const args=words(arg),option=(args[0]||'').toLowerCase();
    if(option==='list'){const jobs=scheduler.list(session.id);display(session,jobs.length?jobs.map(job=>job.id+': '+(job.repeat?'every ':'')+Math.max(0,Math.ceil((job.due-Date.now())/1000))+'s '+job.command).join('\n'):'No delayed commands.');}
    else if(option==='killall'){scheduler.cancelSession(session.id);display(session,'Delayed commands canceled for this session.');}
    else if(option==='kill'){const job=scheduler.list(session.id).find(job=>String(job.id)===args[1]);display(session,job&&scheduler.cancel(job.id)?'Delayed command canceled.':'No such delayed command in this session.');}
    else {const repeat=option==='every',offset=repeat?1:0;if(args.length!==offset+2)throw new Error('Use /delay [every] 2s "command", list, kill ID, or killall.');if(!session.connected)throw new Error('Connect before scheduling commands.');const id=scheduler.add(session.id,args[offset],args[offset+1],repeat);display(session,'Delayed command '+id+' scheduled.');}
   }
   else if(name==='/setinput'){document.getElementById('input').value=arg.slice(0,8192);document.getElementById('input').focus();}
   else if(name==='/recall'){const lines=session.history.filter(line=>!arg||line.toLowerCase().includes(arg.toLowerCase()));display(session,lines.slice(-100).join('\n')||'No matching input history.');}
   else if(name==='/chars'){const names=api.state.characters.filter(c=>c.worldId===session.worldId).map(c=>c.name);display(session,names.join('\n')||'No saved characters in this world.');}
   else if(name==='/connectioninfo'){display(session,(session.connected?'Connected':'Disconnected')+' · '+(session.host||api.state.worlds.find(w=>w.id===session.worldId)?.host||'Unknown host')+':'+(session.port||api.state.worlds.find(w=>w.id===session.worldId)?.port||'?')+' · '+(session.tls?'TLS with system certificate validation':'Plain TCP'));}
   else if(name==='/new')window.BeipDesktopShell?.handle('ui:file-new');
   else if(name==='/connect'){
    const args=words(arg),world=args.length&&api.state.worlds.find(w=>w.name.toLowerCase()===args[0].toLowerCase());
    if(!world)return false;
    if(args.length>2)throw new Error('Use /connect "world name" "character name".');
    const character=args[1]?api.state.characters.find(c=>c.worldId===world.id&&c.name.toLowerCase()===args[1].toLowerCase()):null;
    if(args[1]&&!character)throw new Error('No such saved character in this world.');
    api.connectSession(world.host,String(world.port),world.id,character?.id||'',world.tls);
   }
   else if(name==='/close')api.closeSession(session.id);
   else if(name==='/reconnect'){const world=api.state.worlds.find(w=>w.id===session.worldId);if(world)api.connectSession(world.host,String(world.port),world.id,session.characterId,world.tls);else if(session.host&&session.port)api.connectSession(session.host,String(session.port),'','',session.tls);else throw new Error('No previous connection for this tab.');}
   else if(name==='/ansireset'){session.parser?.sgr('0');}
   else if(name==='/receive'){const old=session.suppressAutomation;try{session.parser?.feed(arg+'\n');}finally{session.suppressAutomation=old;}}
   else if(name==='/disconnect'&&arg.trim().toLowerCase()==='all')document.getElementById('disconnectAll').click();
   else if(name==='/echo'&&/^(on|off)$/i.test(arg.trim())){api.state.preferences.localEcho=arg.trim().toLowerCase()==='on';api.saveSettings();}
   else if(name==='/naws'){const parts=words(arg);if(parts.length!==2||!parts.every(part=>/^\d{1,4}$/.test(part)&&Number(part)>=1&&Number(part)<=4096))throw new Error('Use /naws width height (1–4096).');window.chrome?.webview?.postMessage('resize|'+session.id+'|'+parts.join('|'));}
   else if(name==='/switchtab'){const text=words(arg)[0]||'',tabs=[...api.sessions.values()],target=/^\d+$/.test(text)?tabs[Number(text)-1]:tabs.find(tab=>tab.label.toLowerCase()===text.toLowerCase()||api.state.worlds.find(w=>w.id===tab.worldId)?.name.toLowerCase()===text.toLowerCase());if(!target)throw new Error('Use /switchtab number or tab name.');api.selectSession(target.id);}
   else if(name==='/smartpaste')smartPaste();
   else if(name==='/capturecancel'){
    const scope={serverId:session.worldId,characterId:session.characterId};
    if(session.ruleRuntime)session.ruleRuntime.cancelCapture(scope).then(result=>display(session,result.cancelled?'Spawn capture canceled.':'No active spawn capture.'));
    else display(session,session.ruleEngine?.cancelCapture(scope)?.cancelled?'Spawn capture canceled.':'No active spawn capture.');
   }
   else if(name==='/logall'){if(arg.trim())throw new Error('Use /logall without a filename; this preview saves in its Logs folder.');if(!session.connected)throw new Error('Connect before starting a log.');if(session.logging)throw new Error('A log is already running for this session.');api.startLogging?.(session,true);}
   else return false;
  }catch(error){display(session,error.message);}
  return true;
 }
 function smartPaste(){
  if(!browser)return;
  if(!pasteDialog){
   pasteDialog=document.createElement('dialog');pasteDialog.id='smartPasteDialog';pasteDialog.style.width='560px';
   pasteDialog.innerHTML='<form><div class="dialog-head"><h2>Smart Paste</h2></div><label>Text to send<textarea id="smartPasteText" rows="10" spellcheck="false"></textarea></label><label>Load a text file<input id="smartPasteFile" type="file" accept="text/plain,.txt,.mush,.mu"></label><div class="settings-grid"><label>Prefix<input id="smartPastePrefix" maxlength="1024"></label><label>Suffix<input id="smartPasteSuffix" maxlength="1024"></label><label>Delay between lines (ms)<input id="smartPasteDelay" type="number" min="100" max="10000" value="250"></label></div><label class="check"><input id="smartPasteAliases" type="checkbox"> Process aliases and client commands</label><p id="smartPasteStatus" role="status">Paste clipboard text into the box or choose a text file.</p><div class="dialog-actions"><button id="smartPasteStop" type="button">Stop</button><button id="smartPasteClose" type="button">Close</button><button type="submit">Send</button></div></form>';
   document.body.append(pasteDialog);
   const byId=id=>document.getElementById(id),status=text=>{byId('smartPasteStatus').textContent=text;};
   byId('smartPasteFile').onchange=async()=>{const file=byId('smartPasteFile').files[0];if(!file)return;if(file.size>262144){status('Choose a file no larger than 256 KiB.');return;}try{byId('smartPasteText').value=await file.text();status('File loaded. Review the text before sending.');}catch{status('The file could not be read.');}};
   byId('smartPasteClose').onclick=()=>pasteDialog.close();
   byId('smartPasteStop').onclick=()=>{cancelPaste();status('Paste stopped.');};
   pasteDialog.querySelector('form').onsubmit=event=>{
    event.preventDefault();const api=getApi(),session=api.current;
    try{
     if(session?.kind!=='world'||!session.connected)throw new Error('Select a connected world before sending.');
     const lines=pasteLines(byId('smartPasteText').value,byId('smartPastePrefix').value,byId('smartPasteSuffix').value),delay=Number(byId('smartPasteDelay').value);
     if(!Number.isFinite(delay)||delay<100||delay>10000)throw new Error('Choose a delay from 100 to 10000 milliseconds.');
     cancelPaste();const job=pasteJob={sessionId:session.id,timer:null,index:0};const process=byId('smartPasteAliases').checked;
     function next(){if(pasteJob!==job)return;if(api.sessions.get(session.id)!==session||!session.connected){cancelPaste();status('Paste stopped: session disconnected.');return;}const line=lines[job.index++];if(process)api.command(line,false,session);else api.sendRaw(session,line);status('Sent '+job.index+' of '+lines.length+' lines.');if(job.index<lines.length)job.timer=setTimeout(next,delay);else pasteJob=null;}
     next();
    }catch(error){status(error.message);}
   };
  }
  if(!pasteDialog.open)pasteDialog.showModal();document.getElementById('smartPasteText').focus();
 }
 return {words,duration,createScheduler,pasteLines,handle,closed,incoming,smartPaste,scheduler};
});
