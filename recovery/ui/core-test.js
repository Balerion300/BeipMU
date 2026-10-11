/* Only activated by the native --test-core fixture. Never connects on normal startup. */
window.BeipCoreTest=async function(config){
 const app=window.BeipPreview,send=value=>window.chrome.webview.postMessage(value),errors=[];
 const wait=async(fn,label)=>{const deadline=Date.now()+10000;while(!fn()){if(Date.now()>deadline)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,30));}};
 const el=id=>document.getElementById(id);
 const press=(target,key,options={})=>{const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event;};
 const visible=id=>{const node=el(id);return !!node&&getComputedStyle(node).display!=='none'&&node.getClientRects().length>0;};
 let alpha,beta,persistenceLoaded=false,persistenceSaved=false;
 try{
  await wait(()=>app.settingsLoaded,'settings load');
  persistenceLoaded=config.phase==='persist'&&app.state.worlds.some(w=>w.id==='coreworld')&&app.state.preferences.fontSize===18&&app.state.preferences.inputHeight===120&&app.state.aliases.length===2&&app.state.aliases.some(rule=>rule.description==='Core alias')&&app.state.triggers.some(rule=>rule.description==='Core trigger')&&app.state.macros.some(macro=>macro.description==='Core macro');
  const header=document.querySelector('.app-header');
  const initialLayout=!visible('connection')&&!visible('connectDialog')&&!visible('profilesDialog')&&(!header||getComputedStyle(header).display==='none')&&el('sessionTabs').getBoundingClientRect().top>=el('command').getBoundingClientRect().bottom&&el('command').getBoundingClientRect().top>=el('output').getBoundingClientRect().bottom;
  if(!initialLayout)throw Error('Classic output, input, and bottom tab layout is missing.');
  app.incoming('ui:connection-connect');await wait(()=>el('profilesDialog')?.open,'native Worlds dialog');
  const connectionDialog=visible('profilesDialog')&&visible('worldList')&&visible('profileQuickConnect')&&el('profilesTitle').textContent==='Worlds';
  el('profileQuickConnect').click();await wait(()=>el('connectDialog')?.open,'Quick connect dialog');
  const quickConnect=visible('connectDialog')&&visible('host')&&visible('port')&&!el('profilesDialog').open;
  el('connectDialog').querySelector('[data-close="connectDialog"]').click();
  if(el('connectDialog').open||el('profileEditor')?.open)throw Error('Worlds or Quick connect dialog did not close.');
  const nativeDialogs=[];
  for(const [action,dialog,close] of [
   ['ui:options-aliases','classicAliasesDialog','.classic-close'],
   ['ui:options-triggers','rulesDialog','[data-close="rulesDialog"]'],
   ['ui:options-macros','classicMacrosDialog','.classic-close'],
   ['ui:options-preferences','settingsDialog','[data-close="settingsDialog"]']
  ]){
   app.incoming(action);await wait(()=>el(dialog)?.open,action+' dialog');
   nativeDialogs.push(visible(dialog));
   el(dialog).querySelector(close).click();
   if(el(dialog).open)throw Error(action+' dialog did not close.');
  }
  window.BeipClassicSettings.open();await wait(()=>el('settingsDialog')?.open,'classic Settings dialog');
  const settingsUI=el('settingsTitle').textContent==='Settings'&&el('settingsDialog').querySelectorAll('.classic-settings-categories button').length>=5;
  el('settingsDialog').querySelector('[data-close="settingsDialog"]').click();
  window.BeipClassicSettings.openLogging();await wait(()=>el('classicLoggingDialog')?.open,'classic Logging dialog');
  const loggingDialog=visible('classicLoggingDialog')&&!!el('classicLoggingDialog').querySelector('[data-action="start"]');
  el('classicLoggingDialog').querySelector('[data-action="close-bottom"]').click();
  let inputResize=false;
  if(config.phase==='first'){
   const splitter=el('inputSplitter');splitter.focus();for(let i=0;i<20;i++)press(splitter,'ArrowUp');
   await wait(()=>app.state.preferences.inputHeight===120,'command input resize');
   const height=el('command').getBoundingClientRect().height;
   inputResize=Math.abs(height-120)<3&&splitter.getAttribute('aria-valuenow')==='120';
  }else inputResize=Math.abs(el('command').getBoundingClientRect().height-120)<3&&el('inputSplitter').getAttribute('aria-valuenow')==='120';
  if(!inputResize)throw Error('Resizable command input is not at its saved height.');
  if(config.phase==='first'){
   app.state.worlds=[{id:'coreworld',name:'Core fixture',host:'127.0.0.1',port:String(config.ports[0]),tls:false,autoConnect:false}];
   app.state.characters=[{id:'corecharA',worldId:'coreworld',name:'Alpha'},{id:'corecharB',worldId:'coreworld',name:'Beta'}];
   app.state.preferences.fontSize=18;
   app.state.aliases=['A','B'].map((letter,i)=>({id:'alias'+letter,match:i?'^q(b)$':'^q(a)$',matchType:'regex',replacement:i?'core-\\1eta':'core-\\1lpha',scope:{level:'character',serverId:'coreworld',characterId:'corechar'+letter}}));
   app.state.triggers=[{id:'coretrigger',match:'^CORE A COMPLETE$',matchType:'regex',sendText:'core-trigger-alpha',spawnTitle:'Core notifications',scope:{level:'character',serverId:'coreworld',characterId:'corecharA'},highlight:{color:'#87c47f',wholeLine:true}}];
   app.rebuildRules();const before=app.state.saveCount||0;app.saveSettings();await wait(()=>(app.state.saveCount||0)>before,'settings save');persistenceSaved=true;
  }
  app.incoming('ui:options-aliases');await wait(()=>el('classicAliasesDialog')?.open,'alias editor');
  const aliasDialog=el('classicAliasesDialog');aliasDialog.querySelector('.classic-tree-item').click();
  aliasDialog.querySelector('.classic-description').value='Core alias';aliasDialog.querySelector('[data-action="ok"]').click();
  const aliasEditor=!aliasDialog.open&&app.state.aliases.some(rule=>rule.description==='Core alias');
  if(!aliasEditor)throw Error('Classic alias editor did not save its change.');
  app.incoming('ui:options-triggers');await wait(()=>el('rulesDialog')?.open,'trigger editor');
  const triggerDialog=el('rulesDialog'),triggerRow=el('triggerList').querySelector('.profile-row[data-rule-id="coretrigger"]');
  if(!triggerRow)throw Error('Saved trigger is absent from its list.');
  triggerRow.click();await wait(()=>el('ruleEditor')?.open,'inline trigger editor');
  el('ruleDescription').value='Core trigger';
  [...triggerDialog.querySelectorAll('.classic-trigger-actions button')].find(button=>button.textContent==='Apply').click();
  const triggerEditor=app.state.triggers.some(rule=>rule.id==='coretrigger'&&rule.description==='Core trigger');
  [...triggerDialog.querySelectorAll('.classic-trigger-actions button')].find(button=>button.textContent==='Cancel').click();
  await wait(()=>!triggerDialog.open&&!el('ruleEditor').open,'trigger editor closed');
  if(!triggerEditor)throw Error('Classic trigger editor did not save its change.');
  app.renderProfileChoices();alpha=app.createSession('alpha',{worldId:'coreworld',characterId:'corecharA',label:'Alpha'});beta=app.createSession('beta',{worldId:'coreworld',characterId:'corecharB',label:'Beta'});
  alpha.logWanted=true;beta.logWanted=true;
  send('connect|alpha|127.0.0.1|'+config.ports[0]+'|plain|corecharA');send('connect|beta|127.0.0.1|'+config.ports[1]+'|plain|corecharB');
  await wait(()=>alpha.connected&&beta.connected&&alpha.logging&&beta.logging,'both connected and logging');
  app.selectSession('alpha');window.BeipClassicSettings.openLogging();
  await wait(()=>el('classicLoggingDialog').querySelectorAll('.classic-logging-row').length===2,'two active logs in dialog');
  el('classicLoggingDialog').querySelector('[data-action="stop"]').click();
  await wait(()=>!alpha.logging&&beta.logging,'stop selected log');
  await wait(()=>!el('classicLoggingDialog').querySelector('[data-action="start"]').disabled,'start selected log enabled');
  el('classicLoggingDialog').querySelector('[data-action="start"]').click();
  await wait(()=>alpha.logging&&beta.logging,'restart selected log');
  const loggingControls=alpha.logWanted&&beta.logWanted;
  el('classicLoggingDialog').querySelector('[data-action="close-bottom"]').click();
  send('secret:save|corecharA|'+btoa('sample-pass'));
  await wait(()=>app.secretStatuses?.get('corecharA')==='on','memory credential save');
  send('login|beta|corecharA|'+btoa('BlockedWrong')+'|allow-plain');
  send('login|alpha|corecharA|'+btoa('BlockedPlain'));
  send('login|alpha|corecharA|'+btoa('SampleUser')+'|allow-plain');
  app.command('qa',false,alpha);app.command('qb',false,beta);
  app.appendText(alpha,'LOG alpha\n');app.appendText(beta,'LOG beta\n');
  app.command('/@window.output.write("SCRIPT OK");window.connection.send("core-script-alpha");',false,alpha);
  await wait(()=>alpha.view.textContent.includes('CORE A COMPLETE')&&beta.view.textContent.includes('CORE B COMPLETE')&&alpha.view.textContent.includes('SCRIPT OK')&&alpha.gmcp.rows().length,'separate transcripts, script and GMCP');
  await wait(()=>alpha.view.textContent.includes('AVATAR TEST')&&alpha.tilemap?.get('Tiny')?.tiles?.[1]===1&&alpha.media?.snapshot().cached.includes('tone.wav'),'GMCP visual and media state');
  await wait(()=>{const avatar=[...alpha.view.querySelectorAll('.line')].find(line=>line.textContent.includes('AVATAR TEST'))?.querySelector('img.avatar');return avatar?.complete&&avatar.naturalWidth===32;},'loaded GMCP avatar');
  await wait(()=>{const canvas=alpha.mapsPane?.querySelector('canvas');return canvas?.width===32&&canvas.height===16&&canvas.parentElement?.lastChild?.textContent==='';},'rendered GMCP tilemap');
  const tilemapRendered=alpha.tilemap.get('Tiny').tiles.join(',')==='0,1';
  const avatar=[...alpha.view.querySelectorAll('.line')].find(line=>line.textContent.includes('AVATAR TEST')).querySelector('img.avatar');
  const avatarLoaded=avatar.complete&&avatar.naturalWidth===32;
  const mediaState=alpha.media.snapshot(),mediaDisabled=mediaState.enabled===false&&mediaState.cached.includes('tone.wav')&&mediaState.playing.length===0;
  app.selectSession('alpha');document.getElementById('mapperButton').click();
  await wait(()=>document.getElementById('mapperDialog')?.open,'map dialog');
  const mapRoom=document.getElementById('mapRoom');
  if(config.phase==='first'){
   document.getElementById('roomNew').click();document.getElementById('roomTitle').value='Start';document.getElementById('roomForm').requestSubmit();
   document.getElementById('roomNew').click();mapRoom.selectedIndex=1;mapRoom.dispatchEvent(new Event('change'));document.getElementById('roomTitle').value='North';document.getElementById('roomForm').requestSubmit();
   document.getElementById('exitFrom').selectedIndex=0;document.getElementById('exitTo').selectedIndex=1;document.getElementById('exitCommand').value='n';document.getElementById('exitForm').requestSubmit();
  }
  if(mapRoom.options.length!==2)throw Error('Expected two saved map rooms.');
  mapRoom.selectedIndex=0;mapRoom.dispatchEvent(new Event('change'));document.getElementById('roomCurrent').click();
  mapRoom.selectedIndex=1;mapRoom.dispatchEvent(new Event('change'));document.getElementById('mapRoute').click();
  const mapperUI=document.getElementById('mapRouteText').textContent==='n'&&document.getElementById('mapperCanvas').querySelectorAll('g').length===2&&app.state.maps.coreworld?.rooms?.length===2;
  document.getElementById('mapperClose').click();
  app.selectSession('alpha');app.state.macros=[{id:'coremacro',key:'Ctrl+Q',text:'core-macro-alpha',scope:{level:'character',serverId:'coreworld',characterId:'corecharA'}}];
  app.incoming('ui:options-macros');await wait(()=>el('classicMacrosDialog')?.open,'macro editor');
  const macroDialog=el('classicMacrosDialog');macroDialog.querySelector('.classic-tree-item').click();
  macroDialog.querySelector('.classic-description').value='Core macro';macroDialog.querySelector('[data-action="ok"]').click();
  const macroEditor=!macroDialog.open&&app.state.macros.some(macro=>macro.description==='Core macro');
  if(!macroEditor)throw Error('Classic macro editor did not save its change.');
  press(el('input'),'q',{ctrlKey:true});el('input').value='draft alpha';app.selectSession('beta');el('input').value='draft beta';app.selectSession('alpha');const draftsIsolated=el('input').value==='draft alpha';
  const input=el('input');input.value='core-line-one';const shifted=press(input,'Enter',{shiftKey:true});
  if(shifted.defaultPrevented||input.value!=='core-line-one')throw Error('Shift+Enter submitted the command input.');
  input.value='core-line-one\ncore-line-two';const entered=press(input,'Enter');
  await wait(()=>input.value==='','Enter submits multiline commands');
  const typingUI=entered.defaultPrevented&&input.tagName==='TEXTAREA';
  const result={phase:config.phase,classicLayout:initialLayout,connectionDialog,quickConnect,nativeDialogs:nativeDialogs.every(Boolean),settingsUI,loggingDialog,loggingControls,aliasEditor,triggerEditor,macroEditor,inputResize,typingUI,isolated:!alpha.view.textContent.includes('CORE B COMPLETE')&&!beta.view.textContent.includes('CORE A COMPLETE'),commandsSent:true,logging:alpha.logging&&beta.logging,persistenceSaved,persistenceLoaded,alpha:{text:alpha.view.textContent,connected:alpha.connected},beta:{text:beta.view.textContent,connected:beta.connected},logPaths:[alpha.logPath,beta.logPath],gmcpStats:alpha.gmcp.rows(),scripts:true,draftsIsolated,spawn:[...app.sessions.values()].some(s=>s.kind==='spawn'&&s.view.textContent.includes('CORE A COMPLETE')),credentialSaved:app.secretStatuses?.get('corecharA')==='on',avatarLoaded,tilemapRendered,mediaDisabled,mapperUI,errors};
  // Kill a runaway user script while preserving the other session and UI.
  app.command('/@new Promise(resolve=>{const child=new Worker("script-worker.js");child.onerror=e=>{e.preventDefault();window.output.write("CHILD BLOCKED");resolve();};child.onmessage=()=>{child.terminate();window.output.write("CHILD ALLOWED");resolve();};child.postMessage({id:99,type:"eval",value:"postMessage(\\\"CHILD RAN\\\")"});});',false,alpha);await wait(()=>alpha.view.textContent.includes('CHILD BLOCKED'),'worker CSP');result.workerCSP=true;
  app.command('/@while(true){}',false,alpha);await wait(()=>!alpha.scripts.enabled,'runaway script termination');result.scriptTimeout=alpha.view.textContent.includes('execution time limit');
  send('logstop|alpha');send('logstop|beta');await wait(()=>!alpha.logging&&!beta.logging,'logs stopped');
  const closed=config.phase==='first'?'alpha':'beta',survivor=config.phase==='first'?'beta':'alpha';
  app.closeSession(closed);await new Promise(r=>setTimeout(r,200));result.macros=true;result.closedIsolation=!app.sessions.has(closed)&&app.sessions.get(survivor)?.connected;app.selectSession(survivor);
  send('testresult:'+JSON.stringify(result));
 }catch(error){errors.push(String(error.message||error));send('testresult:'+JSON.stringify({phase:config.phase,errors,alpha:{text:alpha?.view.textContent},beta:{text:beta?.view.textContent}}));}
};
