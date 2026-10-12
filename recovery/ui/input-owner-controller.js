/* Per-session additional input ownership and retained DOM mounts. MIT. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./input-panes.js'):root.BeipInputPanes,common?require('./dock-layout.js'):root.BeipDockLayout,root);if(common)module.exports=api;else root.BeipInputOwners=api;})(typeof globalThis==='object'?globalThis:this,function(inputs,layout,root){
'use strict';
function createController(ports){
 const owners=new WeakMap();
 function valid(owner){return !!owner&&ports.valid(owner);}
 function ensure(owner,saved){if(!valid(owner))throw Error('Input owner is closed.');let entry=owners.get(owner);if(!entry){entry={model:inputs.createModel({saved,history:ports.history?.(owner)||[],defaults:ports.defaults?.(owner)||{}}),mounts:new Map()};owners.set(owner,entry);}return entry;}
 function model(owner,saved){return ensure(owner,saved).model;}
 function serialized(owner){return ensure(owner).model.serialize();}
 function layoutFor(owner,value){return layout.normalize({...value,inputPanes:serialized(owner)},{includeSpawn:true});}
 function open(owner,parameters,value){const entry=ensure(owner,value?.inputPanes),result=entry.model.add({...ports.defaults?.(owner),...inputs.parseNewInput(parameters)});const next=layoutFor(owner,{...value,order:[...new Set([...(value?.order||[]),result.pane.id])],edges:{...value?.edges,[result.pane.id]:value?.edges?.[result.pane.id]||'bottom'}});return {...result,layout:next};}
 function close(owner,key,value){const entry=ensure(owner);entry.model.get(key);entry.mounts.get(key)?.destroy();entry.mounts.delete(key);entry.model.close(key);return layoutFor(owner,{...value,order:(value?.order||[]).filter(item=>item!==key)});}
 function mount(container,owner,key){const entry=ensure(owner);entry.model.get(key);let view=entry.mounts.get(key);if(view){container.append(view.form);return view;}
  view=root.BeipInputPaneView.mount(container,owner,entry.model,key,{valid:item=>valid(item)&&owners.get(item)===entry,activated:(item,id)=>ports.activated?.(item,id),changed:(item,id)=>ports.changed?.(item,id),beforeSubmit:(item,id)=>{const pane=entry.model.get(id);if(pane.inherit){const defaults=ports.defaults?.(item)||{};entry.model.configure(id,{sticky:defaults.sticky,localEcho:defaults.localEcho});}},style:(input,item,pane)=>ports.style?.(input,item,pane),submit:(item,packet)=>{if(!valid(item)||owners.get(item)!==entry||!entry.model.panes.has(packet.paneId))throw Error('Input owner or pane changed.');return ports.submit(item,packet);}});entry.mounts.set(key,view);return view;
 }
 // Park before dock containers are rebuilt. A live textarea and its undo stack,
 // handlers, draft and selection must survive output updates and tab changes.
 function park(owner,container){const entry=owners.get(owner);if(!entry)return null;let focus=null;for(const [key,view] of entry.mounts){if(container&&!container.contains(view.form))continue;if(view.input.ownerDocument.activeElement===view.input)focus=key;view.form.remove();}return focus;}
 function restoreFocus(owner,key){if(!key||!valid(owner)||ports.active&&!ports.active(owner))return;const view=owners.get(owner)?.mounts.get(key);if(view?.input.isConnected)view.focus();}
 function refresh(owner,key){const entry=owners.get(owner);if(key)entry?.mounts.get(key)?.refresh();else for(const view of entry?.mounts.values()||[])view.refresh();}
 function forget(owner){const entry=owners.get(owner);if(!entry)return;for(const view of entry.mounts.values())view.destroy();owners.delete(owner);}
 function replace(owner,saved){forget(owner);return ensure(owner,saved).model;}
 return {model,serialized,layoutFor,open,close,mount,park,restoreFocus,refresh,forget,replace};
}
return {createController};
});
