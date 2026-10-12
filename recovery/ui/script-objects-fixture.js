/* Real-worker/application checks; callable only by the local packaged fixture. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Script object fixture is available only in test mode.');
 const alpha=app.sessions.get('alpha'),beta=app.sessions.get('beta');if(!alpha||!beta)throw Error('Two loopback sessions are required.');
 const selected=app.current.id,variables={...app.variablesForSession(alpha)},betaVariables=JSON.stringify(app.variablesForSession(beta)),prefix=alpha.scriptTitlePrefix||'',wasEnabled=!!alpha.scripts?.enabled;
 const result={error:''},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Script object check failed: '+key);};
 const wait=async(fn,label)=>{const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}};
 try{
  BeipFeatures.initialize(alpha);app.selectSession(beta.id);
  await alpha.scripts.start(`
   window.SetVariable('scriptObjectTarget','friend');
   window.TitlePrefix='[Script] ';
   window.SetOnCommand(function(name,args,win){if(name!=='scriptobject')return false;win.SetVariable('scriptObjectCommand',args);win.output.Write('SCRIPT OBJECT COMMAND '+args);return true;},window);
   window.connection.SetOnDisplay(function(line){
    if(line.string==='SCRIPT OBJECT HIDE')return true;
    if(line.string==='SCRIPT OBJECT RED'){line.Insert(0,window.output.Create('[checked] '));line.Bold(0,10);}
   });
   var objectLine=window.output.Create('SCRIPT OBJECT LINE');objectLine.Color(0,6,0x0000ff);objectLine.Italic(7,13);window.output.Add(objectLine);
   window.Run('/scriptobject original-command-pipeline');
   window.Run('script-objects-owner-alpha');
   app.CreateTimeout(100,function(){window.output.Write('SCRIPT OBJECT TIMER '+window.GetVariable('scriptObjectTarget'));});
  `,BeipFeatures.context(alpha));
  await wait(()=>app.variablesForSession(alpha).scriptObjectCommand==='original-command-pipeline'&&alpha.view.textContent.includes('SCRIPT OBJECT TIMER friend'),'command and timer callbacks');
  check('ownerVariables',app.variablesForSession(alpha).scriptObjectTarget==='friend'&&JSON.stringify(app.variablesForSession(beta))===betaVariables);
  check('ownerCommand',alpha.view.textContent.includes('SCRIPT OBJECT COMMAND original-command-pipeline')&&!beta.view.textContent.includes('SCRIPT OBJECT COMMAND'));
  check('titlePrefix',document.getElementById('sessionTabs').textContent.includes('[Script]'));
  const created=[...alpha.view.querySelectorAll('.line')].find(x=>x.textContent==='SCRIPT OBJECT LINE');
  check('createdLine',!!created&&[...created.querySelectorAll('span')].some(x=>x.textContent==='SCRIPT'&&x.style.color==='rgb(255, 0, 0)')&&[...created.querySelectorAll('span')].some(x=>x.style.fontStyle==='italic'));
  const untouched=document.createElement('div'),link=document.createElement('a');link.href='https://example.invalid/';link.textContent='unchanged linked text';untouched.append(link);
  check('unchangedDOM',!await BeipFeatures.beforeDisplay(alpha,untouched)&&untouched.firstChild===link);
  alpha.parser.feed('\x1b[31mSCRIPT OBJECT RED\x1b[0m\r\nSCRIPT OBJECT HIDE\r\n');await alpha.pendingLineWork;
  const changed=[...alpha.view.querySelectorAll('.line')].find(x=>x.textContent==='[checked] SCRIPT OBJECT RED');
  check('displayMutation',!!changed&&changed.firstElementChild.style.fontWeight==='bold');
  check('originalStylePreserved',!!changed&&[...changed.querySelectorAll('span')].some(x=>x.textContent.includes('SCRIPT OBJECT RED')&&x.style.color==='rgb(230, 107, 107)'));
  check('displayGag',![...alpha.view.querySelectorAll('.line')].some(x=>x.textContent==='SCRIPT OBJECT HIDE'));
  const unsupported=await alpha.scripts.evaluate('try{app.ActiveXObject("WScript.Shell");}catch(e){window.output.write("SCRIPT OBJECT NATIVE BLOCKED");}',BeipFeatures.context(alpha));
  check('nativeCapabilityBoundary',unsupported.effects.some(x=>x.value==='SCRIPT OBJECT NATIVE BLOCKED'));
  check('workerAlive',alpha.scripts.enabled&&beta.connected);
 }catch(error){result.error=String(error.stack||error);}
 finally{
  alpha.scripts?.stop();const target=app.variablesForSession(alpha);for(const key of Object.keys(target))delete target[key];Object.assign(target,variables);alpha.scriptTitlePrefix=prefix;app.refreshTabs();app.selectSession(selected);
  if(wasEnabled)await alpha.scripts.start(app.state.scriptSource||'',BeipFeatures.context(alpha));
  const saved=app.state.saveCount||0;app.saveSettings();await wait(()=>(app.state.saveCount||0)>saved,'script fixture restoration');result.restorationSaved=true;
 }
 return result;
}
window.BeipScriptObjectsFixture={run};
})();
