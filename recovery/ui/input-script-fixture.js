/* Packaged real-worker and owner command-queue acceptance. Loopback test only. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Input script fixture requires test mode.');
 const a=app.sessions.get('alpha'),b=app.sessions.get('beta');if(!a||!b)throw Error('Two loopback owners are required.');
 const result={error:''},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Input script check failed: '+key);};
 const dock=window.BeipDockPanels,selected=app.current.id,wasEnabled=!!a.scripts?.enabled,oldPrefix=a.inputPrefix||'',oldTitle=a.inputTitle||'',oldDraft=app.current===a?document.getElementById('input').value:a.draft||'',oldSelection=a.draftSelection,created=[];
 const script=source=>app.command('/@'+source,false,a,null,{source:'input-script-fixture'});
 try{
  app.selectSession(a.id);BeipFeatures.initialize(a);await a.scripts.start('',BeipFeatures.context(a));
  const before=new Set(dock.inputModel(a).panes.keys());await app.command('/newinput "fixture-prefix "',false,a);const p=[...dock.inputModel(a).panes.values()].find(item=>!before.has(item.id));check('newInputCommand',!!p);created.push([a,p.id]);dock.inputModel(a).configure(p.id,{title:'Fixture exact'});dock.inputChanged(a,p.id,{persist:true});
  const other=dock.newInput('',b);created.push([b,other.id]);dock.inputModel(b).configure(other.id,{title:'Fixture exact'});dock.inputModel(b).set(other.id,'beta unchanged');dock.inputChanged(b,other.id);
  app.selectSession(b.id);
  await script('var fixtureInput=window.GetInput("Fixture exact");fixtureInput.Prefix="say ";fixtureInput.Title="Fixture renamed";fixtureInput.Set("say say hello");fixtureInput.SetSel(1,4);window.Input.Set("primary alpha only");window.SetVariable("inputLookup",String(window.GetInput("fixture renamed"))+":"+String(window.GetInput("Fixture exact")));');
  check('ownerIsolation',p.text==='say hello'&&p.start===1&&p.end===4&&a.draft==='primary alpha only'&&other.text==='beta unchanged');
  check('exactLookup',app.variablesForSession(a).inputLookup==='null:null');
  check('mutableProperties',p.title==='Fixture renamed'&&p.prefix==='say ');
  app.selectSession(a.id);const textarea=document.querySelector('[data-dock="'+p.id+'"] textarea');check('visibleDraft',textarea?.value==='say hello'&&textarea.selectionStart===1&&textarea.selectionEnd===4);
  dock.inputModel(a).set(p.id,'host revised');dock.inputChanged(a,p.id);await script('window.SetVariable("inputFresh",fixtureInput.Get());window.Input.Prefix="primary-prefix ";window.Input.Title="Primary fixture";window.Input.Set("primary-prefix primary-prefix retained");');
  check('retainedHandleFresh',app.variablesForSession(a).inputFresh==='host revised');
  check('primaryPrefix',document.getElementById('input').value==='primary-prefix retained'&&a.inputPrefix==='primary-prefix '&&a.inputTitle==='Primary fixture');
  dock.closePane(p.id,a);const replacement=dock.newInput('',a);created.push([a,replacement.id]);dock.inputModel(a).configure(replacement.id,{title:'Fixture renamed'});
  const stale=await a.scripts.evaluate('fixtureInput.Set("must not reach replacement");',BeipFeatures.context(a),{captureEffects:true});check('closedHandleRejected',stale.failed===true&&stale.effects.length===0&&replacement.text==='');
 }catch(error){result.error=String(error.stack||error);}finally{
  a.scripts?.stop();for(const [owner,id]of created)if(dock.inputModel(owner).panes.has(id))dock.closePane(id,owner);delete app.variablesForSession(a).inputLookup;delete app.variablesForSession(a).inputFresh;a.inputPrefix=oldPrefix;a.inputTitle=oldTitle;a.draft=oldDraft;a.draftSelection=oldSelection;if(app.current===a){document.getElementById('input').value=oldDraft;app.resizeInput?.();}if(app.sessions.has(selected))app.selectSession(selected);app.saveSettings();if(wasEnabled){const restored=await a.scripts.start(app.state.scriptSource||'',BeipFeatures.context(a),{captureEffects:true});if(restored.effects.length)await app.commandPipeline.effects(a,restored.effects,{source:'input-script-fixture-restore'});}
 }
 return result;
}
window.BeipInputScriptFixture={run};
})();
