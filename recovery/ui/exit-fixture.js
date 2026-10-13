/* Runs only when native --test-exit supplies its isolated test directory. */
(function(){
 'use strict';
 const bridge=window.chrome?.webview;if(!bridge)return;
 let started=false;
 bridge.addEventListener('message',event=>{
  if(typeof event.data!=='string'||!event.data.startsWith('testexit:')||started)return;
  started=true;run(event.data.slice(9));
 });
 async function run(phase){
  const app=window.BeipPreview,result={phase,error:''};
  const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Exit fixture failed: '+name);};
  try{
   const deadline=Date.now()+10000;
   while(!app.settingsLoaded){if(Date.now()>deadline)throw Error('Settings did not load.');await new Promise(resolve=>setTimeout(resolve,30));}
   if(phase==='persist'){
    check('restartWorld',app.state.worlds.some(w=>w.id==='exit-world'&&w.notes==='Saved by normal /exit'));
    check('restartPreferences',app.state.preferences.fontSize===19&&app.state.preferences.theme==='light');
   }else{
    app.state.worlds=[{id:'exit-world',name:'Exit fixture',host:'127.0.0.1',port:'1',notes:'Saved by normal /exit',autoConnect:false,preferences:{}}];
    app.state.preferences.fontSize=19;app.state.preferences.theme='light';
   }
   app.state.commandSettings={active:false,echo:false,processCommands:false,sendUnknown:false,legacyVariableAliases:false};
   const owner=app.current;await app.command('/quit',false,owner);
   check('quitUnknown',owner.status==='Unknown command: /quit');
   // The native result handler writes evidence only. It must never close the app.
   bridge.postMessage('testexitresult:'+JSON.stringify(result));
   await app.command('/exit',false,owner);
  }catch(error){result.error=String(error.stack||error);bridge.postMessage('testexitresult:'+JSON.stringify(result));}
 }
})();
