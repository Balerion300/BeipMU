/* Packaged acceptance: actual parser, rules worker, commands, and trigger editor. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Temporal trigger fixture requires test mode.');
 const alpha=app.sessions.get('alpha'),beta=app.sessions.get('beta');if(!alpha||!beta)throw Error('Two loopback sessions are required.');
 const clone=x=>JSON.parse(JSON.stringify(x)),state=app.state,selected=app.current.id;
 const saved={triggers:clone(state.triggers),alpha:{...app.variablesForSession(alpha)},beta:{...app.variablesForSession(beta)}};
 const result={error:''},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Temporal trigger check failed: '+key);};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const wait=async(fn,label)=>{const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await pause(25);}};
 const feed=async(session,text)=>{session.parser.feed(text+'\r\n');await session.pendingLineWork;};
 const variable=(name)=>app.variablesForSession(alpha)[name];
 const install=triggers=>{state.triggers=triggers;app.rebuildRules();};
 try{
  app.selectSession(beta.id);
  install([
   {id:'temporal-parent',description:'Following lines',match:'^TEMP LINE START$',matchType:'regex',multiline:true,multilineLines:2},
   {id:'temporal-child',parentId:'temporal-parent',match:'^TEMP LINE (.+)$',matchType:'regex',sendText:'/set temporalLine=\\1'},
   {id:'temporal-wire',parentId:'temporal-parent',match:'^TEMP LINE (ONE|TWO)$',matchType:'regex',sendText:'temporal-next-alpha'}
  ]);
  check('realWorker',!!alpha.ruleRuntime);
  await feed(alpha,'TEMP LINE START');check('activationDefersChildren',variable('temporalLine')===undefined);
  await feed(beta,'TEMP LINE ONE');check('ownerIsolation',app.variablesForSession(beta).temporalLine===undefined);
  await feed(alpha,'TEMP LINE ONE');check('nextLine',variable('temporalLine')==='ONE');
  await feed(alpha,'TEMP LINE TWO');check('lastAllowedLine',variable('temporalLine')==='TWO');
  await feed(alpha,'TEMP LINE LATE');check('lineExpiry',variable('temporalLine')==='TWO');
  // Exercise Apply, Cancel, validation, and reopening the actual editor.
  BeipClassicDialogs.openTriggers();const dialog=document.getElementById('classicTriggersDialog');
  const field=name=>dialog.querySelector('[data-field="'+name+'"]'),action=name=>dialog.querySelector('[data-action="'+name+'"]');
  check('editorLoadsLimits',field('multiline').checked&&field('multilineLines').value==='2');
  field('multilineLines').value='3';field('multilineTime').value='0.75';action('apply').click();
  check('editorApply',state.triggers[0].multilineLines===3&&state.triggers[0].multilineMs===750);
  field('multilineLines').value='0';field('multilineTime').value='0';action('apply').click();
  check('editorRejectsUnbounded',!!dialog.querySelector('.classic-error').textContent&&state.triggers[0].multilineLines===3);
  action('cancel').click();BeipClassicDialogs.openTriggers();
  check('editorReopens',field('multilineLines').value==='3'&&field('multilineTime').value==='0.75');
  field('multilineLines').value='8';action('cancel').click();check('editorCancel',state.triggers[0].multilineLines===3);
  install([
   {id:'timed-parent',match:'^TEMP TIME START$',matchType:'regex',multiline:true,multilineLines:0,multilineMs:750},
   {id:'timed-child',parentId:'timed-parent',match:'^TEMP TIME (.+)$',matchType:'regex',sendText:'/set temporalTime=\\1'}
  ]);
  await feed(alpha,'TEMP TIME START');await feed(alpha,'TEMP TIME EARLY');check('timeWindow',variable('temporalTime')==='EARLY');
  await pause(850);await feed(alpha,'TEMP TIME LATE');check('idleExpiry',variable('temporalTime')==='EARLY');
  install([
   {id:'capture-window',match:'^TEMP ARM$',matchType:'regex',multiline:true,multilineLines:20},
   {id:'capture-window-child',parentId:'capture-window',match:'^TEMP CAP (.+)$',matchType:'regex',sendText:'/set temporalWindow=\\1'},
   {id:'capture-parent',description:'Capture children',match:'^TEMP CAPTURE START$',matchType:'regex',spawnTitle:'Temporal fixture',spawnCopy:true,captureUntil:'^TEMP END$',captureOnlyChildren:true},
   {id:'capture-marker',parentId:'capture-parent',match:'^TEMP CAP (.+)$',matchType:'regex',sendText:'/set temporalCapture=\\1'},
   {id:'capture-filter',parentId:'capture-parent',match:'^TEMP CAP DONE$',matchType:'regex',filterText:'TEMP END'},
   {id:'capture-normal',match:'^TEMP CAP (.+)$',matchType:'regex',sendText:'/set temporalOutside=\\1'}
  ]);
  await feed(alpha,'TEMP ARM');await feed(alpha,'TEMP CAPTURE START');await feed(alpha,'TEMP CAP BODY');
  check('captureChildrenOnly',variable('temporalCapture')==='BODY'&&variable('temporalWindow')===undefined&&variable('temporalOutside')===undefined);
  await feed(alpha,'TEMP CAP DONE');
  check('filteredTerminal',variable('temporalCapture')==='DONE'&&[...alpha.view.querySelectorAll('.line')].some(line=>line.textContent==='TEMP END'));
  await feed(alpha,'TEMP CAP AFTER');check('captureReleased',variable('temporalCapture')==='DONE'&&variable('temporalOutside')==='AFTER'&&variable('temporalWindow')==='AFTER');
  BeipClassicDialogs.openTriggers();[...dialog.querySelectorAll('.classic-tree-item')].find(node=>node.textContent==='Capture children').click();
  check('captureEditor',field('captureOnlyChildren').checked&&field('captureUntil').value==='^TEMP END$');action('cancel').click();
  install([
   {id:'appearance-groups',match:'^TEMP STYLE (red) and (blue)$',matchType:'regex',highlight:{captureGroups:true,styleExplicit:true,bold:true}},
   {id:'click-command',match:'^TEMP CLICK (send)$',matchType:'regex',sendText:'trigger-click-owner-alpha',sendOnClick:true,sendCaptureIndex:1},
   {id:'click-variable',match:'^TEMP CLICK (variable)$',matchType:'regex',sendText:'/set temporalClicked=alpha',sendOnClick:true,sendCaptureIndex:1}
  ]);
  await feed(alpha,'TEMP STYLE red and blue');const colored=[...alpha.view.querySelectorAll('.line')].find(line=>line.textContent==='TEMP STYLE red and blue');
  check('captureGroupStyles',!!colored&&[...colored.querySelectorAll('.trigger-highlight')].map(node=>node.textContent).join('|')==='red|blue');
  // A real existing link keeps its identity and listener across force-off styling.
  const line=document.createElement('div'),existing=document.createElement('a');existing.href='#';existing.textContent='before middle after';existing.style.textDecoration='underline line-through';existing.style.fontWeight='bold';existing.style.fontStyle='italic';let clicks=0;existing.onclick=event=>{event.preventDefault();clicks++;};line.append(existing);alpha.view.append(line);
  app.applyHighlight(line,{start:7,end:13,style:{underline:false,bold:false,italic:false}});
  const effective=text=>{const walker=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(node.textContent===text){const style=getComputedStyle(node.parentElement),decoration=new Set();for(let p=node.parentElement;p&&p!==alpha.view;p=p.parentElement)for(const value of getComputedStyle(p).textDecorationLine.split(' '))decoration.add(value);return {style,decoration};}throw Error('Missing styled substring: '+text);};
  const before=effective('before '),middle=effective('middle'),after=effective(' after');
  check('explicitStyleOff',middle.style.fontWeight==='400'&&middle.style.fontStyle==='normal'&&!middle.decoration.has('underline')&&middle.decoration.has('line-through'));
  check('outsideStylePreserved',before.decoration.has('underline')&&before.decoration.has('line-through')&&after.decoration.has('underline')&&after.decoration.has('line-through'));
  existing.click();check('originalLinkPreserved',line.querySelector('a')===existing&&clicks===1);line.remove();
  await feed(alpha,'TEMP CLICK send');await feed(alpha,'TEMP CLICK variable');
  check('clickDoesNotSendAutomatically',variable('temporalClicked')===undefined);
  const links=[...alpha.view.querySelectorAll('a[data-kind="command"]')];const wire=links.find(node=>node.dataset.value==='trigger-click-owner-alpha'),local=links.find(node=>node.dataset.value==='/set temporalClicked=alpha');
  check('clickRange',wire?.textContent==='send'&&local?.textContent==='variable');wire.click();local.click();await wait(()=>variable('temporalClicked')==='alpha','owner command click');
  check('clickOwner',app.variablesForSession(beta).temporalClicked===undefined);
  BeipClassicDialogs.openTriggers();field('appearance').checked=true;field('bold').value='off';field('underline').value='';field('colorWholeLine').checked=true;action('apply').click();action('cancel').click();BeipClassicDialogs.openTriggers();
  check('triStateEditor',field('bold').value==='off'&&field('underline').value===''&&field('colorWholeLine').checked);action('cancel').click();
  check('selectionRetained',app.current.id===beta.id);
 }catch(error){result.error=String(error.stack||error);}
 finally{
  document.getElementById('classicTriggersDialog')?.close();state.triggers=saved.triggers;
  for(const [session,values] of [[alpha,saved.alpha],[beta,saved.beta]]){const vars=app.variablesForSession(session);for(const key of Object.keys(vars))delete vars[key];Object.assign(vars,values);}
  app.rebuildRules();app.selectSession(selected);const before=state.saveCount||0;app.saveSettings();await wait(()=>(state.saveCount||0)>before,'temporal fixture restoration');result.restorationSaved=true;
 }
 return result;
}
window.BeipTemporalTriggersFixture={run};
})();
