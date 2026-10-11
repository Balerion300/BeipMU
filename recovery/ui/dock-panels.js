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
let windowSettingsClipboard=null;
function profileKey(session){return 'beipmu:dock:'+String(session?.characterId||session?.worldId||'unassigned').slice(0,80);}
function remember(session){
 if(!session||session.kind!=='world')return;
 const model=ensure(session);
 const floating=Object.fromEntries(model.floating);
 try{localStorage.setItem(profileKey(session),JSON.stringify(layout.copyable({order:model.order,edges:model.edges,sizes:model.sizes,activeByEdge:model.activeByEdge,floating})));}catch{}
}
function savedLayout(key){
 let value={};try{value=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 const result=layout.normalize(value,{rightWidth:legacyRightWidth});if(!window.chrome?.webview?.postMessage)result.floating={};return result;
}
function ensure(session){
 let model=sessionPanels.get(session.id);const key=profileKey(session);
 if(!model){
  const saved=savedLayout(key);
  model={profileKey:key,order:saved.order,edges:saved.edges,sizes:saved.sizes,activeByEdge:saved.activeByEdge,active:Object.values(saved.activeByEdge).find(Boolean)||'',floating:new Map(Object.entries(saved.floating)),floatIds:new Map(),images:[],imageIndex:-1,history:[],spawn:new Map(),spawnSelected:'',splitLines:[],splitScroll:null,notesDrafts:new Map()};
  sessionPanels.set(session.id,model);
 }else if(model.profileKey!==key){
  for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}
  const saved=savedLayout(key);
  model.profileKey=key;model.order=saved.order;model.edges=saved.edges;model.sizes=saved.sizes;model.activeByEdge=saved.activeByEdge;model.active=Object.values(saved.activeByEdge).find(Boolean)||'';model.floating=new Map(Object.entries(saved.floating));model.floatIds.clear();
 }
 return model;
}
function edgeFor(model,type){return layout.EDGES.includes(model.edges[type])?model.edges[type]:layout.DEFAULT_EDGE[type];}
function activeOn(model,edge){const available=model.order.filter(type=>edgeFor(model,type)===edge&&!model.floating.has(type));if(!available.includes(model.activeByEdge[edge]))model.activeByEdge[edge]=available[0]||'';return model.activeByEdge[edge];}
function paneVisible(model,type){return !model.floating.has(type)&&activeOn(model,edgeFor(model,type))===type;}
function pane(type,title,session){const section=document.createElement('section');section.className='dock-pane';section.dataset.dock=type;const header=document.createElement('div');header.className='dock-pane-head';const heading=document.createElement('span');heading.textContent=title||kinds[type];const controls=document.createElement('span');controls.className='dock-head-controls';const position=document.createElement('select');position.className='dock-position';position.setAttribute('aria-label','Dock '+(title||kinds[type])+' on');position.title='Dock position';for(const edge of layout.EDGES){const option=document.createElement('option');option.value=edge;option.textContent=edge[0].toUpperCase()+edge.slice(1);position.append(option);}position.value=edgeFor(ensure(session),type);position.onchange=()=>movePane(type,position.value,session);const floatButton=document.createElement('button');floatButton.type='button';floatButton.title='Float '+(title||kinds[type]);floatButton.setAttribute('aria-label',floatButton.title);floatButton.textContent='↗';floatButton.onclick=()=>floatPane(type,session);const close=document.createElement('button');close.type='button';close.className='dock-close';close.title='Close '+(title||kinds[type]);close.setAttribute('aria-label',close.title);close.textContent='×';close.onclick=()=>closePane(type,session);controls.append(position,floatButton,close);header.append(heading,controls);const body=document.createElement('div');body.className='dock-pane-body';section.append(header,body);return {section,header,body};}
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
 if(type==='image')return {images:model.images.slice(-100),selected:Math.max(0,model.imageIndex)};
 if(type==='notes'){const character=api().state.characters.find(x=>x.id===session.characterId),world=api().state.worlds.find(x=>x.id===session.worldId),profile=character||world,key=profile?(character?'character:':'world:')+profile.id:'';return {profileId:profile?.id||'',profileKind:character?'character':'world',name:profile?.name||'',text:key?(model.notesDrafts.get(key)??profile?.notes??''):''};}
 if(type==='map'){let graph;try{graph=BeipMapper.createWorld(api().state.maps?.[session.worldId]);}catch{graph=BeipMapper.createWorld();}return {worldId:session.worldId,rooms:graph.rooms().slice(0,512),exits:graph.exits().slice(0,2048),currentRoom:graph.currentRoom(),routeText:model.floatRoute||''};}
 if(type==='split')return {lines:(model.splitLines.length?model.splitLines:[...session.view.querySelectorAll('.line')]).slice(-200).map(richLine)};
 if(type==='spawn'){const names=[...model.spawn.keys()],selected=model.spawn.has(model.spawnSelected)?model.spawnSelected:names[0]||'';return {names,selected,lines:(model.spawn.get(selected)||[]).slice(-200).map(x=>x.slice(0,2048))};}
 return {};
}
function floatSnapshot(session,type,model){const data=floatData(session,type,model),snapshot={sessionId:session.id,type,edge:edgeFor(model,type),title:floatTitle(session,type),data};let serialized=JSON.stringify(snapshot);while(new TextEncoder().encode(serialized).length>245760){const lists=[data.rows,data.lines,data.rooms,data.exits,data.images].filter(x=>Array.isArray(x)&&x.length>1).sort((a,b)=>b.length-a.length),list=lists[0];if(!list){snapshot.data={message:'This pane has too much content to display in a floating window.'};serialized=JSON.stringify(snapshot);break;}list.splice(0,Math.ceil(list.length/2));serialized=JSON.stringify(snapshot);}return serialized;}
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
 if(!session||!kinds[type])return false;const model=ensure(session),id=model.floatIds.get(type);if(id){nativePost('float:close|'+id);floatOwners.delete(id);model.floatIds.delete(type);}model.floating.delete(type);if(!model.order.includes(type))model.order.push(type);if(layout.EDGES.includes(edge))model.edges[type]=edge;const next=edgeFor(model,type);model.activeByEdge[next]=type;model.active=type;remember(session);if(current()?.id===session.id)render();return true;
}
function movePane(type,edge,session=current()){
 if(!session||!kinds[type]||!layout.EDGES.includes(edge))return false;const model=ensure(session);if(model.floating.has(type))return dockPane(type,session,edge);if(!model.order.includes(type))model.order.push(type);const previous=edgeFor(model,type);model.edges[type]=edge;if(previous!==edge&&model.activeByEdge[previous]===type){model.activeByEdge[previous]='';activeOn(model,previous);}model.activeByEdge[edge]=type;model.active=type;remember(session);if(current()?.id===session.id)render();return true;
}
function open(type,session=current()){
 if(!session||!kinds[type])return false;
 const model=ensure(session);
 if(!model.order.includes(type))model.order.push(type);
 if(model.floating.has(type)){openFloat(session,type);return true;}
 const edge=edgeFor(model,type);model.activeByEdge[edge]=type;model.active=type;remember(session);if(current()?.id===session.id)render();return true;
}
function closePane(type,session=current()){
 if(!session)return;
 const model=ensure(session),edge=edgeFor(model,type);model.order=model.order.filter(x=>x!==type);
 const id=model.floatIds.get(type);if(id){nativePost('float:close|'+id);floatOwners.delete(id);model.floatIds.delete(type);}model.floating.delete(type);
 if(model.activeByEdge[edge]===type){model.activeByEdge[edge]='';activeOn(model,edge);}if(model.active===type)model.active=Object.values(model.activeByEdge).find(Boolean)||'';
 remember(session);if(current()?.id===session.id)render();
}
function toggle(type,session=current()){if(!session)return false;const model=ensure(session);return model.order.includes(type)?(closePane(type,session),false):open(type,session);}
function copyAllWindowSettings(session=current()){if(!session)return false;const model=ensure(session);windowSettingsClipboard=layout.copyable({order:model.order,edges:model.edges,sizes:model.sizes,activeByEdge:model.activeByEdge,floating:Object.fromEntries(model.floating)});session.status='Window pane settings copied.';if(current()?.id===session.id)$('status').textContent=session.status;return true;}
function pasteAllWindowSettings(session=current()){
 if(!session)return false;if(!session.worldId){session.status='Choose a saved world before pasting window settings.';if(current()?.id===session.id)$('status').textContent=session.status;return false;}
 if(!windowSettingsClipboard){session.status='Copy window settings first.';if(current()?.id===session.id)$('status').textContent=session.status;return false;}
 const model=ensure(session);for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}const copy=layout.copyable(windowSettingsClipboard);model.order=copy.order;model.edges=copy.edges;model.sizes=copy.sizes;model.activeByEdge=copy.activeByEdge;model.active=Object.values(copy.activeByEdge).find(Boolean)||'';model.floating=new Map(Object.entries(window.chrome?.webview?.postMessage?copy.floating:{}));model.floatIds.clear();remember(session);if(current()?.id===session.id)render();session.status='Window pane settings pasted.';if(current()?.id===session.id)$('status').textContent=session.status;return true;
}
function selected(session=current()){if(session)ensure(session);render();}
function closed(session){const model=sessionPanels.get(session.id);if(model)for(const id of model.floatIds.values()){nativePost('float:close|'+id);floatOwners.delete(id);}sessionPanels.delete(session.id);}
function clear(session){const model=session&&sessionPanels.get(session.id);if(!model)return;model.splitLines=[];model.images=[];for(const type of ['split','image'])updateFloat(session,type);if(current()?.id===session.id){for(const type of ['split','image'])if(paneVisible(model,type))renderEdge(edgeFor(model,type),session,model);}}
function addHistory(session,text){const model=ensure(session);model.history.push(text);if(model.history.length>500)model.history.shift();updateFloat(session,'history');if(current()?.id===session.id&&paneVisible(model,'history'))renderEdge(edgeFor(model,'history'),session,model);}
function addImage(session,event){if(!event?.url)return;const model=ensure(session),wasLatest=model.imageIndex<0||model.imageIndex===model.images.length-1;model.images.push({url:event.url,alt:String(event.alt||'Image').slice(0,160)});if(model.images.length>100){model.images.shift();if(!wasLatest)model.imageIndex=Math.max(0,model.imageIndex-1);}if(wasLatest)model.imageIndex=model.images.length-1;updateFloat(session,'image');if(current()?.id===session.id&&paneVisible(model,'image'))renderEdge(edgeFor(model,'image'),session,model);}
function recordLine(session,line){const model=ensure(session);model.splitLines.push(line);if(model.splitLines.length>500)model.splitLines.shift();updateFloat(session,'split');if(current()?.id===session.id&&paneVisible(model,'split'))renderEdge(edgeFor(model,'split'),session,model);}
function refreshLine(session){const model=sessionPanels.get(session?.id);if(!model)return;updateFloat(session,'split');if(current()?.id===session.id&&paneVisible(model,'split'))renderEdge(edgeFor(model,'split'),session,model);}
function routeSpawn(session,title,text,{group=''}={}){
 const model=ensure(session),name=String(title||'Window').slice(0,80),groupName=String(group||'').slice(0,80),key=groupName?groupName+' / '+name:name,rows=model.spawn.get(key)||[];
 if(!model.spawn.has(key)&&model.spawn.size>=32){session.status='Spawn window limit reached (32 per session).';if(current()?.id===session.id)$('status').textContent=session.status;return true;}
 rows.push(String(text||'').slice(0,8192));while(rows.length>200||rows.reduce((total,line)=>total+line.length,0)>262144)rows.shift();model.spawn.set(key,rows);if(!model.spawnSelected)model.spawnSelected=key;
 const first=!model.order.includes('spawn');if(first){model.order.push('spawn');model.edges.spawn=layout.DEFAULT_EDGE.spawn;model.activeByEdge.right='spawn';model.active='spawn';}
 updateFloat(session,'spawn');
 if(current()?.id===session.id){if(first)render();else if(paneVisible(model,'spawn'))renderEdge(edgeFor(model,'spawn'),session,model);}return true;
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
 const search=document.createElement('input');search.type='search';search.className='dock-history-search';search.placeholder='Find history';search.setAttribute('aria-label','Find history');search.value=model.historyQuery||'';
 const list=document.createElement('div');list.className='dock-list';list.setAttribute('aria-label','Sent commands');
 const rows=(session.history.length?session.history:model.history).slice(-500).reverse();
 const draw=()=>{list.replaceChildren();for(const text of rows){if(!text.toLowerCase().includes(search.value.toLowerCase()))continue;const row=button(text,()=>{const input=$('input');input.value=text;input.focus();input.setSelectionRange(text.length,text.length);});row.className='dock-history-row';row.title='Place command in input';list.append(row);}};
 search.addEventListener('input',()=>{model.historyQuery=search.value;draw();});body.append(search);if(!rows.length)status(body,'Commands sent in this session appear here.');body.append(list);draw();
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
function renderEdge(edge,session,model){
 const nodes=edgeNodes[edge],{host:sideHost,splitter:sideSplitter,tabs:sideTabs,content:sideContent}=nodes;
 const docked=model?.order.filter(type=>edgeFor(model,type)===edge&&!model.floating.has(type))||[],visible=!!docked.length;
 const historySearchFocused=document.activeElement?.classList?.contains('dock-history-search')&&sideContent.contains(document.activeElement);
 const previous=sideContent.querySelector('.dock-output-copy'),previousModel=sessionPanels.get(sideContent.dataset.session);
 if(previous&&previousModel&&sideContent.querySelector('.dock-pane')?.dataset.dock==='split')previousModel.splitScroll={top:previous.scrollTop,bottom:previous.scrollHeight-previous.clientHeight-previous.scrollTop<4};
 sideHost.hidden=!visible;sideSplitter.hidden=!visible;sideTabs.replaceChildren();sideContent.replaceChildren();sideContent.dataset.session=session?.id||'';
 if(!visible)return;
 const active=activeOn(model,edge);
 for(const type of docked){const tab=button(kinds[type],()=>{model.activeByEdge[edge]=type;model.active=type;remember(session);renderEdge(edge,session,model);});tab.className='dock-tab';tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(active===type));sideTabs.append(tab);}
 const {section,body}=pane(active,active==='spawn'?(model.spawn.keys().next().value||kinds.spawn):kinds[active],session);sideContent.append(section);
 if(active==='map')renderMap(body,session);
 else if(active==='history')renderHistory(body,session,model);
 else if(active==='image')renderImages(body,model);
 else if(active==='notes')renderNotes(body,session,model);
 else if(active==='split')renderSplit(body,session,model);
 else if(active==='spawn')renderSpawn(body,model);
 if(active==='split'&&model.splitScroll){const next=sideContent.querySelector('.dock-output-copy');if(next)next.scrollTop=model.splitScroll.bottom?next.scrollHeight:model.splitScroll.top;}
 if(active==='history'&&historySearchFocused)sideContent.querySelector('.dock-history-search')?.focus();
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
 if((action==='map-route'||action==='map-walk')&&type==='map'){
  let graph;try{graph=BeipMapper.createWorld(api().state.maps?.[session.worldId]);}catch{return false;}
  if(typeof event.roomId!=='string'||!graph.rooms().some(room=>room.id===event.roomId))return false;
  if(action==='map-route'){const route=graph.shortestPath(event.roomId);model.floatRoute=route?route.commands.join(' → ')||'Already in this room.':'No route from the current room.';}
  else{const commands=graph.walkCommands(event.roomId);if(!session.connected||!commands||commands.length>256){model.floatRoute='No connected route for this session.';}else{for(const command of commands)api().sendRaw(session,command);model.floatRoute='Sent '+commands.length+' commands. Update the current room after arrival.';}}
  updateFloat(session,type);return true;
 }
 if(action==='map-edit'&&type==='map'){api().selectSession(session.id);$('mapperButton')?.click();return true;}
 if(action==='link-command'&&type==='split'){if(typeof event.value!=='string'||event.value.length>4096)return false;const first=event.value.split('|')[0];if(!first)return false;api().command(first,event.prompt===true,session);return true;}
 if(action==='link-url'&&type==='split'){if(typeof event.value!=='string'||event.value.length>4096||!/^https?:\/\//i.test(event.value))return false;nativePost('external|'+event.value);return true;}
 if(action==='image-select'&&type==='image'){const at=Number(event.index);if(!Number.isInteger(at)||at<0||at>=model.images.length)return false;model.imageIndex=at;updateFloat(session,type);return true;}
 if(action==='image-open'&&type==='image'){const at=Number(event.index);if(!Number.isInteger(at)||at<0||at>=model.images.length)return false;nativePost('external|'+model.images[at].url);return true;}
 if(action==='spawn-select'&&type==='spawn'){if(typeof event.name!=='string'||!model.spawn.has(event.name))return false;model.spawnSelected=event.name;updateFloat(session,type);return true;}
 return false;
}
function handleNative(message){
 if(typeof message!=='string'||!message.startsWith('float:'))return false;
 if(message.startsWith('float:ready|')){const owner=floatOwners.get(message.slice(12));if(owner)owner.ready=true;return true;}
 if(message.startsWith('float:event|')){const at=message.indexOf('|',12);if(at<0)return true;const id=message.slice(12,at);try{handleFloatEvent(id,JSON.parse(decode64(message.slice(at+1))));}catch{}return true;}
 if(message.startsWith('float:bounds|')){const parts=message.split('|');if(parts.length!==6)return true;const id=parts[1],owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;const nums=parts.slice(2).map(Number);if(nums.some(x=>!Number.isFinite(x)))return true;const [x,y,width,height]=nums;const rect={x:Math.max(-4000,Math.min(4000,Math.round(x))),y:Math.max(-4000,Math.min(4000,Math.round(y))),width:Math.max(240,Math.min(1400,Math.round(width))),height:Math.max(180,Math.min(1000,Math.round(height)))};model.floating.set(owner.type,rect);remember(session);return true;}
 if(message.startsWith('float:error|')){const id=message.slice(12),owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;model.floatIds.delete(owner.type);model.floating.delete(owner.type);floatOwners.delete(id);if(!model.order.includes(owner.type))model.order.push(owner.type);model.activeByEdge[edgeFor(model,owner.type)]=owner.type;model.active=owner.type;session.status='Could not open floating window; pane restored to dock.';remember(session);if(current()?.id===session.id){$('status').textContent=session.status;render();}return true;}
 if(message.startsWith('float:closed|')){const id=message.slice(13),owner=floatOwners.get(id),session=owner&&api().sessions.get(owner.sessionId);if(!session)return true;const model=ensure(session);if(floatOwners.get(id)!==owner||owner.profileKey!==model.profileKey)return true;model.floatIds.delete(owner.type);model.floating.delete(owner.type);model.order=model.order.filter(x=>x!==owner.type);floatOwners.delete(id);remember(session);if(current()?.id===session.id)render();return true;}
 return false;
}
function floatingStatus(session=current()){const model=session&&sessionPanels.get(session.id);if(!model)return [];return [...model.floatIds].map(([type,id])=>({type,id,ready:!!floatOwners.get(id)?.ready,rendered:!!floatOwners.get(id)?.rendered}));}
for(const edge of layout.EDGES){
 const sideSplitter=edgeNodes[edge].splitter;let drag=null;
 sideSplitter.addEventListener('pointerdown',event=>{if(event.button!==0)return;const session=current();if(!session)return;drag={session,startX:event.clientX,startY:event.clientY,size:ensure(session).sizes[edge]};sideSplitter.setPointerCapture(event.pointerId);event.preventDefault();});
 sideSplitter.addEventListener('pointermove',event=>{if(!drag)return;const delta=edge==='left'?event.clientX-drag.startX:edge==='right'?drag.startX-event.clientX:edge==='top'?event.clientY-drag.startY:drag.startY-event.clientY,model=ensure(drag.session);model.sizes[edge]=layout.dimension(drag.size+delta,edge);sideSplitter.setAttribute('aria-valuenow',String(model.sizes[edge]));if(current()?.id===drag.session.id)document.documentElement.style.setProperty('--dock-'+edge+'-size',model.sizes[edge]+'px');});
 const finish=()=>{if(!drag)return;remember(drag.session);drag=null;};sideSplitter.addEventListener('pointerup',finish);sideSplitter.addEventListener('pointercancel',finish);sideSplitter.addEventListener('lostpointercapture',finish);
 sideSplitter.addEventListener('keydown',event=>{const grow=edge==='left'?'ArrowRight':edge==='right'?'ArrowLeft':edge==='top'?'ArrowDown':'ArrowUp',shrink=edge==='left'?'ArrowLeft':edge==='right'?'ArrowRight':edge==='top'?'ArrowUp':'ArrowDown';if(![grow,shrink,'Home','End'].includes(event.key))return;const session=current();if(!session)return;event.preventDefault();const model=ensure(session),minimum=edge==='bottom'?50:edge==='top'?90:edge==='right'?220:180,maximum=edge==='bottom'?400:edge==='top'?500:700;model.sizes[edge]=layout.dimension(event.key==='Home'?minimum:event.key==='End'?maximum:model.sizes[edge]+(event.key===grow?10:-10),edge);sideSplitter.setAttribute('aria-valuenow',String(model.sizes[edge]));document.documentElement.style.setProperty('--dock-'+edge+'-size',model.sizes[edge]+'px');remember(session);});
 sideSplitter.setAttribute('aria-valuenow',String(layout.DEFAULT_SIZE[edge]));
}
window.addEventListener('beip-map-updated',()=>{const session=current();if(!session)return;const model=ensure(session);if(paneVisible(model,'map'))renderEdge(edgeFor(model,'map'),session,model);updateFloat(session,'map');});
window.BeipDockPanels={open,toggle,closePane,floatPane,dockPane,movePane,copyAllWindowSettings,pasteAllWindowSettings,selected,closed,clear,addHistory,addImage,recordLine,refreshLine,routeSpawn,handleNative,floatingStatus,render};
selected();
})();
