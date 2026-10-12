/* Packaged test-mode acceptance for bounded hierarchy and scoped preferences. */
(function(){
'use strict';
const clone=value=>JSON.parse(JSON.stringify(value));
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Parity fixture is available only in test mode.');
 const state=app.state,saved={aliases:state.aliases,triggers:state.triggers,worlds:state.worlds,characters:state.characters,preferences:state.preferences};
 const result={hierarchyEngine:false,hierarchyWorker:false,hierarchyEditor:false,hierarchyTreeActions:false,hierarchyTriggerEditor:false,scopedSettings:false,scopedSettingsCancel:false,scopedRuntime:false,restorationSaved:false,error:''};
 const wait=async(fn,label)=>{const end=Date.now()+10000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,30));}};
 const requireCheck=(name,value)=>{result[name]=!!value;if(!value)throw Error('Parity check failed: '+name);};
 const change=node=>node.dispatchEvent(new Event('change',{bubbles:true}));
 const world={id:'parity-world',name:'Parity fixture',host:'parity.invalid',port:'4201',tls:false},character={id:'parity-character',worldId:world.id,name:'Parity character'},other={id:'parity-other',worldId:world.id,name:'Parity sibling'};
 const scope={serverId:world.id,characterId:character.id};
 let runtime;
 state.aliases=clone(saved.aliases);state.triggers=clone(saved.triggers);state.worlds=[...clone(saved.worlds),world];state.characters=[...clone(saved.characters),character,other];state.preferences=clone(saved.preferences);
 try{
  state.aliases=[{id:'parity-folder',description:'Parity aliases',folder:true,enabled:true,scope:{level:'server',serverId:world.id}},{id:'parity-parent',parentId:'parity-folder',description:'Parity parent',match:'^go (.*)$',matchType:'regex',replacement:'walk \\1',stopProcessing:true},{id:'parity-child',parentId:'parity-parent',description:'Parity child',match:'walk',replacement:'run'},{id:'parity-later',match:'run',replacement:'wrong',scope:{level:'server',serverId:world.id}}];
  state.triggers=[{id:'parity-trigger-folder',folder:true,description:'Parity triggers',scope:{level:'server',serverId:world.id}},{id:'parity-trigger-parent',parentId:'parity-trigger-folder',match:'Game> ',filterText:'Event> ',stopProcessing:true,sendText:'parent'},{id:'parity-trigger-child',parentId:'parity-trigger-parent',match:'Event> bounty',sendText:'child'},{id:'parity-trigger-later',match:'bounty',sendText:'wrong',scope:{level:'server',serverId:world.id}}];
  const engine=BeipRules.createEngine({aliases:state.aliases,triggers:state.triggers,workerEngine:true,allowRegex:true});
  const trigger=engine.processLine('Game> bounty',scope);
  requireCheck('hierarchyEngine',engine.expandCommand('go east',scope).commands.join('|')==='run east'&&trigger.text==='Event> bounty'&&trigger.actions.map(action=>action.text).join('|')==='parent|child'&&engine.expandCommand('go east',{serverId:'other'}).commands[0]==='go east');
  runtime=new BeipRegexRules.Runtime();runtime.start({aliases:state.aliases,triggers:state.triggers});
  const workerAlias=await runtime.expandCommand('go east',scope),workerTrigger=await runtime.processLine('Game> bounty',scope);
  requireCheck('hierarchyWorker',workerAlias.commands.join('|')==='run east'&&workerTrigger.actions.map(action=>action.text).join('|')==='parent|child');runtime.stop();runtime=null;
  BeipClassicDialogs.openAliases();const aliases=document.getElementById('classicAliasesDialog');
  const row=label=>[...aliases.querySelectorAll('.classic-tree-item')].find(item=>item.textContent===label);
  row('Parity child').click();const selected=aliases.querySelector('.classic-tree-item[aria-selected=true]');
  const hierarchyBefore=selected.getAttribute('aria-level')==='3'&&aliases.querySelector('[data-hierarchy="parent"]').value==='parity-parent'&&aliases.querySelector('.classic-scope').disabled;
  aliases.querySelector('.classic-description').value='Parity child saved';aliases.querySelector('[data-action="ok"]').click();
  if(aliases.open)throw Error(aliases.querySelector('.classic-error').textContent||'Alias editor did not save.');
  BeipClassicDialogs.openAliases();row('Parity child saved').click();
  requireCheck('hierarchyEditor',hierarchyBefore&&aliases.querySelector('[data-hierarchy="parent"]').value==='parity-parent'&&state.aliases.find(item=>item.id==='parity-child').parentId==='parity-parent');
  row('Parity parent').click();aliases.querySelector('[data-action="copy"]').click();
  const copyId=aliases.querySelector('[data-hierarchy="parent"]').value;aliases.querySelector('[data-action="apply"]').click();
  const copied=state.aliases.find(item=>item.description==='Parity parent copy');
  const copyValid=state.aliases.length===6&&copied?.id!=='parity-parent'&&state.aliases.some(item=>item.parentId===copied?.id&&item.description==='Parity child saved');
  aliases.querySelector('[data-action="delete"]').click();aliases.querySelector('[data-action="apply"]').click();
  row('Parity aliases').click();aliases.querySelector('[data-hierarchy-action="folder"]').click();aliases.querySelector('[data-action="apply"]').click();
  const created=state.aliases.find(item=>item.description==='New folder');
  const folderValid=created?.folder===true&&created.parentId==='parity-folder'&&state.aliases.length===5;
  aliases.querySelector('[data-action="delete"]').click();aliases.querySelector('[data-action="ok"]').click();
  requireCheck('hierarchyTreeActions',copyId==='parity-folder'&&copyValid&&folderValid&&state.aliases.length===4&&!aliases.open);
  BeipClassicDialogs.openTriggers();const triggers=document.getElementById('classicTriggersDialog');
  const triggerRow=label=>[...triggers.querySelectorAll('.classic-tree-item')].find(item=>item.textContent===label);
  triggerRow('Event> bounty').click();triggers.querySelector('[data-field="description"]').value='Parity trigger child saved';triggers.querySelector('[data-action="ok"]').click();
  if(triggers.open)throw Error(triggers.querySelector('.classic-error').textContent||'Trigger editor did not save.');
  BeipClassicDialogs.openTriggers();triggerRow('Parity trigger child saved').click();
  requireCheck('hierarchyTriggerEditor',triggers.querySelector('[data-hierarchy="parent"]').value==='parity-trigger-parent'&&triggers.querySelector('.classic-tree-item[aria-selected="true"]').getAttribute('aria-level')==='3'&&state.triggers.find(item=>item.id==='parity-trigger-parent').stopProcessing===true&&state.triggers.find(item=>item.id==='parity-trigger-child').sendText==='child');
  triggers.querySelector('[data-action="cancel"]').click();
  BeipClassicSettings.open('world:'+world.id);const settings=document.getElementById('settingsDialog');
  const outputParent=document.getElementById('classicoutputUseParent');outputParent.checked=false;change(outputParent);document.getElementById('fontSize').value='22';settings.querySelector('[type="submit"]').click();
  BeipClassicSettings.open('character:'+character.id);
  const inherited=document.getElementById('fontSize').value==='22'&&document.getElementById('fontSize').disabled;
  outputParent.checked=false;change(outputParent);document.getElementById('fontSize').value='24';
  const inputParent=document.getElementById('classicinputUseParent');inputParent.checked=false;change(inputParent);document.getElementById('localEcho').checked=true;document.getElementById('classicInputHeight').value='150';settings.querySelector('[type="submit"]').click();
  BeipClassicSettings.open('character:'+character.id);
  requireCheck('scopedSettings',inherited&&document.getElementById('fontSize').value==='24'&&!outputParent.checked&&document.getElementById('localEcho').checked&&document.getElementById('classicInputHeight').value==='150'&&world.preferences.output.values.fontSize===22&&character.preferences.output.values.fontSize===24);
  document.getElementById('fontSize').value='26';settings.querySelector('[data-close="settingsDialog"]').click();BeipClassicSettings.open('character:'+character.id);
  requireCheck('scopedSettingsCancel',document.getElementById('fontSize').value==='24'&&character.preferences.output.values.fontSize===24);
  settings.querySelector('[data-close="settingsDialog"]').click();
  const charP=app.preferencesForSession({worldId:world.id,characterId:character.id}),worldP=app.preferencesForSession({worldId:world.id,characterId:other.id});
  requireCheck('scopedRuntime',charP.fontSize===24&&charP.localEcho===true&&charP.inputHeight===150&&worldP.fontSize===22&&worldP.localEcho===BeipProfilePreferences.resolve(saved.preferences).localEcho&&state.preferences.fontSize===saved.preferences.fontSize);
 }catch(error){result.error=String(error?.message||error).slice(0,400);}
 finally{
  runtime?.stop();for(const id of ['classicAliasesDialog','classicTriggersDialog','settingsDialog']){const dialog=document.getElementById(id);if(dialog?.open)dialog.close();}
  Object.assign(state,saved);app.rebuildRules();app.applyPreferences();app.renderProfileChoices();app.renderProfileLists?.();
  const before=state.saveCount||0;app.saveSettings();try{await wait(()=>(state.saveCount||0)>before,'restored parity settings save');result.restorationSaved=true;}catch(error){result.error+=(result.error?' | ':'')+String(error.message);}
 }
 return result;
}
window.BeipParityFixture={run};
})();
