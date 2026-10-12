/* Session-scoped docked windows. MIT. */
(function(){
'use strict';
const $=id=>document.getElementById(id), api=()=>window.BeipPreview;
const workspace=$('workspace'),host=$('dockHost'),splitter=$('dockSplitter'),tabs=$('dockTabs'),content=$('dockContent'),layout=window.BeipDockLayout;
const kinds={map:'Map',history:'Input History',image:'Image Window',notes:'Character Notes',split:'Split Output',spawn:'Spawn Window'};
const sessionPanels=new Map();
const floatOwners=new Map();
let nextFloatId=1;
let legacyRightWidth=320;try{legacyRightWidth=layout.dimension(localStorage.getItem('beipmu:dock-width'),'right');}catch{}
const edgeNodes={right:{host,splitter,tabs,content}};
host.classList.add('dock-host');host.dataset.edge='right';splitter.classList.add('dock-splitter');splitter.dataset.edge='right';tabs.classList.add('dock-tabs');content.classList.add('dock-content');
for(const edge of ['left','top','bottom']){
 const cap=edge[0].toUpperCase()+edge.slice(1),sideHost=document.createElement('aside'),sideSplitter=document.createElement('div'),sideTabs=document.createElement('div'),sideContent=document.createElement('div');
 sideHost.id='dockHost'+cap;sideHost.className='dock-host';sideHost.dataset.edge=edge;sideHost.setAttribute('aria-label',cap+' docked windows');sideHost.hidden=true;
 sideSplitter.id='dockSplitter'+cap;sideSplitter.className='dock-splitter';sideSplitter.dataset.edge=edge;sideSplitter.setAttribute('role','separator');sideSplitter.setAttribute('aria-label','Resize '+edge+' docked windows');sideSplitter.setAttribute('aria-orientation',edge==='left'||edge==='right'?'vertical':'horizontal');sideSplitter.setAttribute('aria-valuemin',String(edge==='left'?180:edge==='bottom'?50:90));sideSplitter.setAttribute('aria-valuemax',String(edge==='left'?700:edge==='bottom'?400:500));sideSplitter.tabIndex=0;sideSplitter.hidden=true;
 sideTabs.id='dockTabs'+cap;sideTabs.className='dock-tabs';sideTabs.setAttribute('role','tablist');sideTabs.setAttribute('aria-label',cap+' docked windows');sideContent.id='dockContent'+cap;sideContent.className='dock-content';sideHost.append(sideTabs,sideContent);if(edge==='bottom')document.querySelector('footer').before(sideSplitter,sideHost);else workspace.append(sideHost,sideSplitter);edgeNodes[edge]={host:sideHost,splitter:sideSplitter,tabs:sideTabs,content:sideContent};
}
function layoutState(model){return {order:model.order,edges:model.edges,sizes:model.sizes,activeByEdge:model.activeByEdge,trees:model.trees,floating:Object.fromEntries(model.floating)};}
function useLayout(model,value){model.order=value.order;model.edges=value.edges;model.sizes=value.sizes;model.activeByEdge=value.activeByEdge;model.trees=value.trees;}
function normalizeModel(model){useLayout(model,layout.normalize(layoutState(model),{includeSpawn:true}));}
function activate(model,type){useLayout(model,layout.select(layoutState(model),type));model.active=type;}
let windowSettingsClipboard=null;
let paneDrag=null;
const dropOverlay=document.createElement('div');dropOverlay.className='dock-drop-overlay';dropOverlay.hidden=true;dropOverlay.setAttribute('aria-hidden','true');
const dropTargets={};for(const edge of layout.EDGES){const target=document.createElement('div');target.className='dock-drop-target';target.dataset.edge=edge;target.textContent='Dock '+edge;dropOverlay.append(target);dropTargets[edge]=target;}
document.body.append(dropOverlay);
const paneDropOverlay=document.createElement('div');paneDropOverlay.className='dock-pane-drop';paneDropOverlay.hidden=true;const paneDropTargets={};for(const side of ['left','right','top','bottom','tabs']){const target=document.createElement('div');target.className='dock-pane-drop-target';target.dataset.side=side;target.textContent={left:'←',right:'→',top:'↑',bottom:'↓',tabs:'Tabs'}[side];paneDropTargets[side]=target;paneDropOverlay.append(target);}document.body.append(paneDropOverlay);
function cancelPaneDrag(){const drag=paneDrag;paneDrag=null;dropOverlay.hidden=true;paneDropOverlay.hidden=true;document.body.classList.remove('dock-dragging');for(const target of [...Object.values(dropTargets),...Object.values(paneDropTargets)])target.classList.remove('is-target');if(drag?.source?.hasPointerCapture(drag.pointerId))drag.source.releasePointerCapture(drag.pointerId);}
function paneDropAt(x,y){for(const side of ['left','right','top','bottom','tabs']){const r=paneDropTargets[side].getBoundingClientRect();if(!paneDropOverlay.hidden&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return side;}return '';}
function updatePaneDrop(drag,x,y){
 if(drag.group){paneDropOverlay.hidden=true;return;}
 const group=document.elementsFromPoint(x,y).map(node=>node.closest?.('.dock-tree-group')).find(Boolean),type=group?.querySelector('.dock-pane')?.dataset.dock;
 if(type&&type!==drag.type){const rect=group.getBoundingClientRect();drag.target=type;Object.assign(paneDropOverlay.style,{left:(rect.left+rect.width/2-57)+'px',top:(rect.top+rect.height/2-42)+'px'});paneDropOverlay.hidden=false;}
 else{paneDropOverlay.hidden=true;drag.target='';}
 drag.side=paneDropAt(x,y);for(const side of Object.keys(paneDropTargets))paneDropTargets[side].classList.toggle('is-target',side===drag.side);
}
function startPaneDrag(event,type,session,group){
 if(event.button!==0||event.isPrimary===false||current()?.id!==session.id)return;
 cancelPaneDrag();paneDrag={session,profileKey:profileKey(session),type,group,source:event.currentTarget,pointerId:event.pointerId,x:event.clientX,y:event.clientY,started:false,edge:''};event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
}
function dragStillOwned(drag){return current()?.id===drag.session.id&&api()?.sessions.get(drag.session.id)===drag.session&&profileKey(drag.session)===drag.profileKey;}
window.addEventListener('pointermove',event=>{
 const drag=paneDrag;if(!drag||event.pointerId!==drag.pointerId)return;if(!dragStillOwned(drag)){cancelPaneDrag();return;}
 if(!drag.started&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
 drag.started=true;const rect=workspace.getBoundingClientRect(),bottom=document.querySelector('footer').getBoundingClientRect().top;
 Object.assign(dropOverlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:Math.max(0,bottom-rect.top)+'px'});dropOverlay.hidden=false;document.body.classList.add('dock-dragging');
 const rects=Object.fromEntries(layout.EDGES.map(edge=>[edge,dropTargets[edge].getBoundingClientRect()]));drag.edge=event.ctrlKey?'':layout.dropEdge(event.clientX,event.clientY,rects);
 updatePaneDrop(drag,event.clientX,event.clientY);if(event.ctrlKey){drag.side='';paneDropOverlay.hidden=true;}if(drag.edge){drag.side='';paneDropOverlay.hidden=true;}
 for(const edge of layout.EDGES)dropTargets[edge].classList.toggle('is-target',edge===drag.edge);event.preventDefault();
},true);
window.addEventListener('pointerup',event=>{const drag=paneDrag;if(!drag||event.pointerId!==drag.pointerId)return;const edge=event.ctrlKey?'':layout.dropEdge(event.clientX,event.clientY,Object.fromEntries(layout.EDGES.map(edge=>[edge,dropTargets[edge].getBoundingClientRect()]))),side=!event.ctrlKey&&paneDropAt(event.clientX,event.clientY);const commit=drag.started&&dragStillOwned(drag);cancelPaneDrag();if(commit){if(edge){if(drag.group)moveGroup(drag.type,edge,drag.session);else movePane(drag.type,edge,drag.session);}else if(side&&drag.target)arrangePane(drag.type,drag.target,side,drag.session);}},true);
window.addEventListener('pointercancel',cancelPaneDrag,true);
window.addEventListener('lostpointercapture',event=>{if(paneDrag?.pointerId===event.pointerId)cancelPaneDrag();},true);
window.addEventListener('blur',cancelPaneDrag);
window.addEventListener('keydown',event=>{if(paneDrag&&event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelPaneDrag();}},true);
function moveGroup(type,edge,session=current()){
 if(!session||!kinds[type]||!layout.EDGES.includes(edge))return false;const model=ensure(session);if(!model.order.includes(type)||model.floating.has(type))return false;
 const moved=layout.move(layoutState(model),type,edge,{group:true});
 useLayout(model,moved);model.active=moved.activeByEdge[edge];remember(session);if(current()?.id===session.id)render();return true;
}
function profileKey(session){return 'beipmu:dock:'+String(session?.characterId||session?.worldId||'unassigned').slice(0,80);}
function remember(session){
 if(!session||session.kind!=='world')return;
 const model=ensure(session);
 normalizeModel(model);
 try{localStorage.setItem(profileKey(session),JSON.stringify(layout.copyable(layoutState(model))));}catch{}
}
function savedLayout(key,session){
 const profile=api()?.state.characters.find(item=>item.id===session?.characterId)||api()?.state.worlds.find(item=>item.id===session?.worldId);let value=profile?.dockLayout||{};try{const stored=localStorage.getItem(key);if(stored!==null)value=JSON.parse(stored);}catch{}
 const result=layout.normalize(value,{rightWidth:legacyRightWidth});if(!window.chrome?.webview?.postMessage)result.floating={};return result;
}
function ensure(session){
 let model=sessionPanels.get(session.id);const key=profileKey(session);
 if(!model){
  const saved=savedLayout(key,session);
  model={profileKey:key,order:saved.order,edges:saved.edges,sizes:saved.sizes,activeByEdge:saved.activeByEdge,trees:saved.trees,active:Object.values(saved.activeByEdge).find(Boolean)||'',floating:new Map(Object.entries(saved.floating)),floatIds:new Map(),images:[],imageIndex:-1,history:[],spawn:new Map(),spawnSelected:'',splitLines:[],splitScroll:null,notesDrafts:new Map()};
  sessionPanels.set(session.id,model);
 }else if(model.profileKey!==key){
  for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}
  const saved=savedLayout(key,session);
  model.profileKey=key;model.order=saved.order;model.edges=saved.edges;model.sizes=saved.sizes;model.activeByEdge=saved.activeByEdge;model.trees=saved.trees;model.active=Object.values(saved.activeByEdge).find(Boolean)||'';model.floating=new Map(Object.entries(saved.floating));model.floatIds.clear();
 }
 return model;
}
function edgeFor(model,type){return layout.EDGES.includes(model.edges[type])?model.edges[type]:layout.DEFAULT_EDGE[type];}
function activeOn(model,edge){const available=model.order.filter(type=>edgeFor(model,type)===edge&&!model.floating.has(type));if(!available.includes(model.activeByEdge[edge]))model.activeByEdge[edge]=available[0]||'';return model.activeByEdge[edge];}
function paneVisible(model,type){normalizeModel(model);return !model.floating.has(type)&&layout.groupFor(model.trees[edgeFor(model,type)],type)?.active===type;}
function pane(type,title,session){const section=document.createElement('section');section.className='dock-pane';section.dataset.dock=type;const header=document.createElement('div');header.className='dock-pane-head';const heading=document.createElement('span');heading.textContent=title||kinds[type];heading.className='dock-caption';heading.title='Drag to dock on another edge';heading.addEventListener('pointerdown',event=>startPaneDrag(event,type,session,false));const grip=document.createElement('button');grip.type='button';grip.className='dock-group-grip';grip.textContent='⠿';grip.title='Drag this pane group; arrow keys move the group';grip.setAttribute('aria-label','Move '+edgeFor(ensure(session),type)+' pane group; use arrow keys or drag');grip.addEventListener('pointerdown',event=>startPaneDrag(event,type,session,true));grip.addEventListener('keydown',event=>{const edge={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'top',ArrowDown:'bottom'}[event.key];if(edge){event.preventDefault();event.stopPropagation();moveGroup(type,edge,session);edgeNodes[edge].content.querySelector('.dock-group-grip')?.focus();}});const controls=document.createElement('span');controls.className='dock-head-controls';const position=document.createElement('select');position.className='dock-position';position.setAttribute('aria-label','Dock '+(title||kinds[type])+' on');position.title='Dock position';for(const edge of layout.EDGES){const option=document.createElement('option');option.value=edge;option.textContent=edge[0].toUpperCase()+edge.slice(1);position.append(option);}position.value=edgeFor(ensure(session),type);position.onchange=()=>movePane(type,position.value,session);const floatButton=document.createElement('button');floatButton.type='button';floatButton.title='Float '+(title||kinds[type]);floatButton.setAttribute('aria-label',floatButton.title);floatButton.textContent='↗';floatButton.onclick=()=>floatPane(type,session);const close=document.createElement('button');close.type='button';close.className='dock-close';close.title='Close '+(title||kinds[type]);close.setAttribute('aria-label',close.title);close.textContent='×';close.onclick=()=>closePane(type,session);controls.append(position,arrangementControl(type,session),floatButton,close);header.append(grip,heading,controls);const body=document.createElement('div');body.className='dock-pane-body';section.append(header,body);return {section,header,body};}
function button(label,onClick){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=onClick;return b;}
function status(body,message){const p=document.createElement('p');p.className='dock-hint';p.textContent=message;body.append(p);}
function current(){return api()?.current;}
function encode64(value){const bytes=new TextEncoder().encode(value);let raw='';for(let at=0;at<bytes.length;at+=8192)raw+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(raw);}
function decode64(value){return new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));}
function nativePost(value){window.chrome?.webview?.postMessage(value);}
function floatTitle(session,type){let title=kinds[type]+' - '+String(session.label||session.id).slice(0,80);while(new TextEncoder().encode(title).length>160)title=title.slice(0,-1);return title;}
function richNodes(nodes,depth,budget){
 const result=[];if(depth>8)return result;
 for(const node of nodes){if(budget.nodes<=0||budget.chars<=0)break;budget.nodes--;
  if(node.nodeType===Node.TEXT_NODE){const value=(node.textContent||'').slice(0,budget.chars);budget.chars-=value.length;if(value)result.push({text:value});continue;}
  if(node.nodeType!==Node.ELEMENT_NODE)continue;
  const tag=node.localName,entry={tag:['a','img','figure','figcaption','br'].includes(tag)?tag:'span'};
  if(tag==='a'&&['url','command'].includes(node.dataset.kind)){entry.link={kind:node.dataset.kind,value:String(node.dataset.value||'').slice(0,4096),prompt:node.dataset.prompt==='true'};}
  if(tag==='img'){const src=node.getAttribute('src')||'';if(/^https?:\/\//i.test(src))entry.src=src.slice(0,4096);entry.alt=String(node.alt||'Image').slice(0,160);}
  const style={};for(const name of ['color','backgroundColor']){const value=node.style?.[name];if(value&&value.length<=80)style[name]=value;}
  if(node.style?.fontWeight==='bold')style.fontWeight='bold';if(node.style?.fontStyle==='italic')style.fontStyle='italic';if(node.style?.textDecoration&&/^(?:underline|line-through|\s)+$/.test(node.style.textDecoration))style.textDecoration=node.style.textDecoration;
  if(Object.keys(style).length)entry.style=style;
  if(tag!=='img'&&tag!=='br')entry.children=richNodes(node.childNodes,depth+1,budget);
  result.push(entry);
 }
 return result;
}
function richLine(line){return {parts:richNodes(line.childNodes,0,{nodes:128,chars:8192})};}
function floatData(session,type,model){
 if(type==='history')return {rows:session.history.slice(-200).reverse().map(x=>String(x).slice(0,2048))};
 if(type==='image')return {images:model.images.slice(-100),state:{animate:!api().preferencesForSession(session).animatedImagesStartPaused,...model.imageState,selected:Math.max(0,model.imageIndex)},messageText:model.imageMessage||''};
 if(type==='notes'){const character=api().state.characters.find(x=>x.id===session.characterId),world=api().state.worlds.find(x=>x.id===session.worldId),profile=character||world,key=profile?(character?'character:':'world:')+profile.id:'';return {profileId:profile?.id||'',profileKind:character?'character':'world',name:profile?.name||'',text:key?(model.notesDrafts.get(key)??profile?.notes??''):''};}
 if(type==='map'){let graph;try{graph=BeipMapSessions.graph(session);}catch{graph=BeipMapper.createWorld();}const view=BeipMapSessions.get(session);return {worldId:session.worldId,graph:graph.serialize(),layerId:view.layerId,currentRoom:graph.currentRoom(),tracking:view.tracking,view:view.view,routeText:model.floatRoute||''};}
 if(type==='split')return {lines:(model.splitLines.length?model.splitLines:[...session.view.querySelectorAll('.line')]).slice(-200).map(richLine)};
 if(type==='spawn'){const names=[...model.spawn.keys()],selected=model.spawn.has(model.spawnSelected)?model.spawnSelected:names[0]||'';return {names,selected,lines:(model.spawn.get(selected)||[]).slice(-200).map(x=>x.slice(0,2048))};}
 return {};
}
function floatAppearance(session){const prefs=api().preferencesForSession(session);return {font:prefs.outputFontFace||(prefs.fontFamily==='system'?'Segoe UI':'Courier New'),size:prefs.fontSize,foreground:prefs.outputForeground||'#c0c0c0',background:prefs.outputBackground||'#000000',bold:!!prefs.outputFontBold,italic:!!prefs.outputFontItalic,link:prefs.linkColor||'#67adff'};}
function floatSnapshot(session,type,model){const data=floatData(session,type,model),snapshot={sessionId:session.id,type,edge:edgeFor(model,type),title:floatTitle(session,type),appearance:floatAppearance(session),data};let serialized=JSON.stringify(snapshot);while(new TextEncoder().encode(serialized).length>245760){const lists=[data.rows,data.lines,data.rooms,data.exits,data.images].filter(x=>Array.isArray(x)&&x.length>1).sort((a,b)=>b.length-a.length),list=lists[0];if(!list){snapshot.data={message:'This pane has too much content to display in a floating window.'};serialized=JSON.stringify(snapshot);break;}const removed=Math.ceil(list.length/2);if(list===data.images)data.offset=(data.offset||0)+removed;list.splice(0,removed);serialized=JSON.stringify(snapshot);}return serialized;}
function updateFloat(session,type){const model=sessionPanels.get(session?.id),id=model?.floatIds.get(type);if(!id)return;nativePost('float:update|'+id+'|'+encode64(floatSnapshot(session,type,model)));}
function openFloat(session,type){const model=ensure(session);if(model.floatIds.has(type)){updateFloat(session,type);return;}if(floatOwners.size>=12){session.status='Floating window limit reached (12).';if(current()?.id===session.id)$('status').textContent=session.status;model.floating.delete(type);remember(session);queueMicrotask(()=>{if(current()?.id===session.id)render();});return;}
 const rect=model.floating.get(type)||{x:Math.max(40,innerWidth-500),y:80,width:420,height:400},id='fp'+Date.now().toString(36)+'_'+(nextFloatId++).toString(36);model.floatIds.set(type,id);floatOwners.set(id,{sessionId:session.id,type,profileKey:model.profileKey,ready:false,rendered:false});
 nativePost('float:open|'+id+'|'+session.id+'|'+encode64(floatTitle(session,type))+'|'+rect.x+'|'+rect.y+'|'+rect.width+'|'+rect.height+'|'+encode64(floatSnapshot(session,type,model)));
}
function syncFloats(session,model){if(!session||!model)return;for(const type of model.order)if(model.floating.has(type))openFloat(session,type);}
function floatPane(type,session=current()){
 if(!session||!kinds[type]||!window.chrome?.webview?.postMessage)return false;const model=ensure(session);if(!model.order.includes(type))model.order.push(type);
 if(!model.floating.has(type)&&floatOwners.size>=12){session.status='Floating window limit reached (12).';if(current()?.id===session.id)$('status').textContent=session.status;return false;}
 if(!model.floating.has(type))model.floating.set(type,{x:Math.max(40,innerWidth-500),y:80,width:420,height:400});
 const edge=edgeFor(model,type);if(model.activeByEdge[edge]===type)model.activeByEdge[edge]='';activeOn(model,edge);if(model.active===type)model.active=Object.values(model.activeByEdge).find(Boolean)||'';
 remember(session);if(current()?.id===session.id)render();else openFloat(session,type);return true;
}
function dockPane(type,session=current(),edge){
 if(!session||!kinds[type])return false;const model=ensure(session),id=model.floatIds.get(type);if(id){nativePost('float:close|'+id);floatOwners.delete(id);model.floatIds.delete(type);}model.floating.delete(type);if(!model.order.includes(type))model.order.push(type);if(layout.EDGES.includes(edge))model.edges[type]=edge;const next=edgeFor(model,type);model.activeByEdge[next]=type;activate(model,type);remember(session);if(current()?.id===session.id)render();return true;
}
function movePane(type,edge,session=current()){
 if(!session||!kinds[type]||!layout.EDGES.includes(edge))return false;const model=ensure(session);if(model.floating.has(type))return dockPane(type,session,edge);if(!model.order.includes(type))model.order.push(type);useLayout(model,layout.move(layoutState(model),type,edge));activate(model,type);remember(session);if(current()?.id===session.id)render();return true;
}
function open(type,session=current()){
 if(!session||!kinds[type])return false;
 const model=ensure(session);
 if(!model.order.includes(type))model.order.push(type);
 if(model.floating.has(type)){openFloat(session,type);return true;}
 const edge=edgeFor(model,type);model.activeByEdge[edge]=type;activate(model,type);remember(session);if(current()?.id===session.id)render();return true;
}
function closePane(type,session=current()){
 if(!session)return;
 const model=ensure(session),edge=edgeFor(model,type);model.order=model.order.filter(x=>x!==type);
 const id=model.floatIds.get(type);if(id){nativePost('float:close|'+id);floatOwners.delete(id);model.floatIds.delete(type);}model.floating.delete(type);
 if(model.activeByEdge[edge]===type){model.activeByEdge[edge]='';activeOn(model,edge);}if(model.active===type)model.active=Object.values(model.activeByEdge).find(Boolean)||'';
 remember(session);if(current()?.id===session.id)render();
}
function toggle(type,session=current()){if(!session)return false;const model=ensure(session);return model.order.includes(type)?(closePane(type,session),false):open(type,session);}
function copyAllWindowSettings(session=current()){
 if(!session)return false;const model=ensure(session),effective=api().preferencesForSession(session),prefs=window.BeipProfilePreferences;
 const preferences=prefs.normalizeOverrides({output:{useParent:false,values:Object.fromEntries(prefs.OUTPUT_KEYS.map(key=>[key,effective[key]]))},input:{useParent:false,values:Object.fromEntries(prefs.INPUT_KEYS.map(key=>[key,effective[key]]))}});
 windowSettingsClipboard={layout:layout.copyable(layoutState(model)),preferences};session.status='Window layout and output/input settings copied.';if(current()?.id===session.id)$('status').textContent=session.status;return true;
}
function pasteAllWindowSettings(session=current()){
 if(!session)return false;if(!session.worldId){session.status='Choose a saved world before pasting window settings.';if(current()?.id===session.id)$('status').textContent=session.status;return false;}
 if(!windowSettingsClipboard){session.status='Copy window settings first.';if(current()?.id===session.id)$('status').textContent=session.status;return false;}
 const model=ensure(session);for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}const copy=layout.copyable(windowSettingsClipboard.layout);model.order=copy.order;model.edges=copy.edges;model.sizes=copy.sizes;model.activeByEdge=copy.activeByEdge;model.trees=copy.trees;model.active=Object.values(copy.activeByEdge).find(Boolean)||'';model.floating=new Map(Object.entries(window.chrome?.webview?.postMessage?copy.floating:{}));model.floatIds.clear();const profile=api().state.characters.find(item=>item.id===session.characterId&&item.worldId===session.worldId)||api().state.worlds.find(item=>item.id===session.worldId);if(profile&&windowSettingsClipboard.preferences){profile.preferences=window.BeipProfilePreferences.normalizeOverrides(windowSettingsClipboard.preferences);api().applyPreferences();api().saveSettings();}remember(session);if(current()?.id===session.id)render();session.status='Window layout and output/input settings pasted.';if(current()?.id===session.id)$('status').textContent=session.status;return true;
}
function selected(session=current()){cancelPaneDrag();if(session)ensure(session);render();}
function closed(session){if(paneDrag?.session===session)cancelPaneDrag();const model=sessionPanels.get(session.id);if(model)for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}sessionPanels.delete(session.id);}
function clear(session){const model=session&&sessionPanels.get(session.id);if(!model)return;model.splitLines=[];model.images=[];model.imageIndex=-1;model.imageState=undefined;for(const type of ['split','image'])updateFloat(session,type);if(current()?.id===session.id){for(const type of ['split','image'])if(paneVisible(model,type))refreshPane(type,session,model);}}
function addHistory(session,text){const model=ensure(session);model.history.push(text);if(model.history.length>500)model.history.shift();updateFloat(session,'history');if(current()?.id===session.id&&paneVisible(model,'history'))refreshPane('history',session,model);}
function addImage(session,event){if(!event?.url)return;const model=ensure(session),wasLatest=model.imageIndex<0||model.imageIndex===model.images.length-1;model.images.push({url:event.url,alt:String(event.alt||'Image').slice(0,160)});if(model.images.length>100){model.images.shift();if(!wasLatest)model.imageIndex=Math.max(0,model.imageIndex-1);}if(wasLatest){model.imageIndex=model.images.length-1;model.imageState={animate:model.imageState?.animate??!api().preferencesForSession(session).animatedImagesStartPaused};}if(!session.suppressAutomation&&api().preferencesForSession(session).autoImageViewer&&!model.order.includes('image')&&!model.floating.has('image'))open('image',session);updateFloat(session,'image');if(current()?.id===session.id&&paneVisible(model,'image'))refreshPane('image',session,model);}
function recordLine(session,line){const model=ensure(session);model.splitLines.push(line);if(model.splitLines.length>500)model.splitLines.shift();updateFloat(session,'split');if(current()?.id===session.id&&paneVisible(model,'split'))refreshPane('split',session,model);}
function refreshLine(session){const model=sessionPanels.get(session?.id);if(!model)return;updateFloat(session,'split');if(current()?.id===session.id&&paneVisible(model,'split'))refreshPane('split',session,model);}
function removeLine(session,line){const model=sessionPanels.get(session?.id);if(!model)return;model.splitLines=model.splitLines.filter(item=>item!==line);refreshLine(session);}
function routeSpawn(session,title,text,{group=''}={}){
 const model=ensure(session),name=String(title||'Window').slice(0,80),groupName=String(group||'').slice(0,80),key=groupName?groupName+' / '+name:name,rows=model.spawn.get(key)||[];
 if(!model.spawn.has(key)&&model.spawn.size>=32){session.status='Spawn window limit reached (32 per session).';if(current()?.id===session.id)$('status').textContent=session.status;return true;}
 rows.push(String(text||'').slice(0,8192));while(rows.length>200||rows.reduce((total,line)=>total+line.length,0)>262144)rows.shift();model.spawn.set(key,rows);if(!model.spawnSelected)model.spawnSelected=key;
 const first=!model.order.includes('spawn');if(first){model.order.push('spawn');model.edges.spawn=layout.DEFAULT_EDGE.spawn;model.activeByEdge.right='spawn';model.active='spawn';}
 updateFloat(session,'spawn');
 if(current()?.id===session.id){if(first)render();else if(paneVisible(model,'spawn'))refreshPane('spawn',session,model);}return true;
}
function renderMap(body,session){
 if(!session.worldId){status(body,'Choose a saved world to use its map.');return;}
 let graph;try{graph=BeipMapSessions.graph(session);}catch{status(body,'The saved map could not be read.');return;}const state=BeipMapSessions.get(session),tools=document.createElement('div');tools.className='dock-toolbar';tools.append(button('Edit map…',()=>document.getElementById('mapperButton')?.click()));body.append(tools);
 const layers=document.createElement('select');layers.setAttribute('aria-label','Map layer');for(const layer of graph.layers()){const option=document.createElement('option');option.value=layer.id;option.textContent=layer.name;layers.append(option);}layers.value=state.layerId;layers.onchange=()=>BeipMapSessions.setLayer(session,layers.value);tools.append(layers);
 const rooms=graph.rooms();if(!rooms.length){status(body,'No rooms mapped yet. Use Edit map to add rooms and exits.');return;}
 const selector=document.createElement('select');selector.setAttribute('aria-label','Map destination');for(const room of rooms){const option=document.createElement('option');option.value=room.id;option.textContent=(graph.layers().length>1?(graph.layers().find(layer=>layer.id===(room.layerId||'layer0'))?.name||'Map')+' / ':'')+room.title;selector.append(option);}if(rooms.some(room=>room.id===state.destination))selector.value=state.destination;selector.onchange=()=>{state.destination=selector.value;};tools.append(selector);
 const route=document.createElement('p');route.className='dock-hint';route.textContent=state.routeText||'';let canvas;
 function showRoute(){const path=graph.shortestPath(selector.value);state.destination=selector.value;state.routeText=path?path.commands.join(' → ')||'Already in this room.':'No route from the current room.';route.textContent=state.routeText;draw(path);return path;}
 function sendRoute(one){const path=showRoute(),commands=path?.commands;if(!session.connected||!commands||commands.length>256){route.textContent='No connected route for this session.';return;}for(const command of one?commands.slice(0,1):commands)api().sendRaw(session,command);route.textContent='Sent '+(one?Math.min(commands.length,1):commands.length)+' commands. Position updates only when you pin or track an observed room.';}
 tools.append(button('Route',showRoute),button('Step',()=>sendRoute(true)),button('Walk',()=>sendRoute(false)),button('Pin',()=>BeipMapSessions.pin(session,selector.value)),button('Locate',()=>{const id=BeipMapSessions.locate(session,[...session.view.querySelectorAll('.line')].slice(-1000).map(line=>line.textContent));if(!id)route.textContent='No unambiguous room name found in recent output.';}),button('Center',()=>{const current=graph.rooms().find(room=>room.id===graph.currentRoom());if(current&&(current.layerId||'layer0')!==state.layerId){BeipMapSessions.setLayer(session,current.layerId||'layer0');return;}canvas?.center(graph.currentRoom());}),button('Fit',()=>canvas?.fit()));
 const track=document.createElement('label'),tracking=document.createElement('input');tracking.type='checkbox';tracking.checked=state.tracking;tracking.onchange=()=>BeipMapSessions.setTracking(session,tracking.checked);track.append(tracking,document.createTextNode('Track'));tools.append(track);
 const surface=document.createElement('div');surface.style.cssText='display:flex;flex:1;min-height:140px;overflow:hidden';body.append(surface,route);
 function draw(path){canvas?.destroy();canvas=BeipMapView.mount(surface,graph,{layerId:state.layerId,currentRoomId:graph.currentRoom(),view:state.view,route:path,onView:view=>{state.view=view;},onRoom:id=>{selector.value=id;state.destination=id;showRoute();}});canvas.svg.classList.add('dock-map');}draw();
}
function renderHistory(body,session,model){
 const search=document.createElement('input');search.type='search';search.className='dock-history-search';search.placeholder='Find history';search.setAttribute('aria-label','Find history');search.value=model.historyQuery||'';
 const list=document.createElement('div');list.className='dock-list';list.setAttribute('aria-label','Sent commands');
 const rows=(session.history.length?session.history:model.history).slice(-500).reverse();
 const draw=()=>{list.replaceChildren();for(const text of rows){if(!text.toLowerCase().includes(search.value.toLowerCase()))continue;const row=button(text,()=>{const input=$('input');input.value=text;input.focus();input.setSelectionRange(text.length,text.length);});row.className='dock-history-row';row.title='Place command in input';list.append(row);}};
 search.addEventListener('input',()=>{model.historyQuery=search.value;draw();});body.append(search);if(!rows.length)status(body,'Commands sent in this session appear here.');body.append(list);draw();
}
function renderImages(body,model,session){
 const viewer=BeipImageView.mount(body,model.images,{state:{animate:!api().preferencesForSession(session).animatedImagesStartPaused,...model.imageState,selected:model.imageIndex},canSave:true,canCopy:true,onState:state=>{model.imageState=state;model.imageIndex=state.selected;},onAction:(action,item)=>BeipImageRuntime.request(session,action,model.images[item.index]?.url)});viewer.picture.classList.add('dock-image');viewer.root.imageViewer=viewer;
 if(model.imageMessage)status(body,model.imageMessage);
}
function disposeImages(parent){for(const root of parent.querySelectorAll('.image-view'))root.imageViewer?.destroy();}
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
function arrangePane(type,target,side='tabs',session=current()){
 if(!session||!kinds[type]||!kinds[target]||type===target||!['tabs',...layout.EDGES].includes(side))return false;
 const model=ensure(session);normalizeModel(model);if(!model.order.includes(type)||!model.order.includes(target)||model.floating.has(target))return false;
 const value=layout.place(layoutState(model),type,target,side),id=model.floatIds.get(type);
 if(id){nativePost('float:close|'+id);floatOwners.delete(id);model.floatIds.delete(type);}model.floating.delete(type);useLayout(model,value);model.active=type;remember(session);if(current()?.id===session.id)render();return true;
}
function arrangementControl(type,session){
 const control=document.createElement('select');control.className='dock-arrange';control.setAttribute('aria-label','Arrange '+kinds[type]);control.title='Split beside another pane or join its tabs';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Arrange';control.append(placeholder);
 const model=ensure(session);for(const target of model.order){if(target===type||model.floating.has(target))continue;const group=document.createElement('optgroup');group.label=kinds[target];for(const [side,label] of [['left','Left of'],['right','Right of'],['top','Above'],['bottom','Below'],['tabs','Tab with']]){const option=document.createElement('option');option.value=target+':'+side;option.textContent=label+' '+kinds[target];group.append(option);}control.append(group);}control.disabled=control.options.length===1;control.onchange=()=>{const [target,side]=control.value.split(':');arrangePane(type,target,side,session);};return control;
}
function renderPane(type,parent,session,model){
 const {section,body}=pane(type,type==='spawn'?(model.spawn.keys().next().value||kinds.spawn):kinds[type],session);parent.append(section);
 if(type==='map')renderMap(body,session);else if(type==='history')renderHistory(body,session,model);else if(type==='image')renderImages(body,model,session);else if(type==='notes')renderNotes(body,session,model);else if(type==='split')renderSplit(body,session,model);else if(type==='spawn')renderSpawn(body,model);
 if(type==='split'&&model.splitScroll){const next=section.querySelector('.dock-output-copy');if(next)next.scrollTop=model.splitScroll.bottom?next.scrollHeight:model.splitScroll.top;}
}
function refreshPane(type,session,model){
 const old=edgeNodes[edgeFor(model,type)].content.querySelector('[data-dock="'+type+'"]');if(!old)return;
 const focused=old.contains(document.activeElement)?document.activeElement:null,historyFocused=focused?.classList.contains('dock-history-search'),selection=historyFocused?{start:focused.selectionStart,end:focused.selectionEnd}:null;
 if(type==='split'){const scroll=old.querySelector('.dock-output-copy');if(scroll)model.splitScroll={top:scroll.scrollTop,bottom:scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<4};}
 const parent=document.createElement('div');renderPane(type,parent,session,model);const next=parent.firstElementChild;disposeImages(old);old.replaceWith(next);
 if(historyFocused){const field=next.querySelector('.dock-history-search');field?.focus();if(field&&selection)try{field.setSelectionRange(selection.start,selection.end);}catch{}}
}
function renderTree(node,parent,session,model,edge,path=[]){
 if(!node)return;
 if(node.kind==='tabs'){
  const group=document.createElement('div');group.className='dock-tree-group';group.dataset.panes=node.tabs.join(' ');const bar=document.createElement('div');bar.className='dock-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Docked pane group');
  for(const type of node.tabs){const tab=button(kinds[type],()=>{activate(model,type);remember(session);renderEdge(edge,session,model);});tab.className='dock-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(node.active===type));tab.addEventListener('pointerdown',event=>startPaneDrag(event,type,session,false));bar.append(tab);}group.append(bar);renderPane(node.active,group,session,model);parent.append(group);return;
 }
 const split=document.createElement('div');split.className='dock-tree-split';split.dataset.axis=node.axis;const first=document.createElement('div'),second=document.createElement('div'),divider=document.createElement('div');first.className=second.className='dock-tree-branch';divider.className='dock-tree-divider';divider.tabIndex=0;divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize split panes');divider.setAttribute('aria-orientation',node.axis==='x'?'vertical':'horizontal');divider.setAttribute('aria-valuemin','10');divider.setAttribute('aria-valuemax','90');
 const apply=value=>{first.style.flex=value+' 1 0%';second.style.flex=(1-value)+' 1 0%';divider.setAttribute('aria-valuenow',String(Math.round(value*100)));};apply(node.ratio);
 let resizing=null;
 divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;resizing={pointer:event.pointerId,profile:model.profileKey};divider.setPointerCapture(event.pointerId);event.preventDefault();});
 divider.addEventListener('pointermove',event=>{if(!resizing||event.pointerId!==resizing.pointer)return;if(current()?.id!==session.id||model.profileKey!==resizing.profile){resizing=null;return;}const rect=split.getBoundingClientRect(),value=node.axis==='x'?(event.clientX-rect.left)/rect.width:(event.clientY-rect.top)/rect.height;useLayout(model,layout.resize(layoutState(model),edge,path,value));let updated=model.trees[edge];for(const key of path)updated=updated[key];apply(updated.ratio);});
 const finish=()=>{if(resizing){remember(session);resizing=null;}};divider.addEventListener('pointerup',finish);divider.addEventListener('pointercancel',finish);divider.addEventListener('lostpointercapture',finish);
 divider.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();let currentNode=model.trees[edge];for(const key of path)currentNode=currentNode[key];const value=event.key==='Home'?.1:event.key==='End'?.9:currentNode.ratio+(['ArrowLeft','ArrowUp'].includes(event.key)?-.05:.05);useLayout(model,layout.resize(layoutState(model),edge,path,value));remember(session);renderEdge(edge,session,model);edgeNodes[edge].content.querySelector('[data-split-path="'+path.join('-')+'"]')?.focus();});divider.dataset.splitPath=path.join('-');
 renderTree(node.first,first,session,model,edge,[...path,'first']);renderTree(node.second,second,session,model,edge,[...path,'second']);split.append(first,divider,second);parent.append(split);
}
function renderEdge(edge,session,model){
 const {host:sideHost,splitter:sideSplitter,tabs:sideTabs,content:sideContent}=edgeNodes[edge];if(model)normalizeModel(model);
 const visible=!!model?.trees[edge],historySearchFocused=document.activeElement?.classList?.contains('dock-history-search')&&sideContent.contains(document.activeElement),historySelection=historySearchFocused?{start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;
 const previous=sideContent.querySelector('[data-dock="split"] .dock-output-copy'),previousModel=sessionPanels.get(sideContent.dataset.session);if(previous&&previousModel)previousModel.splitScroll={top:previous.scrollTop,bottom:previous.scrollHeight-previous.clientHeight-previous.scrollTop<4};
 sideHost.hidden=!visible;sideSplitter.hidden=!visible;sideTabs.replaceChildren();sideTabs.hidden=true;disposeImages(sideContent);sideContent.replaceChildren();sideContent.dataset.session=session?.id||'';if(!visible)return;
 renderTree(model.trees[edge],sideContent,session,model,edge);if(historySearchFocused){const input=sideContent.querySelector('.dock-history-search');input?.focus();if(input&&historySelection)try{input.setSelectionRange(historySelection.start,historySelection.end);}catch{}}
}
function render(){
 const session=current(),model=session&&ensure(session);syncFloats(session,model);
 for(const edge of layout.EDGES){renderEdge(edge,session,model);const nodes=edgeNodes[edge],size=model?.sizes[edge]||layout.DEFAULT_SIZE[edge],visible=!nodes.host.hidden;nodes.splitter.setAttribute('aria-valuenow',String(size));document.documentElement.style.setProperty('--dock-'+edge+'-size',visible?size+'px':'0px');document.documentElement.style.setProperty('--dock-'+edge+'-gap',visible?'5px':'0px');}
}
function handleFloatEvent(id,event){
 const owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session||!event||typeof event!=='object')return false;
 const type=owner.type,model=ensure(session),action=event.action;if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return false;
 if(action==='rendered'&&event.type===type&&event.sessionId===session.id){owner.rendered=true;return true;}
 if(action==='dock'){dockPane(type,session);return true;}
 if(action==='dock-edge'&&layout.EDGES.includes(event.edge)){dockPane(type,session,event.edge);return true;}
 if(action==='close'){closePane(type,session);return true;}
 if(action==='history-recall'&&type==='history'){
  const rows=session.history.slice(-200).reverse(),text=rows[Number(event.index)];if(typeof text!=='string')return false;api().selectSession(session.id);$('input').value=text;$('input').focus();return true;
 }
 if(action==='notes-save'&&type==='notes'){
  const character=api().state.characters.find(x=>x.id===session.characterId),world=api().state.worlds.find(x=>x.id===session.worldId),profile=character||world;
  if(!profile||event.profileId!==profile.id||typeof event.text!=='string'||event.text.length>16384)return false;
  profile.notes=event.text;model.notesDrafts.delete((character?'character:':'world:')+profile.id);api().saveSettings();updateFloat(session,type);return true;
 }
 if(action==='notes-draft'&&type==='notes'){
  const character=api().state.characters.find(x=>x.id===session.characterId),world=api().state.worlds.find(x=>x.id===session.worldId),profile=character||world;
  if(!profile||event.profileId!==profile.id||typeof event.text!=='string'||event.text.length>16384)return false;
  model.notesDrafts.set((character?'character:':'world:')+profile.id,event.text);return true;
 }
 if(type==='map'&&['map-route','map-walk','map-step','map-pin','map-layer','map-track','map-locate'].includes(action)){
  let graph;try{graph=BeipMapSessions.graph(session);}catch{return false;}
  if(action==='map-layer')return BeipMapSessions.setLayer(session,event.layerId);
  if(action==='map-track'){BeipMapSessions.setTracking(session,event.enabled===true);return true;}
  if(action==='map-locate'){const found=BeipMapSessions.locate(session,[...session.view.querySelectorAll('.line')].slice(-1000).map(line=>line.textContent));if(!found){model.floatRoute='No unambiguous room found in recent output.';updateFloat(session,type);}return true;}
  if(typeof event.roomId!=='string'||!graph.rooms().some(room=>room.id===event.roomId))return false;
  if(action==='map-pin')return BeipMapSessions.pin(session,event.roomId);
  const route=graph.shortestPath(event.roomId);
  if(action==='map-route')model.floatRoute=route?route.commands.join(' → ')||'Already in this room.':'No route from the current room.';
  else{const commands=route?.commands;if(!session.connected||!commands||commands.length>256)model.floatRoute='No connected route for this session.';else{for(const command of action==='map-step'?commands.slice(0,1):commands)api().sendRaw(session,command);model.floatRoute='Sent '+(action==='map-step'?Math.min(commands.length,1):commands.length)+' commands. Awaiting observed position.';}}
  updateFloat(session,type);return true;
 }
 if(action==='map-edit'&&type==='map'){api().selectSession(session.id);$('mapperButton')?.click();return true;}
 if(action==='link-command'&&type==='split'){if(typeof event.value!=='string'||event.value.length>4096)return false;const first=event.value.split('|')[0];if(!first)return false;api().command(first,event.prompt===true,session);return true;}
 if(action==='link-url'&&type==='split'){if(typeof event.value!=='string'||event.value.length>4096||!/^https?:\/\//i.test(event.value))return false;nativePost('external|'+event.value);return true;}
 if(action==='image-loaded'&&type==='image'){if(event.index!==model.imageIndex||!Number.isFinite(event.width)||event.width<1||!Number.isFinite(event.height)||event.height<1)return false;owner.imageLoaded={width:event.width,height:event.height,paused:event.paused===true};return true;}
 if(action==='image-state'&&type==='image'){model.imageState=BeipImageView.normalizeState(event.state,model.images.length);model.imageIndex=model.imageState.selected;return true;}
 if(action==='image-action'&&type==='image'){const index=Number(event.index);if(!Number.isInteger(index)||!model.images[index])return false;return BeipImageRuntime.request(session,event.name,model.images[index].url);}
 if(action==='image-select'&&type==='image'){const at=Number(event.index);if(!Number.isInteger(at)||at<0||at>=model.images.length)return false;model.imageIndex=at;updateFloat(session,type);return true;}
 if(action==='image-open'&&type==='image'){const at=Number(event.index);if(!Number.isInteger(at)||at<0||at>=model.images.length)return false;nativePost('external|'+model.images[at].url);return true;}
 if(action==='spawn-select'&&type==='spawn'){if(typeof event.name!=='string'||!model.spawn.has(event.name))return false;model.spawnSelected=event.name;updateFloat(session,type);return true;}
 return false;
}
function handleNative(message){
 if(typeof message!=='string'||!message.startsWith('float:'))return false;
 if(message.startsWith('float:drag|')){
  const parts=message.split('|'),id=parts[1],phase=parts[2],owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);
  if(!session||current()?.id!==session.id||owner.profileKey!==profileKey(session)||!['move','drop','cancel'].includes(phase)){if(paneDrag?.nativeId===id)cancelPaneDrag();return true;}
  if(phase==='cancel'){if(paneDrag?.nativeId===id)cancelPaneDrag();return true;}
  const x=Number(parts[3]),y=Number(parts[4]),ctrl=parts[5]==='1';if(parts.length!==6||![x,y].every(Number.isFinite))return true;
  if(phase==='move'){
   if(paneDrag?.nativeId!==id){cancelPaneDrag();paneDrag={nativeId:id,session,profileKey:owner.profileKey,type:owner.type,group:false,started:true,source:null,edge:''};}
   const drag=paneDrag,rect=workspace.getBoundingClientRect(),bottom=document.querySelector('footer').getBoundingClientRect().top;
   Object.assign(dropOverlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:Math.max(0,bottom-rect.top)+'px'});dropOverlay.hidden=false;
   drag.edge=ctrl?'':layout.dropEdge(x,y,Object.fromEntries(layout.EDGES.map(edge=>[edge,dropTargets[edge].getBoundingClientRect()])));updatePaneDrop(drag,x,y);if(ctrl||drag.edge){drag.side='';paneDropOverlay.hidden=true;}for(const edge of layout.EDGES)dropTargets[edge].classList.toggle('is-target',edge===drag.edge);
  }else if(paneDrag?.nativeId===id){const drag=paneDrag,edge=ctrl?'':layout.dropEdge(x,y,Object.fromEntries(layout.EDGES.map(edge=>[edge,dropTargets[edge].getBoundingClientRect()]))),side=ctrl?'':paneDropAt(x,y);cancelPaneDrag();if(dragStillOwned(drag)){if(edge)dockPane(owner.type,session,edge);else if(side&&drag.target)arrangePane(owner.type,drag.target,side,session);}}
  return true;
 }
 if(message.startsWith('float:ready|')){const owner=floatOwners.get(message.slice(12));if(owner)owner.ready=true;return true;}
 if(message.startsWith('float:event|')){const at=message.indexOf('|',12);if(at<0)return true;const id=message.slice(12,at);try{handleFloatEvent(id,JSON.parse(decode64(message.slice(at+1))));}catch{}return true;}
 if(message.startsWith('float:bounds|')){const parts=message.split('|');if(parts.length!==6)return true;const id=parts[1],owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;const nums=parts.slice(2).map(Number);if(nums.some(x=>!Number.isFinite(x)))return true;const [x,y,width,height]=nums;const rect={x:Math.max(-4000,Math.min(4000,Math.round(x))),y:Math.max(-4000,Math.min(4000,Math.round(y))),width:Math.max(240,Math.min(1400,Math.round(width))),height:Math.max(180,Math.min(1000,Math.round(height)))};model.floating.set(owner.type,rect);remember(session);return true;}
 if(message.startsWith('float:error|')){const id=message.slice(12),owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;model.floatIds.delete(owner.type);model.floating.delete(owner.type);floatOwners.delete(id);if(!model.order.includes(owner.type))model.order.push(owner.type);model.activeByEdge[edgeFor(model,owner.type)]=owner.type;model.active=owner.type;session.status='Could not open floating window; pane restored to dock.';remember(session);if(current()?.id===session.id){$('status').textContent=session.status;render();}return true;}
 if(message.startsWith('float:closed|')){const id=message.slice(13),owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;model.floatIds.delete(owner.type);model.floating.delete(owner.type);model.order=model.order.filter(x=>x!==owner.type);floatOwners.delete(id);remember(session);if(current()?.id===session.id)render();return true;}
 return false;
}
function floatingStatus(session=current()){const model=session&&sessionPanels.get(session.id);if(!model)return [];return [...model.floatIds].map(([type,id])=>({type,id,ready:!!floatOwners.get(id)?.ready,rendered:!!floatOwners.get(id)?.rendered,...(type==='image'?{imageLoaded:floatOwners.get(id)?.imageLoaded}: {})}));}
for(const edge of layout.EDGES){
 const sideSplitter=edgeNodes[edge].splitter;let drag=null;
 sideSplitter.addEventListener('pointerdown',event=>{if(event.button!==0)return;const session=current();if(!session)return;drag={session,startX:event.clientX,startY:event.clientY,size:ensure(session).sizes[edge]};sideSplitter.setPointerCapture(event.pointerId);event.preventDefault();});
 sideSplitter.addEventListener('pointermove',event=>{if(!drag)return;const delta=edge==='left'?event.clientX-drag.startX:edge==='right'?drag.startX-event.clientX:edge==='top'?event.clientY-drag.startY:drag.startY-event.clientY,model=ensure(drag.session);model.sizes[edge]=layout.dimension(drag.size+delta,edge);sideSplitter.setAttribute('aria-valuenow',String(model.sizes[edge]));if(current()?.id===drag.session.id)document.documentElement.style.setProperty('--dock-'+edge+'-size',model.sizes[edge]+'px');});
 const finish=()=>{if(!drag)return;remember(drag.session);drag=null;};sideSplitter.addEventListener('pointerup',finish);sideSplitter.addEventListener('pointercancel',finish);sideSplitter.addEventListener('lostpointercapture',finish);
 sideSplitter.addEventListener('keydown',event=>{const grow=edge==='left'?'ArrowRight':edge==='right'?'ArrowLeft':edge==='top'?'ArrowDown':'ArrowUp',shrink=edge==='left'?'ArrowLeft':edge==='right'?'ArrowRight':edge==='top'?'ArrowUp':'ArrowDown';if(![grow,shrink,'Home','End'].includes(event.key))return;const session=current();if(!session)return;event.preventDefault();const model=ensure(session),minimum=edge==='bottom'?50:edge==='top'?90:edge==='right'?220:180,maximum=edge==='bottom'?400:edge==='top'?500:700;model.sizes[edge]=layout.dimension(event.key==='Home'?minimum:event.key==='End'?maximum:model.sizes[edge]+(event.key===grow?10:-10),edge);sideSplitter.setAttribute('aria-valuenow',String(model.sizes[edge]));document.documentElement.style.setProperty('--dock-'+edge+'-size',model.sizes[edge]+'px');remember(session);});
 sideSplitter.setAttribute('aria-valuenow',String(layout.DEFAULT_SIZE[edge]));
}
window.addEventListener('beip-image-action',event=>{const session=api()?.sessions.get(event.detail?.sessionId);if(!session)return;const model=ensure(session);model.imageMessage=session.status;updateFloat(session,'image');if(current()?.id===session.id&&paneVisible(model,'image'))refreshPane('image',session,model);});
window.addEventListener('beip-map-position',event=>{const session=api()?.sessions.get(event.detail?.sessionId);if(!session)return;const model=ensure(session);if(current()?.id===session.id&&paneVisible(model,'map'))refreshPane('map',session,model);updateFloat(session,'map');});
window.addEventListener('beip-map-updated',()=>{const session=current();if(!session)return;const model=ensure(session);if(paneVisible(model,'map'))refreshPane('map',session,model);updateFloat(session,'map');});
window.BeipDockPanels={open,toggle,closePane,floatPane,dockPane,movePane,moveGroup,arrangePane,copyAllWindowSettings,pasteAllWindowSettings,selected,closed,clear,addHistory,addImage,recordLine,refreshLine,removeLine,routeSpawn,handleNative,floatingStatus,render};
selected();
})();
