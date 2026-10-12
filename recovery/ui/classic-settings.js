/* Classic settings and logging windows over the recovery client's existing controls. */
(function(){
'use strict';
const byId=id=>document.getElementById(id),app=()=>window.BeipPreview;
const settings=byId('settingsDialog'),form=byId('settingsForm');
if(!settings||!form)return;

const fields={
 fontSize:byId('fontSize').closest('label'),fontFamily:byId('fontFamily').closest('label'),
 theme:byId('theme').closest('label'),scrollback:byId('scrollback').closest('label'),
 inlineImages:byId('inlineImages').closest('label'),localEcho:byId('localEcho').closest('label'),
 mediaEnabled:byId('mediaEnabled').closest('label'),defaultLogging:byId('defaultLogging').closest('label')
};
byId('fontFamily').querySelector('option[value=monospace]').textContent='Courier New';
const caption=form.querySelector('.dialog-head'),actions=form.querySelector('.dialog-actions');
caption.className='classic-settings-caption';
caption.querySelector('h2').textContent='Settings';
caption.querySelector('p')?.remove();
actions.className='classic-settings-actions';
actions.querySelector('[type=submit]').textContent='OK';
const body=document.createElement('div');body.className='classic-settings-body';
const categories=document.createElement('nav');categories.className='classic-settings-categories';categories.setAttribute('aria-label','Settings categories');
const content=document.createElement('div');content.className='classic-settings-content';
body.append(categories,content);
const scopeBar=document.createElement('label');scopeBar.className='classic-settings-scope';scopeBar.textContent='Settings for';
const scopeChoice=document.createElement('select');scopeChoice.id='classicSettingsScope';scopeChoice.setAttribute('aria-label','Settings profile');scopeBar.append(scopeChoice);
const definitions=[
 ['general','General'],['theme','UI Theme'],['input','Input Windows'],['output','Output Windows'],['logging','Logging']
];
const panels=new Map(),buttons=new Map();
for(const [key,title] of definitions){
 const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.category=key;
 button.onclick=()=>selectCategory(key);categories.append(button);buttons.set(key,button);
 const panel=document.createElement('section');panel.className='classic-settings-panel';panel.dataset.category=key;panel.hidden=true;
 const heading=document.createElement('h3');heading.textContent=title;panel.append(heading);content.append(panel);panels.set(key,panel);
}
function group(category,title,...nodes){
 const wrapper=document.createElement('fieldset');wrapper.className='classic-settings-group';
 const legend=document.createElement('legend');legend.textContent=title;wrapper.append(legend,...nodes);
 panels.get(category).append(wrapper);
}
function note(text){const p=document.createElement('p');p.className='classic-settings-note';p.textContent=text;return p;}
group('general','Windows',fields.mediaEnabled,note('Sound and speech playback is an application preference.'));
group('theme','Display',fields.theme,note('The selected theme applies to output and command windows.'));
const heightLabel=document.createElement('label');heightLabel.className='classic-settings-number';heightLabel.textContent='Command window height';
const height=document.createElement('input');height.type='number';height.min='40';height.max='300';height.step='1';height.id='classicInputHeight';height.setAttribute('aria-label','Command window height in pixels');heightLabel.append(height);
const extraControls={},samples={};
function setting(key,title,type='number',min=0,max=100){
 const label=document.createElement('label');label.textContent=title;
 const control=document.createElement('input');control.id='pref_'+key;control.type=type;control.setAttribute('aria-label',title);
 if(type==='number'){control.min=String(min);control.max=String(max);control.step='1';}
 if(type==='text'){control.maxLength=80;if(/Color|Foreground|Background/.test(key)){control.placeholder='Theme default';control.pattern='#[0-9a-fA-F]{6}|';control.title='Use #RRGGBB or leave blank for the theme default';}else{control.placeholder='Courier New';control.setAttribute('list','classicFontFaces');}}
 if(type==='checkbox'){label.textContent='';label.append(control,document.createTextNode(title));}else label.append(control);
 extraControls[key]=control;return label;
}
const fonts=document.createElement('datalist');fonts.id='classicFontFaces';for(const face of ['Courier New','Consolas','Cascadia Mono','Lucida Console','Segoe UI','Arial','Times New Roman']){const option=document.createElement('option');option.value=face;fonts.append(option);}settings.append(fonts);
function sample(category){const sample=document.createElement('div');sample.className='classic-settings-sample';sample.textContent='AaBbCc — The quick brown fox\n0123456789  Sample text';samples[category]=sample;return sample;}
function fontStyles(prefix){return ['Bold','Italic','Underline','Strikeout'].map(style=>setting(prefix+'Font'+style,style,'checkbox'));}
function margins(prefix){return ['Left','Top','Right','Bottom'].map(side=>setting(prefix+'Margin'+side,side+' margin (pixels)'));}
group('input','Text',sample('input'),setting('inputFontFace','Font face','text'),setting('inputFontSize','Font size (pixels)','number',8,72),...fontStyles('input'),setting('inputForeground','Foreground','text'),setting('inputBackground','Background','text'));
group('input','Input Window',heightLabel,setting('inputAutoSize','Resize to fit contents','checkbox'),setting('inputMinLines','Minimum height (lines)','number',1,30),setting('inputMaxLines','Maximum height (lines)','number',1,30),setting('inputSticky',"Don't clear input on enter",'checkbox'),fields.localEcho,setting('localEchoColor','Local echo color','text'),...margins('input'));
group('output','Text',sample('output'),fields.fontFamily,setting('outputFontFace','Font face override','text'),fields.fontSize,...fontStyles('output'),setting('outputForeground','Foreground','text'),setting('outputBackground','Background','text'),setting('linkColor','Link color','text'));
group('output','Output Settings',fields.scrollback,fields.inlineImages,setting('paragraphSpacing','Paragraph spacing (pixels)'),setting('wrappedIndent','Wrapped line indent (pixels)','number',0,500),setting('fixedWidth','Fixed width','checkbox'),setting('fixedWidthChars','Width (characters)','number',2,500),...margins('output'));
group('output','Appearance and scrolling',setting('fanFold','Alternating line backgrounds','checkbox'),setting('fanFoldColor1','First background','text'),setting('fanFoldColor2','Second background','text'),setting('scrollToBottom','Scroll to bottom on new output','checkbox'),setting('smoothScrolling','Smooth scrolling','checkbox'),setting('splitOnPageUp','Split on Page Up','checkbox'));
group('logging','New Sessions',fields.defaultLogging,
 note('When enabled, each new connected session starts a separate log file. Use Logging to start or stop a session manually.'));
form.replaceChildren(caption,scopeBar,body,actions);
settings.classList.add('classic-settings');
function selectCategory(key){
 for(const [name,panel] of panels){const active=name===key;panel.hidden=!active;buttons.get(name).setAttribute('aria-current',active?'page':'false');}
}
categories.addEventListener('keydown',event=>{
 if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
 const list=[...buttons.values()],at=list.indexOf(document.activeElement);
 if(at<0)return;event.preventDefault();list[(at+(event.key==='ArrowDown'?1:-1)+list.length)%list.length].focus();
});
const inheritance={};
for(const category of ['input','output']){
 const label=document.createElement('label');label.className='classic-settings-inherit';
 const check=document.createElement('input');check.type='checkbox';check.id='classic'+category+'UseParent';
 const text=document.createElement('span');label.append(check,text);
 const explanation=note('');explanation.className+=' classic-settings-effective';
 panels.get(category).querySelector('h3').after(label,explanation);
 inheritance[category]={label,check,text,explanation};
 check.onchange=()=>{captureDraft();renderScope();};
}
const controls={fontSize:byId('fontSize'),fontFamily:byId('fontFamily'),scrollback:byId('scrollback'),inlineImages:byId('inlineImages'),localEcho:byId('localEcho'),inputHeight:height,...extraControls};
let draft=new Map(),selected='global';
function model(){return window.BeipProfilePreferences;}
function profileFor(key){const [level,id]=key.split(':');return level==='world'?app().state.worlds.find(x=>x.id===id):level==='character'?app().state.characters.find(x=>x.id===id):null;}
function readControl(control){return control.type==='checkbox'?control.checked:control.type==='number'?Number(control.value):control.value;}
function writeControl(control,value){if(control.type==='checkbox')control.checked=!!value;else control.value=String(value);}
function currentDraft(key){if(!draft.has(key))draft.set(key,key==='global'?{...app().state.preferences}:model().normalizeOverrides(profileFor(key)?.preferences));return draft.get(key);}
function effective(key){
 const profile=profileFor(key),world=key.startsWith('world:')?profile:app().state.worlds.find(x=>x.id===profile?.worldId);
 const worldDraft=world?{...world,preferences:currentDraft('world:'+world.id)}:null;
 const character=key.startsWith('character:')?{...profile,preferences:currentDraft(key)}:null;
 return model().resolve(currentDraft('global'),worldDraft,character);
}
function captureDraft(){
 if(!model())return;const target=currentDraft(selected);
 if(selected==='global'){
  for(const [key,control] of Object.entries(controls))target[key]=readControl(control);
  for(const key of ['theme','mediaEnabled','defaultLogging'])target[key]=readControl(byId(key));
 }else{
  for(const [group,keys] of [['output',model().OUTPUT_KEYS],['input',model().INPUT_KEYS]]){
   // Capture editable values before applying a changed inheritance checkbox.
   if(!target[group].useParent)for(const key of keys)target[group].values[key]=readControl(controls[key]);
   target[group].useParent=inheritance[group].check.checked;
   if(!target[group].useParent&&!Object.keys(target[group].values).length){const p=effective(selected);for(const key of keys)target[group].values[key]=p[key];}
  }
 }
}
function updateSamples(){
 if(!model())return;
 const p=model().normalizeGlobal({...effective(selected),...Object.fromEntries(Object.entries(controls).map(([key,c])=>[key,readControl(c)]))});
 for(const [category,target] of Object.entries(samples)){
  if(window.BeipWindowPreferences){if(category==='output')window.BeipWindowPreferences.applyOutput(target,p);else window.BeipWindowPreferences.applyInput(target,p);}
  target.style.color=p[category+'Foreground']||(p.theme==='light'?'#111':'#c0c0c0');target.style.backgroundColor=p[category+'Background']||(p.theme==='light'?'#fff':'#000');
 }
}
for(const control of Object.values(controls))control.addEventListener('input',updateSamples);
const settingClipboard={};
for(const category of ['input','output']){
 const row=document.createElement('div');row.className='classic-settings-copy';
 const copy=document.createElement('button'),paste=document.createElement('button');copy.type=paste.type='button';copy.textContent='Copy settings';paste.textContent='Paste settings';paste.disabled=true;
 copy.onclick=()=>{settingClipboard[category]=Object.fromEntries(model()[category==='input'?'INPUT_KEYS':'OUTPUT_KEYS'].map(key=>[key,readControl(controls[key])]));paste.disabled=false;};
 paste.onclick=()=>{if(!settingClipboard[category])return;captureDraft();const target=currentDraft(selected);if(selected==='global')Object.assign(target,settingClipboard[category]);else{target[category].useParent=false;target[category].values={...settingClipboard[category]};}renderScope();};
 row.append(copy,paste);panels.get(category).append(row);
}
function renderScope(){
 const isGlobal=selected==='global',p=effective(selected),target=currentDraft(selected);
 for(const [key,control] of Object.entries(controls))writeControl(control,p[key]);
 for(const [group,keys] of [['output',model().OUTPUT_KEYS],['input',model().INPUT_KEYS]]){
  const item=inheritance[group];item.label.hidden=isGlobal;item.explanation.hidden=isGlobal;
  item.check.checked=isGlobal||target[group].useParent;
  item.text.textContent=selected.startsWith('character:')?'Use world settings':'Use global settings';
  item.explanation.textContent=item.check.checked?'Showing inherited values. Clear the checkbox to customize this profile.':'Changes apply only to this profile; unspecified values follow its parent.';
  for(const key of keys)controls[key].disabled=!isGlobal&&target[group].useParent;
 }
 for(const key of ['theme','mediaEnabled','defaultLogging']){writeControl(byId(key),currentDraft('global')[key]);byId(key).disabled=!isGlobal;}
 caption.querySelector('h2').textContent=isGlobal?'Settings':'Settings — '+(profileFor(selected)?.name||'Profile');
 updateSamples();
}
function initializeScopes(requested='global'){
 draft=new Map();scopeChoice.replaceChildren();
 function option(key,label){const entry=document.createElement('option');entry.value=key;entry.textContent=label;scopeChoice.append(entry);}
 option('global','Global settings');
 for(const world of app().state.worlds){option('world:'+world.id,'World: '+world.name);for(const character of app().state.characters.filter(x=>x.worldId===world.id))option('character:'+character.id,'Character: '+world.name+' / '+character.name);}
 selected=[...scopeChoice.options].some(x=>x.value===requested)?requested:'global';scopeChoice.value=selected;
 if(model())renderScope();
}
scopeChoice.onchange=()=>{captureDraft();selected=scopeChoice.value;renderScope();};
byId('settingsButton').addEventListener('click',()=>initializeScopes());
form.addEventListener('submit',event=>{
 if(!model()){app().state.preferences.inputHeight=Math.max(40,Math.min(300,Number(height.value)||40));return;}
 // This dialog owns scoped saves; the legacy form handler writes only global fields.
 event.preventDefault();event.stopImmediatePropagation();captureDraft();
 app().state.preferences={...app().state.preferences,...model().normalizeGlobal(currentDraft('global'))};
 for(const [key,value] of draft)if(key!=='global'){const profile=profileFor(key);if(profile)profile.preferences=model().normalizeOverrides(value);}
 app().applyPreferences();for(const session of app().sessions.values())session.media?.setEnabled(app().state.preferences.mediaEnabled);
 app().saveSettings();settings.close();
},true);
function open(scope='global'){
 if(settings.open)return;
 height.value=String(app().state.preferences.inputHeight||40);
 selectCategory('general');
 byId('settingsButton').click();
 if(model())initializeScopes(scope);
}

const logging=document.createElement('dialog');logging.id='classicLoggingDialog';logging.className='classic-logging';
logging.setAttribute('aria-labelledby','classicLoggingTitle');
logging.innerHTML=`<div class="classic-logging-caption"><h2 id="classicLoggingTitle">Logging</h2><button type="button" data-action="close" aria-label="Close logging">×</button></div>
 <div class="classic-logging-section"><strong>Current</strong><div class="classic-logging-rule"></div></div>
 <div class="classic-logging-list" role="listbox" aria-label="Current logs"></div>
 <div class="classic-logging-current-actions"><button type="button" data-action="stop">Stop</button><button type="button" data-action="stop-all">Stop All</button></div>
 <div class="classic-logging-section"><strong>New</strong><div class="classic-logging-rule"></div></div>
 <div class="classic-logging-new-actions"><button type="button" data-action="start">Start...</button><label>Starting from <select data-action="starting-point"><option value="now">Now</option><option value="beginning">Beginning of scrollback</option></select></label><button type="button" data-action="close-bottom">Close</button></div><button type="button" data-action="export" class="classic-log-export">Export active transcript...</button>`;
document.body.append(logging);
const list=logging.querySelector('.classic-logging-list');
const stop=logging.querySelector('[data-action=stop]'),stopAll=logging.querySelector('[data-action=stop-all]');
const start=logging.querySelector('[data-action=start]');
let selectedId='',refreshTimer=0,lastListSignature='';
function loggingSessions(){return [...app().sessions.values()].filter(session=>session.kind==='world'&&(session.logging||session.logWanted));}
function refreshLogging(){
 if(!logging.open)return;
 const current=app().current,active=loggingSessions();
 if(!active.some(session=>session.id===selectedId))selectedId=active.find(session=>session.id===current?.id)?.id||active[0]?.id||'';
 const signature=JSON.stringify(active.map(session=>[session.id,session.logging,session.logPath,session.connected,session.label]))+'|'+selectedId;
 if(signature!==lastListSignature){
  list.replaceChildren();
  if(!active.length){const empty=document.createElement('div');empty.className='classic-logging-empty';empty.textContent='No active logs.';list.append(empty);}
  for(const session of active){
   const row=document.createElement('button');row.type='button';row.className='classic-logging-row';row.setAttribute('role','option');
   row.setAttribute('aria-selected',String(session.id===selectedId));
   row.textContent=(session.label||session.id)+(session.logging?' — '+(session.logPath||'Logging'):session.connected?' — Starting...':' — Waiting to connect');
   row.onclick=()=>{selectedId=session.id;refreshLogging();};list.append(row);
  }
  lastListSignature=signature;
 }
 stop.disabled=!selectedId;stopAll.disabled=!active.length;
 start.disabled=!current||current.kind!=='world'||!current.connected||current.logging;
}
function stopSession(session){
 if(!session||session.kind!=='world')return;
 session.logWanted=false;
 if(session.logging||session.connected)window.chrome?.webview?.postMessage('logstop|'+session.id);
 if(session.id===app().current?.id)byId('logging').checked=false;
}
stop.onclick=()=>{stopSession(app().sessions.get(selectedId));refreshLogging();};
stopAll.onclick=()=>{for(const session of loggingSessions())stopSession(session);refreshLogging();};
start.onclick=()=>{
 const session=app().current;if(!session||session.kind!=='world'||!session.connected)return;
 session.logWanted=true;
 byId('logging').checked=true;
 if(!session.logging){if(app().startLogging)app().startLogging(session,logging.querySelector('[data-action=starting-point]').value==='beginning');else window.chrome?.webview?.postMessage('logstart|'+session.id);}
 selectedId=session.id;refreshLogging();
};
logging.querySelector('[data-action=export]').onclick=()=>byId('exportButton').click();
function closeLogging(){logging.close();}
logging.querySelector('[data-action=close]').onclick=closeLogging;
logging.querySelector('[data-action=close-bottom]').onclick=closeLogging;
logging.addEventListener('close',()=>{clearInterval(refreshTimer);refreshTimer=0;lastListSignature='';});
function openLogging(){
 if(logging.open)return;
 logging.showModal();refreshLogging();refreshTimer=setInterval(refreshLogging,500);
}
window.BeipClassicSettings={open,openLogging};
})();
