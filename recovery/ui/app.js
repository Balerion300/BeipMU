'use strict';
const $=id=>document.getElementById(id),bridge=window.chrome?.webview;
const send=text=>bridge?.postMessage(text),output=$('output'),history=[];
window.addEventListener('error',e=>send('error|'+e.message));
let historyIndex=0,line=null,images=0,loaded=0,failed=0,test=false,testClicked=false,testReported=false,decoder=new TextDecoder();
const menu=$('menu');
function command(value,prompt){if(prompt){$('input').value=value;$('input').focus();}else send('send|'+value);}
function activate(link,event){if(link.kind==='url'){send('external|'+link.value);return;}
 const commands=link.value.split('|').filter(Boolean),hints=(link.hint||'').split('|');
 if((event.type==='contextmenu'||event.shiftKey)&&commands.length>1){menu.replaceChildren();commands.forEach((c,i)=>{const button=document.createElement('button');button.textContent=hints[i+1]||c;button.onclick=()=>{menu.hidden=true;command(c,link.prompt);};menu.append(button);});menu.style.left=Math.min(event.clientX,innerWidth-250)+'px';menu.style.top=Math.min(event.clientY,innerHeight-commands.length*42)+'px';menu.hidden=false;}
 else if(commands.length)command(commands[0],link.prompt);
}
function anchor(link){const a=document.createElement('a');a.href=link.kind==='url'?link.value:'#';a.title=link.hint||link.value;a.dataset.kind=link.kind;a.onclick=e=>{e.preventDefault();activate(link,e);};a.oncontextmenu=e=>{if(link.kind==='command'){e.preventDefault();activate(link,e);}};return a;}
function ensureLine(){if(!line){line=document.createElement('div');line.className='line';output.append(line);}return line;}
function finalizeLine(){if(!line)return;const seen=new Set();for(const node of [...line.children]){if(node.tagName!=='SPAN')continue;const text=node.textContent,re=/https?:\/\/[^\s<>"']+/g,fragment=document.createDocumentFragment();let at=0,m;while((m=re.exec(text))){const url=m[0].replace(/[).,;!?]+$/,'');if(!BeipProtocol.webURL(url))continue;const prefix=document.createElement('span');prefix.style.cssText=node.style.cssText;prefix.textContent=text.slice(at,m.index);fragment.append(prefix);const a=anchor({kind:'url',value:url});a.textContent=url;fragment.append(a);at=m.index+url.length;try{if(!seen.has(url)&&/\.(png|jpe?g|gif|webp|bmp)$/i.test(new URL(url).pathname)){seen.add(url);image({url,alt:'Linked image',height:220});}}catch{}}
 if(at){const tail=document.createElement('span');tail.style.cssText=node.style.cssText;tail.textContent=text.slice(at);fragment.append(tail);node.replaceWith(fragment);}}
}
function appendText(text,style,link){const parts=text.split('\n');parts.forEach((s,i)=>{if(i){finalizeLine();line=null;}if(!s){ensureLine();return;}const parent=link?anchor(link):document.createElement('span');parent.textContent=s;
 if(style.bold)parent.style.fontWeight='bold';if(style.italic)parent.style.fontStyle='italic';if(style.color)parent.style.color=style.color;if(style.background)parent.style.background=style.background;parent.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ');const current=ensureLine(),last=current.lastElementChild;if(!link&&last?.tagName==='SPAN'&&last.style.cssText===parent.style.cssText)last.append(document.createTextNode(s));else current.append(parent);
 });}
function image(event){images++;const figure=document.createElement('figure');figure.className='inline-image';const img=document.createElement('img');img.alt=event.alt;img.style.maxHeight=event.height+'px';const caption=document.createElement('figcaption');caption.textContent='Loading image…';const parent=event.link?anchor(event.link):anchor({kind:'url',value:event.url});parent.append(img);figure.append(parent,caption);ensureLine().append(figure);
 img.onload=()=>{loaded++;caption.textContent=event.alt;updateCounts();scroll();};img.onerror=()=>{failed++;caption.classList.add('image-error');caption.replaceChildren(document.createTextNode('Image could not be loaded. '));const source=anchor({kind:'url',value:event.url});source.textContent='Open source';caption.append(source);updateCounts();};img.src=event.url;updateCounts();}
function updateCounts(){$('counts').textContent=`${images} image${images===1?'':'s'} · ${loaded} loaded${failed?' · '+failed+' failed':''}`;}
function scroll(){if($('autoscroll').checked)output.scrollTop=output.scrollHeight;while(output.children.length>5000)output.firstChild.remove();}
const parser=new BeipProtocol.Parser(event=>{if(event.type==='text')appendText(event.text,event.style,event.link);else if(event.type==='image')image(event);else if(event.type==='protocol')$('protocol').textContent=[event.pueblo?'Pueblo':'',event.mxp?'MXP':''].filter(Boolean).join(' + ')||'Plain text';else if(event.type==='warning')appendText('\n'+event.text+'\n',{color:'#e9ab96'},null);scroll();},value=>send('send|'+value));
function incoming(message){if(message.startsWith('data:')){const bytes=Uint8Array.from(atob(message.slice(5)),c=>c.charCodeAt(0));parser.feed(decoder.decode(bytes,{stream:true}));}
 else if(message.startsWith('status:'))$('status').textContent=message.slice(7);
 else if(message==='reset:'){parser.reset();decoder=new TextDecoder();$('protocol').textContent='Plain text';}
 else if(message==='mxp:on')parser.setMXP(true);else if(message==='mxp:off')parser.setMXP(false);
 else if(message==='ended:'){parser.feed(decoder.decode());parser.finish();finalizeLine();}
 else if(message==='test:'){test=true;output.replaceChildren();line=null;}
 if(test&&!testClicked){const a=output.querySelector('a[data-kind="command"]');if(a){testClicked=true;a.click();}}
 if(test&&!testReported&&output.textContent.includes('FIXTURE COMPLETE')){testReported=true;setTimeout(()=>send('testresult:'+JSON.stringify({images,loaded,failed,commandClicked:testClicked,protocol:$('protocol').textContent,lines:[...output.querySelectorAll('.line')].map(e=>e.textContent),text:output.textContent})),1500);}
}
bridge?.addEventListener('message',e=>incoming(e.data));
$('connection').onsubmit=e=>{e.preventDefault();send('connect|'+$('host').value.trim()+'|'+$('port').value.trim());};
$('disconnect').onclick=()=>send('disconnect');
$('command').onsubmit=e=>{e.preventDefault();const value=$('input').value;if(!value)return;history.push(value);historyIndex=history.length;command(value,false);$('input').value='';};
$('input').onkeydown=e=>{if(e.key==='ArrowUp'&&history.length){e.preventDefault();historyIndex=Math.max(0,historyIndex-1);$('input').value=history[historyIndex];}if(e.key==='ArrowDown'){e.preventDefault();historyIndex=Math.min(history.length,historyIndex+1);$('input').value=history[historyIndex]||'';}};
$('clear').onclick=()=>{output.replaceChildren();line=null;images=loaded=failed=0;updateCounts();};
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.hidden=true;});
window.BeipPreview={incoming,parser};send('ready');
