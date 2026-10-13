/* Type0 Config schema from Root.prp; first window mirrors Assets/SampleConfig.txt. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipInputImportFixture=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const source=`Version=329
Windows.MainWindowSettings.Input
{
 Font.Size=21
 Fore=RGB(1,210,180)
 Back=RGB(10,20,30)
 Sticky=true
 LocalEcho=false
}
Connections.Shortcuts."Imported input fixture"
{
 Host="example.invalid:4201"
 Characters.Guest
 {
  MainWindowSettings.Input
  {
   Font.Size=12
   Fore=RGB(200,100,20)
   Sticky=false
  }
  Docking
  {
   DockedPanes
   {
    {
     Side=3
     Size=81
     Windows
     {
      {
       Size=300
       InputWindow
       {
        Font.Size=19
        AutoSizeVertically=false
        MinimumHeight=5
        MaximumHeight=20
        Title="Copied input"
        Prefix="pose "
        Fore=RGB(230,200,150)
        Back=RGB(0,0,0)
        LocalEchoColor=RGB(0,255,255)
       }
      }
      {
       Type=0
       Size=200
      }
     }
    }
   }
   FloatingWindows
   {
    {
     Type=0
     Rect=(10,20,410,320)
     InputWindow
     {
      Title="Former floating input"
      Prefix="say "
      Sticky=true
      Font.Size=16
      Font.Bold=true
     }
    }
   }
  }
 }
}`;
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Input import fixture requires test mode.');
 const clone=x=>JSON.parse(JSON.stringify(x)),result={error:''},dock=BeipDockPanels,saved={current:app.current?.id,preferences:clone(app.state.preferences),worlds:new Set(app.state.worlds.map(x=>x.id)),characters:new Set(app.state.characters.map(x=>x.id))},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Input import check failed: '+key);},wait=async(fn,label)=>{const until=Date.now()+10000;while(!fn()){if(Date.now()>until)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}};let session,dialog,choices,storageKey;
 try{
  const plan=BeipClassicImport.previewConfig(source,'Input-window source fixture.txt');dialog=document.getElementById('classicImportDialog');choices=[...dialog.querySelectorAll('[data-part]')].map(input=>[input,input.checked]);for(const [input] of choices)input.checked=['profiles','preferences'].includes(input.dataset.part);check('preview',plan.characters[0].dockLayout.inputPanes.panes.length===3&&plan.report.skipped['Original floating input docked at bottom']===1);
  const count=app.state.saveCount||0;dialog.querySelector('[data-action="apply"]').click();await wait(()=>!dialog.open&&(app.state.saveCount||0)>count,'import save');const character=app.state.characters.find(x=>!saved.characters.has(x.id));check('applied',!!character?.dockLayout);storageKey='beipmu:dock:'+character.id;session=app.createSession('input-import-fixture',{worldId:character.worldId,characterId:character.id,label:'Imported inputs'});app.selectSession(session.id);
  const model=dock.inputModel(session),panes=[...model.panes.values()],field=pane=>document.querySelector('[data-dock="'+pane.id+'"] .additional-input-text'),copied=panes[0],global=panes[1],floating=panes[2];check('instances',panes.length===3&&new Set(panes.map(p=>p.id)).size===3&&panes.every(p=>!!field(p)));check('geometry',dock.getLayout(session).trees.bottom.kind==='split'&&dock.getLayout(session).sizes.bottom===81&&panes.every(p=>dock.getLayout(session).edges[p.id]==='bottom')&&!Object.keys(dock.getLayout(session).floating).length);
  check('globalAppearance',global.inherit&&global.inheritSource==='global'&&getComputedStyle(field(global)).fontSize==='21px'&&getComputedStyle(field(global)).color==='rgb(1, 210, 180)'&&app.preferencesForSession(session).inputFontSize===12);check('copiedAppearance',!copied.inherit&&copied.title==='Copied input'&&copied.prefix==='pose '&&getComputedStyle(field(copied)).fontSize==='19px'&&getComputedStyle(field(floating)).fontWeight==='700');
  const retained=field(global);retained.value='/echo IMPORTED INPUT LOCAL';retained.dispatchEvent(new Event('input',{bubbles:true}));retained.form.requestSubmit();await wait(()=>session.view.textContent.includes('IMPORTED INPUT LOCAL'),'global sticky local command');check('globalSticky',retained.value==='/echo IMPORTED INPUT LOCAL'&&retained.selectionStart===0&&retained.selectionEnd===retained.value.length);
  app.state.preferences.inputFontSize=24;app.state.preferences.inputSticky=false;app.applyPreferences();check('liveGlobalUpdate',field(global)===retained&&getComputedStyle(retained).fontSize==='24px'&&getComputedStyle(field(copied)).fontSize==='19px');retained.value='/echo IMPORTED INPUT CLEAR';retained.dispatchEvent(new Event('input',{bubbles:true}));retained.form.requestSubmit();await wait(()=>session.view.textContent.includes('IMPORTED INPUT CLEAR'),'updated global clear');check('updatedGlobalClear',retained.value==='');
  const serialized=JSON.parse(JSON.stringify(dock.getLayout(session)));serialized.sizes.bottom=190;dock.applyLayout(serialized,session);check('roundtrip',dock.inputModel(session).get(global.id).inheritSource==='global'&&dock.inputModel(session).get(copied.id).prefix==='pose '&&field(global)!==retained&&getComputedStyle(field(global)).fontSize==='24px');
  window.BeipTestScreenshots?.delete('imported-inputs');window.chrome.webview.postMessage('testcapture:imported-inputs');await wait(()=>window.BeipTestScreenshots?.has('imported-inputs'),'imported input screenshot');check('screenshot',true);
 }catch(error){result.error=String(error.stack||error);}
 finally{
  if(dialog?.open)dialog.close();for(const [input,checked] of choices||[])input.checked=checked;if(session)app.closeSession(session.id);if(storageKey)localStorage.removeItem(storageKey);app.state.worlds=app.state.worlds.filter(x=>saved.worlds.has(x.id));app.state.characters=app.state.characters.filter(x=>saved.characters.has(x.id));app.state.preferences=saved.preferences;app.renderProfileChoices();app.renderProfileLists?.();if(saved.current&&app.sessions.has(saved.current))app.selectSession(saved.current);app.applyPreferences();const count=app.state.saveCount||0;app.saveSettings();try{await wait(()=>(app.state.saveCount||0)>count,'restoring imported input fixture');result.restorationSaved=true;}catch(error){result.error+=(result.error?' | ':'')+error.message;}
 }
 return result;
}
return {source,run};
});
