/* Packaged logging acceptance. A disconnected fixture session owns all files. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Logging fixture requires test mode.');
 const state=app.state,saved={worlds:state.worlds,characters:state.characters,preferences:state.preferences},selected=app.current?.id,oldInput=document.getElementById('input').value,result={};
 const clone=value=>JSON.parse(JSON.stringify(value)),byId=id=>document.getElementById(id),check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Logging check failed: '+key);};
 const wait=async(test,label)=>{const end=Date.now()+10000;while(!test()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(r=>setTimeout(r,25));}};
 const world={id:'logging-world',name:'LoggingWorld',host:'logging.invalid',port:'4000'},character={id:'logging-character',worldId:world.id,name:'LoggingCharacter'},unique=Date.now().toString(36);let session;
 state.worlds=[...clone(saved.worlds),world];state.characters=[...clone(saved.characters),character];state.preferences=clone(saved.preferences);
 try{
  session=app.createSession('logging-fixture-session',{worldId:world.id,characterId:character.id,label:'Logging fixture'});app.selectSession(session.id);
  BeipClassicSettings.open();const settings=byId('settingsDialog');
  byId('logging_fileNameReviewed').checked=true;byId('logging_defaultFileName').value='logging-'+unique+'-%server%-%character%-%date%.txt';byId('logging_logTyped').checked=true;byId('logging_logSent').checked=true;byId('logging_typedPrefix').value='Typed> ';byId('logging_sentPrefix').value='Sent> ';byId('logging_timestamp').value='none';byId('logging_wrap').checked=false;byId('logging_doubleSpace').checked=false;settings.querySelector('[type=submit]').click();
  check('settingsSave',!settings.open&&state.preferences.logging.logTyped&&state.preferences.logging.logSent&&state.preferences.logging.fileNameReviewed);
  BeipClassicSettings.open();check('settingsReopen',byId('logging_sentPrefix').value==='Sent> ');byId('logging_sentPrefix').value='discard';settings.querySelector('[data-close=settingsDialog]').click();check('settingsCancel',state.preferences.logging.sentPrefix==='Sent> ');
  app.startLogging(session,'now');await wait(()=>session.logging&&session.logPath,'plain log opens');result.plainPath=session.logPath;check('nameTokens',session.logPath.includes('LoggingWorld-LoggingCharacter-')&&session.logPath.endsWith('.txt'));
  app.logLine(session,{text:'logging typed fixture',kind:'typed'});app.logLine(session,{text:'logging sent fixture',kind:'sent'});
  app.appendText(session,'Logging received  A  B\n',{color:'#11aaee'},null);await session.pendingLineWork;
  session.suppressAutomation=true;app.appendText(session,'> synthetic fixture\n',{},null);session.suppressAutomation=false;
  app.appendText(session,'Logging after synthetic\n',{},null);await session.pendingLineWork;
  app.stopLogging(session);await wait(()=>!session.logging&&!session.logStarting,'plain log closes');
  result.plainRequired=['Typed> logging typed fixture','Sent> logging sent fixture','Logging received  A  B','Logging after synthetic'];result.plainExcluded=['> synthetic fixture'];
  app.startLogging(session,'beginning','logging-'+unique+'.html');await wait(()=>session.logging&&session.logPath?.endsWith('.html'),'HTML log opens');result.htmlPath=session.logPath;
  app.logLine(session,{text:'<script>literal & text</script>',kind:'received'});app.stopLogging(session);await wait(()=>!session.logging&&!session.logStarting,'HTML log closes');
  result.htmlRequired=['<!doctype html>','color:rgb(17, 170, 238)','Logging received  A  B','&lt;script&gt;literal &amp; text&lt;/script&gt;'];result.htmlExcluded=['<script>literal','> synthetic fixture'];
  const text=Array.from({length:75},(_,i)=>'VISIBLE LOG ROW '+String(i).padStart(2,'0')).join('\n')+'\n';app.appendText(session,text,{},null);await session.pendingLineWork;
  const output=byId('output');output.scrollTop=output.scrollHeight;await new Promise(r=>requestAnimationFrame(r));const first=BeipLogging.visibleLines(session.view,output).find(line=>line!==session.line);check('visibleStartFound',!!first&&first.textContent!=='Logging received  A  B');result.visibleFirst=first.textContent;
  app.startLogging(session,'window','logging-'+unique+'-visible.txt');await wait(()=>session.logging&&session.logPath?.endsWith('-visible.txt'),'visible-window log opens');result.visiblePath=session.logPath;app.stopLogging(session);await wait(()=>!session.logging&&!session.logStarting,'visible-window log closes');
  check('nativeFilesClosed',!session.logging&&!session.logStarting);
 }catch(error){result.error=String(error.message||error).slice(0,500);}
 finally{
  if(byId('settingsDialog').open)byId('settingsDialog').close();if(session)app.closeSession(session.id);Object.assign(state,saved);if(selected&&app.sessions.has(selected))app.selectSession(selected);byId('input').value=oldInput;app.applyPreferences();app.renderProfileChoices();app.renderProfileLists?.();
  const before=state.saveCount||0;app.saveSettings();try{await wait(()=>(state.saveCount||0)>before,'restored logging settings save');result.restorationSaved=true;}catch(error){result.error=(result.error||'')+' | '+error.message;}
 }
 return result;
}
window.BeipLoggingFixture={run};
})();
