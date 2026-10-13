/* Packaged-only automation acceptance using real rules workers and native audio. */
(function(){
'use strict';
async function run(app,config){
 if(!window.BeipCoreTesting)throw Error('Test mode required.');
 const clone=x=>JSON.parse(JSON.stringify(x)),state=app.state,alpha=app.sessions.get('alpha'),beta=app.sessions.get('beta');
 const saved={commandSettings:state.commandSettings,aliases:clone(state.aliases),triggers:clone(state.triggers),preferences:clone(state.preferences),characters:clone(state.characters)},selected=app.current.id;
 const result={},check=(key,value,details)=>{result[key]=!!value;if(!value)throw Error('Automation check failed: '+key+(details?' '+JSON.stringify(details):''));};
 const wait=async(fn,label)=>{const end=Date.now()+12000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,30));}};
 const feed=async(session,text)=>{session.parser.feed(text+'\r\n');await session.pendingLineWork;};
 const scope={level:'character',serverId:alpha.worldId,characterId:alpha.characterId};
 try{
  state.commandSettings={active:true,echo:false,processCommands:true,sendUnknown:false,legacyVariableAliases:false};state.preferences.mediaEnabled=false;app.applyPreferences();
  app.selectSession(beta.id);
  BeipClientCommands.handle('/set target=friend',alpha);BeipClientCommands.handle('/set target=other',beta);
  state.aliases=[{id:'automation-alias',scope,match:'^automation alias$',matchType:'regex',replacement:'automation-alias-%target%',expandVariables:true}];
  state.triggers=[{id:'automation-set',scope,match:'^AUTOMATION SET$',matchType:'regex',sendText:'/set target=updated'},{id:'automation-use',scope,match:'^AUTOMATION USE$',matchType:'regex',sendText:'automation-variable-%target%',sendExpandVariables:true},{id:'automation-away',scope,match:'^AUTOMATION AWAY$',matchType:'regex',awayCondition:'away',awayOnce:true,sendText:'automation-away-once'},{id:'automation-audio',scope,match:'^AUTOMATION AUDIO$',matchType:'regex',sound:{enabled:true,path:config.audioPath},speech:{enabled:true,text:'Beip test.'}}];
  app.rebuildRules();await app.command('automation alias',false,alpha);
  await feed(alpha,'AUTOMATION SET\r\nAUTOMATION USE');
  check('variablesIsolated',app.variablesForSession(alpha).target==='updated'&&app.variablesForSession(beta).target==='other');
  await feed(alpha,'AUTOMATION AWAY\r\nAUTOMATION AWAY');
  check('awayContext',app.ruleContext(alpha).away===true&&app.ruleContext(beta).away===!document.hasFocus());
  const audio=app.triggerAudio(alpha);await feed(alpha,'AUTOMATION AUDIO');
  const stops=()=>audio.snapshot().events.filter(e=>e.action==='stop'&&e.status==='complete').length;
  let beforeStop=stops();audio.stop();await wait(()=>stops()>beforeStop,'disabled playback barrier');
  check('audioOptIn',audio.snapshot().events.every(e=>!['api-accepted','queued'].includes(e.status)));
  state.preferences.mediaEnabled=true;app.applyPreferences();await feed(alpha,'AUTOMATION AUDIO');
  await wait(()=>audio.snapshot().events.some(e=>e.action==='speech'&&e.status==='ended'),'native speech completion');
  const events=audio.snapshot().events,ended=events.find(e=>e.action==='speech'&&e.status==='ended');
  check('nativeSound',events.some(e=>e.action==='sound'&&e.status==='api-accepted'));
  check('nativeSpeech',ended.stream>0&&events.some(e=>e.status==='queued'&&e.stream===ended.stream)&&events.some(e=>e.status==='started'&&e.stream===ended.stream));
  app.selectSession(alpha.id);BeipClassicDialogs.openTriggers();
  const dialog=document.getElementById('classicTriggersDialog'),field=name=>dialog.querySelector('[data-field="'+name+'"]');
  [...dialog.querySelectorAll('.classic-tree-item')].find(x=>x.textContent==='^AUTOMATION AUDIO$').click();
  dialog.querySelector('[data-tab="sound"]').click();field('speechText').value='Saved voice text';field('awayCondition').value='away';field('awayOnce').checked=true;field('oncePerLine').checked=false;
  dialog.querySelector('[data-action="ok"]').click();if(dialog.open)throw Error(dialog.querySelector('.classic-error').textContent);
  BeipClassicDialogs.openTriggers();[...dialog.querySelectorAll('.classic-tree-item')].find(x=>x.textContent==='^AUTOMATION AUDIO$').click();dialog.querySelector('[data-tab="sound"]').click();
  window.chrome.webview.postMessage('testcapture:automation-sound');await wait(()=>window.BeipTestScreenshots?.has('automation-sound'),'Sound editor screenshot');
  result.soundEditorDetails={speechBottom:field('speechText').getBoundingClientRect().bottom,editorBottom:dialog.querySelector('.classic-editor').getBoundingClientRect().bottom,soundEnabled:field('soundEnabled').checked,soundPathMatches:field('soundPath').value===config.audioPath,speechEnabled:field('speechEnabled').checked,speechText:field('speechText').value,awayCondition:field('awayCondition').value,awayOnce:field('awayOnce').checked,oncePerLine:field('oncePerLine').checked};
  check('soundEditor',result.soundEditorDetails.speechBottom<=result.soundEditorDetails.editorBottom&&field('soundEnabled').checked&&field('soundPath').value===config.audioPath&&field('speechEnabled').checked&&field('speechText').value==='Saved voice text'&&field('awayCondition').value==='away'&&field('awayOnce').checked&&!field('oncePerLine').checked,result.soundEditorDetails);
  dialog.querySelector('[data-action="cancel"]').click();
  const stale=app.createSession('automation-stale',{worldId:alpha.worldId,characterId:alpha.characterId,label:'Stale audio test'});
  const originalProcess=stale.ruleRuntime.beginLine.bind(stale.ruleRuntime);let release,started=false;
  const gate=new Promise(resolve=>{release=resolve;});
  stale.ruleRuntime.beginLine=async(...args)=>{const value=await originalProcess(...args);started=true;await gate;return value;};
  stale.parser.feed('AUTOMATION AUDIO\r\n');await wait(()=>started,'delayed real worker result');
  stale.parser.feed('AUTOMATION AUDIO'); // A partial final line must not restart audio on disconnect.
  app.incoming('session:'+stale.id+':ended:');release();await stale.pendingLineWork;
  const staleAudio=app.triggerAudio(stale),staleStops=()=>staleAudio.snapshot().events.filter(e=>e.action==='stop'&&e.status==='complete').length,oldStaleStops=staleStops();
  staleAudio.stop();await wait(()=>staleStops()>oldStaleStops,'disconnected playback barrier');
  check('audioEpochIsolation',staleAudio.snapshot().events.every(e=>!['api-accepted','queued'].includes(e.status)));
  app.closeSession(stale.id);
  beforeStop=stops();audio.speak('This queued speech is stopped when playback is disabled.');state.commandSettings={active:true,echo:false,processCommands:true,sendUnknown:false,legacyVariableAliases:false};state.preferences.mediaEnabled=false;app.applyPreferences();
  await wait(()=>stops()>beforeStop,'audio stopped');
  check('audioDisabled',!audio.snapshot().enabled&&!audio.speak('Should never be queued.'));
  result.audioEvents=audio.snapshot().events;
 }finally{
  if(app.sessions.has('automation-stale'))app.closeSession('automation-stale');
  for(const id of ['classicTriggersDialog','classicAliasesDialog'])document.getElementById(id)?.close();
  state.commandSettings=saved.commandSettings;state.aliases=saved.aliases;state.triggers=saved.triggers;state.preferences=saved.preferences;state.characters=saved.characters;
  // Keep one synthetic value to verify persistence on the fixture's second launch.
  state.characters.find(c=>c.id===alpha.characterId).variables={automationSaved:'persisted'};
  app.applyPreferences();app.rebuildRules();app.selectSession(selected);const before=state.saveCount||0;app.saveSettings();await wait(()=>(state.saveCount||0)>before,'automation restoration save');
 }
 return result;
}
window.BeipAutomationFixture={run};
})();
