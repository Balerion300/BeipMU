/* Session/epoch-owned restore transport and safe structured rendering. */
(function(root,factory){const model=typeof module==='object'&&module.exports?require('./restore-model.js'):root.BeipRestoreModel;const api=factory(model);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipRestoreRuntime=api;})(typeof globalThis==='object'?globalThis:this,function(model){
'use strict';
function encoded(text){let value='';for(const byte of new TextEncoder().encode(text))value+=String.fromCharCode(byte);return btoa(value);}
function decoded(text){if(text.length>model.MAX_RECORD_BYTES*2)throw Error('Oversized restore response.');return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text),value=>value.charCodeAt(0)));}
function createController({sessionId,characterId,epoch,preferences,character,post,onReplay=()=>{},onError=()=>{},onReady=()=>{},onCleared=()=>{},timeoutMs=15000}){
 if(!/^[a-z\d_-]{1,64}$/i.test(sessionId)||!/^[a-z\d_-]{1,64}$/i.test(characterId)||!Number.isSafeInteger(epoch)||epoch<0)throw Error('Invalid restore session identity.');
 const config=model.normalizeGlobal(preferences?.restore),isEnabled=model.enabled(preferences,character),limit=config.bufferKiB*1024;let mode='idle',timer=null,expected=null,records=[],loadedBytes=0,pending=[],pendingBytes=0,clearing=false;
 const identity=sessionId+'|'+characterId+'|'+epoch;
 const fail=error=>{clearTimeout(timer);mode='failed';clearing=false;records=[];pending=[];pendingBytes=0;onError(String(error.message||error));};
 function start({load=true}={}){if(mode!=='idle')throw Error('Restore loading can only start once.');post('restoreconfig|'+identity+'|'+(isEnabled?'1':'0')+'|'+config.bufferKiB);if(!isEnabled){mode='disabled';onReady();return;}if(!load){mode='live';onReady();return;}mode='loading';timer=setTimeout(()=>fail(Error('Restoring previous output timed out.')),timeoutMs);post('restoreload|'+identity);}
 function capture(raw){if(['cancelled','failed','disabled','idle'].includes(mode))return false;let value;try{value=model.serialize(raw);}catch(error){onError(error.message);return false;}if(mode==='live'){post('restorewrite|'+identity+'|'+encoded(value));return true;}const bytes=new TextEncoder().encode(value).length+4;while(pending.length&&pendingBytes+bytes>limit){pendingBytes-=pending.shift().bytes;}if(bytes>limit)return false;pending.push({value,bytes});pendingBytes+=bytes;return true;}
 async function finish(){clearTimeout(timer);mode='replaying';const saved=records;records=[];try{await onReplay(saved);if(mode!=='replaying')return;mode='live';for(const item of pending)post('restorewrite|'+identity+'|'+encoded(item.value));pending=[];pendingBytes=0;onReady();}catch(error){if(mode!=='cancelled')fail(error);}}
 function message(payload){
  if(typeof payload!=='string'||!/^restore(?:begin|item|end|error|cleared):/.test(payload))return false;
  const fields=payload.split(':'),type=fields[0];if(fields[1]!==characterId||fields[2]!==String(epoch)||mode==='cancelled')return true;
  try{
   if(type==='restoreerror'){if(fields.length!==4)throw Error('Invalid restore error response.');fail(Error(decoded(fields[3])));return true;}
   if(type==='restorecleared'){if(fields.length!==3||!clearing)throw Error('Unexpected restore clear response.');clearing=false;if(mode==='failed')mode=isEnabled?'live':'disabled';onCleared();return true;}
   if(mode!=='loading')return true;
   if(type==='restorebegin'){if(fields.length!==4||expected!==null||!/^\d+$/.test(fields[3]))throw Error('Invalid restore begin response.');expected=Number(fields[3]);if(!Number.isSafeInteger(expected)||expected>200000)throw Error('Too many restore records.');}
   else if(type==='restoreitem'){if(fields.length!==5||expected===null||fields[3]!==String(records.length)||records.length>=expected)throw Error('Restore records arrived out of sequence.');const source=decoded(fields[4]);loadedBytes+=new TextEncoder().encode(source).length+4;if(loadedBytes>limit)throw Error('Restore data exceeds the configured character buffer.');records.push(model.deserialize(source));}
   else if(type==='restoreend'){if(fields.length!==4||expected===null||fields[3]!==String(expected)||records.length!==expected)throw Error('Incomplete restore response.');void finish();}
  }catch(error){fail(error);}return true;
 }
 function cancel(){clearTimeout(timer);mode='cancelled';records=[];pending=[];pendingBytes=0;}
 function clear(){if(mode==='loading'||mode==='replaying'||mode==='idle'||mode==='cancelled')throw Error('Wait for restore loading to finish before clearing saved output.');if(clearing)return;clearing=true;post('restoreclear|'+identity);}
 return {start,capture,message,cancel,clear,get mode(){return mode;}};
}
function fromLine(line){
 if(line.dataset.restoreReplay||line.dataset.logSynthetic)return null;const parts=[];
 function linkOf(node){if(node.tagName!=='A')return undefined;return {kind:node.dataset.kind||'url',value:node.dataset.value||node.getAttribute('href')||'',hint:node.title||'',prompt:node.dataset.prompt==='true'};}
 function walk(node,inherited={},link){if(node.nodeType===3){if(node.textContent)parts.push({type:'text',text:node.textContent,style:{...inherited},...(link?{link}:{} )});return;}if(node.nodeType!==1)return;
  if(node.classList.contains('inline-image')){const image=node.querySelector('img');if(image){const source=image.getAttribute('src');if(source){const imagePart={type:'image',url:source,alt:image.alt||''},height=parseFloat(image.style.maxHeight);if(Number.isFinite(height))imagePart.height=Math.max(0,Math.min(4096,Math.round(height)));const imageLink=linkOf(image.closest('a')||{});if(imageLink)imagePart.link=imageLink;parts.push(imagePart);}return;}}
  const own={...inherited},css=node.style;if(css.color)own.color=css.color;if(css.backgroundColor)own.background=css.backgroundColor;if(css.fontWeight)own.bold=css.fontWeight==='bold'||Number(css.fontWeight)>=600;if(css.fontStyle)own.italic=css.fontStyle==='italic';if(css.textDecorationLine||css.textDecoration){const decoration=css.textDecorationLine||css.textDecoration;own.underline=decoration.includes('underline');own.strike=decoration.includes('line-through');}const target=linkOf(node)||link;for(const child of node.childNodes)walk(child,own,target);
 }
 walk(line);return model.normalizeRecord({v:1,kind:'line',time:Number(line.dataset.logTime)||Date.now(),parts});
}
function renderLine(raw,{document:doc=globalThis.document,onLink=()=>{},onImage=()=>{}}={}){
 const record=model.normalizeRecord(raw);if(record.kind!=='line')throw Error('A line record is required.');const line=doc.createElement('div');line.className='line';line.dataset.restoreReplay='true';line.dataset.logTime=String(record.time);
 for(const part of record.parts){if(part.type==='image'){const placeholder=doc.createElement('button');placeholder.type='button';placeholder.className='restore-image';placeholder.textContent='Load saved image'+(part.alt?': '+part.alt:'');placeholder.onclick=()=>onImage(part,placeholder);line.append(placeholder);continue;}
  const node=doc.createElement(part.link?'a':'span');node.textContent=part.text;const style=part.style||{};if(style.color)node.style.color=style.color;if(style.background)node.style.backgroundColor=style.background;node.style.fontWeight=style.bold?'bold':'normal';node.style.fontStyle=style.italic?'italic':'normal';node.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ')||'none';if(part.link){node.href=part.link.kind==='url'?part.link.value:'#';node.title=part.link.hint||part.link.value;node.dataset.kind=part.link.kind;node.dataset.value=part.link.value;node.dataset.prompt=String(!!part.link.prompt);node.onclick=event=>{event.preventDefault();onLink(part.link,event);};}line.append(node);
 }
 return line;
}
return Object.freeze({createController,fromLine,renderLine});
});
