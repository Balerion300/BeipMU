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
group('general','Windows',fields.inlineImages,fields.mediaEnabled);
group('theme','Display',fields.theme,note('The selected theme applies to output and command windows.'));
const heightLabel=document.createElement('label');heightLabel.className='classic-settings-number';heightLabel.textContent='Command window height';
const height=document.createElement('input');height.type='number';height.min='40';height.max='300';height.step='1';height.id='classicInputHeight';height.setAttribute('aria-label','Command window height in pixels');heightLabel.append(height);
group('input','Input Window',heightLabel,fields.localEcho,note('Enter sends a command. Shift+Enter inserts a new line; Ctrl+Up and Ctrl+Down recall command history.'));
group('output','Global Output Settings',fields.fontFamily,fields.fontSize,fields.scrollback,
 note('The text sample in the main window updates when you save these settings.'));
group('logging','New Sessions',fields.defaultLogging,
 note('When enabled, each new connected session starts a separate log file. Use Logging to start or stop a session manually.'));
form.replaceChildren(caption,body,actions);
settings.classList.add('classic-settings');
function selectCategory(key){
 for(const [name,panel] of panels){const active=name===key;panel.hidden=!active;buttons.get(name).setAttribute('aria-current',active?'page':'false');}
}
categories.addEventListener('keydown',event=>{
 if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
 const list=[...buttons.values()],at=list.indexOf(document.activeElement);
 if(at<0)return;event.preventDefault();list[(at+(event.key==='ArrowDown'?1:-1)+list.length)%list.length].focus();
});
form.addEventListener('submit',()=>{app().state.preferences.inputHeight=Math.max(40,Math.min(300,Number(height.value)||40));},true);
function open(){
 if(settings.open)return;
 height.value=String(app().state.preferences.inputHeight||40);
 selectCategory('general');
 byId('settingsButton').click();
}

const logging=document.createElement('dialog');logging.id='classicLoggingDialog';logging.className='classic-logging';
logging.setAttribute('aria-labelledby','classicLoggingTitle');
logging.innerHTML=`<div class="classic-logging-caption"><h2 id="classicLoggingTitle">Logging</h2><button type="button" data-action="close" aria-label="Close logging">×</button></div>
 <div class="classic-logging-section"><strong>Current</strong><div class="classic-logging-rule"></div></div>
 <div class="classic-logging-list" role="listbox" aria-label="Current logs"></div>
 <div class="classic-logging-current-actions"><button type="button" data-action="stop">Stop</button><button type="button" data-action="stop-all">Stop All</button></div>
 <div class="classic-logging-section"><strong>New</strong><div class="classic-logging-rule"></div></div>
 <div class="classic-logging-new-actions"><button type="button" data-action="start">Start...</button><button type="button" data-action="export">Export active transcript...</button><button type="button" data-action="close-bottom">Close</button></div>`;
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
 if(!session.logging)window.chrome?.webview?.postMessage('logstart|'+session.id);
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
