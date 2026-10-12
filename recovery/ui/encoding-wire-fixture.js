/* Isolated native encoding and reconnect acceptance. MIT. */
(function(root){root.BeipEncodingWireFixture={async run(app,config){
 if(!root.BeipCoreTesting)throw Error('Encoding wire fixture requires isolated test mode.');
 const result={},selected=app.current?.id,scriptsEnabled=app.state.scriptEnabled,owners=[],el=id=>document.getElementById(id);
 const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Encoding check failed: '+name);};
 const wait=async(fn,label)=>{const until=Date.now()+8000;while(!fn()){if(Date.now()>until)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}};
 const openWorld=id=>{app.incoming('ui:connection-connect');el('worldList').querySelector('[data-profile-id="'+id+'"]').click();};
 try{
  app.state.scriptEnabled=false;
  check('portsAvailable',config.ports.length===4);
  check('persistedChoices',config.phase!=='persist'||app.state.worlds.find(w=>w.id==='encoding1252')?.encoding==='utf-8'&&app.state.worlds.find(w=>w.id==='encoding437')?.encoding==='cp437');
  const worlds=[['encoding1252','Encoding Windows-1252','windows-1252',config.ports[2]],['encoding437','Encoding CP437','cp437',config.ports[3]]].map(([id,name,encoding,port])=>({id,name,encoding,encodingNeedsReview:false,host:'127.0.0.1',port:String(port),tls:false,autoConnect:false}));
  app.state.worlds=app.state.worlds.filter(w=>!worlds.some(other=>other.id===w.id));app.state.worlds.push(...worlds);app.renderProfileLists();app.renderProfileChoices();
  for(const world of worlds){const before=new Set(app.sessions.keys());app.connectSession(world.host,world.port,world.id);const owner=[...app.sessions.values()].find(s=>!before.has(s.id));if(!owner)throw Error('No encoding session created.');owners.push(owner);}
  const [a,b]=owners;
  await wait(()=>a.connected&&b.connected&&a.view.textContent.includes('ENCODING 1252 COMPLETE')&&b.view.textContent.includes('ENCODING 437 COMPLETE'),'legacy output');await Promise.all(owners.map(s=>s.pendingLineWork));
  check('incoming1252',a.encoding==='windows-1252'&&a.view.textContent.includes('café € ÿ'));
  check('incoming437',b.encoding==='cp437'&&b.view.textContent.includes('café ╬ \u00a0'));
  check('sessionIsolation',!a.view.textContent.includes('ENCODING 437')&&!b.view.textContent.includes('ENCODING 1252'));
  const links=[...a.view.querySelectorAll('a[data-kind="command"]')];result.linkDetails=links.map(node=>({text:node.textContent,kind:node.dataset.kind,value:node.dataset.value}));check('puebloAccentedLink',links.map(node=>node.textContent).join('')==='café €'&&links.every(node=>node.dataset.value==='encoding-link café € ÿ'));links[0].click();
  await app.command('encoding-cp1252 café € ÿ',false,a);await app.command('encoding-cp437 café ╬ \u00a0',false,b);
  openWorld(worlds[0].id);check('editorLoaded',el('profileEncoding').value==='windows-1252');el('profileEncoding').value='cp437';el('profileEditor').querySelector('[data-close="profileEditor"]').click();openWorld(worlds[0].id);check('editorCancel',el('profileEncoding').value==='windows-1252');
  const selector=el('profileEncoding'),caption=selector.closest('label').querySelector('.encoding-caption'),note=el('profileEncodingNote'),field=selector.closest('fieldset'),selectRect=selector.getBoundingClientRect(),captionRect=caption.getBoundingClientRect(),noteRect=note.getBoundingClientRect(),fieldRect=field.getBoundingClientRect();
  const measure=document.createElement('canvas').getContext('2d');measure.font=getComputedStyle(selector).font;const valueWidth=measure.measureText(selector.selectedOptions[0].textContent).width;
  result.editorRects={selectWidth:selectRect.width,captionWidth:captionRect.width,valueWidth,noteWidth:noteRect.width,fieldWidth:fieldRect.width};check('editorValueVisible',selectRect.width>=170&&selectRect.width>=valueWidth+28&&selectRect.height>=20&&selectRect.left>=fieldRect.left&&selectRect.right<=fieldRect.right);check('editorCaptionVisible',captionRect.width>=90&&captionRect.height>=12&&captionRect.right<=selectRect.left);check('editorNoteWraps',noteRect.top>=selectRect.bottom&&noteRect.left>=fieldRect.left&&noteRect.right<=fieldRect.right&&note.scrollWidth<=note.clientWidth+1);
  el('profileEncoding').value='utf-8';root.chrome.webview.postMessage('testcapture:encoding-settings');await wait(()=>root.BeipTestScreenshots?.has('encoding-settings'),'encoding screenshot');el('profileForm').requestSubmit();check('editorSave',app.state.worlds.find(w=>w.id===worlds[0].id).encoding==='utf-8'&&a.encoding==='windows-1252');el('profilesDialog').close();
  check('reconnectStarted',app.reconnectSession(a));await wait(()=>a.connected&&a.encoding==='utf-8'&&a.view.textContent.includes('ENCODING UTF8 COMPLETE'),'UTF8 reconnect');await a.pendingLineWork;
  check('incomingUtf8',a.view.textContent.includes('reconnected 🐉 café'));
  await app.command('encoding-utf8 🐉 café',false,a);await app.command('encoding-cp437-still café ╬ \u00a0',false,b);
  check('otherEncodingUnchanged',b.connected&&b.encoding==='cp437');
  app.state.scriptEnabled=scriptsEnabled;const count=app.state.saveCount||0;app.saveSettings();await wait(()=>(app.state.saveCount||0)>count,'encoding save');check('settingsSaved',true);
 }catch(error){result.error=String(error.stack||error);}
 finally{app.state.scriptEnabled=scriptsEnabled;for(const id of ['profileEditor','profilesDialog'])if(el(id).open)el(id).close();for(const owner of owners)if(app.sessions.has(owner.id))app.closeSession(owner.id);if(app.sessions.has(selected))app.selectSession(selected);}
 return result;
}};})(globalThis);
