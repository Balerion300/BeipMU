/* Loopback-only packaged acceptance for original client commands. */
(function(){
'use strict';
async function run(app=window.BeipPreview,config={}){
 if(!window.BeipCoreTesting)throw Error('Command fixture requires test mode.');
 const alpha=app.sessions.get('alpha'),beta=app.sessions.get('beta');if(!alpha?.connected||!beta?.connected)throw Error('Two connected loopback sessions are required.');
 const clone=x=>JSON.parse(JSON.stringify(x)),state=app.state,selected=app.current.id,character=state.characters.find(item=>item.id===alpha.characterId&&item.worldId===alpha.worldId);
 const saved={commandSettings:state.commandSettings,aliases:clone(state.aliases),triggers:clone(state.triggers),alpha:{...app.variablesForSession(alpha)},beta:{...app.variablesForSession(beta)},dump:alpha.gmcpDump,idle:character.idle&&clone(character.idle)};
 const result={error:''},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Command check failed: '+key);};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),wait=async(fn,label)=>{const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await pause(25);}};
 const feed=async(session,text)=>{session.parser.feed(text+'\r\n');await session.pendingLineWork;};
 let newTab;
 try{
  check('persistedIdleLoaded',config.phase!=='persist'||saved.idle?.enabled===false&&saved.idle?.minutes===1&&saved.idle?.text==='command-idle-persisted');
  state.commandSettings={active:true,echo:false,processCommands:true,sendUnknown:false,legacyVariableAliases:false};state.triggers=[];state.aliases=[alpha,beta].map((session,index)=>({id:'command-wall-'+session.id,match:'command-fixture-wall',matchType:'exact',scope:{level:'character',serverId:session.worldId,characterId:session.characterId},replacement:'command-wall-'+session.id+'\n/set commandWallSeen='+session.id}));app.rebuildRules();
  app.selectSession(beta.id);await app.command('/newtab',false,alpha);newTab=app.current;
  check('newTab',newTab!==alpha&&newTab!==beta&&newTab.kind==='world'&&!newTab.connected);app.closeSession(newTab.id);newTab=null;app.selectSession(beta.id);
  const world=state.worlds.find(item=>item.id===alpha.worldId),beforeSessions=app.sessions.size;
  await app.command('/world "'+world.name+'" "command-fixture-missing-character"',false,alpha);
  check('worldValidation',app.sessions.size===beforeSessions&&alpha.view.textContent.includes('No such saved character in this world.'));
  await feed(alpha,'COMMAND KEEP\r\nCOMMAND REMOVE');await app.command('/removelast',false,alpha);
  const liveRows=[...alpha.view.querySelectorAll('.line:not([data-restore-replay])')].map(line=>line.textContent);
  check('removeOwnerLastLine',liveRows.includes('COMMAND KEEP')&&!liveRows.some(text=>text.includes('COMMAND REMOVE'))&&app.current===beta);
  await app.command('/gmcp dump_on',false,alpha);
  await app.command('/receivegmcp Beip.Stats {"Command fixture":{"values":{"Health":{"int":99}}}}',false,alpha);
  check('receiveGMCP',alpha.gmcp.panes.get('Command fixture')?.values.get('Health')?.value===99&&!beta.gmcp.panes.has('Command fixture'));
  check('receivedDump',alpha.view.textContent.includes('GMCP Received: Beip.Stats')&&!beta.view.textContent.includes('GMCP Received: Beip.Stats'));
  const outgoing='Core.Ping {"commandFixture":true}';window.chrome.webview.postMessage('gmcp|alpha|'+btoa(outgoing));
  await wait(()=>alpha.view.textContent.includes('GMCP Sent: '+outgoing),'accepted native GMCP dump');check('sentDump',true);
  await app.command('/gmcp dump_off',false,alpha);await app.command('/receivegmcp Beip.CommandFixture {"hiddenDump":true}',false,alpha);
  check('dumpDisabled',!alpha.view.textContent.includes('GMCP Received: Beip.CommandFixture'));
  await app.command('/receivegmcp Beip.Stats {"Command fixture":null}',false,alpha);
  const controllers=[alpha,beta].map(session=>app.triggerAudio(session)),stopCounts=controllers.map(controller=>controller.snapshot().events.filter(event=>event.action==='stop').length);
  await app.command('/silence',false,alpha);await wait(()=>controllers.every((controller,index)=>controller.snapshot().events.filter(event=>event.action==='stop').length>stopCounts[index]),'global native silence');
  check('silenceAllSessions',controllers.every(controller=>controller.snapshot().events.at(-1).action==='stop'&&controller.snapshot().events.at(-1).status==='complete')&&[alpha,beta].every(session=>!session.media?.snapshot().playing.length));
  await app.command('/wall command-fixture-wall',false,alpha);await wait(()=>app.variablesForSession(alpha).commandWallSeen==='alpha'&&app.variablesForSession(beta).commandWallSeen==='beta','broadcast alias ownership');
  check('wallPerSessionAliases',app.current===beta);
  await app.command('/idle 0 "command-idle-alpha"',false,alpha);let idle=BeipClientCommands.idle.list().find(job=>job.id===alpha.id);
  check('idleMinimumAndOwner',idle?.minutes===1&&idle.due>Date.now()+55000&&!BeipClientCommands.idle.list().some(job=>job.id===beta.id)&&character.idle?.enabled===true);
  const due=idle.due;await pause(30);await app.commandPipeline.submit(alpha,'command-idle-reset-alpha',{mode:'send',source:'fixture-idle'});idle=BeipClientCommands.idle.list().find(job=>job.id===alpha.id);
  check('idleResetOnSend',idle.due>due);await app.command('/idle',false,alpha);check('idleDisabled',character.idle.enabled===false&&!BeipClientCommands.idle.list().some(job=>job.id===alpha.id));
  await app.command('/idle 1 ""',false,alpha);check('emptyIdleUsesNop',BeipClientCommands.idle.list().find(job=>job.id===alpha.id)?.text==='');
  // Exercise the same hooked NOP path as the idle timer without waiting a minute.
  await app.commandPipeline.submit(alpha,'',{mode:'nop',source:'fixture-idle'});result.nativeNopRequested=true;await app.command('/idle',false,alpha);
 }catch(error){result.error=String(error.stack||error);}
 finally{
  if(newTab&&app.sessions.has(newTab.id))app.closeSession(newTab.id);BeipClientCommands.idle.cancel(alpha.id);alpha.gmcpDump=saved.dump;
  state.commandSettings=saved.commandSettings;state.aliases=saved.aliases;state.triggers=saved.triggers;
  for(const [session,values] of [[alpha,saved.alpha],[beta,saved.beta]]){const vars=app.variablesForSession(session);for(const key of Object.keys(vars))delete vars[key];Object.assign(vars,values);}
  // Synthetic disabled settings prove the next packaged launch reads this field.
  character.idle={enabled:false,minutes:1,text:'command-idle-persisted'};
  app.rebuildRules();app.selectSession(selected);const count=state.saveCount||0;app.saveSettings();await wait(()=>(state.saveCount||0)>count,'command fixture restoration');result.restorationSaved=true;
 }
 return result;
}
window.BeipCommandFixture={run};
})();
