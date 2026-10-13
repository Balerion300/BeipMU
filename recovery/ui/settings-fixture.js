/* Packaged-only settings acceptance, with no network connection or real credentials. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Settings fixture requires test mode.');
 const state=app.state,saved={worlds:state.worlds,characters:state.characters,preferences:state.preferences},selected=app.current?.id,input=document.getElementById('input'),oldInput=input.value,result={};
 const clone=x=>JSON.parse(JSON.stringify(x)),byId=id=>document.getElementById(id),check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Settings fixture failed: '+name);};
 const change=node=>node.dispatchEvent(new Event('change',{bubbles:true}));
 const world={id:'settings-world',name:'Settings fixture',host:'settings.invalid',port:'4000'},character={id:'settings-character',worldId:world.id,name:'Settings character'};
 let session;
 state.worlds=[...clone(saved.worlds),world];state.characters=[...clone(saved.characters),character];state.preferences=clone(saved.preferences);
 try{
  session=app.createSession('settings-session',{worldId:world.id,characterId:character.id,label:'Settings fixture'});app.selectSession(session.id);
  BeipClassicSettings.open('character:'+character.id);const dialog=byId('settingsDialog');
  for(const name of ['output','input']){const control=byId('classic'+name+'UseParent');control.checked=false;change(control);}
  byId('fontSize').value='20';byId('pref_outputFontFace').value='Consolas';byId('pref_outputForeground').value='#aabbcc';byId('pref_outputBackground').value='#102030';byId('pref_linkColor').value='#66bbff';byId('pref_paragraphSpacing').value='3';byId('pref_outputMarginLeft').value='7';
  byId('pref_inputFontSize').value='16';byId('pref_inputFontFace').value='Courier New';byId('pref_inputForeground').value='#ddeeff';byId('pref_inputBackground').value='#203040';byId('pref_inputSticky').checked=true;byId('classicInputHeight').value='90';
  dialog.querySelector('[type=submit]').click();check('editorSaves',!dialog.open&&character.preferences.input.values.inputSticky&&character.preferences.output.values.outputMarginLeft===7);
  app.appendText(session,'Settings sample  A  B\n',{},null);const sample=session.view.querySelector('.line'),before=sample.textContent;
  const style=getComputedStyle(session.view),inputStyle=getComputedStyle(input);check('independentRuntime',style.fontSize==='20px'&&style.color==='rgb(170, 187, 204)'&&style.backgroundColor==='rgb(16, 32, 48)'&&style.paddingLeft==='7px'&&inputStyle.fontSize==='16px'&&inputStyle.color==='rgb(221, 238, 255)'&&getComputedStyle(sample).marginBottom==='3px');
  check('preservedSpacing',before==='Settings sample  A  B');
  input.value='/set settings_fixture=ok';byId('command').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));check('stickyInput',input.value==='/set settings_fixture=ok');
  character.preferences.input.values.inputSticky=false;character.preferences.input.values.inputAutoSize=true;character.preferences.input.values.inputMinLines=2;character.preferences.input.values.inputMaxLines=4;app.applyPreferences();
  input.value='a\nb\nc\nd\ne\nf';input.dispatchEvent(new Event('input',{bubbles:true}));const height=Number.parseFloat(document.documentElement.style.getPropertyValue('--input-height'));check('autoSizeBounded',height>40&&height<100&&character.preferences.input.values.inputHeight===90);
  input.value='/unset settings_fixture';byId('command').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));check('clearInput',input.value==='');
  BeipClassicSettings.open('character:'+character.id);check('editorReopens',byId('pref_outputForeground').value==='#aabbcc'&&byId('pref_inputFontSize').value==='16');byId('pref_outputForeground').value='#ffffff';dialog.querySelector('[data-close=settingsDialog]').click();check('cancelPreserves',character.preferences.output.values.outputForeground==='#aabbcc');
  BeipClassicSettings.open('character:'+character.id);[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Output Windows')?.click();window.chrome.webview.postMessage('testcapture:expanded-settings');const shotDeadline=Date.now()+3000;while(!window.BeipTestScreenshots?.has('expanded-settings')&&Date.now()<shotDeadline)await new Promise(resolve=>setTimeout(resolve,25));dialog.querySelector('[data-close=settingsDialog]').click();
  const normalized=BeipProfiles.normalizeSettings(state),reload=BeipProfiles.normalizeSettings(JSON.parse(JSON.stringify(normalized)));check('serializedRoundtrip',JSON.stringify(normalized)===JSON.stringify(reload)&&reload.characters.find(c=>c.id===character.id).preferences.output.values.outputBackground==='#102030');
 }catch(error){result.error=String(error.message||error).slice(0,400);}
 finally{
  if(byId('settingsDialog').open)byId('settingsDialog').close();if(session)app.closeSession(session.id);Object.assign(state,saved);if(selected&&app.sessions.has(selected))app.selectSession(selected);input.value=oldInput;app.applyPreferences();app.renderProfileChoices();app.renderProfileLists?.();
  const before=state.saveCount||0;app.saveSettings();const until=Date.now()+10000;while((state.saveCount||0)<=before&&Date.now()<until)await new Promise(r=>setTimeout(r,30));result.restorationSaved=(state.saveCount||0)>before;
 }
 return result;
}
window.BeipSettingsFixture={run};
})();
