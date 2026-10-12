/* Original-style keyboard shortcut editor and dispatcher. MIT. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=()=>window.BeipPreview,model=window.BeipShortcuts;
const dialog=document.createElement('dialog');dialog.id='shortcutDialog';dialog.setAttribute('aria-labelledby','shortcutTitle');
dialog.innerHTML='<div class="shortcut-head"><h2 id="shortcutTitle">Keyboard Shortcuts</h2><button type="button" data-action="close" aria-label="Close">×</button></div><div class="shortcut-body"><div class="shortcut-list" role="listbox" aria-label="Application shortcuts"><div class="shortcut-list-head"><span>Action</span><span>Key</span></div><div id="shortcutRows"></div></div><div class="shortcut-edit"><label>Press key combination here<input id="shortcutKey" autocomplete="off" spellcheck="false" aria-label="Key combination"></label><button type="button" data-action="clear">Clear</button><button type="button" data-action="default">Default</button></div><p id="shortcutError" class="shortcut-error" role="alert"></p></div><div class="shortcut-footer"><button type="button" data-action="reset">Reset All</button><span><button type="button" data-action="apply">Apply</button><button type="button" data-action="save">OK</button><button type="button" data-action="cancel">Cancel</button></span></div>';
document.body.append(dialog);
const one=selector=>dialog.querySelector(selector);
let draft={},selected=model.ACTIONS[0].id;
function currentBindings(){return model.bindings(draft);}
function error(value){one('#shortcutError').textContent=value||'';}
function render(){const rows=one('#shortcutRows'),values=currentBindings();rows.replaceChildren();for(const action of model.ACTIONS){const row=document.createElement('button');row.type='button';row.className='shortcut-row';row.setAttribute('role','option');row.setAttribute('aria-selected',String(action.id===selected));const name=document.createElement('span');name.textContent=action.label;const key=document.createElement('span');key.textContent=values[action.id]||'';row.append(name,key);row.onclick=()=>{selected=action.id;render();};rows.append(row);}one('#shortcutKey').value=values[selected]||'';}
function setKey(value){try{const before=currentBindings(),next=model.assign(draft,selected,value);draft=next;const after=currentBindings(),replaced=model.ACTIONS.find(action=>action.id!==selected&&before[action.id]&&after[action.id]===''&&before[action.id]===value);error(replaced?replaced.label+' was cleared because it used this key.':'');render();}catch(e){error(e.message);}}
function open(){draft=model.normalizeOverrides(api().state.preferences.shortcuts);selected=model.ACTIONS[0].id;error('');render();if(!dialog.open)dialog.showModal();}
function save(close){api().state.preferences.shortcuts=model.normalizeOverrides(draft);api().saveSettings();error('');if(close)dialog.close();}
one('[data-action=close]').onclick=()=>dialog.close();one('[data-action=cancel]').onclick=()=>dialog.close();one('[data-action=apply]').onclick=()=>save(false);one('[data-action=save]').onclick=()=>save(true);one('[data-action=clear]').onclick=()=>setKey('');one('[data-action=default]').onclick=()=>setKey(model.DEFAULTS[selected]||'');one('[data-action=reset]').onclick=()=>{draft={};error('');render();};
one('#shortcutKey').onkeydown=event=>{if(event.key==='Tab'&&!event.ctrlKey&&!event.altKey&&!event.metaKey)return;event.preventDefault();event.stopPropagation();if(event.key==='Backspace'||event.key==='Delete'){setKey('');return;}const chord=model.safeChord(event);if(chord)setKey(chord);else error('Use Control or Alt with a letter, or choose a function/navigation key.');};
function isOtherEditor(target){if(!(target instanceof Element))return false;if(target===$('input'))return false;if(target.closest('dialog,[contenteditable=true],[contenteditable=""]'))return true;if(target.matches('textarea,select'))return true;if(target.matches('input'))return target.type!=='button'&&target.type!=='submit';return false;}
function historyMove(session,step){const input=$('input'),index=session.historyIndex??session.history.length;if(index===session.history.length&&step<0)session.historyDraft=input.value;session.historyIndex=Math.max(0,Math.min(session.history.length,index+step));input.value=session.historyIndex===session.history.length?session.historyDraft||'':session.history[session.historyIndex]||'';input.focus();input.setSelectionRange(input.value.length,input.value.length);api().resizeInput();}
function handleAction(action,session,target){const input=$('input'),inInput=target===input,shell=window.BeipDesktopShell;
 const output=$('output'),inOutput=target===output||output.contains(target);
 if(action==='minimize'){window.chrome?.webview?.postMessage('window:minimize');return true;}
 if(action==='findInput'){window.BeipSearch?.open('input');return true;}
 if(action==='sendInput'){if(!inInput)return false;$('command').requestSubmit();return true;}
 if(action==='saveHistory'){if(!inInput)return false;const value=input.value;if(value){session.history.push(value);if(session.history.length>500)session.history.shift();session.historyIndex=session.history.length;window.BeipDockPanels?.addHistory(session,value);input.value='';}else historyMove(session,1);return true;}
 if(action==='historyUp'||action==='historyDown'){if(!inInput)return false;historyMove(session,action==='historyUp'?-1:1);return true;}
 if(action==='sendLastHistory'){const value=session.history.at(-1);if(!value)return false;api().command(value,false,session);return true;}
 if(action==='clearInput'){if(!inInput)return false;input.value='';return true;}
 if(action==='convertReturns'||action==='convertTabs'){if(!inInput)return false;input.value=action==='convertReturns'?input.value.replace(/\r\n?|\n/g,'%R'):input.value.replace(/\t/g,'%T');return true;}
 if(action==='nextTab'||action==='previousTab'){const ids=[...api().sessions.keys()],at=ids.indexOf(session.id),step=action==='nextTab'?1:-1;api().selectSession(ids[(at+step+ids.length)%ids.length]);return true;}
 if(action==='reconnect'){window.BeipClientCommands?.handle('/reconnect',session);return true;}
 if(action==='outputTop'||action==='outputBottom'){if(!inOutput)return false;output.scrollTop=action==='outputTop'?0:output.scrollHeight;return true;}
 if(['outputLineUp','outputLineDown','outputPageUp','outputPageDown'].includes(action)){if(!inOutput&&!inInput)return false;if(action==='outputPageUp'&&api().preferencesForSession(session).splitOnPageUp)window.BeipDockPanels?.open('split');const line=Math.max(12,parseFloat(getComputedStyle(output).lineHeight)||16),page=Math.max(line,output.clientHeight-line);output.scrollTop+=(action==='outputLineUp'?-line:action==='outputLineDown'?line:action==='outputPageUp'?-page:page);return true;}
 if(action==='selectOutput'&&!inOutput)return false;
 if(action==='historyWindow'){window.BeipDockPanels?.open('history');window.BeipSearch?.open('history');return true;}
 const dispatch={newTab:'ui:file-new',closeTab:'ui:file-close',connect:'ui:connection-connect',disconnect:'ui:connection-disconnect',findOutput:'ui:edit-find',pauseOutput:'ui:edit-pause-output',selectOutput:'ui:edit-select-all',smartPaste:'ui:edit-smart-paste',logging:'ui:logging-toggle',triggers:'ui:options-triggers',aliases:'ui:options-aliases',macros:'ui:options-macros',settings:'ui:options-preferences',mapWindow:'ui:options-map',imageWindow:'ui:window-image',notesWindow:'ui:window-character-notes'};
 return !!(dispatch[action]&&shell?.handle(dispatch[action]));
}
function handleKey(event,session){if(!session||event.defaultPrevented||event.isComposing||event.keyCode===229||event.repeat||isOtherEditor(event.target))return false;const action=model.lookup(event,api().state.preferences.shortcuts);if(!action)return false;if(action==='sendInput'&&event.shiftKey)return false;if(!handleAction(action,session,event.target))return false;event.preventDefault();event.stopImmediatePropagation();return true;}
window.BeipShortcutUI={open,handleKey};
})();
