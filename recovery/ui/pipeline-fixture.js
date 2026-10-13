/* Test-only command ordering acceptance; only the two loopback fixture owners. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Pipeline fixture requires test mode.');
 const alpha=app.sessions.get('alpha'),beta=app.sessions.get('beta');if(!alpha?.connected||!beta?.connected)throw Error('Two connected loopback sessions required.');
 const clone=value=>JSON.parse(JSON.stringify(value)),state=app.state,saved={aliases:clone(state.aliases),triggers:clone(state.triggers),settings:state.commandSettings&&clone(state.commandSettings),source:state.scriptSource,enabled:alpha.scripts.enabled,selected:app.current.id};
 const result={error:''},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Pipeline check failed: '+key);};
 const source='window.UserData={sends:[],commands:[]};window.SetOnCommand(function(name){window.UserData.commands.push(name);return false;});window.connection.SetOnSend(function(text){window.UserData.sends.push(text);if(text==="pipeline-parent-alpha")window.Run("pipeline-child-alpha");return text==="pipeline-blocked-alpha";});';
 let originalExpand;
 try{
  state.commandSettings={active:true,echo:false,processCommands:true,sendUnknown:false,legacyVariableAliases:false};
  state.aliases=[{id:'pipelineLocal',match:'^pipeline-local$',matchType:'regex',replacement:'/echo PIPELINE LOCAL ALPHA'},
   {id:'pipelineEscaped',match:'/pipeline-escape',matchType:'exact',replacement:'pipeline-escaped-alpha'},
   {id:'pipelineLiteral',match:'pipeline-literal',matchType:'exact',replacement:'/echo pipeline-literal-alpha'},
   {id:'pipelineDrop',match:'pipeline-drop',matchType:'exact',replacement:''}];
  state.triggers=[{id:'pipelineTrigger',match:'PIPELINE TRIGGER SOURCE',matchType:'exact',sendText:'/echo PIPELINE TRIGGER LOCAL\r\npipeline-trigger-alpha'}];app.rebuildRules();
  await alpha.scripts.start(source,BeipFeatures.context(alpha),{captureEffects:true});
  app.selectSession(beta.id);await app.command('pipeline-local',false,alpha);
  check('expandedInternalCommand',alpha.view.textContent.includes('PIPELINE LOCAL ALPHA')&&!beta.view.textContent.includes('PIPELINE LOCAL ALPHA'));
  state.commandSettings.processCommands=false;await app.command('pipeline-literal',false,alpha);state.commandSettings.processCommands=true;
  await app.command('//pipeline-escape',false,alpha);await app.command('pipeline-drop',false,alpha);
  await app.command('pipeline-parent-alpha',false,alpha);await app.command('pipeline-blocked-alpha',false,alpha);
  await app.command('/@window.connection.Send("pipeline-send-alpha");window.connection.Transmit("pipeline-transmit-alpha");',false,alpha);
  const hookState=await alpha.scripts.evaluate('window.output.write(JSON.stringify(window.UserData));',BeipFeatures.context(alpha),{captureEffects:true});
  const seen=JSON.parse(hookState.effects.find(x=>x.type==='output').value);
  check('hookProvenance',seen.sends.filter(x=>x==='pipeline-send-alpha').length===1&&!seen.sends.includes('pipeline-transmit-alpha')&&seen.sends.includes('pipeline-blocked-alpha')&&seen.commands.filter(x=>x==='echo').length===1&&!seen.commands.includes('@'));
  check('nestedRunOnce',seen.sends.filter(x=>x==='pipeline-child-alpha').length===1&&seen.sends.filter(x=>x==='pipeline-parent-alpha').length===1);
  // Hold a real worker result to expose the application's async completion boundary.
  originalExpand=alpha.ruleRuntime.expandCommand;let release,entered;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
  alpha.ruleRuntime.expandCommand=async function(...args){const expanded=await originalExpand.apply(this,args);entered();await gate;return expanded;};
  let completed=false;const first=app.command('pipeline-order-one-alpha',false,alpha).then(value=>{completed=true;return value;});await ready;
  const second=app.command('pipeline-order-two-alpha',false,alpha);await app.command('/echo PIPELINE BETA INDEPENDENT',false,beta);
  check('awaitAndOwnerIsolation',!completed&&beta.view.textContent.includes('PIPELINE BETA INDEPENDENT'));release();await Promise.all([first,second]);
  alpha.ruleRuntime.expandCommand=originalExpand;originalExpand=null;
  // Model a reconnect epoch while the real worker result is pending, without opening another socket.
  const original=alpha.ruleRuntime.expandCommand;let staleRelease,staleEntered;const staleGate=new Promise(resolve=>staleRelease=resolve),staleReady=new Promise(resolve=>staleEntered=resolve);
  originalExpand=original;alpha.ruleRuntime.expandCommand=async function(...args){const expanded=await original.apply(this,args);staleEntered();await staleGate;return expanded;};
  const stale=app.command('pipeline-stale-alpha',false,alpha),queued=app.command('pipeline-stale-queued-alpha',false,alpha);await staleReady;alpha.connectionEpoch=(alpha.connectionEpoch||0)+1;staleRelease();
  const staleResults=await Promise.all([stale,queued]);check('staleEpochCancelled',staleResults.every(x=>x?.completed===false));alpha.ruleRuntime.expandCommand=original;originalExpand=null;
  alpha.parser.feed('PIPELINE TRIGGER SOURCE\r\n');await alpha.pendingLineWork;
  check('triggerUsesCommands',alpha.view.textContent.includes('PIPELINE TRIGGER LOCAL')&&!beta.view.textContent.includes('PIPELINE TRIGGER LOCAL'));
  app.incoming('ui:options-aliases');const dialog=document.getElementById('classicAliasesDialog'),editor=dialog.querySelector('.classic-editor'),footer=dialog.querySelector('.classic-footer');
  check('aliasControls',dialog.open&&dialog.querySelector('[data-command-setting="active"]').checked&&dialog.querySelector('[data-command-setting="processCommands"]').checked&&footer.getBoundingClientRect().bottom<=dialog.getBoundingClientRect().bottom+1&&editor.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top+1);dialog.querySelector('.classic-close').click();
  return result;
 }catch(error){result.error=error.message;return result;}
 finally{if(originalExpand&&alpha.ruleRuntime)alpha.ruleRuntime.expandCommand=originalExpand;state.aliases=saved.aliases;state.triggers=saved.triggers;state.commandSettings=saved.settings;app.rebuildRules();alpha.scripts.stop();if(saved.enabled){const initial=await alpha.scripts.start(saved.source,BeipFeatures.context(alpha),{captureEffects:true});if(initial.effects.length)await app.commandPipeline.effects(alpha,initial.effects,{source:'fixture-restore'});}if(app.sessions.has(saved.selected))app.selectSession(saved.selected);}
}
window.BeipPipelineFixture={run};
})();
