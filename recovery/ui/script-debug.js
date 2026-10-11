/* Separate, bounded Script Debug Output for opt-in user scripts. MIT. */
(function(){
'use strict';
const MAX_ENTRIES=200,MAX_MESSAGE=512;
const dialog=document.createElement('dialog');dialog.id='scriptDebugDialog';dialog.className='script-debug';
dialog.setAttribute('aria-labelledby','scriptDebugTitle');
dialog.innerHTML='<div class="script-debug-head"><h2 id="scriptDebugTitle">Script Debug Output</h2><button type="button" data-action="close" aria-label="Close">×</button></div><div class="script-debug-list" role="log" aria-live="polite"></div><div class="script-debug-actions"><button type="button" data-action="clear">Clear</button><button type="button" data-action="close">Close</button></div>';
document.body.append(dialog);
const list=dialog.querySelector('.script-debug-list');
function open(){if(!dialog.open)dialog.showModal();}
function close(){if(dialog.open)dialog.close();}
function clear(){list.replaceChildren();}
function record(session,message,{show=true}={}){
 const text=String(message??'').slice(0,MAX_MESSAGE);
 const row=document.createElement('div');row.className='script-debug-entry';
 const heading=document.createElement('div');heading.className='script-debug-entry-head';
 const time=document.createElement('time');time.dateTime=new Date().toISOString();time.textContent=new Date().toLocaleTimeString();
 const label=document.createElement('strong');label.textContent=String(session?.label||session?.id||'Script').slice(0,80);
 const detail=document.createElement('pre');detail.textContent=text;
 heading.append(time,label);row.append(heading,detail);list.append(row);
 while(list.children.length>MAX_ENTRIES)list.firstChild.remove();
 if(show)open();list.scrollTop=list.scrollHeight;
}
for(const button of dialog.querySelectorAll('[data-action="close"]'))button.onclick=close;
dialog.querySelector('[data-action="clear"]').onclick=clear;
window.BeipScriptDebug={open,close,clear,record};
})();
