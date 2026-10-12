/* Packaged test-mode checks for nested pane layouts. MIT. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Layout fixture is available only in test mode.');
 const dock=window.BeipDockPanels,prior=app.current,worlds=app.state.worlds,characters=app.state.characters;
 const world={id:'layout-fixture-world',name:'Layout fixture',host:'layout.invalid',port:4201},character={id:'layout-fixture-character',worldId:world.id,name:'Layout owner',notes:'owner notes',preferences:{output:{useParent:false,values:{fontSize:17,paragraphSpacing:2}},input:{useParent:false,values:{inputSticky:true}}}};
 const key='beipmu:dock:'+character.id,otherKey='beipmu:dock:layout-fixture-other',saved=localStorage.getItem(key),otherSaved=localStorage.getItem(otherKey);
 const result={nestedVisible:false,controls:false,keyboardResize:false,persisted:false,copyPaste:false,sessionIsolation:false,notesFocus:false,allWindowPreferences:false,legacyMigration:false,restorationSaved:false,error:''};
 let session,other;
 const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Layout check failed: '+name);};
 const pane=type=>document.querySelector('.dock-host .dock-pane[data-dock="'+type+'"]');
 const stored=()=>JSON.parse(localStorage.getItem(key)||'{}');
 try{
  localStorage.removeItem(key);localStorage.removeItem(otherKey);app.state.worlds=[...worlds,world];app.state.characters=[...characters,character,{id:'layout-fixture-other',worldId:world.id,name:'Other owner',notes:'other notes'}];
  session=app.createSession('layout-fixture-session',{worldId:world.id,characterId:character.id,label:'Layout fixture'});app.selectSession(session.id);
  for(const type of ['map','notes','history','image'])dock.open(type,session);
  dock.arrangePane('notes','map','bottom',session);dock.arrangePane('history','notes','right',session);dock.arrangePane('image','map','tabs',session);
  const bounds=type=>pane(type)?.getBoundingClientRect(),image=bounds('image'),notes=bounds('notes'),history=bounds('history');
  check('nestedVisible',!!image&&!!notes&&!!history&&image.width>0&&image.height>0&&notes.top>=image.bottom&&history.left>=notes.right&&document.querySelectorAll('#dockContent .dock-tree-split').length===2);
  const notesField=pane('notes').querySelector('textarea');notesField.focus();notesField.value='unsaved owner draft';notesField.dispatchEvent(new Event('input',{bubbles:true}));notesField.setSelectionRange(4,8);dock.addHistory(session,'fixture history');
  check('notesFocus',document.activeElement===notesField&&notesField.value==='unsaved owner draft'&&notesField.selectionStart===4&&notesField.selectionEnd===8);
  const arrange=pane('history').querySelector('.dock-arrange');arrange.value='notes:top';arrange.dispatchEvent(new Event('change',{bubbles:true}));
  check('controls',stored().trees.right.second.axis==='y'&&bounds('history').bottom<=bounds('notes').top);
  const divider=document.querySelector('#dockContent [data-split-path="second"]');divider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
  check('keyboardResize',Math.abs(stored().trees.right.second.ratio-.55)<.001&&document.activeElement?.dataset.splitPath==='second');
  const before=JSON.stringify(stored());dock.closed(session);dock.selected(session);
  check('persisted',JSON.stringify(stored())===before&&!!pane('image')&&!!pane('notes')&&!!pane('history'));
  dock.copyAllWindowSettings(session);
  other=app.createSession('layout-fixture-session-other',{worldId:world.id,characterId:'layout-fixture-other',label:'Other layout'});app.selectSession(other.id);dock.pasteAllWindowSettings(other);
  check('copyPaste',JSON.stringify(JSON.parse(localStorage.getItem(otherKey)))===before);
  const otherPreferences=app.preferencesForSession(other);check('allWindowPreferences',otherPreferences.fontSize===17&&otherPreferences.paragraphSpacing===2&&otherPreferences.inputSticky===true);
  check('sessionIsolation',pane('notes').querySelector('textarea').value==='other notes'&&session.history!==other.history);
  dock.closed(other);localStorage.setItem(otherKey,JSON.stringify({order:['history','map'],active:'map'}));dock.selected(other);
  check('legacyMigration',!!pane('map')&&pane('map').closest('.dock-host').dataset.edge==='right'&&document.querySelectorAll('#dockContent .dock-tree-split').length===0);
 }catch(error){result.error=String(error.stack||error);}
 finally{
  if(other)app.closeSession(other.id);if(session)app.closeSession(session.id);app.state.worlds=worlds;app.state.characters=characters;
  for(const [name,value] of [[key,saved],[otherKey,otherSaved]]){if(value===null)localStorage.removeItem(name);else localStorage.setItem(name,value);}
  if(prior&&app.sessions.has(prior.id)){app.selectSession(prior.id);dock.copyAllWindowSettings(prior);}app.renderProfileChoices();
  const count=app.state.saveCount||0;app.saveSettings();const deadline=Date.now()+10000;while((app.state.saveCount||0)<=count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));result.restorationSaved=(app.state.saveCount||0)>count;if(!result.restorationSaved)result.error+=(result.error?' | ':'')+'Timed out restoring layout fixture profiles.';
 }
 return result;
}
window.BeipLayoutFixture={run};
})();
