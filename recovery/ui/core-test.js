/* Only activated by the native --test-core fixture. Never connects on normal startup. */
window.BeipCoreTest=async function(config){
 const app=window.BeipPreview,send=value=>window.chrome.webview.postMessage(value),errors=[];
 const wait=async(fn,label)=>{const deadline=Date.now()+10000;while(!fn()){if(Date.now()>deadline)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,30));}};
 let alpha,beta,persistenceLoaded=false,persistenceSaved=false;
 try{
  await wait(()=>app.settingsLoaded,'settings load');
  persistenceLoaded=config.phase==='persist'&&app.state.worlds.some(w=>w.id==='coreworld')&&app.state.preferences.fontSize===18&&app.state.aliases.length===2;
  if(config.phase==='first'){
   app.state.worlds=[{id:'coreworld',name:'Core fixture',host:'127.0.0.1',port:String(config.ports[0]),tls:false,autoConnect:false}];
   app.state.characters=[{id:'corecharA',worldId:'coreworld',name:'Alpha'},{id:'corecharB',worldId:'coreworld',name:'Beta'}];
   app.state.preferences.fontSize=18;
   app.state.aliases=['A','B'].map((letter,i)=>({id:'alias'+letter,match:i?'^q(b)$':'^q(a)$',matchType:'regex',replacement:i?'core-\\1eta':'core-\\1lpha',scope:{level:'character',serverId:'coreworld',characterId:'corechar'+letter}}));
   app.state.triggers=[{id:'coretrigger',match:'^CORE A COMPLETE$',matchType:'regex',sendText:'core-trigger-alpha',spawnTitle:'Core notifications',scope:{level:'character',serverId:'coreworld',characterId:'corecharA'},highlight:{color:'#87c47f',wholeLine:true}}];
   app.rebuildRules();const before=app.state.saveCount||0;app.saveSettings();await wait(()=>(app.state.saveCount||0)>before,'settings save');persistenceSaved=true;
  }
  app.renderProfileChoices();alpha=app.createSession('alpha',{worldId:'coreworld',characterId:'corecharA',label:'Alpha'});beta=app.createSession('beta',{worldId:'coreworld',characterId:'corecharB',label:'Beta'});
  alpha.logWanted=true;beta.logWanted=true;
  send('connect|alpha|127.0.0.1|'+config.ports[0]+'|plain|corecharA');send('connect|beta|127.0.0.1|'+config.ports[1]+'|plain|corecharB');
  await wait(()=>alpha.connected&&beta.connected&&alpha.logging&&beta.logging,'both connected and logging');
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
  app.selectSession('alpha');app.state.macros=[{id:'coremacro',key:'Ctrl+Q',text:'core-macro-alpha',scope:{level:'character',serverId:'coreworld',characterId:'corecharA'}}];document.getElementById('input').dispatchEvent(new KeyboardEvent('keydown',{key:'q',ctrlKey:true,bubbles:true,cancelable:true}));document.getElementById('input').value='draft alpha';app.selectSession('beta');document.getElementById('input').value='draft beta';app.selectSession('alpha');const draftsIsolated=document.getElementById('input').value==='draft alpha';
  const result={phase:config.phase,isolated:!alpha.view.textContent.includes('CORE B COMPLETE')&&!beta.view.textContent.includes('CORE A COMPLETE'),commandsSent:true,logging:alpha.logging&&beta.logging,persistenceSaved,persistenceLoaded,alpha:{text:alpha.view.textContent,connected:alpha.connected},beta:{text:beta.view.textContent,connected:beta.connected},logPaths:[alpha.logPath,beta.logPath],gmcpStats:alpha.gmcp.rows(),scripts:true,draftsIsolated,spawn:[...app.sessions.values()].some(s=>s.kind==='spawn'&&s.view.textContent.includes('CORE A COMPLETE')),credentialSaved:app.secretStatuses?.get('corecharA')==='on',avatarLoaded,tilemapRendered,mediaDisabled,mapperUI,errors};
  // Kill a runaway user script while preserving the other session and UI.
  app.command('/@new Promise(resolve=>{const child=new Worker("script-worker.js");child.onerror=e=>{e.preventDefault();window.output.write("CHILD BLOCKED");resolve();};child.onmessage=()=>{child.terminate();window.output.write("CHILD ALLOWED");resolve();};child.postMessage({id:99,type:"eval",value:"postMessage(\\\"CHILD RAN\\\")"});});',false,alpha);await wait(()=>alpha.view.textContent.includes('CHILD BLOCKED'),'worker CSP');result.workerCSP=true;
  app.command('/@while(true){}',false,alpha);await wait(()=>!alpha.scripts.enabled,'runaway script termination');result.scriptTimeout=alpha.view.textContent.includes('execution time limit');
  send('logstop|alpha');send('logstop|beta');await wait(()=>!alpha.logging&&!beta.logging,'logs stopped');
  const closed=config.phase==='first'?'alpha':'beta',survivor=config.phase==='first'?'beta':'alpha';
  app.closeSession(closed);await new Promise(r=>setTimeout(r,200));result.macros=true;result.closedIsolation=!app.sessions.has(closed)&&app.sessions.get(survivor)?.connected;app.selectSession(survivor);
  send('testresult:'+JSON.stringify(result));
 }catch(error){errors.push(String(error.message||error));send('testresult:'+JSON.stringify({phase:config.phase,errors,alpha:{text:alpha?.view.textContent},beta:{text:beta?.view.textContent}}));}
};
