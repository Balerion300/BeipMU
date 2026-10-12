/* Original-style rule and macro editors over the existing saved data models. */
(function(){
'use strict';
const app=()=>window.BeipPreview;
const clone=value=>JSON.parse(JSON.stringify(value));
const id=prefix=>prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=window.CSS?.escape||((value)=>String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&'));

function scopeChoices(){
 const state=app().state;
 return [{value:'global',label:'Global'},
  ...state.worlds.map(world=>({value:'w:'+world.id,label:world.name})),
  ...state.characters.map(character=>({value:'c:'+character.id,label:character.name+' · '+(state.worlds.find(world=>world.id===character.worldId)?.name||'World')}))];
}
function scopeValue(scope){
 if(scope?.level==='character')return 'c:'+scope.characterId;
 if(scope?.level==='server')return 'w:'+scope.serverId;
 return 'global';
}
function scopeFrom(value){
 if(value.startsWith('w:'))return {level:'server',serverId:value.slice(2)};
 if(value.startsWith('c:')){
  const character=app().state.characters.find(item=>item.id===value.slice(2));
  if(character)return {level:'character',serverId:character.worldId,characterId:character.id};
 }
 return {level:'global'};
}
function editor(kind){
 const alias=kind==='alias',dialog=document.createElement('dialog');
 dialog.id=alias?'classicAliasesDialog':'classicMacrosDialog';
 dialog.className='classic-dialog '+(alias?'classic-aliases':'classic-macros');
 dialog.setAttribute('aria-labelledby',dialog.id+'Title');
 dialog.innerHTML=`<div class="classic-title"><h2 id="${dialog.id}Title">${alias?'Aliases':'Keyboard Macros'}</h2><button class="classic-close" type="button" aria-label="Close">×</button></div>
  <div class="classic-workspace"><div class="classic-tree" role="tree" aria-label="Saved ${alias?'aliases':'keyboard macros'}"></div>
  <div class="classic-editor"><div class="classic-edit-head"><label><input class="classic-enabled" type="checkbox"> ${alias?'Process this alias':'Process this keyboard macro'}</label></div>
  <label class="classic-field">Description<input class="classic-description" maxlength="80" autocomplete="off"></label>
  ${alias?`<label class="classic-field">Matcharoo<input class="classic-match" maxlength="128" autocomplete="off" spellcheck="false"></label>
   <div class="classic-row"><label class="classic-field">Match type<select class="classic-match-type"><option value="simple">Text</option><option value="exact">Exact line</option><option value="wildcard">Wildcard</option><option value="regex">Regular Expression</option></select></label><label class="classic-check"><input class="classic-case" type="checkbox"> Match Case</label></div>
   <label class="classic-check"><input class="classic-stop" type="checkbox"> Stop processing further aliases</label>
   <label class="classic-check"><input class="classic-variables" type="checkbox"> Expand %variables%</label><label class="classic-field classic-stretch">Alias for<textarea class="classic-replacement" maxlength="65536" spellcheck="false"></textarea></label>`:
  `<label class="classic-field classic-stretch">Macro Text<textarea class="classic-text" maxlength="65536" spellcheck="false"></textarea></label>
   <label class="classic-check"><input class="classic-type" type="checkbox"> Type into Input Window</label>
   <fieldset class="classic-key"><legend>Key</legend><label>Press key combination here<input class="classic-combo" maxlength="80" autocomplete="off" spellcheck="false" aria-label="Macro key combination"></label></fieldset>
   <label class="classic-check"><input class="classic-override" type="checkbox"> Override a built-in shortcut</label>
   <p class="classic-note">Letters A–Z need Alt or Control to avoid ordinary typing.</p>`}
  <label class="classic-field">Scope<select class="classic-scope"></select></label><p class="classic-error" role="alert"></p></div></div>
  <div class="classic-footer"><div class="classic-list-actions"><button type="button" data-action="new">New</button><button type="button" data-action="copy">Copy</button><button type="button" data-action="delete">Delete</button></div>
  <div class="classic-save-actions"><button type="button" data-action="apply">Apply</button><button type="button" data-action="ok">OK</button><button type="button" data-action="cancel">Cancel</button></div></div>`;
 document.body.append(dialog);
 const one=selector=>dialog.querySelector(selector);
 let draft=[],selected=-1;
 const treeEditor=alias?BeipRuleTreeEditor.create({dialog,getItems:()=>draft,setItems:items=>{draft=items;},getSelected:()=>selected,setSelected:index=>{selected=index;},flush,renderEditor,choices:scopeChoices,scopeValue,scopeFrom,error:setError,prefix:'a'}):null;
 function field(name){return one('.classic-'+name);}
 function setError(message){field('error').textContent=message;}
 function fillScope(){
  const select=field('scope');select.replaceChildren();
  for(const choice of scopeChoices()){
   const option=document.createElement('option');option.value=choice.value;option.textContent=choice.label;select.append(option);
  }
 }
 function flush(){
  if(selected<0||!draft[selected])return;
  const item=draft[selected];treeEditor?.flush();item.enabled=field('enabled').checked;item.description=field('description').value.trim().slice(0,80);
  if(!item.parentId)item.scope=scopeFrom(field('scope').value);
  if(alias){item.match=field('match').value.trim();item.matchType=field('match-type').value;item.matchCase=field('case').checked;item.stopProcessing=field('stop').checked;item.replacement=field('replacement').value;item.expandVariables=field('variables').checked;}
  else{item.key=field('combo').value.trim();item.text=field('text').value;item.mode=field('type').checked?'type':'send';item.overrideBuiltins=field('override').checked;}
 }
 function renderTree(){
  if(treeEditor){treeEditor.render();return;}
  const tree=field('tree');tree.replaceChildren();
  const choices=scopeChoices(),known=new Set(choices.map(choice=>choice.value));
  for(const choice of choices){
   const members=draft.map((item,index)=>({item,index})).filter(({item})=>scopeValue(item.scope)===choice.value);
   if(!members.length&&choice.value!=='global')continue;
   const group=document.createElement('div');group.className='classic-tree-group';
   const title=document.createElement('div');title.className='classic-tree-heading';title.textContent=choice.label;group.append(title);
   for(const {item,index} of members){
    const button=document.createElement('button');button.type='button';button.className='classic-tree-item';button.setAttribute('role','treeitem');button.setAttribute('aria-selected',String(index===selected));
    button.textContent=(alias?item.description||item.match:item.description||item.key)||'(New '+(alias?'alias':'macro')+')';
    button.onclick=()=>{flush();selected=index;renderTree();renderEditor();};group.append(button);
   }
   tree.append(group);
  }
  for(const {item,index} of draft.map((item,index)=>({item,index})).filter(({item})=>!known.has(scopeValue(item.scope)))){
   const button=document.createElement('button');button.type='button';button.className='classic-tree-item';button.textContent=item.description||item.match||item.key||'(Unassigned)';button.onclick=()=>{flush();selected=index;renderTree();renderEditor();};tree.append(button);
  }
 }
 function renderEditor(){
  const item=draft[selected],disabled=!item;
  for(const control of dialog.querySelectorAll('.classic-editor input,.classic-editor select,.classic-editor textarea'))control.disabled=disabled;
  for(const action of ['copy','delete'])one('[data-action="'+action+'"]').disabled=disabled;
  if(!item)return;
  field('enabled').checked=item.enabled!==false;field('description').value=item.description||'';
  field('scope').value=scopeValue(item.scope);
  if(alias){field('match').value=item.match||'';field('match-type').value=item.matchType||'simple';field('case').checked=!!item.matchCase;field('stop').checked=!!item.stopProcessing;field('replacement').value=item.replacement||'';field('variables').checked=!!item.expandVariables;}
  else{field('combo').value=item.key||'';field('text').value=item.text||'';field('type').checked=item.mode==='type';field('override').checked=!!item.overrideBuiltins;}
  treeEditor?.fill();if(alias&&item.folder)for(const name of ['match','match-type','case','stop','replacement','variables'])field(name).disabled=true;setError('');
 }
 function makeNew(copy){
  if(treeEditor){treeEditor.makeNew(copy);return;}
  flush();
  if(draft.length>=(alias?128:BeipMacros.MAX_MACROS)){setError('Maximum number of '+(alias?'aliases':'macros')+' reached.');return;}
  const source=copy&&draft[selected]?clone(draft[selected]):null;
  const item=source||{enabled:true,scope:scopeFrom(field('scope').value||'global'),description:'',...(alias?{match:'',matchType:'simple',replacement:''}:{key:'',mode:'send',text:'',overrideBuiltins:false})};
  item.id=id(alias?'a':'macro');if(copy)item.description=(item.description||'')+' copy';
  draft.push(item);selected=draft.length-1;renderTree();renderEditor();field(alias?'match':'combo').focus();
 }
 function validate(){
  flush();if(alias){const hierarchy=BeipRules.hierarchy(draft);if(hierarchy.errors.length){setError(hierarchy.errors[0]);return false;}draft=BeipRules.normalizeHierarchy(draft).items;}
  for(const item of draft){
   if(alias){if(item.folder)continue;if(!item.match||item.match.length>128){setError('Enter a match for each alias.');return false;}}
   else{
    const key=BeipMacros.normalizeCombo(item.key);
    if(!key){setError('Enter a valid key combination for each macro.');return false;}
    item.key=key;
    if(!item.text){setError('Enter text for each macro.');return false;}
    const commands=item.text.split(/\r\n|\n|\r/);
    if(item.mode==='type'&&item.text.length>8192||item.mode!=='type'&&(commands.length>16||commands.some(command=>command.length>8192))){setError('Macro text is too long for this action.');return false;}
   }
  }
  return true;
 }
 function apply(){
  if(!validate())return false;
  if(alias){app().state.aliases=clone(draft);app().rebuildRules();}
  else app().state.macros=clone(draft);
  app().saveSettings();setError('');return true;
 }
 function open(){
  draft=clone(alias?app().state.aliases:app().state.macros);selected=draft.length?0:-1;
  fillScope();renderTree();renderEditor();if(!dialog.open)dialog.showModal();
 }
 one('.classic-close').onclick=()=>dialog.close();
 one('[data-action="cancel"]').onclick=()=>dialog.close();
 one('[data-action="new"]').onclick=()=>makeNew(false);
 one('[data-action="copy"]').onclick=()=>makeNew(true);
 one('[data-action="delete"]').onclick=()=>{if(treeEditor){treeEditor.remove();return;}if(selected<0)return;draft.splice(selected,1);selected=Math.min(selected,draft.length-1);renderTree();renderEditor();};
 one('[data-action="apply"]').onclick=()=>apply();
 one('[data-action="ok"]').onclick=()=>{if(apply())dialog.close();};
 field('description').addEventListener('input',()=>{if(selected<0)return;flush();renderTree();});
 if(alias)field('match').addEventListener('input',()=>{if(selected<0)return;flush();renderTree();});
 else field('combo').onkeydown=event=>{if(event.key==='Tab')return;event.preventDefault();event.stopPropagation();const key=BeipMacros.normalizeCombo(event);if(key)field('combo').value=key;};
 return {open,dialog};
}
const aliases=editor('alias'),macros=editor('macro');
document.getElementById('macrosButton').onclick=macros.open;
window.BeipClassicDialogs={openAliases:aliases.open,openMacros:macros.open};
})();
