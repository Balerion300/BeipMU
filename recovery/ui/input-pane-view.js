/* Owned additional input pane DOM; caller supplies docking and dispatch. MIT. */
(function(root){
'use strict';
function mount(container,owner,model,key,ports){
 const doc=container.ownerDocument,form=doc.createElement('form'),input=doc.createElement('textarea'),send=doc.createElement('button'),message=doc.createElement('p');let disposed=false;
 form.className='additional-input';input.className='additional-input-text';input.maxLength=root.BeipInputPanes.MAX_DRAFT;input.spellcheck=false;send.type='submit';send.textContent='Send';message.className='additional-input-status';message.setAttribute('role','status');form.append(input,send,message);container.append(form);
 const valid=()=>!disposed&&ports.valid(owner)&&model.panes.has(key);
 function refresh(){if(!valid())return;const pane=model.get(key);input.value=pane.text;input.setSelectionRange(pane.start,pane.end);input.setAttribute('aria-label',model.caption(pane));ports.style?.(input,owner,pane);}
 function capture(){if(!valid())return;model.set(key,input.value,{stripPrefix:false});model.select(key,input.selectionStart,input.selectionEnd);}
 const report=error=>{if(valid())message.textContent=String(error.message||error);};
 const onInput=()=>{capture();ports.changed?.(owner,key);},onSelect=()=>{if(valid())model.select(key,input.selectionStart,input.selectionEnd);},onFocus=()=>{if(valid()){model.activate(key);ports.activated?.(owner,key);}},onSubmit=event=>{event.preventDefault();if(!valid())return;capture();ports.beforeSubmit?.(owner,key);const packet=model.submit(key);refresh();message.textContent='';try{Promise.resolve(ports.submit(owner,packet)).catch(report);}catch(error){report(error);}},onKey=event=>{
  if(!valid()||event.isComposing)return;
  if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey){event.preventDefault();event.stopPropagation();form.requestSubmit();}
  else if(event.ctrlKey&&!event.shiftKey&&!event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();event.stopPropagation();capture();model.recall(key,event.key==='ArrowUp'?-1:1);refresh();}
 };
 input.addEventListener('input',onInput);input.addEventListener('select',onSelect);input.addEventListener('focus',onFocus);input.addEventListener('keydown',onKey);form.addEventListener('submit',onSubmit);refresh();
 return {form,input,refresh,focus(){if(valid())input.focus();},destroy(){if(disposed)return;capture();disposed=true;input.removeEventListener('input',onInput);input.removeEventListener('select',onSelect);input.removeEventListener('focus',onFocus);input.removeEventListener('keydown',onKey);form.removeEventListener('submit',onSubmit);form.remove();}};
}
root.BeipInputPaneView={mount};
})(typeof globalThis==='object'?globalThis:this);
