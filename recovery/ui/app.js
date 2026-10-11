'use strict';
const $=id=>document.getElementById(id),bridge=window.chrome?.webview;
const send=text=>bridge?.postMessage(text),output=$('output'),menu=$('menu');
const defaults={fontSize:13,fontFamily:'monospace',theme:'dark',scrollback:10000,inlineImages:true,localEcho:false,defaultLogging:false,inputHeight:40};
const state={worlds:[],characters:[],preferences:{...defaults},aliases:[],triggers:[],macros:[],scriptSource:"",scriptEnabled:false,maps:{},secretStatuses:new Map(),secretErrors:new Map()};
const sessions=new Map(),spawnPanes=new Map(),closedIds=new Set();
let activeId='default',nextSession=1,test=false,testClicked=false,testReported=false,settingsLoaded=false,ruleEngine=null;
window.addEventListener('error',e=>send('error|'+e.message));

function safeId(value){return /^[A-Za-z0-9_-]{1,64}$/.test(value);}
function newId(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function encode64(value){const bytes=new TextEncoder().encode(value);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function decode64(value){return new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));}
function profileLabel(session){if(session.kind==='spawn')return session.label;const world=state.worlds.find(x=>x.id===session.worldId),character=state.characters.find(x=>x.id===session.characterId);return character?.name||world?.name||session.label;}
function createSession(id,{worldId='',characterId='',label='New session',kind='world',parentId=''}={}){
 if(!safeId(id)||sessions.has(id))return sessions.get(id);
 closedIds.delete(id);
 const view=document.createElement('div');view.className='session-view';view.dataset.session=id;view.hidden=id!==activeId;output.append(view);if(kind==='world'){const welcome=document.createElement('div');welcome.className='welcome';welcome.textContent='To connect to a world, click the globe icon in the bottom left';view.append(welcome);}
 const session={id,worldId,characterId,label,kind,parentId,view,line:null,decoder:new TextDecoder(),parser:null,history:[],historyIndex:0,images:0,loaded:0,failed:0,connected:false,connecting:false,connectedAt:0,activityAt:Date.now(),typedCount:0,tls:false,loginAttempted:false,logging:false,logWanted:!!state.preferences.defaultLogging,unread:0,status:'Ready.',protocol:'Plain text',hasOutput:false};
 if(kind==='world'){configureRules(session);session.parser=new BeipProtocol.Parser(event=>renderEvent(session,event),value=>sendRaw(session,value));}
 sessions.set(id,session);refreshTabs();return session;
}
function current(){return sessions.get(activeId);}
function refreshTabs(){
 const tabs=$('sessionTabs');tabs.replaceChildren();
 for(const session of sessions.values()){
  const item=document.createElement('div');item.className='tab-wrap';
  const tab=document.createElement('button');tab.type='button';tab.className='session-tab';tab.role='tab';tab.ariaSelected=String(session.id===activeId);tab.tabIndex=session.id===activeId?0:-1;
  const title=document.createElement('span');title.textContent=profileLabel(session);tab.append(title);
  if(session.connected){const dot=document.createElement('span');dot.className='connection-dot';dot.title='Connected';tab.append(dot);}
  if(session.unread){const count=document.createElement('span');count.className='unread';count.textContent=String(Math.min(session.unread,99));count.setAttribute('aria-label',session.unread+' unread lines');tab.append(count);}
  tab.onclick=()=>selectSession(session.id);item.append(tab);
  if(session.id!=='default'||session.hasOutput||sessions.size>1){const close=document.createElement('button');close.type='button';close.className='tab-close';close.textContent='×';close.title='Close '+profileLabel(session);close.setAttribute('aria-label',close.title);close.onclick=()=>closeSession(session.id);item.append(close);}
  tabs.append(item);
 }
}
function selectSession(id){
 const previous=current();if(previous)previous.draft=$('input').value;
 const next=sessions.get(id);if(!next)return;
 for(const session of sessions.values())session.view.hidden=session.id!==id;
 activeId=id;next.unread=0;refreshTabs();renderStatus(next.status);$('protocol').textContent=next.protocol;updateCounts();$('logging').checked=next.logWanted;$('logging').disabled=next.kind!=='world';$('disconnect').disabled=next.kind!=='world';
 if(next.kind==='world'){$('world').value=next.worldId||'';updateCharacterChoices();$('character').value=next.characterId||'';const world=state.worlds.find(x=>x.id===next.worldId);if(world){$('host').value=world.host;$('port').value=world.port;$('tls').checked=!!world.tls;}}
 $('input').value=next.draft||'';window.BeipFeatures?.selected();window.BeipDockPanels?.selected(next);window.BeipDesktopShell?.refreshPauseBadge();$('input').focus();
}
function closeSession(id){
 const session=sessions.get(id);if(!session)return;
 if(session.kind==='world'){if(session.logging)send('logstop|'+id);send('close|'+id);}
 session.ruleRuntime?.stop();window.BeipFeatures?.closed(session);window.BeipDockPanels?.closed(session);session.view.remove();sessions.delete(id);closedIds.add(id);
 if(!sessions.size)createSession('start'+nextSession++,{label:'(New Tab)'});
 if(activeId===id)selectSession(sessions.keys().next().value);else refreshTabs();
}
function sendRaw(session,value){const target=session.kind==='spawn'?sessions.get(session.parentId):session;if(!target||target.kind!=='world')return;if(/[\r\n]/.test(value)||new TextEncoder().encode(value).length>8192){showStatus(target,'Command rejected: one line at a time, up to 8192 bytes.');return;}send('send|'+(test&&target.id==='default'?'':target.id+'|')+value);}
function command(value,prompt,session=current()){
 if(prompt){$('input').value=value;$('input').focus();return;}
 if(!session)return;
 if(window.BeipFeatures?.handleCommand(value,session))return;
 const transmit=commands=>{for(const cmd of commands){if(!cmd)continue;sendRaw(session,cmd);if(state.preferences.localEcho){session.suppressAutomation=true;appendText(session,'> '+cmd+'\n',{color:'var(--echo)'},null);session.suppressAutomation=false;}}};
 const context={serverId:session.worldId,characterId:session.characterId};
 if(session.ruleRuntime){session.ruleRuntime.expandCommand(value,context).then(result=>{if(sessions.get(session.id)===session)transmit(result.commands||[]);});return;}
 let commands=[value];try{commands=(session.ruleEngine||ruleEngine)?.expandCommand(value,context).commands||commands;}catch(e){showStatus(session,'Alias error: '+e.message);return;}transmit(commands);
}
function activate(link,event,session){
 if(link.kind==='url'){send('external|'+link.value);return;}
 const commands=link.value.split('|').filter(Boolean),hints=(link.hint||'').split('|');
 if((event.type==='contextmenu'||event.shiftKey)&&commands.length>1){menu.replaceChildren();commands.forEach((c,i)=>{const button=document.createElement('button');button.textContent=hints[i+1]||c;button.onclick=()=>{menu.hidden=true;command(c,link.prompt,session);};menu.append(button);});menu.style.left=Math.max(0,Math.min(event.clientX,innerWidth-250))+'px';menu.style.top=Math.max(0,Math.min(event.clientY,innerHeight-commands.length*42))+'px';menu.hidden=false;}
 else if(commands.length)command(commands[0],link.prompt,session);
}
function anchor(link,session){const a=document.createElement('a');a.href=link.kind==='url'?link.value:'#';a.title=link.hint||link.value;a.dataset.kind=link.kind;a.dataset.value=link.value;a.dataset.prompt=link.prompt?'true':'false';a.onclick=e=>{e.preventDefault();activate(link,e,session);};a.oncontextmenu=e=>{if(link.kind==='command'){e.preventDefault();activate(link,e,session);}};return a;}
function ensureLine(session){if(!session.line){session.view.querySelector('.welcome')?.remove();session.line=document.createElement('div');session.line.className='line';session.view.append(session.line);window.BeipFeatures?.attachLine(session,session.line);session.hasOutput=true;}else if(!session.line.childNodes.length&&!session.line.gmcpAvatar){window.BeipFeatures?.attachLine(session,session.line);}return session.line;}
function applyHighlight(line,action){
 const style=action.style||{},start=Math.max(0,Number.isFinite(action.start)?action.start:0),end=Math.max(start,Number.isFinite(action.end)?action.end:line.textContent.length);
 const nodes=[],walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);let node,offset=0;
 while((node=walker.nextNode())){const next=offset+node.length;if(next>start&&offset<end)nodes.push({node,from:Math.max(0,start-offset),to:Math.min(node.length,end-offset)});offset=next;}
 for(const part of nodes){if(part.from>=part.to)continue;const range=document.createRange();range.setStart(part.node,part.from);range.setEnd(part.node,part.to);const span=document.createElement('span');span.className='trigger-highlight';if(style.color)span.style.color=style.color;if(style.background)span.style.backgroundColor=style.background;if(style.bold)span.style.fontWeight='bold';if(style.italic)span.style.fontStyle='italic';span.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ');range.surroundContents(span);}
}
function finalizeLine(session){
 const line=session.line;session.line=null;if(!line)return;
 const finish=result=>{if(sessions.get(session.id)!==session)return;
 if(result?.text!==undefined&&result.text!==plain)line.textContent=result.text;
 const highlights=[];for(const action of result?.actions||[]){
  if(action.type==='command'&&action.text)sendRaw(session,action.text);
  else if(action.type==='highlight')highlights.push(action);
  else if(action.type==='notification'){if(session.id!==activeId)session.unread++;if('Notification'in window&&Notification.permission==='granted')new Notification(profileLabel(session),{body:action.text||plain});}
  else if(action.type==='spawn')spawnText(session,action.title||'Window',action.text||plain,action.group||'');
 }
 window.BeipFeatures?.completeLine(session,line,plain);
 if(session.logWanted&&!result?.logGagged){if(session.logging)logLine(session,result?.text??plain);else if(session.logBacklog)session.logBacklog.push(result?.text??plain);}
 if(result?.gagged){line.remove();return;}
 const seen=new Set();
 for(const node of [...line.children]){if(node.tagName!=='SPAN')continue;const text=node.textContent,re=/https?:\/\/[^\s<>"']+/g,fragment=document.createDocumentFragment();let at=0,m;
  while((m=re.exec(text))){const url=m[0].replace(/[).,;!?]+$/,'');if(!BeipProtocol.webURL(url))continue;const prefix=document.createElement('span');prefix.style.cssText=node.style.cssText;prefix.textContent=text.slice(at,m.index);fragment.append(prefix);const a=anchor({kind:'url',value:url},session);a.textContent=url;fragment.append(a);at=m.index+url.length;try{if(!seen.has(url)&&/\.(png|jpe?g|gif|webp|bmp)$/i.test(new URL(url).pathname)){seen.add(url);image(session,{url,alt:'Linked image',height:220},line);}}catch{}}
  if(at){const tail=document.createElement('span');tail.style.cssText=node.style.cssText;tail.textContent=text.slice(at);fragment.append(tail);node.replaceWith(fragment);}
 }
 for(const action of highlights)applyHighlight(line,action);
 if(session.id!==activeId){session.unread++;refreshTabs();}
 window.BeipDockPanels?.recordLine(session,line);
 };
 const plain=line.textContent,context={serverId:session.worldId,characterId:session.characterId};
 if(session.kind!=='world'||test||session.suppressAutomation){finish(null);return;}
 if(session.ruleRuntime)session.ruleRuntime.processLine(plain,context).then(finish);
 else{try{finish((session.ruleEngine||ruleEngine)?.processLine(plain,context));}catch(e){showStatus(session,'Trigger error: '+e.message);finish(null);}}
}
function logLine(session,text){const bytes=new TextEncoder().encode(text);if(bytes.length<=65536)send('log|'+session.id+'|'+encode64(text));else showStatus(session,'A line was too long to log.');}
function startLogging(session,fromBeginning=false){
 if(!session||session.kind!=='world'||session.logging||session.logStarting)return;
 session.logWanted=true;session.logStarting=true;
 session.logBacklog=fromBeginning?[...session.view.querySelectorAll('.line')].filter(line=>line!==session.line).map(line=>line.textContent):[];
 send('logstart|'+session.id);
 if(session.id===activeId)$('logging').checked=true;
}
function appendText(session,text,style={},link=null){
 const parts=text.split('\n');parts.forEach((s,i)=>{if(i)finalizeLine(session);if(!s){if(i)ensureLine(session);return;}
  const parent=link?anchor(link,session):document.createElement('span');parent.textContent=s;
  if(style.bold)parent.style.fontWeight='bold';if(style.italic)parent.style.fontStyle='italic';if(style.color)parent.style.color=style.color;if(style.background)parent.style.background=style.background;parent.style.textDecoration=[style.underline?'underline':'',style.strike?'line-through':''].filter(Boolean).join(' ');
  const current=ensureLine(session),last=current.lastElementChild;if(!link&&last?.tagName==='SPAN'&&last.style.cssText===parent.style.cssText)last.append(document.createTextNode(s));else current.append(parent);
 });scroll(session);
}
function image(session,event,targetLine=null){
 session.images++;window.BeipDockPanels?.addImage(session,event);if(!state.preferences.inlineImages){const a=anchor(event.link||{kind:'url',value:event.url},session);a.textContent='[Image: '+event.alt+']';(targetLine||ensureLine(session)).append(a);updateCounts();return;}
 const figure=document.createElement('figure');figure.className='inline-image';const img=document.createElement('img');img.alt=event.alt;img.style.maxHeight=event.height+'px';const caption=document.createElement('figcaption');caption.textContent='Loading image…';const parent=event.link?anchor(event.link,session):anchor({kind:'url',value:event.url},session);parent.append(img);figure.append(parent,caption);(targetLine||ensureLine(session)).append(figure);
 img.onload=()=>{session.loaded++;caption.textContent=event.alt;updateCounts();scroll(session);window.BeipDockPanels?.refreshLine(session);};img.onerror=()=>{session.failed++;caption.classList.add('image-error');caption.replaceChildren(document.createTextNode('Image could not be loaded. '));const source=anchor({kind:'url',value:event.url},session);source.textContent='Open source';caption.append(source);updateCounts();window.BeipDockPanels?.refreshLine(session);};img.src=event.url;updateCounts();
}
function renderEvent(session,event){
 if(event.type==='text')appendText(session,event.text,event.style,event.link);
 else if(event.type==='image')image(session,event);
 else if(event.type==='protocol'){session.protocol=[event.pueblo?'Pueblo':'',event.mxp?'MXP':''].filter(Boolean).join(' + ')||'Plain text';if(session.id===activeId)$('protocol').textContent=session.protocol;}
 else if(event.type==='warning')appendText(session,'\n'+event.text+'\n',{color:'#e9ab96'},null);
 scroll(session);
}
function scroll(session){const pane=session.view;if($('autoscroll').checked&&session.id===activeId)output.scrollTop=output.scrollHeight;const limit=Number(state.preferences.scrollback)||5000;while(pane.children.length>limit)pane.firstChild.remove();}
function updateCounts(){const s=current();$('counts').textContent=s?`${s.images} image${s.images===1?'':'s'} · ${s.loaded} loaded${s.failed?' · '+s.failed+' failed':''}`:'0 images';}
function renderStatus(message){$('status').textContent=message;$('status').dataset.active=String(message!=='Ready.'&&message!=='');}
function showStatus(session,message){session.status=message;if(session.id===activeId)renderStatus(message);}
function spawnText(parent,title,text,group=''){
 if(window.BeipDockPanels?.routeSpawn(parent,title,text,{group}))return;
 const key=parent.id+'|'+title;let target=sessions.get(spawnPanes.get(key));
 if(!target){const id='spawn'+nextSession++;target=createSession(id,{label:title,kind:'spawn',parentId:parent.id,worldId:parent.worldId,characterId:parent.characterId});spawnPanes.set(key,id);}
 appendText(target,text+'\n');
}
function showSecretStatus(characterId){
 if($('profileKind').value!=='character'||$('profileId').value!==characterId)return;
 const status=state.secretStatuses.get(characterId),error=state.secretErrors.get(characterId);
 $('profileSecretStatus').textContent=status==='on'?'Saved password available on this computer.':status==='off'?'No saved password.':status==='error'?'Credential error: '+(error||'Unknown error.'):'Checking saved password…';
 $('profileForgetSecret').disabled=status!=='on';
}
function secretStatusMessage(message){
 const match=/^secretstatus:([A-Za-z0-9_-]{1,64}):(on|off|error(?::.*)?)$/.exec(message);if(!match)return;
 const id=match[1],value=match[2],status=value.startsWith('error')?'error':value;
 state.secretStatuses.set(id,status);
 if(status==='error'){let detail='Credential operation failed.';try{if(value.startsWith('error:'))detail=decode64(value.slice(6));}catch{}state.secretErrors.set(id,detail);renderStatus(detail);}
 else state.secretErrors.delete(id);
 showSecretStatus(id);
}
function autoLogin(session){
 if(session.loginAttempted||!session.characterId||session.kind!=='world')return;
 const character=state.characters.find(x=>x.id===session.characterId&&x.worldId===session.worldId);
 if(!character?.autoLogin||!character.loginName)return;
 session.loginAttempted=true;
 if(!session.tls&&!character.allowPlainLogin){showStatus(session,'Automatic login needs TLS or your explicit permission for a plain connection.');return;}
 send('login|'+session.id+'|'+character.id+'|'+encode64(character.loginName)+(session.tls?'':'|allow-plain'));
}
function incoming(message){
 if(typeof message!=='string')return;
 if(message.startsWith('ui:')){window.BeipDesktopShell?.handle(message);return;}
 if(message.startsWith('testcore:')){window.BeipCoreTesting=true;window.BeipCoreTest?.(JSON.parse(decode64(message.slice(9))));return;}
 if(message.startsWith('secretstatus:')){secretStatusMessage(message);return;}
 if(message.startsWith('settings:')){settingsMessage(message);return;}
 let id='default',payload=message;
 if(message.startsWith('session:')){const end=message.indexOf(':',8);if(end<0)return;id=message.slice(8,end);payload=message.slice(end+1);if(!safeId(id))return;}
 let session=sessions.get(id);
 if(!session&&id!=='default'&&!closedIds.has(id))session=createSession(id,{label:id});
 if(!session)return;
 if(window.BeipFeatures?.incoming(session,payload))return;
 if(payload.startsWith('data:')){if(session.paused){(session.pausedData??=[]).push(payload);session.pausedDataSize=(session.pausedDataSize||0)+payload.length;if(session.pausedDataSize>8*1024*1024){window.BeipDesktopShell?.resume(session);showStatus(session,'Output resumed after reaching the pause buffer limit.');}return;}try{const bytes=Uint8Array.from(atob(payload.slice(5)),c=>c.charCodeAt(0));session.activityAt=Date.now();session.parser?.feed(session.decoder.decode(bytes,{stream:true}));}catch(e){showStatus(session,'Could not decode server data.');}}
 else if(payload.startsWith('status:'))showStatus(session,payload.slice(7));
 else if(payload==='reset:'){session.parser?.reset();session.decoder=new TextDecoder();session.protocol='Plain text';session.loginAttempted=false;if(id===activeId)$('protocol').textContent=session.protocol;}
 else if(payload==='mxp:on')session.parser?.setMXP(true);else if(payload==='mxp:off')session.parser?.setMXP(false);
 else if(payload==='ended:'){window.BeipDesktopShell?.resume(session);session.parser?.feed(session.decoder.decode());session.parser?.finish();finalizeLine(session);session.connected=false;session.connecting=false;session.connectedAt=0;refreshTabs();}
 else if(payload==='connected:on'){session.connected=true;session.connecting=false;session.connectedAt=Date.now();session.activityAt=Date.now();if(session.logWanted&&!session.logging)startLogging(session);autoLogin(session);refreshTabs();}
 else if(payload==='connected:off'){session.connected=false;session.connecting=false;session.connectedAt=0;refreshTabs();}
 else if(payload.startsWith('logstatus:on:')){session.logging=true;session.logStarting=false;const backlog=session.logBacklog||[];session.logBacklog=null;if(session.logWanted){for(const line of backlog)logLine(session,line);}else send('logstop|'+session.id);refreshLogging(session);try{session.logPath=decode64(payload.slice(13));showStatus(session,'Logging to '+session.logPath);}catch{}}
 else if(payload==='logstatus:off'){session.logging=false;session.logWanted=false;session.logStarting=false;session.logBacklog=null;refreshLogging(session);}
 else if(payload.startsWith('logstatus:error:')){session.logging=false;session.logWanted=false;session.logStarting=false;session.logBacklog=null;refreshLogging(session);try{showStatus(session,decode64(payload.slice(16)));}catch{showStatus(session,'Logging failed.');}}
 else if(payload.startsWith('exportstatus:saved:'))showStatus(session,'Exported to '+decode64(payload.slice(19)));
 else if(payload.startsWith('exportstatus:error:'))showStatus(session,decode64(payload.slice(19)));
 else if(payload==='exportstatus:cancelled')showStatus(session,'Export cancelled.');
 else if(payload==='test:'){test=true;session.view.replaceChildren();session.line=null;session.hasOutput=false;session.images=session.loaded=session.failed=0;selectSession(id);}
 if(test&&!testClicked){const a=output.querySelector('a[data-kind="command"]');if(a){testClicked=true;a.click();}}
 if(test&&!testReported&&output.textContent.includes('FIXTURE COMPLETE')){testReported=true;setTimeout(()=>send('testresult:'+JSON.stringify({images:session.images,loaded:session.loaded,failed:session.failed,commandClicked:testClicked,protocol:$('protocol').textContent,lines:[...output.querySelectorAll('.line')].map(e=>e.textContent),text:output.textContent})),1500);}
}
function refreshLogging(session){if(session.id===activeId)$('logging').checked=session.logWanted;}

function normalizeSettings(data){
 if(!data||typeof data!=='object')return;
 if(window.BeipProfiles)data=BeipProfiles.normalizeSettings(data);
 state.worlds=Array.isArray(data.worlds)?data.worlds.filter(x=>x&&safeId(x.id)&&typeof x.name==='string'&&typeof x.host==='string'&&/^\d{1,5}$/.test(String(x.port))):[];
 state.characters=Array.isArray(data.characters)?data.characters.filter(x=>x&&safeId(x.id)&&typeof x.name==='string'&&state.worlds.some(w=>w.id===x.worldId)):[];
 const characterIds=new Set(state.characters.map(x=>x.id));for(const id of state.secretStatuses.keys())if(!characterIds.has(id)){state.secretStatuses.delete(id);state.secretErrors.delete(id);}
 for(const id of characterIds)send('secret:status|'+id);
 state.preferences={...defaults,...(data.preferences&&typeof data.preferences==='object'?data.preferences:{})};
 state.aliases=Array.isArray(data.aliases)?data.aliases:[];state.triggers=Array.isArray(data.triggers)?data.triggers:[];state.maps=data.maps||{};state.macros=data.macros||[];state.scriptSource=data.scriptSource||'';state.scriptEnabled=!!data.scriptEnabled;
 rebuildRules();applyPreferences();renderProfileChoices();renderProfileLists();renderRuleLists();
}
function settingsMessage(message){
 if(message.startsWith('settings:error:')){renderStatus('Could not save preferences: '+message.slice(15));return;}
 if(message==='settings:saved'){state.saveCount=(state.saveCount||0)+1;return;}
 if(!message.startsWith('settings:')||message==='settings:')return;
 try{normalizeSettings(JSON.parse(decode64(message.slice(9))));settingsLoaded=true;if(!test&&!window.BeipCoreTesting)setTimeout(()=>{if(test||window.BeipCoreTesting)return;for(const plan of BeipProfiles.startupPlan(state)){const w=state.worlds.find(x=>x.id===plan.worldId),c=state.characters.find(x=>x.id===plan.characterId);if(!w)continue;if(plan.connect)connectTo(w.host,w.port,w.id,c?.id||'',w.tls);else{const session=createSession('s'+nextSession++,{worldId:w.id,characterId:c?.id||'',label:c?.name||w.name});selectSession(session.id);}}},400);}catch(e){renderStatus('Could not read saved settings.');}
}
function saveSettings(){if(test)return;send('settings:save|'+JSON.stringify(BeipProfiles.serializeSettings(state)));}
function configureRules(session){session.ruleRuntime?.stop();session.ruleRuntime=null;session.ruleEngine=BeipRules.createEngine({aliases:state.aliases,triggers:state.triggers});if(([...state.aliases,...state.triggers].some(r=>r.enabled!==false&&r.matchType==='regex')||state.triggers.some(r=>r.enabled!==false&&r.captureUntil))&&window.BeipRegexRules){session.ruleRuntime=new BeipRegexRules.Runtime(message=>showStatus(session,message));session.ruleRuntime.start({aliases:state.aliases,triggers:state.triggers});}}
function rebuildRules(){ruleEngine=BeipRules.createEngine({aliases:state.aliases,triggers:state.triggers});for(const s of sessions.values())if(s.kind==='world')configureRules(s);}
function applyPreferences(){
 const p=state.preferences;document.documentElement.dataset.theme=p.theme==='light'?'light':'dark';document.documentElement.style.setProperty('--output-size',Math.max(10,Math.min(30,Number(p.fontSize)||13))+'px');document.documentElement.style.setProperty('--output-font',p.fontFamily==='system'?'"Segoe UI",sans-serif':'"Courier New",Consolas,monospace');document.documentElement.style.setProperty('--input-height',Math.max(40,Math.min(300,Number(p.inputHeight)||40))+'px');$('inputSplitter').setAttribute('aria-valuenow',String(Math.max(40,Math.min(300,Number(p.inputHeight)||40))));
}
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
function renderProfileChoices(){
 const world=$('world'),selected=world.value;world.replaceChildren();option(world,'','Quick connect');for(const p of state.worlds)option(world,p.id,p.name);world.value=state.worlds.some(x=>x.id===selected)?selected:'';
 updateCharacterChoices();
}
function updateCharacterChoices(){
 const select=$('character'),selected=select.value;select.replaceChildren();option(select,'','No character label');for(const p of state.characters.filter(x=>x.worldId===$('world').value))option(select,p.id,p.name);select.value=state.characters.some(x=>x.id===selected&&x.worldId===$('world').value)?selected:'';
}
function renderProfileLists(){
 const wl=$('worldList'),cl=$('characterList');wl.replaceChildren();cl.replaceChildren();
 if(!state.worlds.length){const p=document.createElement('p');p.className='empty';p.textContent='No worlds saved yet.';wl.append(p);}
 for(const world of state.worlds){const row=document.createElement('div');row.className='profile-row';row.dataset.profileId=world.id;row.dataset.profileKind='world';row.tabIndex=0;row.setAttribute('role','button');row.onclick=e=>{if(!(e.target instanceof Element&&e.target.closest('button')))openEditor('world',world);};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor('world',world);}};const desc=document.createElement('div');const strong=document.createElement('strong');strong.textContent=world.name;const small=document.createElement('small');small.textContent=world.host+':'+world.port+(world.autoConnect?' · Opens on startup':'');desc.append(strong,small);const use=document.createElement('button');use.type='button';use.textContent='Connect';use.onclick=()=>{connectWorld(world);$('profilesDialog').close();};const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.onclick=()=>openEditor('world',world);const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=()=>{if(!confirm('Delete world '+world.name+' and its characters?'))return;for(const character of state.characters.filter(x=>x.worldId===world.id)){send('secret:delete|'+character.id);state.secretStatuses.delete(character.id);state.secretErrors.delete(character.id);}state.worlds=state.worlds.filter(x=>x.id!==world.id);state.characters=state.characters.filter(x=>x.worldId!==world.id);saveSettings();renderProfileChoices();renderProfileLists();};row.append(desc,use,edit,del);wl.append(row);}
 if(!state.characters.length){const p=document.createElement('p');p.className='empty';p.textContent='No character labels saved yet.';cl.append(p);}
 for(const character of state.characters){const world=state.worlds.find(x=>x.id===character.worldId);const row=document.createElement('div');row.className='profile-row';row.dataset.profileId=character.id;row.dataset.profileKind='character';row.tabIndex=0;row.setAttribute('role','button');row.onclick=e=>{if(!(e.target instanceof Element&&e.target.closest('button')))openEditor('character',character);};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor('character',character);}};const desc=document.createElement('div');const strong=document.createElement('strong');strong.textContent=character.name;const small=document.createElement('small');small.textContent=world?.name||'Unknown world';desc.append(strong,small);const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.onclick=()=>openEditor('character',character);const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=()=>{if(!confirm('Delete character '+character.name+' and its saved password?'))return;send('secret:delete|'+character.id);state.secretStatuses.delete(character.id);state.secretErrors.delete(character.id);state.characters=state.characters.filter(x=>x.id!==character.id);saveSettings();renderProfileChoices();renderProfileLists();};row.append(desc,edit,del);cl.append(row);}
}
function markProfileSelection(kind,id){for(const row of $('profilesDialog').querySelectorAll('.profile-row[data-profile-id]'))row.classList.toggle('selected',row.dataset.profileKind===kind&&row.dataset.profileId===id);}
function openEditor(kind,profile=null){
 $('profileKind').value=kind;$('profileId').value=profile?.id||'';$('profileEditorTitle').textContent=(profile?'Edit ':'New ')+(kind==='world'?'world':'character');$('profileName').value=profile?.name||'';$('profileError').textContent='';$('worldFields').hidden=kind!=='world';$('characterFields').hidden=kind!=='character';markProfileSelection(kind,profile?.id||'');
 $('profileInfo').value=kind==='world'?profile?.notes||'':'';
 $('profileHost').value=profile?.host||$('host').value;$('profilePort').value=profile?.port||$('port').value;$('profileTLS').checked=profile?.tls??$('tls').checked;$('profileAuto').checked=!!profile?.autoConnect;$('characterOpen').checked=!!profile?.openAtStartup;$('characterAuto').checked=!!profile?.autoConnect;
 $('profileLoginName').value=kind==='character'?profile?.loginName||'':'';$('profileAutoLogin').checked=kind==='character'&&!!profile?.autoLogin;$('profileAllowPlainLogin').checked=kind==='character'&&!!profile?.allowPlainLogin;$('profilePassword').value='';$('profileRememberSecret').checked=false;$('profileSecretStatus').textContent=profile?'Checking saved password…':'Save this character before checking for a password.';$('profileForgetSecret').disabled=true;
 const worlds=$('profileWorld');worlds.replaceChildren();for(const w of state.worlds)option(worlds,w.id,w.name);worlds.value=profile?.worldId||$('world').value||state.worlds[0]?.id||'';
 if(kind==='character'&&profile){showSecretStatus(profile.id);send('secret:status|'+profile.id);}
 if(!$('profileEditor').open){if($('profilesDialog').open)$('profileEditor').show();else $('profileEditor').showModal();}$('profileName').focus();
}
function saveProfile(event){
 event.preventDefault();const kind=$('profileKind').value,id=$('profileId').value||newId(kind==='world'?'w':'c'),name=$('profileName').value.trim();if(!name){$('profileError').textContent='Enter a display name.';return;}
 if(kind==='world'){const host=$('profileHost').value.trim(),port=$('profilePort').value.trim();if(!host||host.length>253||/[\s|]/.test(host)||!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535){$('profileError').textContent='Enter a valid server address and port.';return;}const p={...state.worlds.find(x=>x.id===id),id,name,notes:$('profileInfo').value,host,port,tls:$('profileTLS').checked,autoConnect:$('profileAuto').checked};const index=state.worlds.findIndex(x=>x.id===id);if(index>=0)state.worlds[index]=p;else state.worlds.push(p);}
 else{const worldId=$('profileWorld').value,loginName=$('profileLoginName').value.trim(),password=$('profilePassword').value,remember=$('profileRememberSecret').checked;
  if(!state.worlds.some(x=>x.id===worldId)){$('profileError').textContent='Choose a saved world first.';return;}
  if(/[\x00-\x1f\x7f]/.test(loginName)||new TextEncoder().encode(loginName).length>128){$('profileError').textContent='Use a single-line login name of at most 128 bytes.';return;}
  if($('profileAutoLogin').checked&&!loginName){$('profileError').textContent='Enter a login name for automatic login.';return;}
  if(password&&!remember){$('profileError').textContent='Check Remember password to save the entered password, or clear the field.';return;}
  if(remember&&(!password||/[\x00-\x1f\x7f]/.test(password)||new TextEncoder().encode(password).length>2048)){$('profileError').textContent='Enter a single-line password of at most 2048 bytes.';return;}
  const p={...state.characters.find(x=>x.id===id),id,name,worldId,loginName,autoLogin:$('profileAutoLogin').checked,allowPlainLogin:$('profileAllowPlainLogin').checked,openAtStartup:$('characterOpen').checked,autoConnect:$('characterAuto').checked};const index=state.characters.findIndex(x=>x.id===id);if(index>=0)state.characters[index]=p;else state.characters.push(p);
  if(remember)send('secret:save|'+id+'|'+encode64(password));$('profilePassword').value='';
 }
 saveSettings();renderProfileChoices();if(kind==='world'){$('world').value=id;updateCharacterChoices();}renderProfileLists();const saved=kind==='world'?state.worlds.find(x=>x.id===id):state.characters.find(x=>x.id===id);if($('profilesDialog').open)openEditor(kind,saved);else $('profileEditor').close();
}
function ruleScopeLabel(rule){if(rule.scope?.level==='server')return state.worlds.find(w=>w.id===rule.scope.serverId)?.name||'Missing world';if(rule.scope?.level==='character')return state.characters.find(c=>c.id===rule.scope.characterId)?.name||'Missing character';return 'All worlds';}
function renderRuleLists(){
 for(const [kind,listId] of [['alias','aliasList'],['trigger','triggerList']]){
  const target=$(listId),rules=kind==='alias'?state.aliases:state.triggers;target.replaceChildren();
  if(!rules.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No '+(kind==='alias'?'aliases':'triggers')+' saved.';target.append(empty);}
  for(const rule of rules){const row=document.createElement('div');row.className='profile-row';row.dataset.ruleId=rule.id;row.onclick=e=>{if(!(e.target instanceof Element&&e.target.closest('button')))openRuleEditor(kind,rule);};row.tabIndex=0;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRuleEditor(kind,rule);}};const desc=document.createElement('div');const name=document.createElement('strong');name.textContent=rule.description||rule.match||'(unnamed)';const detail=document.createElement('small');detail.textContent=ruleScopeLabel(rule)+(rule.enabled===false?' · Disabled':'');desc.append(name,detail);const toggle=document.createElement('button');toggle.type='button';toggle.textContent=rule.enabled===false?'Enable':'Disable';toggle.onclick=()=>{rule.enabled=rule.enabled===false;saveSettings();rebuildRules();renderRuleLists();};const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.onclick=()=>openRuleEditor(kind,rule);const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=()=>{if(!confirm('Delete '+kind+' '+rule.match+'?'))return;const list=kind==='alias'?state.aliases:state.triggers;list.splice(list.indexOf(rule),1);saveSettings();rebuildRules();renderRuleLists();};row.append(desc,toggle,edit,del);target.append(row);}
 }
}
function updateRuleScope(){
 const level=$('ruleScope').value;$('ruleWorldLabel').hidden=level!=='server';$('ruleCharacterLabel').hidden=level!=='character';
}
function populateRuleTargets(){
 const world=$('ruleWorld'),character=$('ruleCharacter');world.replaceChildren();character.replaceChildren();for(const w of state.worlds)option(world,w.id,w.name);for(const c of state.characters){const w=state.worlds.find(x=>x.id===c.worldId);option(character,c.id,c.name+(w?' · '+w.name:''));}
}
function openRuleEditor(kind,rule=null){
 populateRuleTargets();$('ruleKind').value=kind;$('ruleId').value=rule?.id||'';$('ruleEditorTitle').textContent=(rule?'Edit ':'New ')+kind;$('ruleDescription').value=rule?.description||'';$('ruleMatch').value=rule?.match||'';$('ruleMatchType').value=rule?.matchType||'simple';$('ruleScope').value=rule?.scope?.level||'global';$('ruleWorld').value=rule?.scope?.serverId||$('world').value||state.worlds[0]?.id||'';$('ruleCharacter').value=rule?.scope?.characterId||$('character').value||state.characters[0]?.id||'';$('ruleReplacement').value=rule?.replacement||'';$('ruleSend').value=rule?.sendText||'';$('ruleHighlight').checked=!!rule?.highlight;$('ruleColor').value=/^#[0-9a-f]{6}$/i.test(rule?.highlight?.color||'')?rule.highlight.color:'#ffff80';$('ruleGag').checked=!!rule?.gag;$('ruleLogGag').checked=!!rule?.logGag;$('ruleNotify').checked=!!rule?.notify;$('ruleSpawn').value=rule?.spawnTitle||'';$('ruleEnabled').checked=rule?.enabled!==false;$('ruleError').textContent='';$('aliasFields').hidden=kind!=='alias';$('triggerFields').hidden=kind!=='trigger';updateRuleScope();if(!$('ruleEditor').open){if($('rulesDialog').open)$('ruleEditor').show();else $('ruleEditor').showModal();}$('ruleMatch').focus();for(const row of $('triggerList').querySelectorAll('.profile-row'))row.classList.toggle('selected',row.dataset.ruleId===rule?.id);
}
function saveRule(event){
 event.preventDefault();const kind=$('ruleKind').value,level=$('ruleScope').value,match=$('ruleMatch').value.trim();if(!match){$('ruleError').textContent='Enter text to match.';return;}
 const scope={level};if(level==='server'){scope.serverId=$('ruleWorld').value;if(!scope.serverId){$('ruleError').textContent='Save a world profile first.';return;}}if(level==='character'){scope.characterId=$('ruleCharacter').value;scope.serverId=state.characters.find(c=>c.id===scope.characterId)?.worldId;if(!scope.characterId||!scope.serverId){$('ruleError').textContent='Save a character profile first.';return;}}
 const id=$('ruleId').value||newId(kind==='alias'?'a':'t'),rule={id,description:$('ruleDescription').value.trim(),enabled:$('ruleEnabled').checked,scope,match,matchType:$('ruleMatchType').value};
 if(kind==='alias')rule.replacement=$('ruleReplacement').value;else{rule.sendText=$('ruleSend').value;rule.gag=$('ruleGag').checked;rule.logGag=$('ruleLogGag').checked;rule.notify=$('ruleNotify').checked;rule.spawnTitle=$('ruleSpawn').value.trim();if($('ruleHighlight').checked)rule.highlight={color:$('ruleColor').value,wholeLine:true};}
 const list=kind==='alias'?state.aliases:state.triggers,index=list.findIndex(x=>x.id===id);if(index>=0)list[index]=rule;else list.push(rule);saveSettings();rebuildRules();renderRuleLists();if($('rulesDialog').open)openRuleEditor(kind,rule);else $('ruleEditor').close();
}
function connectWorld(world,characterId=''){
 $('world').value=world.id;updateCharacterChoices();$('character').value=characterId;$('host').value=world.host;$('port').value=world.port;$('tls').checked=!!world.tls;connectTo(world.host,world.port,world.id,characterId,!!world.tls);
}
function connectTo(host,port,worldId='',characterId='',tls=false){
 if(!host||host.length>253||/[\s|]/.test(host)||!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535){$('status').textContent='Enter a valid server address and port.';return;}
 const savedWorld=state.worlds.find(x=>x.id===worldId);
 if(!state.characters.some(x=>x.id===characterId&&x.worldId===worldId)||!savedWorld||savedWorld.host.toLowerCase()!==host.toLowerCase()||Number(savedWorld.port)!==Number(port)||!!savedWorld.tls!==!!tls)characterId='';
 let session=sessions.get('default');
 if(test||!session||session.hasOutput||session.connected||session.connecting||sessions.size>1)session=createSession('s'+nextSession++,{worldId,characterId,label:host});
 else{session.worldId=worldId;session.characterId=characterId;session.label=host;session.view.replaceChildren();}
 session.host=host;session.port=String(port);session.tls=!!tls;session.loginAttempted=false;session.logWanted=!!state.preferences.defaultLogging;session.connecting=true;selectSession(session.id);showStatus(session,'Connecting to '+host+':'+port+'…');if($('connectDialog').open)$('connectDialog').close();send('connect|'+session.id+'|'+host+'|'+port+(characterId?'|'+(tls?'tls':'plain')+'|'+characterId:tls?'|tls':''));if(session.logWanted)startLogging(session);
}
function welcome(){createSession('default',{label:'(New Tab)'});selectSession('default');}
function setupTriggerDialog(){
 const dialog=$('rulesDialog'),layout=dialog.querySelector('.profiles-layout'),triggerSection=$('triggerList').parentElement;
 const workspace=document.createElement('div');workspace.className='classic-trigger-workspace';workspace.append(triggerSection,$('ruleEditor'));layout.hidden=true;dialog.append(workspace);
 const samples=document.createElement('section');samples.className='trigger-samples';samples.innerHTML='<h3>Samples</h3><p>No sample triggers are bundled with this recovery build.</p>';triggerSection.append(samples);
 const triggerFields=$('triggerFields'),original=[...triggerFields.children],tabs=document.createElement('div');tabs.className='trigger-tabs';
 const groups=[['Appearance',['ruleColor','ruleHighlight']],['Send',['ruleSend']],['Spawn',['ruleSpawn']],['Activity',['ruleNotify']],['Misc',['ruleGag','ruleLogGag']]];
 const pages=[];for(const [name,ids] of groups){const button=document.createElement('button');button.type='button';button.textContent=name;const page=document.createElement('div');page.className='trigger-tab-panel';for(const id of ids){const field=original.find(x=>x.querySelector?.('#'+id));if(field)page.append(field);}button.onclick=()=>{for(const [index,node] of pages.entries()){const active=node===page;node.hidden=!active;tabs.children[index].classList.toggle('active',active);}};tabs.append(button);pages.push(page);}
 triggerFields.replaceChildren(tabs,...pages);tabs.firstChild.click();
 const actions=document.createElement('div');actions.className='classic-trigger-actions';
 const add=(label,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=action;actions.append(button);};
 add('New',()=>openRuleEditor('trigger'));
 add('Copy',()=>{const original=state.triggers.find(x=>x.id===$('ruleId').value);if(original)openRuleEditor('trigger',{...original,id:'',description:(original.description||original.match)+' copy'});});
 add('Delete',()=>{const id=$('ruleId').value,row=[...$('triggerList').querySelectorAll('.profile-row')].find(x=>x.dataset.ruleId===id);row?.querySelector('button:last-child')?.click();if(!state.triggers.some(x=>x.id===id))openRuleEditor('trigger',state.triggers[0]||null);});
 add('Apply',()=>$('ruleForm').requestSubmit());
 add('OK',()=>{$('ruleForm').requestSubmit();if(!$('ruleError').textContent)dialog.close();});
 add('Cancel',()=>dialog.close());
 dialog.append(actions);dialog.addEventListener('close',()=>{if($('ruleEditor').open)$('ruleEditor').close();});
}
setupTriggerDialog();

bridge?.addEventListener('message',e=>incoming(e.data));
$('connection').onsubmit=e=>{e.preventDefault();connectTo($('host').value.trim(),$('port').value.trim(),$('world').value,$('character').value,$('tls').checked);};
$('world').onchange=()=>{const w=state.worlds.find(x=>x.id===$('world').value);if(w){$('host').value=w.host;$('port').value=w.port;$('tls').checked=!!w.tls;}updateCharacterChoices();};
$('disconnect').onclick=()=>{const s=current();if(s?.kind==='world')send('disconnect|'+s.id);};
$('connectAll').onclick=()=>{for(const world of state.worlds)connectWorld(world);};
$('disconnectAll').onclick=()=>{for(const s of sessions.values())if(s.kind==='world'&&(s.connected||s.connecting))send('disconnect|'+s.id);};
$('command').onsubmit=e=>{e.preventDefault();const s=current(),value=$('input').value;if(!s||!value)return;const lines=value.replace(/\r\n?/g,'\n').split('\n');for(const line of lines){if(!line)continue;s.history.push(line);if(s.history.length>500)s.history.shift();s.historyIndex=s.history.length;s.typedCount++;s.activityAt=Date.now();window.BeipDockPanels?.addHistory(s,line);command(line,false,s);} $('input').value='';window.BeipDesktopShell?.refreshActivity();};
$('input').onkeydown=e=>{const s=current();if(!s||e.isComposing)return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('command').requestSubmit();return;}if(e.ctrlKey&&!e.shiftKey&&e.key.toLowerCase()==='h'){e.preventDefault();window.BeipDockPanels?.open('history',s);return;}const historyKey=e.ctrlKey&&(e.key==='ArrowUp'||e.key==='ArrowDown');if(historyKey&&e.key==='ArrowUp'&&s.history.length){e.preventDefault();s.historyIndex=Math.max(0,s.historyIndex-1);$('input').value=s.history[s.historyIndex];}else if(historyKey&&e.key==='ArrowDown'){e.preventDefault();const draft=$('input').value;if(s.historyIndex>=s.history.length&&draft){s.history.push(draft);if(s.history.length>500)s.history.shift();window.BeipDockPanels?.addHistory(s,draft);s.historyIndex=s.history.length;$('input').value='';return;}s.historyIndex=Math.min(s.history.length,s.historyIndex+1);$('input').value=s.history[s.historyIndex]||'';}};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.defaultPrevented)return;if(e.ctrlKey&&e.key==='Tab'){e.preventDefault();const ids=[...sessions.keys()],step=e.shiftKey?-1:1;selectSession(ids[(ids.indexOf(activeId)+step+ids.length)%ids.length]);}else if(e.altKey&&/^[1-9]$/.test(e.key)){const id=[...sessions.keys()][Number(e.key)-1];if(id){e.preventDefault();selectSession(id);}}});
$('clear').onclick=()=>{const s=current();if(!s)return;s.view.replaceChildren();s.line=null;s.images=s.loaded=s.failed=0;s.hasOutput=false;window.BeipDockPanels?.clear(s);updateCounts();};
$('logging').onchange=()=>{const s=current();if(!s||s.kind!=='world')return;s.logWanted=$('logging').checked;if(s.logWanted)startLogging(s);else {s.logStarting=false;s.logBacklog=null;if(s.logging)send('logstop|'+s.id);}};
$('profileEditorMount').append($('profileEditor'));
$('profilesDialog').addEventListener('close',()=>{if($('profileEditor').open)$('profileEditor').close();});
$('profilesButton').onclick=()=>{renderProfileLists();$('profilesDialog').showModal();openEditor('world',state.worlds[0]||null);};$('newWorld').onclick=()=>openEditor('world');$('newCharacter').onclick=()=>{if(!state.worlds.length){openEditor('world');return;}openEditor('character');};
$('profileQuickConnect').onclick=()=>{$('profilesDialog').close();$('profileEditor').close();$('connectDialog').showModal();};
$('profileConnectSelected').onclick=()=>{const kind=$('profileKind').value,id=$('profileId').value,character=kind==='character'?state.characters.find(x=>x.id===id):null,world=character?state.worlds.find(x=>x.id===character.worldId):state.worlds.find(x=>x.id===id);if(!world){$('profilesDialog').close();$('profileEditor').close();$('connectDialog').showModal();return;}connectWorld(world,character?.id||'');$('profilesDialog').close();$('profileEditor').close();};
$('profileCopySelected').onclick=()=>{const kind=$('profileKind').value,id=$('profileId').value,profile=(kind==='world'?state.worlds:state.characters).find(x=>x.id===id);if(profile)openEditor(kind,{...profile,id:'',name:profile.name+' copy'});};
$('profileDeleteSelected').onclick=()=>{const kind=$('profileKind').value,id=$('profileId').value,row=[...$('profilesDialog').querySelectorAll('.profile-row[data-profile-id]')].find(x=>x.dataset.profileId===id&&x.dataset.profileKind===kind);row?.querySelector('button:last-child')?.click();if(!(kind==='world'?state.worlds:state.characters).some(x=>x.id===id))openEditor('world',state.worlds[0]||null);};
$('profileForm').onsubmit=saveProfile;
$('profileForgetSecret').onclick=()=>{const id=$('profileId').value;if(!safeId(id)||$('profileKind').value!=='character')return;send('secret:delete|'+id);state.secretStatuses.set(id,'off');state.secretErrors.delete(id);showSecretStatus(id);};
$('profileEditor').addEventListener('close',()=>{$('profilePassword').value='';$('profileRememberSecret').checked=false;});
$('rulesButton').onclick=()=>{renderRuleLists();$('rulesDialog').showModal();openRuleEditor('trigger',state.triggers[0]||null);};$('newAlias').onclick=()=>openRuleEditor('alias');$('newTrigger').onclick=()=>openRuleEditor('trigger');$('ruleScope').onchange=updateRuleScope;$('ruleForm').onsubmit=saveRule;
$('settingsButton').onclick=()=>{const p=state.preferences;$('fontSize').value=p.fontSize;$('fontFamily').value=p.fontFamily;$('theme').value=p.theme;$('scrollback').value=p.scrollback;$('inlineImages').checked=!!p.inlineImages;$('localEcho').checked=!!p.localEcho;$('defaultLogging').checked=!!p.defaultLogging;$('mediaEnabled').checked=!!p.mediaEnabled;$('settingsDialog').showModal();};
$('settingsForm').onsubmit=e=>{e.preventDefault();state.preferences={fontSize:Math.max(10,Math.min(30,Number($('fontSize').value)||13)),fontFamily:$('fontFamily').value==='system'?'system':'monospace',theme:$('theme').value==='light'?'light':'dark',scrollback:Math.max(100,Math.min(20000,Number($('scrollback').value)||10000)),inlineImages:$('inlineImages').checked,localEcho:$('localEcho').checked,defaultLogging:$('defaultLogging').checked,mediaEnabled:$('mediaEnabled').checked,inputHeight:Math.max(40,Math.min(300,Number(state.preferences.inputHeight)||40))};applyPreferences();for(const session of sessions.values())session.media?.setEnabled(state.preferences.mediaEnabled);saveSettings();$('settingsDialog').close();};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.hidden=true;});
welcome();applyPreferences();rebuildRules();
window.BeipPreview={incoming,sessions,state,secretStatuses:state.secretStatuses,get settingsLoaded(){return settingsLoaded;},get parser(){return sessions.get('default')?.parser;},get current(){return current();},selectSession,appendText,createSession,connectSession:connectTo,closeSession,sendRaw,command,ensureLine,image,renderEvent,renderProfileChoices,saveSettings,applyPreferences,rebuildRules,startLogging};
window.addEventListener('DOMContentLoaded',()=>{send('ready');send('settings:load');});
