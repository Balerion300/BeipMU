/* Packaged Auto Emoji acceptance; native file operations use the isolated test profile. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Emoji fixture requires test mode.');
 const result={},state=app.state,savedPreferences=state.preferences,selected=app.current?.id;let initial,session;
 const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Emoji fixture failed: '+name);};
 const wait=async(test,label)=>{const end=Date.now()+10000;while(!test()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}};
 const encoded=text=>{let bytes='';for(const value of new TextEncoder().encode(text))bytes+=String.fromCharCode(value);return btoa(bytes);};
 async function request(command){const revision=BeipEmoji.snapshot().revision;window.chrome.webview.postMessage(command);await wait(()=>BeipEmoji.snapshot().revision>revision,command.split('|')[0]);const next=BeipEmoji.snapshot();if(next.error)throw Error(next.error);return next;}
 const custom='# fixture table\nIGNORE_BEGIN\n🔥 warning\nIGNORE_END\nREPLACE_BEGIN\n🙂 :)\n🦊 fox\nREPLACE_END\n🐕 dog\n🐶 dog face';
 try{
  initial=await request('emoji:load');const copy=await request('emoji:copy');check('nativeCopy',copy.custom&&copy.source===initial.source);
  BeipClassicSettings.open();const dialog=document.getElementById('settingsDialog');document.getElementById('emojiSource').value=custom;document.getElementById('emojiSource').dispatchEvent(new Event('input',{bubbles:true}));
  const revision=BeipEmoji.snapshot().revision;document.getElementById('emojiSaveSource').click();await wait(()=>BeipEmoji.snapshot().revision>revision,'emoji editor saves');check('nativeSave',BeipEmoji.snapshot().source===custom&&BeipEmoji.snapshot().custom&&!BeipEmoji.snapshot().error);
  check('preview',document.getElementById('emojiPreview').textContent==='A 🦊 and dog🐕 🙂');document.getElementById('emojiEnabled').checked=true;dialog.querySelector('[type=submit]').click();check('settingsEnable',state.preferences.emojiEnabled===true);
  const reload=await request('emoji:load');check('nativeReload',reload.custom&&reload.source===custom&&reload.rules===4);
  BeipClassicSettings.open();check('settingsReopen',document.getElementById('emojiEnabled').checked);document.getElementById('emojiEnabled').checked=false;dialog.querySelector('[data-close=settingsDialog]').click();check('settingsCancel',state.preferences.emojiEnabled===true);
  const line=document.createElement('div'),prefix=document.createTextNode('f'),link=document.createElement('a'),suffix=document.createElement('b'),image=document.createElement('img');link.href='https://example.org/dog';link.dataset.command='look fox';link.textContent='o';suffix.textContent='x';image.alt='dog';line.append(prefix,link,suffix,document.createTextNode(' dog face  warning '),image,document.createTextNode(' :)'));const beforeLink=link;
  check('domReplacement',BeipEmoji.applyLine(line,{emojiEnabled:true})===2&&line.textContent==='fox dog face🐶  warning  🙂');
  let clicked='';link.addEventListener('click',event=>{event.preventDefault();clicked=link.dataset.command;});link.click();
  check('linksImagesStylesPreserved',line.contains(beforeLink)&&line.contains(image)&&line.contains(suffix)&&link.textContent==='o'&&clicked==='look fox'&&link.dataset.command==='look fox'&&link.href==='https://example.org/dog'&&line.querySelectorAll('img').length===1);
  check('idempotent',BeipEmoji.applyLine(line,{emojiEnabled:true})===0&&line.textContent==='fox dog face🐶  warning  🙂');
  const linkedLine=document.createElement('div'),fullLink=document.createElement('a'),bold=document.createElement('b');fullLink.dataset.command='look fox';bold.textContent='o';fullLink.append(document.createTextNode('f'),bold,document.createTextNode('x'));linkedLine.append(fullLink);let linkedClick='';fullLink.addEventListener('click',event=>{event.preventDefault();linkedClick=fullLink.dataset.command;});const linkedMatches=BeipEmoji.applyLine(linkedLine,{emojiEnabled:true});fullLink.click();check('styledLinkReplacement',linkedMatches===1&&fullLink.textContent==='🦊'&&fullLink.contains(bold)&&linkedClick==='look fox'&&linkedLine.contains(fullLink));
  const boundary=document.createElement('div');boundary.append(document.createTextNode('fo'),document.createElement('img'),document.createTextNode('x'));check('imageBoundary',BeipEmoji.applyLine(boundary,{emojiEnabled:true})===0&&boundary.textContent==='fox');
  const echo=document.createElement('div');echo.dataset.logSynthetic='true';echo.textContent='fox :)';check('typedEchoPreserved',BeipEmoji.applyLine(echo,{emojiEnabled:true})===0&&echo.textContent==='fox :)');
  session=app.createSession('emoji-fixture-session',{label:'Emoji fixture'});app.selectSession(session.id);app.startLogging(session,'now','emoji-original-'+Date.now()+'.txt');await wait(()=>session.logging&&session.logPath,'pre-emoji log opens');result.logPath=session.logPath;
  app.appendText(session,'fox dog face  warning :)\n',{},null);await session.pendingLineWork;check('receivedOutput',session.view.querySelector('.line').textContent==='🦊 dog face🐶  warning 🙂');app.stopLogging(session);await wait(()=>!session.logging,'pre-emoji log closes');check('rawLogClosed',true);
  const defaults=await request('emoji:revert');check('nativeRevert',!defaults.custom&&defaults.source===BeipEmojiModel.defaultSource&&defaults.rules===1189);
 }catch(error){result.error=String(error.message||error).slice(0,500);}
 finally{
  if(document.getElementById('settingsDialog').open)document.getElementById('settingsDialog').close();
  try{if(initial){const restored=await request(initial.custom?'emoji:save|'+encoded(initial.source):'emoji:revert');result.nativeRestored=restored.custom===initial.custom&&restored.source===initial.source;}}catch(error){result.error=(result.error||'')+' | '+error.message;}
  if(session)app.closeSession(session.id);state.preferences=savedPreferences;if(selected&&app.sessions.has(selected))app.selectSession(selected);app.applyPreferences();
  const before=state.saveCount||0;app.saveSettings();try{await wait(()=>(state.saveCount||0)>before,'restored emoji settings');result.restorationSaved=true;}catch(error){result.error=(result.error||'')+' | '+error.message;}
 }
 return result;
}
window.BeipEmojiFixture={run};
})();
