/* Auto Emoji changes text nodes only, preserving links, images and existing spans. */
(function(){
'use strict';
let source=BeipEmojiModel.defaultSource,compiled=BeipEmojiModel.compile(source),custom=false,error='',revision=0;
function snapshot(){return {source,custom,error,rules:compiled.rules.length,revision};}
function notify(){revision++;window.dispatchEvent(new CustomEvent('beip-emoji-source',{detail:snapshot()}));}
function load(value,isCustom=false){const next=BeipEmojiModel.compile(value);source=value;compiled=next;custom=isCustom;error='';notify();return snapshot();}
function globalMessage(message){
 if(typeof message!=='string'||!message.startsWith('emoji:'))return false;
 try{if(message.startsWith('emoji:source:')){const at=message.indexOf('|',13);if(at<0)throw Error('Invalid Emoji.txt response.');load(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(message.slice(at+1)),c=>c.charCodeAt(0))),message.slice(13,at)==='custom');}
 else if(message.startsWith('emoji:error:'))throw Error(new TextDecoder().decode(Uint8Array.from(atob(message.slice(12)),c=>c.charCodeAt(0))));}
 catch(failure){error=String(failure.message||failure);notify();}return true;
}
function applyLine(line,preferences){
 if(!preferences?.emojiEnabled||line.dataset.logSynthetic||line.dataset.beipEmoji==='done')return 0;
 const nodes=[];let text='';
 function collect(parent){for(const node of parent.childNodes){if(node.nodeType===Node.TEXT_NODE){nodes.push({node,start:text.length,end:text.length+node.textContent.length});text+=node.textContent;}else if(node.nodeType===Node.ELEMENT_NODE){if(node.matches('.inline-image,img,[data-auto-emoji]'))text+='\0';else collect(node);}}}
 collect(line);
 const interactive=node=>node.parentElement?.closest('a,button,[role="link"],[data-command]')||null;
 const hits=BeipEmojiModel.matches(text,compiled).filter(hit=>{const leaves=nodes.filter(item=>item.end>hit.start&&item.start<hit.end);return leaves.length&&leaves.every(item=>interactive(item.node)===interactive(leaves[0].node));});line.dataset.beipEmoji='done';
 for(const hit of hits.reverse()){
  const start=hit.replace?hit.start:hit.end,end=hit.end;
  const first=nodes.find(item=>(hit.replace?start>=item.start&&start<item.end:start>item.start&&start<=item.end)&&item.node.parentNode),last=nodes.find(item=>end>item.start&&end<=item.end&&item.node.parentNode);if(!first||!last)continue;
  // Edit text leaves independently: Range.deleteContents can remove a whole
  // existing link when a replacement crosses a styled or interactive boundary.
  if(hit.replace)for(const item of nodes){const from=Math.max(start,item.start),to=Math.min(end,item.end);if(to>from)item.node.deleteData(from-item.start,to-from);}
  const range=document.createRange();range.setStart(first.node,start-first.start);range.collapse(true);
  const emoji=document.createElement('span');emoji.dataset.autoEmoji='true';emoji.className='auto-emoji';emoji.textContent=hit.emoji;range.insertNode(emoji);
 }
 return hits.length;
}
window.BeipEmoji={snapshot,load,globalMessage,applyLine};
const initialize=()=>window.chrome?.webview?.postMessage('emoji:load');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
