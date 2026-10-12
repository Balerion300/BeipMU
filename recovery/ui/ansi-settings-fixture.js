/* Packaged full-dialog ANSI settings acceptance. MIT. */
(function(root){root.BeipAnsiSettingsFixture={async run(app=root.BeipPreview){
 if(!root.BeipCoreTesting)throw Error('ANSI settings fixture requires isolated test mode.');
 const original=app.state.preferences,selected=app.current?.id,dialog=document.getElementById('settingsDialog'),result={};let session;const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('ANSI settings fixture failed: '+name);};
 async function capture(name){root.chrome.webview.postMessage('testcapture:'+name);const deadline=Date.now()+3000;while(!root.BeipTestScreenshots?.has(name)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));check(name+'Captured',root.BeipTestScreenshots?.has(name));}
 app.state.preferences=JSON.parse(JSON.stringify(original));
 try{
  root.BeipClassicSettings.open('global');dialog.querySelector('button[data-category="ansi"]').click();
  dialog.querySelector('[data-ansi-preset="VGA"]').click();dialog.querySelector('[data-ansi-color="1"]').value='#e89b45';dialog.querySelector('[data-ansi="fontBold"]').checked=true;dialog.querySelector('[data-ansi="resetOnNewLine"]').checked=true;dialog.querySelector('[data-ansi-color="1"]').dispatchEvent(new Event('input',{bubbles:true}));await capture('ansi-settings');dialog.querySelector('[type="submit"]').click();
  check('dialogSave',!dialog.open&&app.state.preferences.ansi.colors[1]==='#e89b45'&&app.state.preferences.ansi.fontBold&&app.state.preferences.ansi.resetOnNewLine);
  check('liveSessionsUpdated',[...app.sessions.values()].filter(session=>session.parser).every(session=>session.parser.ansiState.preferences.colors[1]==='#e89b45'&&session.parser.ansiState.preferences.fontBold));
  session=app.createSession('ansi-settings-test',{label:'ANSI settings test'});session.suppressAutomation=true;app.selectSession(session.id);session.parser.feed('\x1b[31;1mANSI CUSTOM COLOR\nANSI RESET PLAIN\n');await session.pendingLineWork;
  const colored=[...session.view.querySelectorAll('.line span')].find(node=>node.textContent==='ANSI CUSTOM COLOR'),plain=[...session.view.querySelectorAll('.line span')].find(node=>node.textContent==='ANSI RESET PLAIN');
  check('renderedCustomColorBold',colored&&getComputedStyle(colored).color==='rgb(232, 155, 69)'&&Number(getComputedStyle(colored).fontWeight)>=700);check('renderedNewlineReset',plain&&!plain.style.color&&!plain.style.fontWeight);await capture('ansi-rendered-output');
  root.BeipClassicSettings.open('global');check('dialogReopen',dialog.querySelector('[data-ansi-color="1"]').value==='#e89b45');dialog.querySelector('[data-ansi-preset="Bright"]').click();dialog.querySelector('[data-close="settingsDialog"]').click();check('dialogCancel',app.state.preferences.ansi.colors[1]==='#e89b45');
  const reload=root.BeipProfiles.normalizeSettings(JSON.parse(JSON.stringify(root.BeipProfiles.normalizeSettings(app.state))));check('settingsRoundTrip',reload.preferences.ansi.colors[1]==='#e89b45'&&reload.preferences.ansi.resetOnNewLine);
 }catch(error){result.error=String(error.message||error).slice(0,400);}
 finally{if(dialog.open)dialog.close();if(session)app.closeSession(session.id);app.state.preferences=original;if(selected&&app.sessions.has(selected))app.selectSession(selected);app.applyPreferences();const before=app.state.saveCount||0;app.saveSettings();const until=Date.now()+10000;while((app.state.saveCount||0)<=before&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,30));result.restorationSaved=(app.state.saveCount||0)>before;}
 return result;
}};})(globalThis);
