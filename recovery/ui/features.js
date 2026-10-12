/* Desktop features on top of the isolated connection/rendering foundation. MIT. */
(function(){
'use strict';
const byId=id=>document.getElementById(id),send=value=>window.chrome?.webview?.postMessage(value);
const api=()=>window.BeipPreview;
function base64(value){const bytes=new TextEncoder().encode(value);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function decode(value){return new TextDecoder().decode(Uint8Array.from(atob(value),x=>x.charCodeAt(0)));}
function context(s){const a=api(),input=byId('input'),active=a.current===s,characters=new Map();for(const c of a.state.characters){const list=characters.get(c.worldId)||[];list.push({id:c.id,name:c.name,notes:c.notes});characters.set(c.worldId,list);}const worlds=a.state.worlds.map(w=>({...w,characters:characters.get(w.id)||[]}));return {sessionId:s.id,title:s.label,titlePrefix:s.scriptTitlePrefix||'',variables:a.variablesForSession(s),paused:!!s.paused,canReconnect:!!a.reconnectSession&&!!(s.worldId||s.host),logFileName:s.logPath||'',connected:s.connected,logging:s.logging,world:worlds.find(w=>w.id===s.worldId),character:a.state.characters.find(c=>c.id===s.characterId),worlds,windows:[...a.sessions.values()].map(w=>({id:w.id,title:w.label})),input:{text:active?input.value:s.draft||'',start:active?input.selectionStart:s.draftSelection?.start||0,end:active?input.selectionEnd:s.draftSelection?.end||0},buildNumber:10,version:10};}
function applyLine(node,snapshot){const line=BeipScripts.validLine(snapshot);if(!line)return;const fragment=document.createDocumentFragment();for(const run of line.runs){const span=document.createElement('span');span.textContent=run.text;const st=run.style;if(st.color)span.style.color=st.color;if(st.background)span.style.backgroundColor=st.background;if(st.bold)span.style.fontWeight='bold';if(st.italic)span.style.fontStyle='italic';span.style.textDecoration=[st.underline?'underline':'',st.strike?'line-through':''].filter(Boolean).join(' ');fragment.append(span);}node.replaceChildren(fragment);}
function snapshotLine(node){const runs=[],walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let textNode;while((textNode=walker.nextNode())){if(runs.length>=512)return node.textContent;const css=getComputedStyle(textNode.parentElement),style={};for(const [key,property] of [['color','color'],['background','backgroundColor']]){const match=/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(css[property]);if(match)style[key]='#'+match.slice(1).map(x=>Number(x).toString(16).padStart(2,'0')).join('');}if(Number(css.fontWeight)>=600||css.fontWeight==='bold')style.bold=true;if(css.fontStyle==='italic')style.italic=true;if(css.textDecorationLine.includes('underline'))style.underline=true;if(css.textDecorationLine.includes('line-through'))style.strike=true;runs.push({text:textNode.data,style});}return {text:node.textContent,runs};}
async function beforeDisplay(s,line){if(!s.scripts?.enabled)return false;const epoch=s.connectionEpoch,result=await dispatch(s,'display',snapshotLine(line));if(api().sessions.get(s.id)!==s||s.connectionEpoch!==epoch)return true;if(result.line)applyLine(line,result.line);return result.handled;}
function followEffects(s,fn){const worker=s.scripts?.worker,epoch=s.connectionEpoch;queueMicrotask(()=>{if(api().sessions.get(s.id)===s&&s.scripts?.worker===worker&&s.connectionEpoch===epoch)fn();});}
function allowChainedAction(s){const now=Date.now();if(!s.scriptActionWindow||now-s.scriptActionWindow.start>1000)s.scriptActionWindow={start:now,count:0};if(++s.scriptActionWindow.count>128){s.scripts.fail('Script stopped: recursive command or display limit exceeded.');return false;}return true;}
function dispatch(s,type,value){initialize(s);return s.scripts.dispatch(type,value,context(s));}
function initialize(s){if(!s.gmcp)s.gmcp=new BeipGMCP.State();if(!s.media&&window.BeipMedia)s.media=BeipMedia.createController({enabled:!!api().state.preferences.mediaEnabled});if(!s.tilemap&&window.BeipTilemap)s.tilemap=BeipTilemap.createState();if(!s.stats){s.stats=document.createElement('aside');s.stats.className='stats';s.stats.hidden=true;s.view.before(s.stats);}if(!s.scripts)s.scripts=new BeipScripts.Runtime(effects=>{
 if(api().sessions.get(s.id)!==s)return;for(const e of effects){if(e.type==='send'){if(!/[\r\n]/.test(e.value))api().sendRaw(s,e.value);}else if(e.type==='input-set'){
  s.draft=e.value;s.draftSelection={start:e.value.length,end:e.value.length};if(api().current===s){byId('input').value=e.value;byId('input').setSelectionRange(e.value.length,e.value.length);}
 }else if(e.type==='input-select'){
  const length=(api().current===s?byId('input').value:s.draft||'').length;s.draftSelection={start:Math.min(length,e.start),end:Math.min(length,e.end)};if(api().current===s)byId('input').setSelectionRange(s.draftSelection.start,s.draftSelection.end);
 }else if(e.type==='variable-set'||e.type==='variable-delete'){
  const variables=api().variablesForSession(s);if(e.type==='variable-set'){const candidate={...variables,[e.name]:e.value},normalized=BeipRules.normalizeVariables(candidate);if(Object.keys(candidate).length!==Object.keys(normalized).length||normalized[e.name]!==e.value)throw Error('Variable limit exceeded.');Object.defineProperty(variables,e.name,{value:e.value,writable:true,enumerable:true,configurable:true});}else delete variables[e.name];if(s.characterId)api().saveSettings();
 }else if(e.type==='profile-set'){
  if(e.id!==(e.kind==='world'?s.worldId:s.characterId))throw Error('Profile changes require the owning session.');const list=e.kind==='world'?api().state.worlds:api().state.characters,profile=list.find(x=>x.id===e.id);if(!profile)throw Error('Profile no longer exists.');if(e.key==='name'&&list.some(x=>x.id!==e.id&&(e.kind==='world'||x.worldId===profile.worldId)&&x.name.toLowerCase()===e.value.toLowerCase()))throw Error('A profile with that name already exists.');profile[e.key]=e.value;api().saveSettings();api().renderProfileChoices();api().renderProfileLists();api().refreshTabs?.();
 }else if(e.type==='title-prefix'){s.scriptTitlePrefix=e.value;api().refreshTabs?.();
 }else if(e.type==='activity'){if(api().current!==s)s.unread=(s.unread||0)+1;if(e.important)s.importantActivity=(s.importantActivity||0)+1;api().refreshTabs?.();
 }else if(e.type==='run'){if(allowChainedAction(s))followEffects(s,()=>{for(const line of e.value.replace(/\r\n?/g,'\n').split('\n'))if(line)api().command(line,false,s);});
 }else if(e.type==='receive'){if(allowChainedAction(s))followEffects(s,()=>s.parser?.feed(e.value));
 }else if(e.type==='reconnect'){followEffects(s,()=>api().reconnectSession?.(s));
 }else if(e.type==='close'){followEffects(s,()=>api().closeSession(s.id));
 }else if(e.type==='connect-dialog'){followEffects(s,()=>{api().selectSession(s.id);byId('profilesButton').click();});
 }else if(e.type==='log-write'){if(s.logging)send('log|'+s.id+'|'+base64(e.value));
 }else if(e.type==='play-sound'){if(!api().state.preferences.mediaEnabled||!api().triggerAudio(s).playSound(e.value))throw Error('Enable sound and choose a supported local WAV path.');
 }else if(e.type==='stop-sounds'){s.triggerAudio?.stop();
 }else if(e.type==='output-line'){const previous=s.suppressAutomation;s.suppressAutomation=true;try{for(const run of e.line.runs)api().appendText(s,run.text,run.style);api().appendText(s,'\n');}finally{s.suppressAutomation=previous;}
 }else if(e.type==='debug'){window.BeipScriptDebug?.record(s,e.value,{show:false});}else{
  s.suppressAutomation=true;
  if(e.type==='html'){const p=new BeipProtocol.Parser(event=>api().renderEvent(s,event),()=>{});p.pueblo=true;p.feed(e.value);p.finish();}else api().appendText(s,e.value+'\n');
  s.suppressAutomation=false;
 }}
},error=>{window.BeipScriptDebug?.record(s,error);s.suppressAutomation=true;api().appendText(s,error+'\n',{color:'#e9ab96'});s.suppressAutomation=false;});s.scripts.setContextProvider(()=>context(s));}
function resize(s){if(s.kind!=='world'||!s.connected||s.view.hidden)return;const style=getComputedStyle(byId('output')),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=style.font;const cell=ctx.measureText('M').width||9;const rows=Math.max(1,Math.floor(byId('output').clientHeight/(parseFloat(style.lineHeight)||23))),cols=Math.max(1,Math.floor((byId('output').clientWidth-44)/cell));send('resize|'+s.id+'|'+Math.min(4096,cols)+'|'+Math.min(4096,rows));}
function renderTilemaps(s){if(!s.mapsPane){s.mapsPane=document.createElement('aside');s.mapsPane.className='tilemaps';s.view.before(s.mapsPane);}s.mapsPane.hidden=s.view.hidden;for(const name of s.tilemap.list()){const map=s.tilemap.get(name);let box=[...s.mapsPane.children].find(x=>x.dataset.name===name);if(!box){box=document.createElement('section');box.dataset.name=name;const title=document.createElement('h3');title.textContent=name;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',name);const status=document.createElement('p');status.className='hint';box.append(title,canvas,status);s.mapsPane.append(box);}const img=new Image();img.onload=()=>{box.lastChild.textContent=s.tilemap.render(box.querySelector('canvas'),name,img)?'':'Invalid tileset.';};img.onerror=()=>box.lastChild.textContent='Map image could not be loaded.';img.src=map.url;}}
new ResizeObserver(()=>{const s=api()?.current;if(s)resize(s);}).observe(byId('output'));
function stats(s){initialize(s);s.stats.replaceChildren();const panes=s.gmcp.rows();s.stats.hidden=!panes.length||s.view.hidden;for(const p of panes){const box=document.createElement('section');if(p.background)box.style.background=p.background;const title=document.createElement('h3');title.textContent=p.title;box.append(title);for(const r of p.rows){const row=document.createElement('div');row.className='stat-row';const label=document.createElement('span');label.textContent=r.name;label.style.textAlign=r.alignment;if(r.color||r.nameColor)label.style.color=r.color||r.nameColor;const value=document.createElement('span');value.textContent=r.text;if(r.color||r.valueColor)value.style.color=r.color||r.valueColor;row.append(label,value);if(r.fraction!==null){const meter=document.createElement('progress');meter.max=1;meter.value=r.fraction;meter.setAttribute('aria-label',r.name+': '+r.text);if(r.fill)meter.style.accentColor=r.fill;row.append(meter);}box.append(row);}s.stats.append(box);}}
function attachLine(s,line){initialize(s);const metadata=s.gmcp.takeLine();if(!metadata)return;line.gmcpAvatar=metadata;updateAvatar(s,line);}
function updateAvatar(s,line){const data=s.gmcp.avatar(line.gmcpAvatar);let image=line.querySelector('.avatar');if(!data?.url){image?.remove();return;}if(!image){image=document.createElement('img');image.className='avatar';image.alt='Player avatar';image.onerror=()=>{image.hidden=true;};line.prepend(image);}image.hidden=false;image.src=data.url;image.title=data.hint||'';image.onclick=()=>send('external|'+(data.clickURL||data.url));}
function incoming(s,payload){
 window.BeipClientCommands?.incoming?.(s,payload);
 if(payload.startsWith('gmcp:')){initialize(s);let message;try{message=decode(payload.slice(5));}catch{return true;}const result=s.gmcp.receive(message);if(result.send)send('gmcp|'+s.id+'|'+base64(result.send));if(result.stats)stats(s);if(result.avatars)for(const line of s.view.querySelectorAll('.line'))if(line.gmcpAvatar)updateAvatar(s,line);if(!result.error)dispatch(s,'gmcp',message);try{const at=message.indexOf(' ');const name=at<0?message:message.slice(0,at),data=at<0?null:JSON.parse(message.slice(at+1));if(name.toLowerCase().startsWith('client.media.'))s.media.handle(name,data);else if(name.toLowerCase().startsWith('beip.tilemap.')){s.tileQueue=(s.tileQueue||Promise.resolve()).then(()=>s.tilemap.apply(name,data)).then(()=>renderTilemaps(s)).catch(()=>{});}}catch{}return true;}
 if(payload==='connected:on'){initialize(s);resize(s);if(api().state.scriptEnabled&&!s.scripts.enabled)s.scripts.start(api().state.scriptSource||'',context(s)).then(()=>dispatch(s,'connect',''));}
 if(payload==='reset:'){initialize(s);s.scripts.stop();s.gmcp=new BeipGMCP.State();stats(s);}
 if(payload==='ended:'){if(s.scripts?.enabled){const worker=s.scripts.worker;dispatch(s,'disconnect','').then(()=>{if(s.scripts?.worker===worker)s.scripts.stop();});}s.media?.stopAll();}
 return false;
}
function completeLine(){}
function selected(){for(const s of api().sessions.values()){if(s.stats)s.stats.hidden=s.view.hidden||!s.gmcp.panes.size;if(s.mapsPane)s.mapsPane.hidden=s.view.hidden;const active=api().current===s;if(s.scriptWasActive!==active){s.scriptWasActive=active;if(s.scripts?.enabled)dispatch(s,'activate',String(active));}resize(s);}findReset();}
function closed(s){window.BeipClientCommands?.closed?.(s);s.scripts?.stop();s.media?.stopAll();s.stats?.remove();s.mapsPane?.remove();}
function display(s,value){s.suppressAutomation=true;api().appendText(s,value+'\n',{color:'#a6c9d5'});s.suppressAutomation=false;}
function handleCommand(value,s){
 if(window.BeipClientCommands?.handle?.(value,s))return true;
 if(value.startsWith('//')){api().sendRaw(s,value.slice(1));return true;}
 if(value.startsWith('/@')){initialize(s);s.scripts.evaluate(value.slice(2),context(s));return true;}
 if(!value.startsWith('/'))return false;
 const at=value.indexOf(' '),name=(at<0?value:value.slice(0,at)).toLowerCase(),arg=at<0?'':value.slice(at+1).trim();
 if(name==='/clear')byId('clear').click();
 else if(name==='/disconnect')send('disconnect|'+s.id);
 else if(name==='/log'){byId('logging').checked=!s.logWanted;byId('logging').dispatchEvent(new Event('change'));}
 else if(name==='/echo')display(s,arg);
 else if(name==='/find'){byId('findBar').hidden=false;byId('findText').value=arg;findNext(1);byId('findText').focus();}
 else if(name==='/worlds')byId('profilesButton').click();
 else if(name==='/alias'||name==='/trigger')byId('rulesButton').click();
 else if(name==='/connect'){
  const world=api().state.worlds.find(w=>w.name.toLowerCase()===arg.toLowerCase());
  if(world)api().connectSession(world.host,world.port,world.id,'',world.tls);
  else {const m=/^(\[[^\]]+\]|[^:\s]+):(\d{1,5})$/.exec(arg);if(m)api().connectSession(m[1].replace(/^\[|\]$/g,''),m[2]);else display(s,'Use /connect world-name or /connect host:port.');}
 }
 else if(name==='/help')display(s,'/connect world-name or host:port · /disconnect · /worlds · /alias · /trigger · /log · /clear · /find text · /echo text · /@ JavaScript\nUse // to send a command starting with a slash. Scripts support window.connection.send/SetOnReceive/SetOnGMCP and window.output.write/writeHTML.');
 else display(s,'Unknown client command '+name+'. Use // to send a slash to the server, or /help.');
 return true;
}
let found=[],foundAt=-1;
function findReset(){for(const node of found)node.classList.remove('find-hit');found=[];foundAt=-1;byId('findCount').textContent='';}
function findNext(step){findReset();const value=byId('findText').value.toLocaleLowerCase();if(!value)return;const session=api().current;if(!session)return;found=[...session.view.querySelectorAll('.line')].filter(e=>e.textContent.toLocaleLowerCase().includes(value));for(const node of found)node.classList.add('find-hit');foundAt=step<0?found.length-1:0;if(found.length)found[foundAt].scrollIntoView({block:'center'});byId('findCount').textContent=found.length+' matching lines';}
window.BeipFeatures={initialize,attachLine,incoming,completeLine,selected,closed,handleCommand,dispatch,context,applyLine,beforeDisplay};
byId('findButton').onclick=()=>{byId('findBar').hidden=!byId('findBar').hidden;if(!byId('findBar').hidden)byId('findText').focus();else findReset();};
byId('findForm').onsubmit=e=>{e.preventDefault();const query=byId('findText').value.toLocaleLowerCase();const s=api().current;if(!s)return;const next=[...s.view.querySelectorAll('.line')].filter(e=>query&&e.textContent.toLocaleLowerCase().includes(query));if(!next.length){findReset();byId('findCount').textContent='No matches';return;}if(next.length!==found.length||next.some((n,i)=>n!==found[i]))findNext(1);else{foundAt=(foundAt+1)%found.length;found[foundAt].scrollIntoView({block:'center'});byId('findCount').textContent=(foundAt+1)+' / '+found.length;}};
byId('exportButton').onclick=()=>{const s=api().current;if(s)send('export|'+(s.kind==='spawn'?s.parentId:s.id)+'|'+base64([...s.view.querySelectorAll('.line')].map(e=>e.textContent).join('\r\n')));};
byId('scriptsButton').onclick=()=>{byId('scriptSource').value=api().state.scriptSource||'';byId('scriptEnabled').checked=!!api().state.scriptEnabled;byId('scriptsDialog').showModal();};
byId('scriptForm').onsubmit=e=>{e.preventDefault();api().state.scriptSource=byId('scriptSource').value;api().state.scriptEnabled=byId('scriptEnabled').checked;api().saveSettings();for(const s of api().sessions.values())if(s.kind==='world'){initialize(s);s.scripts.stop();if(api().state.scriptEnabled&&s.connected)s.scripts.start(api().state.scriptSource,context(s));}byId('scriptsDialog').close();};
byId('scriptRun').onclick=()=>{const s=api().current;if(s?.kind==='world'){initialize(s);s.scripts.evaluate(byId('scriptSource').value,context(s));}};
byId('scriptStop').onclick=()=>{for(const s of api().sessions.values())s.scripts?.stop();};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.isComposing||byId('input').type==='password')return;const s=api().current;if(window.BeipMacros&&s){const result=BeipMacros.match?.(e,{serverId:s.worldId,characterId:s.characterId,inputElement:byId('input'),reservedCombos:window.BeipShortcuts?.boundCombos(api().state.preferences.shortcuts)},api().state.macros||[]);if(result){e.preventDefault();e.stopImmediatePropagation();if(result.input!==null){byId('input').setRangeText(result.input,byId('input').selectionStart,byId('input').selectionEnd,'end');byId('input').focus();}else for(const c of result.commands||[])api().command(c,false,s);return;}}
 if(window.BeipShortcutUI?.handleKey(e,s)){e.preventDefault();e.stopImmediatePropagation();}
},true);
})();
