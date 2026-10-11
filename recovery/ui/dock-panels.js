/* Session-scoped docked windows. MIT. */
(function(){
'use strict';
const $=id=>document.getElementById(id), api=()=>window.BeipPreview;
const host=$('dockHost'),splitter=$('dockSplitter'),tabs=$('dockTabs'),content=$('dockContent');
const kinds={map:'Map',history:'Input History',image:'Image Window',notes:'Character Notes',split:'Split Output',spawn:'Spawn Window'};
const sessionPanels=new Map();
const clamp=value=>Math.max(220,Math.min(700,Math.round(Number(value)||320)));
let width=320;try{width=clamp(localStorage.getItem('beipmu:dock-width'));}catch{}
function profileKey(session){return 'beipmu:dock:'+String(session?.characterId||session?.worldId||'unassigned').slice(0,80);}
function remember(session){
 if(!session||session.kind!=='world')return;
 const model=ensure(session);
 try{localStorage.setItem(profileKey(session),JSON.stringify({order:model.order.filter(x=>x!=='spawn'),active:model.active==='spawn'?'':model.active}));}catch{}
}
function ensure(session){
 let model=sessionPanels.get(session.id);
 if(!model){
  let saved=[],active='';try{const value=JSON.parse(localStorage.getItem(profileKey(session))||'[]'),order=Array.isArray(value)?value:value?.order;if(Array.isArray(order))saved=order.filter(x=>kinds[x]&&x!=='spawn').slice(0,5);if(typeof value?.active==='string'&&saved.includes(value.active))active=value.active;}catch{}
  model={order:[...new Set(saved)],active:active||saved[0]||'',images:[],imageIndex:-1,history:[],spawn:new Map(),spawnSelected:'',splitLines:[],splitScroll:null,notesDrafts:new Map()};
  sessionPanels.set(session.id,model);
 }
 return model;
}
function pane(type,title){const section=document.createElement('section');section.className='dock-pane';section.dataset.dock=type;const header=document.createElement('div');header.className='dock-pane-head';const heading=document.createElement('span');heading.textContent=title||kinds[type];const close=document.createElement('button');close.type='button';close.className='dock-close';close.title='Close '+(title||kinds[type]);close.setAttribute('aria-label',close.title);close.textContent='×';close.onclick=()=>closePane(type);header.append(heading,close);const body=document.createElement('div');body.className='dock-pane-body';section.append(header,body);return {section,header,body};}
function button(label,onClick){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=onClick;return b;}
function status(body,message){const p=document.createElement('p');p.className='dock-hint';p.textContent=message;body.append(p);}
function current(){return api()?.current;}
function open(type,session=current()){
 if(!session||!kinds[type])return false;
 const model=ensure(session);
 if(!model.order.includes(type))model.order.push(type);
 model.active=type;remember(session);render();return true;
}
function closePane(type,session=current()){
 if(!session)return;
 const model=ensure(session);model.order=model.order.filter(x=>x!==type);
 if(model.active===type)model.active=model.order.at(-1)||'';
 remember(session);render();
}
function toggle(type,session=current()){if(!session)return false;const model=ensure(session);return model.order.includes(type)?(closePane(type,session),false):open(type,session);}
function selected(session=current()){if(session)ensure(session);render();}
function closed(session){sessionPanels.delete(session.id);}
function clear(session){const model=session&&sessionPanels.get(session.id);if(!model)return;model.splitLines=[];model.images=[];if(current()?.id===session.id)render();}
function addHistory(session,text){const model=ensure(session);model.history.push(text);if(model.history.length>500)model.history.shift();if(current()?.id===session.id&&model.active==='history')render();}
function addImage(session,event){if(!event?.url)return;const model=ensure(session),wasLatest=model.imageIndex<0||model.imageIndex===model.images.length-1;model.images.push({url:event.url,alt:String(event.alt||'Image').slice(0,160)});if(model.images.length>100){model.images.shift();if(!wasLatest)model.imageIndex=Math.max(0,model.imageIndex-1);}if(wasLatest)model.imageIndex=model.images.length-1;if(current()?.id===session.id&&model.active==='image')render();}
function recordLine(session,line){const model=ensure(session);model.splitLines.push(line);if(model.splitLines.length>500)model.splitLines.shift();if(current()?.id===session.id&&model.active==='split')render();}
function refreshLine(session){const model=sessionPanels.get(session?.id);if(model&&current()?.id===session.id&&model.active==='split')render();}
function routeSpawn(session,title,text,{group=''}={}){
 const model=ensure(session),name=String(title||'Window').slice(0,80),groupName=String(group||'').slice(0,80),key=groupName?groupName+' / '+name:name,rows=model.spawn.get(key)||[];
 if(!model.spawn.has(key)&&model.spawn.size>=32){session.status='Spawn window limit reached (32 per session).';if(current()?.id===session.id)$('status').textContent=session.status;return true;}
 rows.push(String(text||'').slice(0,8192));while(rows.length>200||rows.reduce((total,line)=>total+line.length,0)>262144)rows.shift();model.spawn.set(key,rows);if(!model.spawnSelected)model.spawnSelected=key;
 const first=!model.order.includes('spawn');if(first){model.order.push('spawn');model.active='spawn';}
 if(current()?.id===session.id&&(first||model.active==='spawn'))render();return true;
}
function renderMap(body,session){
 if(!session.worldId){status(body,'Choose a saved world to use its map.');return;}
 let graph;try{graph=BeipMapper.createWorld(api().state.maps?.[session.worldId]);}catch{graph=BeipMapper.createWorld();}
 const tools=document.createElement('div');tools.className='dock-toolbar';tools.append(button('Edit map…',()=>document.getElementById('mapperButton')?.click()));body.append(tools);
 const rooms=graph.rooms();if(!rooms.length){status(body,'No rooms mapped yet. Use Edit map to add rooms and exits.');return;}
 const selector=document.createElement('select');selector.setAttribute('aria-label','Map destination');for(const room of rooms){const opt=document.createElement('option');opt.value=room.id;opt.textContent=room.title;selector.append(opt);}tools.append(selector);
 const route=document.createElement('p');route.className='dock-hint';
 tools.append(button('Route',()=>{const path=graph.shortestPath(selector.value);route.textContent=path?path.commands.join(' → ')||'Already in this room.':'No route from the current room.';}));
 tools.append(button('Walk',()=>{const commands=graph.walkCommands(selector.value);if(!session.connected||!commands||commands.length>256){route.textContent='No connected route for this session.';return;}for(const command of commands)api().sendRaw(session,command);route.textContent='Sent '+commands.length+' commands. Update the current room after arrival.';}));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('dock-map');svg.setAttribute('role','img');svg.setAttribute('aria-label','Mapped rooms and exits');
 const minX=Math.min(...rooms.map(r=>r.x))-70,minY=Math.min(...rooms.map(r=>r.y))-40,maxX=Math.max(...rooms.map(r=>r.x))+160,maxY=Math.max(...rooms.map(r=>r.y))+60;
 svg.setAttribute('viewBox',`${minX} ${minY} ${Math.max(240,maxX-minX)} ${Math.max(180,maxY-minY)}`);
 const ns='http://www.w3.org/2000/svg';for(const exit of graph.exits()){const from=rooms.find(r=>r.id===exit.from),to=rooms.find(r=>r.id===exit.to);if(!from||!to)continue;const line=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:'#777','stroke-width':2}))line.setAttribute(k,v);svg.append(line);}
 for(const room of rooms){const group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),label=document.createElementNS(ns,'text');circle.setAttribute('cx',room.x);circle.setAttribute('cy',room.y);circle.setAttribute('r','11');circle.setAttribute('fill',graph.currentRoom()===room.id?'#d5a600':'#9fa2a2');label.setAttribute('x',room.x+16);label.setAttribute('y',room.y+4);label.textContent=room.title;group.append(circle,label);group.addEventListener('click',()=>{selector.value=room.id;});svg.append(group);}
 body.append(svg,route);
}
function renderHistory(body,session,model){
 const list=document.createElement('div');list.className='dock-list';list.setAttribute('aria-label','Sent commands');
 const rows=(session.history.length?session.history:model.history).slice(-500).reverse();
 for(const text of rows){const row=button(text,()=>{const input=$('input');input.value=text;input.focus();input.setSelectionRange(text.length,text.length);});row.className='dock-history-row';row.title='Place command in input';list.append(row);}
 if(!rows.length)status(body,'Commands sent in this session appear here.');body.append(list);
}
function renderImages(body,model){
 if(!model.images.length){status(body,'Images received in this session appear here.');return;}
 let at=Math.max(0,Math.min(model.images.length-1,model.imageIndex));const img=document.createElement('img');img.className='dock-image';const caption=document.createElement('p');caption.className='dock-hint';const show=()=>{model.imageIndex=at;const item=model.images[at];img.src=item.url;img.alt=item.alt;caption.textContent=`${at+1} / ${model.images.length} · ${item.alt}`;};
 const toolbar=document.createElement('div');toolbar.className='dock-toolbar';toolbar.append(button('Previous',()=>{at=Math.max(0,at-1);show();}),button('Next',()=>{at=Math.min(model.images.length-1,at+1);show();}),button('Open source',()=>window.chrome?.webview?.postMessage('external|'+model.images[at].url)));
 body.append(toolbar,img,caption);show();
}
function renderNotes(body,session,model){
 const character=api().state.characters.find(x=>x.id===session.characterId),world=api().state.worlds.find(x=>x.id===session.worldId),profile=character||world;
 if(!profile){status(body,'Select a saved character or world to keep notes.');return;}
 const key=(character?'character:':'world:')+profile.id,label=document.createElement('label');label.textContent='Notes for '+profile.name;const field=document.createElement('textarea');field.className='dock-notes';field.maxLength=16384;field.value=model.notesDrafts.get(key)??profile.notes??'';field.setAttribute('aria-label','Character notes');field.addEventListener('input',()=>{model.notesDrafts.set(key,field.value);});label.append(field);
 const result=document.createElement('span');result.setAttribute('role','status');
 const save=()=>{profile.notes=field.value;model.notesDrafts.delete(key);api().saveSettings();result.textContent='Saved.';};
 const toolbar=document.createElement('div');toolbar.className='dock-toolbar';toolbar.append(button('Save notes',save),result);
 field.addEventListener('keydown',event=>{if(event.ctrlKey&&event.key.toLowerCase()==='s'){event.preventDefault();save();}});
 body.append(label,toolbar);
}
function renderSplit(body,session,model){
 const note=document.createElement('p');note.className='dock-hint';note.textContent='Independent view of recent output';body.append(note);
 const scroll=document.createElement('div');scroll.className='dock-output-copy';scroll.tabIndex=0;scroll.setAttribute('aria-label','Recent output');
 scroll.addEventListener('click',event=>{const anchor=event.target instanceof Element?event.target.closest('a[data-kind]'):null;if(!anchor)return;event.preventDefault();if(anchor.dataset.kind==='url')window.chrome?.webview?.postMessage('external|'+anchor.dataset.value);else if(anchor.dataset.kind==='command')api().command(anchor.dataset.value||'',anchor.dataset.prompt==='true',session);});
 const lines=model.splitLines.length?model.splitLines:[...session.view.querySelectorAll('.line')].slice(-500);
 for(const line of lines)scroll.append(line.cloneNode(true));
 body.append(scroll);
}
function renderSpawn(body,model){
 const names=[...model.spawn.keys()];if(!names.length){status(body,'Triggered spawn text appears here.');return;}
 const selector=document.createElement('select');selector.setAttribute('aria-label','Spawned window');for(const name of names){const option=document.createElement('option');option.textContent=name;selector.append(option);}
 if(model.spawn.has(model.spawnSelected))selector.value=model.spawnSelected;
 const listing=document.createElement('div');listing.className='dock-output-copy';listing.tabIndex=0;const show=()=>{model.spawnSelected=selector.value;listing.replaceChildren();for(const line of model.spawn.get(selector.value)||[]){const row=document.createElement('div');row.className='line';row.textContent=line;listing.append(row);}listing.scrollTop=listing.scrollHeight;};
 selector.addEventListener('change',show);body.append(selector,listing);show();
}
function render(){
 const session=current(),model=session&&ensure(session),visible=!!model?.order.length;
 const previous=content.querySelector('.dock-output-copy'),previousModel=sessionPanels.get(content.dataset.session);
 if(previous&&previousModel&&content.querySelector('.dock-pane')?.dataset.dock==='split')previousModel.splitScroll={top:previous.scrollTop,bottom:previous.scrollHeight-previous.clientHeight-previous.scrollTop<4};
 host.hidden=!visible;splitter.hidden=!visible;tabs.replaceChildren();content.replaceChildren();
 content.dataset.session=session?.id||'';
 document.documentElement.style.setProperty('--dock-width',width+'px');
 if(!visible)return;
 if(!model.order.includes(model.active))model.active=model.order[0];
  for(const type of model.order){const tab=button(kinds[type],()=>{model.active=type;remember(session);render();});tab.className='dock-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(model.active===type));tabs.append(tab);}
 const type=model.active,{section,body}=pane(type,type==='spawn'?(model.spawn.keys().next().value||kinds.spawn):kinds[type]);
 content.append(section);
 if(type==='map')renderMap(body,session);
 else if(type==='history')renderHistory(body,session,model);
 else if(type==='image')renderImages(body,model);
 else if(type==='notes')renderNotes(body,session,model);
 else if(type==='split')renderSplit(body,session,model);
 else if(type==='spawn')renderSpawn(body,model);
 if(type==='split'&&model.splitScroll){const next=content.querySelector('.dock-output-copy');if(next)next.scrollTop=model.splitScroll.bottom?next.scrollHeight:model.splitScroll.top;}
}
let drag=null;
splitter.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,width};splitter.setPointerCapture(event.pointerId);event.preventDefault();});
splitter.addEventListener('pointermove',event=>{if(!drag)return;width=clamp(drag.width+drag.x-event.clientX);splitter.setAttribute('aria-valuenow',String(width));document.documentElement.style.setProperty('--dock-width',width+'px');});
function finish(){if(!drag)return;drag=null;try{localStorage.setItem('beipmu:dock-width',String(width));}catch{}}
splitter.addEventListener('pointerup',finish);splitter.addEventListener('pointercancel',finish);splitter.addEventListener('lostpointercapture',finish);
splitter.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();width=event.key==='Home'?220:event.key==='End'?700:clamp(width+(event.key==='ArrowLeft'?10:-10));splitter.setAttribute('aria-valuenow',String(width));document.documentElement.style.setProperty('--dock-width',width+'px');try{localStorage.setItem('beipmu:dock-width',String(width));}catch{}});
splitter.setAttribute('aria-valuenow',String(width));
window.addEventListener('beip-map-updated',()=>{const session=current();if(session&&ensure(session).active==='map')render();});
window.BeipDockPanels={open,toggle,closePane,selected,closed,clear,addHistory,addImage,recordLine,refreshLine,routeSpawn,render};
selected();
})();
