/* Classic Windows client shell around the protocol and session UI. MIT. */
(function(){
'use strict';
const byId=id=>document.getElementById(id),api=()=>window.BeipPreview;
const splitter=byId('inputSplitter');
let dragging=false,startY=0,startHeight=40;
const clamp=value=>Math.max(40,Math.min(300,Math.round(Number(value)||40)));
function setHeight(value,persist){
 const height=clamp(value);
 api().state.preferences.inputHeight=height;
 document.documentElement.style.setProperty('--input-height',height+'px');
 splitter.setAttribute('aria-valuenow',String(height));
 if(persist)api().saveSettings();
}
splitter.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;
 dragging=true;startY=event.clientY;startHeight=clamp(api().state.preferences.inputHeight);
 splitter.focus();
 splitter.setPointerCapture(event.pointerId);event.preventDefault();
});
splitter.addEventListener('pointermove',event=>{if(dragging)setHeight(startHeight+startY-event.clientY,false);});
function finishDrag(){if(!dragging)return;dragging=false;api().saveSettings();}
splitter.addEventListener('pointerup',finishDrag);
splitter.addEventListener('pointercancel',finishDrag);
splitter.addEventListener('lostpointercapture',finishDrag);
splitter.addEventListener('keydown',event=>{
 let height=clamp(api().state.preferences.inputHeight);
 if(event.key==='ArrowUp')height+=4;
 else if(event.key==='ArrowDown')height-=4;
 else if(event.key==='Home')height=40;
 else if(event.key==='End')height=300;
 else return;
 event.preventDefault();setHeight(height,true);
});
function openDialog(id){const dialog=byId(id);if(dialog&&!dialog.open)dialog.showModal();}
function click(id){byId(id)?.click();}
function toggleLogging(){const control=byId('logging');if(control.disabled)return;control.checked=!control.checked;control.dispatchEvent(new Event('change',{bubbles:true}));}
function selectOutput(){
 const session=api().current;if(!session)return;
 const range=document.createRange();range.selectNodeContents(session.view);
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 byId('output').focus();
}
function copySelection(){
 const input=byId('input');
 let value='';
 if(document.activeElement===input&&input.selectionStart!==input.selectionEnd)value=input.value.slice(input.selectionStart,input.selectionEnd);
 else value=window.getSelection()?.toString()||'';
 if(!value)return;
 const bytes=new TextEncoder().encode(value);if(bytes.length>1024*1024)return;let raw='';
 for(let at=0;at<bytes.length;at+=8192)raw+=String.fromCharCode(...bytes.subarray(at,at+8192));
 window.chrome?.webview?.postMessage('clipboard|'+btoa(raw));
}
function refreshPauseBadge(){byId('pauseBadge').hidden=!api().current?.paused;}
function resume(session){
 if(!session?.paused)return;
 session.paused=false;
 const queued=session.pausedData||[];session.pausedData=[];session.pausedDataSize=0;
 for(const payload of queued)api().incoming('session:'+session.id+':'+payload);
 refreshPauseBadge();
}
function togglePaused(){const session=api().current;if(!session)return;if(session.paused)resume(session);else session.paused=true;refreshPauseBadge();}
const actions={
 'ui:file-new':()=>{const session=api().createSession('tab'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),{label:'(New Tab)'});if(session)api().selectSession(session.id);},
 'ui:file-close':()=>{const session=api().current;if(session)api().closeSession(session.id);},
 'ui:file-export':()=>click('exportButton'),
 'ui:edit-copy':copySelection,
 'ui:edit-select-all':selectOutput,
 'ui:edit-find':()=>click('findButton'),
 'ui:edit-clear':()=>click('clear'),
 'ui:edit-follow-output':()=>{byId('autoscroll').checked=!byId('autoscroll').checked;},
 'ui:edit-pause-output':togglePaused,
 'ui:connection-connect':()=>click('profilesButton'),
 'ui:connection-disconnect':()=>click('disconnect'),
 'ui:connection-connect-all':()=>click('connectAll'),
 'ui:connection-disconnect-all':()=>click('disconnectAll'),
 'ui:connection-profiles':()=>click('profilesButton'),
 'ui:logging-toggle':()=>{if(window.BeipClassicSettings?.openLogging)BeipClassicSettings.openLogging();else toggleLogging();},
 'ui:options-aliases':()=>{if(window.BeipClassicDialogs)BeipClassicDialogs.openAliases();else click('rulesButton');},
 'ui:options-triggers':()=>{if(window.BeipClassicDialogs?.openTriggers)BeipClassicDialogs.openTriggers();else click('rulesButton');},
 'ui:options-macros':()=>{if(window.BeipClassicDialogs)BeipClassicDialogs.openMacros();else click('macrosButton');},
 'ui:options-scripts':()=>click('scriptsButton'),
 'ui:options-map':()=>window.BeipDockPanels?.toggle('map'),
 'ui:window-input-history':()=>window.BeipDockPanels?.toggle('history'),
 'ui:window-image':()=>window.BeipDockPanels?.toggle('image'),
 'ui:window-character-notes':()=>window.BeipDockPanels?.toggle('notes'),
 'ui:window-split':()=>window.BeipDockPanels?.toggle('split'),
 'ui:window-spawn':()=>window.BeipDockPanels?.toggle('spawn'),
 'ui:edit-smart-paste':()=>window.BeipClientCommands?.smartPaste?.(),
 'ui:options-preferences':()=>{if(window.BeipClassicSettings?.open)BeipClassicSettings.open();else click('settingsButton');},
 'ui:help-about':()=>openDialog('aboutDialog'),
 'ui:clipboard-saved':()=>setStatus('Copied to clipboard.'),
 'ui:clipboard-failed':()=>setStatus('Could not copy selected text.')
};
function setStatus(message){const session=api().current;if(session)session.status=message;byId('status').textContent=message;byId('status').dataset.active='true';}
function handle(message){const action=actions[message];if(!action)return false;action();return true;}
function duration(milliseconds){const seconds=Math.max(0,Math.floor(milliseconds/1000));if(seconds<60)return seconds+'s';const minutes=Math.floor(seconds/60);if(minutes<60)return minutes+'m '+seconds%60+'s';return Math.floor(minutes/60)+'h '+minutes%60+'m';}
function refreshActivity(){
 const session=api().current,now=Date.now();
 if(!session){byId('activityCounts').textContent='Typed 0  Online 0s  Idle 0s';return;}
 const online=session.connectedAt&&session.connected?duration(now-session.connectedAt):'0s';
 const idle=session.connected?duration(now-(session.activityAt||now)):'0s';
 byId('activityCounts').textContent='Typed '+session.typedCount+'  Online '+online+'  Idle '+idle;
}
byId('connectShortcut').addEventListener('click',()=>click('profilesButton'));
byId('profilesShortcut').addEventListener('click',()=>{click('profilesButton');const row=byId('characterList').querySelector('.profile-row');row?.click();});
byId('menuShortcut').addEventListener('click',()=>window.chrome?.webview?.postMessage('menu:open'));
document.addEventListener('mouseup',event=>{if(api().current?.paused)return;const node=event.target;if(!(node instanceof Element)||!node.closest('#output,.dock-output-copy,.dock-list'))return;if(!window.getSelection()?.toString())return;copySelection();});
byId('output').addEventListener('contextmenu',event=>{
 if(event.target instanceof Element&&event.target.closest('a'))return;
 event.preventDefault();
 const menu=byId('menu');menu.replaceChildren();
 const add=(label,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{menu.hidden=true;action();};menu.append(button);};
 add('Find…',()=>handle('ui:edit-find'));
 add(api().current?.paused?'Resume output':'Pause output',()=>handle('ui:edit-pause-output'));
 add('Split',()=>handle('ui:window-split'));
 add('Copy screen to clipboard',()=>{selectOutput();copySelection();});
 add('Clear',()=>handle('ui:edit-clear'));
 add('Settings…',()=>handle('ui:options-preferences'));
 menu.style.left=Math.max(0,Math.min(event.clientX,innerWidth-210))+'px';
 menu.style.top=Math.max(0,Math.min(event.clientY,innerHeight-190))+'px';
 menu.hidden=false;
});
setInterval(refreshActivity,1000);
refreshActivity();
window.BeipDesktopShell={handle,refreshActivity,refreshPauseBadge,resume,setHeight};
})();
