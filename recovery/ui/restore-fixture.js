/* Packaged two-launch restoration acceptance, using only the isolated test profile. */
(function(){
'use strict';
async function run(app=window.BeipPreview,config={phase:'first'}){
 if(!window.BeipCoreTesting)throw Error('Restore fixture requires test mode.');
 const state=app.state,saved={worlds:state.worlds,characters:state.characters,preferences:state.preferences,triggers:state.triggers,commandSettings:state.commandSettings},selected=app.current?.id,beforeIds=new Set(app.sessions.keys()),result={},dockKey='beipmu:dock:restore-fixture-char',savedDock=localStorage.getItem(dockKey);
 const clone=value=>JSON.parse(JSON.stringify(value)),check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Restore fixture failed: '+name);};
 const wait=async(test,label)=>{const end=Date.now()+15000;while(!test()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}};
 const world={id:'restore-fixture-world',name:'Restore fixture',host:'restore.invalid',port:'4000'},character={id:'restore-fixture-char',worldId:world.id,name:'Restore character',restore:{enabled:true}},groupedHistory='/echo restore grouped first\n\n/echo   WHO\tName  Idle\n/echo restore grouped last',additionalDraft='/echo restore additional first\n\n/echo restore additional last',additionalHistory='restore-prefix '+additionalDraft;
 state.worlds=[...clone(saved.worlds),world];state.characters=[...clone(saved.characters),character];state.preferences={...clone(saved.preferences),restore:{enabled:true,bufferKiB:64}};state.triggers=clone(saved.triggers);
 let session;
 const armReplayTrap=()=>state.triggers.push({id:'restore-fixture-trap',enabled:true,scope:{level:'character',serverId:world.id,characterId:character.id},matchType:'simple',match:'RESTORE FIXTURE',filterText:'REPLAY TRIGGER RAN',sendText:'/set restore_unexpected=true'});
 try{
  BeipClassicSettings.open();const dialog=document.getElementById('settingsDialog');document.getElementById('restoreEnabled').checked=true;document.getElementById('restoreBufferKiB').value='65';dialog.querySelector('[type=submit]').click();check('settingsRoundAndSave',state.preferences.restore.bufferKiB===128);
  BeipClassicSettings.open();document.getElementById('restoreEnabled').checked=false;dialog.querySelector('[data-close=settingsDialog]').click();check('settingsCancel',state.preferences.restore.enabled);state.preferences.restore.bufferKiB=64;
  if(config.phase!=='first')armReplayTrap();
  session=app.createSession('restore-fixture-first',{worldId:world.id,characterId:character.id});await wait(()=>session.restoreController?.mode==='live','initial restore load');
  if(config.phase==='first'){
   session.restoreController.clear();await wait(()=>session.status.includes('Saved output cleared'),'initial isolated clear');
   app.appendText(session,'RESTORE FIXTURE  Name  Idle\n',{color:'#11aaee',bold:true},{kind:'command',value:'/set restore_unexpected=true',hint:'Explicit restore fixture click'});await session.pendingLineWork;
   session.restoreController.capture({v:1,kind:'history',time:1700000000000,text:'restore fixture history'});
   // Exercise the shipped forms and their model history callback with the real
   // native controller. Internal echo commands keep this owner disconnected.
   state.commandSettings={active:false,echo:false,processCommands:false,sendUnknown:false,legacyVariableAliases:false};app.selectSession(session.id);
   const primary=document.getElementById('input');primary.value=groupedHistory;primary.dispatchEvent(new Event('input',{bubbles:true}));primary.form.requestSubmit();
   await wait(()=>session.view.textContent.includes('restore grouped last'),'primary grouped command completion');check('groupedHistoryCaptured',session.history.filter(text=>text===groupedHistory).length===1&&!session.connected);
   const pane=BeipDockPanels.newInput('"restore-prefix "',session),additional=document.querySelector('[data-dock="'+pane.id+'"] .additional-input-text');
   additional.value=additionalDraft;additional.dispatchEvent(new Event('input',{bubbles:true}));additional.form.requestSubmit();await wait(()=>session.view.textContent.includes('restore additional last'),'additional grouped command completion');
   check('additionalGroupedHistoryCaptured',session.history.filter(text=>text===additionalHistory).length===1&&!session.connected);BeipDockPanels.closePane(pane.id,session);
   session.restoreController.capture({v:1,kind:'line',time:1700000000001,parts:[{type:'image',url:'https://restore.invalid/never-fetched.png',alt:'Restored image placeholder',height:150}]});
   session.restoreController.capture({v:1,kind:'gmcp',time:1700000000002,package:'Beip.Stats',data:'{"Restore":{"values":{"saved":{"int":12}}}}'});
   session.restoreController.capture({v:1,kind:'gmcp',time:1700000000003,package:'beip.line.id',data:'"historical-avatar-request"'});
   app.closeSession(session.id);
   armReplayTrap();
   session=app.createSession('restore-fixture-reopen',{worldId:world.id,characterId:character.id});await wait(()=>session.restoreController?.mode==='live','same-launch restored snapshot');
  }
  check('diskOrSameLaunchRestore',session.view.textContent.includes('RESTORE FIXTURE  Name  Idle')&&session.history.includes('restore fixture history'));
  check('groupedHistoryRestored',session.history.filter(text=>text===groupedHistory).length===1&&!session.history.includes('/echo restore grouped first')&&!session.history.includes('/echo restore grouped last'));
  check('additionalGroupedHistoryRestored',session.history.filter(text=>text===additionalHistory).length===1&&!session.history.includes('restore-prefix /echo restore additional first')&&!session.history.includes('/echo restore additional last'));
  const historyBeforeReplay=session.history.slice(),historyIndexBeforeReplay=session.historyIndex,capture=session.restoreController.capture;let historyReplayCaptures=0;
  try{session.restoreController.capture=(...args)=>{historyReplayCaptures++;return capture(...args);};app.replayRestoreRecords(session,[{v:1,kind:'history',time:1700000000004,text:'replay grouped first\nreplay grouped last'}]);check('groupedReplayNoCapture',historyReplayCaptures===0&&session.history[0]==='replay grouped first\nreplay grouped last');}
  finally{session.restoreController.capture=capture;session.history.splice(0,session.history.length,...historyBeforeReplay);session.historyIndex=historyIndexBeforeReplay;}
  check('secondLaunchEvidence',config.phase==='first'||session.view.querySelectorAll('[data-restore-replay]').length>=2);
  const link=session.view.querySelector('a[data-kind=command]');check('linksStylesSpacing',link?.dataset.value==='/set restore_unexpected=true'&&link.textContent==='RESTORE FIXTURE  Name  Idle'&&link.style.color==='rgb(17, 170, 238)'&&link.style.fontWeight==='bold');
  check('imagesDoNotFetch',session.view.querySelectorAll('img').length===0&&session.view.querySelector('.restore-image')?.textContent.includes('Restored image placeholder'));
  check('noCommandSideEffects',app.variablesForSession(session).restore_unexpected===undefined&&!session.connected&&session.gmcp.rows().some(row=>JSON.stringify(row).includes('12')));
  check('historicalAvatarDoesNotLeak',session.gmcp.nextLine===null&&!session.gmcp.requests.has('historical-avatar-request'));
  check('restoredCaptureSkipped',BeipRestoreRuntime.fromLine(session.view.querySelector('[data-restore-replay]'))===null);
  const length=session.view.querySelectorAll('[data-restore-replay]').length;session.connectionEpoch=1;app.configureRestore(session);await wait(()=>session.restoreController?.mode==='live','epoch rebound');check('reconnectDoesNotDuplicate',session.view.querySelectorAll('[data-restore-replay]').length===length);
  const oldController=session.restoreController;session.connectionEpoch=2;app.configureRestore(session);oldController.message('restorebegin:'+character.id+':1:0');check('staleEpochIgnored',oldController.mode==='cancelled');
  const source='Version=400\nConnections.Logging\n{\nRestoreBufferSizeCurrent=64\n}\nConnections.Shortcuts.First\n{\nHost="restore.invalid:4000"\nEncoding=0\nCharacters.Same\n{\nRestoreLogIndex=1\n}\n}\nConnections.Shortcuts.Second\n{\nHost="restore.invalid:4001"\nEncoding=0\nCharacters.Same\n{\nRestoreLogIndex=0\n}\n}';
  await BeipClassicImport.previewConfig(source,'Synthetic restore Config.txt');const importDialog=document.getElementById('classicImportDialog');importDialog.querySelector('[data-action=apply]').click();const firstWorld=state.worlds.find(item=>item.name==='First'),secondWorld=state.worlds.find(item=>item.name==='Second'),firstCharacter=state.characters.find(item=>item.worldId===firstWorld.id),secondCharacter=state.characters.find(item=>item.worldId===secondWorld.id);
  function slot(text){const bytes=new Uint8Array(65536),view=new DataView(bytes.buffer),payload=new TextEncoder().encode(text);view.setUint32(4,12+payload.length,true);bytes[8]=0;bytes[9]=payload.length&255;bytes[10]=payload.length>>>8;view.setBigUint64(12,116444736000000000n+17000000000000000n,true);bytes.set(payload,20);return bytes;}
  const original=new Uint8Array(131072);original.set(slot('SECOND ORIGINAL  A  B'));original.set(slot('FIRST ORIGINAL  A  B'),65536);const plan=BeipClassicImport.previewRestore(original);check('originalIdentityAndWarning',plan.characters.find(item=>item.characterId===firstCharacter.id).records[0].payload[0]===70&&importDialog.textContent.includes('visual trigger/spawn'));
  const panel=importDialog.querySelector('[data-panel=restore]');for(const box of panel.querySelectorAll('input[type=checkbox]'))box.checked=box.dataset.characterId===firstCharacter.id;[...panel.querySelectorAll('button')].find(button=>button.textContent==='Restore selected characters').click();await wait(()=>[...app.sessions.values()].some(item=>item.characterId===firstCharacter.id&&item.view.textContent.includes('FIRST ORIGINAL  A  B')),'selected original slot import');check('selectedOriginalOnly',![...app.sessions.values()].some(item=>item.characterId===secondCharacter.id));importDialog.close();
  const clearCharacter={id:'restore-fixture-clear',worldId:world.id,name:'Clear fixture'};state.characters.push(clearCharacter);const clearSession=app.createSession('restore-fixture-clear-session',{worldId:world.id,characterId:clearCharacter.id});await wait(()=>clearSession.restoreController?.mode==='live','clear fixture load');clearSession.restoreController.capture({v:1,kind:'history',time:0,text:'discard fixture'});clearSession.restoreController.clear();await wait(()=>clearSession.status.includes('Saved output cleared'),'explicit native clear');app.closeSession(clearSession.id);const reopened=app.createSession('restore-fixture-clear-reopen',{worldId:world.id,characterId:clearCharacter.id});await wait(()=>reopened.restoreController?.mode==='live','cleared fixture reopens');check('nativeClear',!reopened.history.includes('discard fixture'));
  result.nativeCharacter='restore-fixture-char';result.nativeRequired=['RESTORE FIXTURE  Name  Idle','restore fixture history',JSON.stringify(groupedHistory).slice(1,-1),JSON.stringify(additionalHistory).slice(1,-1),'https://restore.invalid/never-fetched.png'];
 }catch(error){result.error=String(error.message||error).slice(0,700);}
 finally{
  for(const id of [...app.sessions.keys()])if(!beforeIds.has(id))app.closeSession(id);if(savedDock===null)localStorage.removeItem(dockKey);else localStorage.setItem(dockKey,savedDock);for(const id of ['settingsDialog','classicImportDialog'])if(document.getElementById(id)?.open)document.getElementById(id).close();Object.assign(state,saved);if(selected&&app.sessions.has(selected))app.selectSession(selected);app.rebuildRules();app.applyPreferences();app.renderProfileChoices();app.renderProfileLists?.();const before=state.saveCount||0;app.saveSettings();try{await wait(()=>(state.saveCount||0)>before,'restored fixture settings');result.restorationSaved=true;}catch(error){result.error=(result.error||'')+' | '+error.message;}
 }
 return result;
}
window.BeipRestoreFixture={run};
})();
