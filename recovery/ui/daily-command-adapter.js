/* Owner-bound browser adapter. No active global listener or native bridge. MIT. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./daily-commands.js'):root.BeipDailyCommands);if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipDailyCommandAdapter=api;})(typeof globalThis==='object'?globalThis:this,function(core){
'use strict';
function parseColor(value,document,CSS){if(!/^(#[0-9a-f]{6}|[a-z]{1,20})$/i.test(value)||/^(inherit|initial|unset|revert|revertlayer|currentcolor|transparent)$/i.test(value)||!CSS.supports('color',value))return null;const context=document.createElement('canvas').getContext('2d');context.fillStyle=value;return /^#[0-9a-f]{6}$/i.test(context.fillStyle)?context.fillStyle.toLowerCase():null;}
function createAdapter(api,environment){
 const {document,crypto,CSS}=environment;
 const commands=core.createCommands({
  epoch:owner=>owner.connectionEpoch,valid:(owner,epoch)=>api.sessions.get(owner.id)===owner&&owner.connectionEpoch===epoch,connected:owner=>!!owner.connected,
  display:(owner,text)=>{const previous=owner.suppressAutomation;owner.suppressAutomation=true;try{api.appendText(owner,text+'\n',{color:'#a6c9d5'});}finally{owner.suppressAutomation=previous;}},
  triggers:()=>api.state.triggers,saveRules:()=>{api.saveSettings();api.rebuildRules();api.renderRuleLists?.();},saveSettings:()=>api.saveSettings(),refreshTabs:()=>api.refreshTabs(),
  character:owner=>api.state.characters.find(character=>character.id===owner.characterId&&character.worldId===owner.worldId),parseColor:value=>parseColor(value,document,CSS),
  grabPrefix:()=>crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8,'0')+' ',
  send:(owner,text,execution)=>execution.run(owner,text,{mode:'send',source:'grab'}),
  setInput:(owner,text)=>{owner.draft=text;owner.draftSelection={start:text.length,end:text.length};if(api.current===owner){const input=document.getElementById('input');input.value=text;input.setSelectionRange(text.length,text.length);api.resizeInput();}},
  scripts:owner=>owner.scripts
 });
 return commands;
}
return {createAdapter,parseColor};
});
