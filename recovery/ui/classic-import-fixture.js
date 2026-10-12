/* Packaged-only import checks; invoked by core-test in its isolated test run. */
(function(){
'use strict';
const zipped='UEsDBBQAAAAIAFi6S12QFPARegAAALcAAAAJAAAAQXRsYXMueG1sVY5BCsJADEWvErIudNp1p0vxCq4kaISBmUYyUXt8M7UKQgjk5X34E1mmCk/WmmSJOOI8FbrDQoUjHtJqD2VnKlJ2eKScEZQvFjF0oRvbYP/nnEivX2cIzRp+Gq/J4KZSPI5g4gZusfMHMlXbQXu+2E+P9V7L99Z3fgNQSwECFAAUAAAACABYuktdkBTwEXoAAAC3AAAACQAAAAAAAAAAAAAAgAEAAAAAQXRsYXMueG1sUEsFBgAAAAABAAEANwAAAKEAAAAAAA==';
const source=`Version=400
Connections
{
 Shortcuts
 {
  "Import Fixture"
  {
   Host="import.example:4444"
   Characters
   {
    Alice.Password="fixture-secret-874"
    Alice.Connect="connect Alice fixture-secret-874"
   }
   Triggers
   {
    {
     Description="Imported notice"
     FindString.MatchText="FIXTURE NOTICE"
     Toast.Active=true
    }
   }
  }
 }
 KeyboardMacros2
 {
  {
   Macro="look"
   key=Control+Alt+K
  }
  {
   Macro="/@window.connection.send('secret')"
   key=Control+Alt+J
  }
 }
}
`;
const nestedSource=String.raw`Version=400
Connections
{
 Aliases
 {
  Active=true
  AfterCount=1
  {
   Description="Import alias parent"
   FindString.MatchText="^nest (.+)$"
   FindString.RegularExpression=true
   Replace="middle \\1"
   Aliases
   {
    {
     Description="Import alias child"
     FindString.MatchText="middle"
     Replace="finish"
    }
   }
  }
  {
   Description="Import alias after"
   FindString.MatchText="finish"
   Replace="done"
  }
 }
 Triggers
 {
  AfterCount=1
  {
   Description="Import global after"
   FindString.MatchText="^NESTED .+$"
   FindString.RegularExpression=true
   OncePerLine=true
   Send.Active=true
   Send.Send="global after"
  }
 }
 Shortcuts
 {
  "Nested Import Fixture"
  {
   Host="nested-import.invalid:4444"
   Triggers
   {
    AfterCount=1
    {
     Description="Import trigger parent"
     FindString.MatchText="^NESTED (.+)$"
     FindString.RegularExpression=true
     OncePerLine=true
     Send.Active=true
     Send.Send="parent:%target%"
     Send.ExpandVariables=true
     Triggers
     {
      {
       Description="Import trigger child"
       FindString.MatchText="READY$"
       FindString.RegularExpression=true
       OncePerLine=true
       AwayPresent=true
       AwayPresentOnce=true
       Send.Active=true
       Send.Send="child:%target%"
       Send.ExpandVariables=true
       Speech.Active=true
       Speech.WholeLine=true
      }
     }
    }
    {
     Description="Import server after"
     FindString.MatchText="^NESTED .+$"
     FindString.RegularExpression=true
     OncePerLine=true
     Send.Active=true
     Send.Send="server after"
    }
   }
   Characters
   {
    Alice
    {
     Variables
     {
      {
       Name="target"
       Value="friend"
      }
     }
    }
   }
  }
 }
}`;
async function run(){
 if(!window.BeipCoreTesting)throw new Error('Import fixture is available only in test mode.');
 const api=window.BeipPreview,state=api.state,save={commandSettings:state.commandSettings,worlds:state.worlds,characters:state.characters,aliases:state.aliases,triggers:state.triggers,macros:state.macros,preferences:state.preferences,maps:state.maps};
 const initialSaves=state.saveCount||0;let importSaves=0,nestedSession=null;
 state.worlds=JSON.parse(JSON.stringify(save.worlds));state.characters=JSON.parse(JSON.stringify(save.characters));state.aliases=JSON.parse(JSON.stringify(save.aliases));state.triggers=JSON.parse(JSON.stringify(save.triggers));state.macros=JSON.parse(JSON.stringify(save.macros));state.preferences={...save.preferences};state.maps=JSON.parse(JSON.stringify(save.maps));
 const result={configPreview:false,reviewBeforeApply:false,credentialsOmitted:false,scriptOmitted:false,configApplied:false,nestedConfigApplied:false,nestedConfigWorker:false,atlasPreview:false,zipDecompression:false,atlasApplied:false,restorationSaved:false,error:''};
 try{
  const importer=window.BeipClassicImport,dialog=document.getElementById('classicImportDialog');
  const plan=importer.previewConfig(source,'fixture Config.txt');
  result.configPreview=plan.worlds.length===1&&plan.characters.length===1&&plan.triggers.length===1&&plan.macros.length===1;
  result.reviewBeforeApply=dialog.open&&dialog.textContent.includes('fixture Config.txt')&&!state.worlds.some(x=>x.name==='Import Fixture');
  result.credentialsOmitted=!JSON.stringify(plan).includes('fixture-secret-874')&&plan.characters[0].loginName===''&&plan.characters[0].autoLogin===false;
  result.scriptOmitted=plan.macros.every(x=>!x.text.includes('/@'))&&!!plan.report.skipped['Unsupported or script macros'];
  dialog.querySelector('[data-action="apply"]').click();
  if(!dialog.open)importSaves++;
  const world=state.worlds.find(x=>x.name==='Import Fixture');
  result.configApplied=!!world&&state.characters.some(x=>x.worldId===world.id&&x.name==='Alice')&&state.triggers.some(x=>x.description==='Imported notice')&&!dialog.open;
  if(!world)return result;
  // Isolate this acceptance's rule output; finally restores the original arrays.
  state.aliases=[];state.triggers=[];
  const nestedPlan=importer.previewConfig(nestedSource,'nested fixture Config.txt');
  dialog.querySelector('[data-action="apply"]').click();if(!dialog.open)importSaves++;
  const nestedWorld=state.worlds.find(x=>x.name==='Nested Import Fixture'),nestedCharacter=state.characters.find(x=>x.worldId===nestedWorld?.id&&x.name==='Alice');
  const findRule=(kind,name)=>state[kind].find(x=>x.description===name);
  const aliasParent=findRule('aliases','Import alias parent'),aliasChild=findRule('aliases','Import alias child'),aliasAfter=findRule('aliases','Import alias after');
  const triggerParent=findRule('triggers','Import trigger parent'),triggerChild=findRule('triggers','Import trigger child'),serverAfter=findRule('triggers','Import server after'),globalAfter=findRule('triggers','Import global after');
  const originalIds=new Set([...nestedPlan.aliases,...nestedPlan.triggers].map(x=>x.id)),imported=[aliasParent,aliasChild,aliasAfter,triggerParent,triggerChild,serverAfter,globalAfter];
  result.nestedConfigApplied=!dialog.open&&!!nestedCharacter&&nestedCharacter.variables?.target==='friend'&&imported.every(x=>x&&!originalIds.has(x.id))&&aliasChild.parentId===aliasParent.id&&aliasAfter.phase==='after'&&triggerChild.parentId===triggerParent.id&&triggerChild.scope.serverId===nestedWorld.id&&triggerChild.awayCondition==='away'&&triggerChild.awayOnce===true&&triggerChild.speech?.enabled===true&&triggerChild.speech.wholeLine===true&&triggerChild.sendExpandVariables===true&&serverAfter.phase==='after'&&globalAfter.phase==='after'&&state.triggers.indexOf(triggerChild)>state.triggers.indexOf(triggerParent);
  if(!result.nestedConfigApplied)throw Error('Nested import did not preserve identities, scopes, or effects.');
  nestedSession=api.createSession('nested_import_acceptance',{worldId:nestedWorld.id,characterId:nestedCharacter.id,label:'Nested import acceptance'});
  const runtime=nestedSession.ruleRuntime;if(!runtime)throw Error('Imported regex rules did not create the session worker.');
  const context=api.ruleContext(nestedSession),unmatched=await runtime.processLine('READY',context),blockedAlias=await runtime.expandCommand('middle READY',context),expanded=await runtime.expandCommand('nest READY',context),matched=await runtime.processLine('NESTED READY',context);
  const commands=matched.actions.filter(x=>x.type==='command'),speech=matched.actions.filter(x=>x.type==='speech');
  result.nestedConfigWorker=context.away===true&&context.variables.target==='friend'&&!unmatched.actions.length&&blockedAlias.commands.join('|')==='middle READY'&&expanded.commands.join('|')==='done READY'&&commands.map(x=>x.text).join('|')==='parent:friend|child:friend|server after|global after'&&commands.map(x=>x.triggerId).join('|')===[triggerParent.id,triggerChild.id,serverAfter.id,globalAfter.id].join('|')&&speech.length===1&&speech[0].triggerId===triggerChild.id&&speech[0].text==='NESTED READY'&&!matched.diagnostics.length&&!expanded.diagnostics.length;
  if(!result.nestedConfigWorker)throw Error('Nested import worker did not preserve conditional traversal and scope order.');
  api.closeSession(nestedSession.id);nestedSession=null;
  const bytes=Uint8Array.from(atob(zipped),c=>c.charCodeAt(0));
  const atlas=await importer.previewAtlas(bytes,'fixture.atlas');
  result.atlasPreview=atlas.maps.length===1&&atlas.maps[0].graph.rooms.length===2&&atlas.maps[0].graph.exits.length===2&&dialog.textContent.includes('fixture.atlas');
  result.zipDecompression=result.atlasPreview&&typeof DecompressionStream==='function';
  dialog.querySelector('[data-target="world"]').value=world.id;
  dialog.querySelector('[data-target="world"]').dispatchEvent(new Event('change'));
  dialog.querySelector('[data-action="apply"]').click();
  if(!dialog.open)importSaves++;
  const graph=state.maps[world.id];
  result.atlasApplied=!!graph&&graph.rooms.length===2&&graph.exits.some(x=>x.from==='r0'&&x.to==='r1'&&x.command==='east')&&!dialog.open;
 }catch(error){result.error=String(error?.message||error).slice(0,200);}
 finally{
  if(nestedSession)api.closeSession(nestedSession.id);
  const dialog=document.getElementById('classicImportDialog');if(dialog?.open)dialog.close();
  Object.assign(state,save);api.rebuildRules();api.applyPreferences();api.renderProfileChoices();api.renderProfileLists?.();
  window.dispatchEvent(new Event('beip-map-updated'));
  api.saveSettings();
  const expected=initialSaves+importSaves+1;
  for(let i=0;i<100&&(state.saveCount||0)<expected;i++)await new Promise(resolve=>setTimeout(resolve,50));
  result.restorationSaved=(state.saveCount||0)>=expected;
  if(!result.restorationSaved)result.error+=(result.error?' | ':'')+'Restored settings were not acknowledged.';
 }
 return result;
}
window.BeipClassicImportFixture={run};
})();
