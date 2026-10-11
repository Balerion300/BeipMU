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
async function run(){
 if(!window.BeipCoreTesting)throw new Error('Import fixture is available only in test mode.');
 const api=window.BeipPreview,state=api.state,save={worlds:state.worlds,characters:state.characters,aliases:state.aliases,triggers:state.triggers,macros:state.macros,preferences:state.preferences,maps:state.maps};
 const initialSaves=state.saveCount||0;let importSaves=0;
 state.worlds=JSON.parse(JSON.stringify(save.worlds));state.characters=JSON.parse(JSON.stringify(save.characters));state.aliases=JSON.parse(JSON.stringify(save.aliases));state.triggers=JSON.parse(JSON.stringify(save.triggers));state.macros=JSON.parse(JSON.stringify(save.macros));state.preferences={...save.preferences};state.maps=JSON.parse(JSON.stringify(save.maps));
 const result={configPreview:false,reviewBeforeApply:false,credentialsOmitted:false,scriptOmitted:false,configApplied:false,atlasPreview:false,zipDecompression:false,atlasApplied:false,restorationSaved:false,error:''};
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
