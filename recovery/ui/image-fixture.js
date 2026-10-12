/* Packaged image-renderer checks. Caller supplies the local fixture server GIF URL. */
(function(){
'use strict';
async function runRenderer(animatedURL){
 if(!window.BeipCoreTesting)throw Error('Image fixture is available only in test mode.');
 const result={loaded:false,zoom:false,actualSize:false,paused:false,resumed:false,clearPreservesHistory:false,historyNavigation:false,ownerAction:false,destroyed:false,error:''},dialog=document.createElement('dialog');dialog.style.cssText='width:620px;height:420px;background:#111;color:#ccc';dialog.setAttribute('aria-label','Image viewer fixture');document.body.append(dialog);dialog.showModal();
 const wait=async(fn,label)=>{const end=Date.now()+10000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Image check failed: '+key);};let viewer,lastAction;
 try{
  const items=[{url:animatedURL,alt:'Red and blue animation'},{url:animatedURL+'?second',alt:'Second image'}];
  viewer=BeipImageView.mount(dialog,items,{state:{selected:0},onAction:(action,item)=>{lastAction={action,...item};},canSave:true,canCopy:true});
  const button=text=>[...viewer.root.querySelectorAll('button')].find(value=>value.textContent===text),img=viewer.picture;
  await wait(()=>img.complete&&img.naturalWidth===32&&!img.hidden,'loaded animated test image');check('loaded',img.naturalHeight===16);
  const width=parseFloat(img.style.width),rect=viewer.viewport.getBoundingClientRect();viewer.viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:-150,clientX:rect.left+rect.width*.75,clientY:rect.top+rect.height*.75,cancelable:true}));check('zoom',parseFloat(img.style.width)>width&&viewer.getState().x!==0&&viewer.getState().y!==0);
  button('100%').click();check('actualSize',parseFloat(img.style.width)===32&&parseFloat(img.style.height)===16);
  const animate=viewer.root.querySelector('input[type="checkbox"]');animate.click();check('paused',img.hidden&&!viewer.root.querySelector('canvas').hidden&&viewer.root.querySelector('canvas').width===32&&viewer.getState().animate===false);
  animate.click();check('resumed',!img.hidden&&viewer.root.querySelector('canvas').hidden&&viewer.getState().animate===true);
  button('Clear').click();check('clearPreservesHistory',img.hidden&&viewer.getState().cleared&&viewer.root.querySelector('select').options.length===2);
  button('Next').click();await wait(()=>img.complete&&img.naturalWidth===32&&!img.hidden,'history image');check('historyNavigation',viewer.getState().selected===1&&!viewer.getState().cleared&&img.alt==='Second image');
  button('Copy image URL').click();check('ownerAction',lastAction?.action==='copy-url'&&lastAction.index===1&&lastAction.url===BeipImageView.webURL(items[1].url));
  button('Fit').click();window.BeipTestScreenshots?.delete('image-viewer');window.chrome.webview.postMessage('testcapture:image-viewer');await wait(()=>window.BeipTestScreenshots?.has('image-viewer'),'image viewer screenshot');
  viewer.destroy();check('destroyed',!dialog.querySelector('.image-view')&&!img.hasAttribute('src'));
 }catch(error){result.error=String(error.stack||error);}
 finally{viewer?.destroy();dialog.close();dialog.remove();}
 return result;
}
async function run(app=window.BeipPreview,httpBase=''){
 if(!window.BeipCoreTesting)throw Error('Image fixture is available only in test mode.');
 const url=new URL('animated-fixture.gif',httpBase).href,result=await runRenderer(url),saved={preferences:app.state.preferences,worlds:app.state.worlds,characters:app.state.characters},prior=app.current,world={id:'image-fixture-world',name:'Image fixture',host:'image.invalid',port:4201},chars=[{id:'image-fixture-a',worldId:world.id,name:'Image alpha'},{id:'image-fixture-b',worldId:world.id,name:'Image beta'}],keys=chars.map(item=>'beipmu:dock:'+item.id),storage=new Map(keys.map(key=>[key,localStorage.getItem(key)]));let alpha,beta;
 Object.assign(result,{settingsSave:false,settingsReopen:false,autoViewer:false,inlineSizeAndPause:false,avatarSizeAndPause:false,avatarLiveUpdate:false,nativeSave:false,nativeCopy:false,nativeOwner:false,nativeDecodeError:false,floatingImage:false,restorationSaved:false});
 const wait=async(fn,label)=>{const end=Date.now()+15000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Image check failed: '+key);},encode=value=>btoa(unescape(encodeURIComponent(value))),pane=()=>document.querySelector('.dock-pane[data-dock="image"]'),button=(root,text)=>[...root.querySelectorAll('button')].find(item=>item.textContent===text);
 try{
  if(result.error)return result;
  app.state.worlds=[...saved.worlds,world];app.state.characters=[...saved.characters,...chars];for(const key of keys)localStorage.removeItem(key);
  BeipClassicSettings.open('global');const settings=document.getElementById('settingsDialog');button(settings,'General').click();for(const [key,value] of Object.entries({inlineImageHeight:123,avatarWidth:77,avatarHeight:45,animatedImagesStartPaused:true,autoImageViewer:true})){const field=document.getElementById('pref_'+key);if(field.type==='checkbox')field.checked=value;else field.value=value;}
  document.getElementById('settingsForm').requestSubmit();check('settingsSave',!settings.open&&app.state.preferences.inlineImageHeight===123&&app.state.preferences.avatarWidth===77&&app.state.preferences.avatarHeight===45&&app.state.preferences.animatedImagesStartPaused&&app.state.preferences.autoImageViewer);
  BeipClassicSettings.open('global');button(settings,'General').click();check('settingsReopen',document.getElementById('pref_inlineImageHeight').value==='123'&&document.getElementById('pref_animatedImagesStartPaused').checked);settings.querySelector('[data-close="settingsDialog"]').click();
  alpha=app.createSession('image-fixture-alpha',{worldId:world.id,characterId:chars[0].id,label:'Image alpha'});beta=app.createSession('image-fixture-beta',{worldId:world.id,characterId:chars[1].id,label:'Image beta'});app.selectSession(alpha.id);app.image(alpha,{url,alt:'Animated image fixture',heightSpecified:false});check('autoViewer',!!pane()?.querySelector('.image-view'));
  const inline=alpha.view.querySelector('.inline-image img');await wait(()=>inline.complete&&inline.naturalWidth===32&&inline.hidden,'inline image initially paused');check('inlineSizeAndPause',inline.style.maxHeight==='123px'&&inline.parentNode.querySelector('canvas')?.width===32);
  const gmcp=(name,value)=>app.incoming('session:'+alpha.id+':gmcp:'+encode(name+' '+JSON.stringify(value)));app.appendText(alpha,'\n');gmcp('beip.ids',{portrait:{url:new URL('avatar-fixture.png',httpBase).href,'hover-text':'Portrait avatar'}});gmcp('beip.line.id','portrait');app.appendText(alpha,'Image avatar fixture\n');const avatar=alpha.view.querySelector('img.avatar');await wait(()=>avatar?.complete&&avatar.naturalWidth===16&&avatar.naturalHeight===32&&avatar.hidden,'portrait avatar initially paused');const avatarFrame=avatar.parentNode.querySelector('canvas.avatar');check('avatarSizeAndPause',avatar.style.width==='77px'&&avatar.style.height==='auto'&&avatar.style.minHeight==='45px'&&avatarFrame?.getBoundingClientRect().width===77&&avatarFrame?.getBoundingClientRect().height===154);
  gmcp('beip.ids',{portrait:{url,'hover-text':'Updated avatar'}});await wait(()=>avatar.complete&&avatar.naturalWidth===32&&avatar.hidden&&avatar.parentNode.querySelector('canvas.avatar')?.title==='Updated avatar','updated paused avatar');const updatedFrame=avatar.parentNode.querySelector('canvas.avatar');check('avatarLiveUpdate',alpha.view.querySelectorAll('img.avatar').length===1&&updatedFrame.getBoundingClientRect().width===77&&updatedFrame.getBoundingClientRect().height===45);
  button(pane(),'Save image…').click();app.selectSession(beta.id);await wait(()=>alpha.imageActions?.some(event=>event.action==='save'),'native image save');const savedEvent=alpha.imageActions.find(event=>event.action==='save');result.savePath=savedEvent.detail;check('nativeSave',savedEvent.status==='saved');
  app.selectSession(alpha.id);button(pane(),'Copy image').click();app.selectSession(beta.id);await wait(()=>alpha.imageActions?.some(event=>event.action==='copy'),'native image copy');const copyEvent=alpha.imageActions.find(event=>event.action==='copy');result.copyPath=copyEvent.detail;check('nativeCopy',copyEvent.status==='copied');check('nativeOwner',app.current===beta&&!beta.imageActions?.length&&savedEvent.sessionId===alpha.id&&copyEvent.sessionId===alpha.id);
  const count=alpha.imageActions.length;BeipImageRuntime.request(alpha,'copy',new URL('invalid-image',httpBase).href);await wait(()=>alpha.imageActions.length>count,'invalid native image');check('nativeDecodeError',alpha.imageActions.at(-1).status==='error'&&!!alpha.imageActions.at(-1).detail);
  app.selectSession(alpha.id);BeipDockPanels.floatPane('image',alpha);await wait(()=>BeipDockPanels.floatingStatus(alpha).some(item=>item.type==='image'&&item.ready&&item.rendered&&item.imageLoaded?.width===32&&item.imageLoaded?.height===16&&item.imageLoaded?.paused),'floating paused image load');BeipDockPanels.dockPane('image',alpha);check('floatingImage',!!pane()?.querySelector('.image-view')&&!BeipDockPanels.floatingStatus(alpha).some(item=>item.type==='image'));
 }catch(error){result.error+=(result.error?' | ':'')+String(error.stack||error);}
 finally{
  document.getElementById('settingsDialog')?.close();if(beta)app.closeSession(beta.id);if(alpha)app.closeSession(alpha.id);Object.assign(app.state,saved);for(const [key,value] of storage){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}if(prior&&app.sessions.has(prior.id))app.selectSession(prior.id);app.renderProfileChoices();app.applyPreferences();const count=app.state.saveCount||0;app.saveSettings();try{await wait(()=>(app.state.saveCount||0)>count,'image fixture restoration');result.restorationSaved=true;}catch(error){result.error+=(result.error?' | ':'')+error.message;}
 }
 return result;
}
window.BeipImageFixture={run,runRenderer};
})();
