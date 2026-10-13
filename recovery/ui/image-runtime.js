/* Owned image actions and inline/avatar presentation. MIT. */
(function(){
'use strict';
const app=()=>window.BeipPreview,records=new WeakMap();let menu=null;
const encode=value=>{const bytes=new TextEncoder().encode(value);let raw='';for(let at=0;at<bytes.length;at+=8192)raw+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(raw);};
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value),char=>char.charCodeAt(0)));
const owned=session=>!!session&&app()?.sessions.get(session.id)===session;
function request(session,action,url){
 if(!owned(session)||!['save','copy','copy-url','open','view'].includes(action))return false;
 url=BeipImageView.webURL(url);if(!url)return false;
 if(action==='view'){BeipDockPanels.addImage(session,{url,alt:'Selected image'});BeipDockPanels.open('image',session);}
 else if(action==='open')window.chrome?.webview?.postMessage('external|'+url);
 else if(action==='copy-url')window.chrome?.webview?.postMessage('clipboard|'+encode(url));
 else{app().showStatus(session,action==='save'?'Preparing image to save…':'Preparing image to copy…');window.chrome?.webview?.postMessage('image:'+action+'|'+session.id+'|'+encode(url));}
 return true;
}
function handleNative(session,payload){
 if(!payload.startsWith('imageaction:'))return false;if(!owned(session))return true;
 const match=/^imageaction:(save|copy):(saved|copied|cancelled|error):(.*)$/.exec(payload);if(!match)return true;let detail='';try{detail=decode(match[3]);}catch{}
 const event={sessionId:session.id,action:match[1],status:match[2],detail};(session.imageActions??=[]).push(event);if(session.imageActions.length>30)session.imageActions.shift();
 app().showStatus(session,event.status==='error'?'Image '+event.action+' failed: '+detail:event.status==='cancelled'?'Image save cancelled.':event.status==='saved'?'Image saved.':'Image copied.');window.dispatchEvent(new CustomEvent('beip-image-action',{detail:event}));return true;
}
function closeMenu(){menu?.close();menu?.remove();menu=null;}
function freeze(record){
 const {img}=record;if(record.disposed)return;record.canvas?.remove();record.canvas=null;img.hidden=false;if(!record.paused||!img.complete||!img.naturalWidth)return;
 try{const canvas=document.createElement('canvas'),scale=Math.min(1,2048/img.naturalWidth,2048/img.naturalHeight);canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);canvas.className=img.className;canvas.style.cssText=img.style.cssText;const bounds=img.getBoundingClientRect();canvas.style.width=bounds.width+'px';canvas.style.height=bounds.height+'px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',img.alt);canvas.title=img.title;canvas.onclick=img.onclick;canvas.oncontextmenu=event=>contextMenu(event,record);img.before(canvas);img.hidden=true;record.canvas=canvas;}catch{record.paused=false;}
}
function contextMenu(event,record){
 if(!owned(record.session))return;event.preventDefault();event.stopPropagation();closeMenu();menu=document.createElement('dialog');menu.className='image-actions';menu.setAttribute('aria-label','Image actions');const dialog=menu;
 const item=(label,fn)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{closeMenu();fn();};dialog.append(button);};
 item('View image',()=>request(record.session,'view',record.img.src));item('Open source',()=>request(record.session,'open',record.img.src));item('Copy image URL',()=>request(record.session,'copy-url',record.img.src));item('Save image…',()=>request(record.session,'save',record.img.src));item('Copy image',()=>request(record.session,'copy',record.img.src));item(record.paused?'Animate image':'Pause animation',()=>{record.paused=!record.paused;freeze(record);});item('Cancel',()=>{});dialog.addEventListener('close',()=>{dialog.remove();if(menu===dialog)menu=null;});document.body.append(dialog);dialog.showModal();
}
function bind(img,session,options={}){
 if(!owned(session))return;let record=records.get(img);if(!record){record={img,session,options,paused:false,canvas:null,url:''};records.set(img,record);img.addEventListener('load',()=>{record.paused=!!app().preferencesForSession(record.session).animatedImagesStartPaused;freeze(record);});img.addEventListener('error',()=>{record.canvas?.remove();record.canvas=null;});img.oncontextmenu=event=>contextMenu(event,record);}
 record.session=session;record.options=options;if(record.url&&record.url!==img.src){record.canvas?.remove();record.canvas=null;img.hidden=false;}record.url=img.src;if(record.canvas){record.canvas.onclick=img.onclick;record.canvas.title=img.title;}const pref=app().preferencesForSession(session);
 if(options.kind==='avatar'){img.style.width=pref.avatarWidth+'px';img.style.height='auto';img.style.minHeight=pref.avatarHeight+'px';img.style.objectFit='contain';}
 else img.style.maxHeight=(Number.isFinite(options.height)?options.height:pref.inlineImageHeight)+'px';
 return record;
}
function refresh(){for(const session of app()?.sessions.values()||[])for(const img of session.view.querySelectorAll('img')){const record=records.get(img);if(record){bind(img,session,record.options);if(record.canvas)freeze(record);}}}
function unbind(img){const record=records.get(img);if(record){record.disposed=true;record.canvas?.remove();records.delete(img);}}
window.BeipImageRuntime={request,handleNative,bindInline:(img,session,options={})=>bind(img,session,{...options,kind:'inline'}),bindAvatar:(img,session)=>bind(img,session,{kind:'avatar'}),unbind,refresh};
})();
