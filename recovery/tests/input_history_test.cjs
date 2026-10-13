'use strict';
const assert=require('node:assert/strict'),inputs=require('../ui/input-panes.js'),{createController}=require('../ui/input-owner-controller.js');
// Wnd_Main.cpp 1605-1752: one history cursor/draft; history entries contain
// the complete InputControl text, including returns, with the prefix once.
const history=[],events=[],model=inputs.createModel({history,onHistoryAdded:text=>events.push(text)}),extra=model.add({prefix:'say '}).pane;
model.set('primary','first\r\n\r\nthird',{stripPrefix:false});const primaryPacket=model.submit('primary');
assert.equal(primaryPacket.text,'first\r\n\r\nthird');assert.deepEqual(history,['first\n\nthird']);assert.deepEqual(events,history);
model.set(extra.id,'second');model.submit(extra.id);assert.equal(history.at(-1),'say second');
model.set('primary','primary draft');model.recall('primary',-1);assert.equal(model.get('primary').text,'say second');assert.equal(model.historyPosition,1);
// Switching controls continues the same cursor; it does not select the newest
// entry again, and the original saved draft follows the shared cursor.
model.set(extra.id,'second');model.recall(extra.id,-1);assert.equal(extra.text,'first\n\nthird');assert.equal(model.historyPosition,0);assert.equal(history.length,2);
model.recall(extra.id,1);assert.equal(extra.text,'second');model.recall(extra.id,1);assert.equal(extra.text,'primary draft');assert.equal(model.historyPosition,null);assert.equal(extra.start,extra.text.length);assert.equal(extra.end,extra.text.length);
model.set('primary','saved\nunsent');model.recall('primary',1);assert.equal(model.get('primary').text,'');assert.equal(history.at(-1),'saved\nunsent');assert.equal(events.at(-1),'saved\nunsent');
model.recall('primary',-1);model.set('primary','edited\nunsent');model.recall('primary',-1);assert.equal(history.at(-1),'edited\nunsent');assert.equal(events.at(-1),'edited\nunsent');assert.equal(model.get('primary').text,'say second');
model.configure('primary',{sticky:true,prefix:'pose '});model.set('primary','sticky\ntext',{stripPrefix:false});model.submit('primary');assert.equal(history.at(-1),'pose sticky\ntext');assert.equal(model.get('primary').start,0);assert.equal(model.get('primary').end,11);
assert.equal(model.panes.size,1);assert.ok(!model.serialize().panes.some(p=>p.id==='primary'));assert.throws(()=>model.close('primary'),/cannot be closed/);
// Unedited recalls remain duplicates even when another prefix is used.
const duplicate=inputs.createModel({history:['say same']}),pane=duplicate.add({prefix:'say '}).pane;duplicate.recall(pane.id,-1);duplicate.recall(pane.id,1);assert.deepEqual(duplicate.history,['say same']);
// Capture callback is owner-bound and invalidated by layout replacement/close.
const owner={history:[]},captured=[],live=new Set([owner]),controller=createController({valid:item=>live.has(item),history:item=>item.history,historyAdded:(item,text)=>captured.push([item,text])});
const old=controller.model(owner);old.set('primary','owned');old.submit('primary');assert.deepEqual(captured,[[owner,'owned']]);
const replacement=controller.replace(owner);old.addHistory('stale');assert.equal(captured.length,1);replacement.addHistory('fresh');assert.equal(captured.at(-1)[1],'fresh');live.delete(owner);replacement.addHistory('closed');assert.equal(captured.length,2);
console.log('PASS shared primary/additional cursor, grouped multiline history, edited recall capture, saved draft, sticky/end selection, duplicate suppression and owner-bound capture');

// Execute the shipped primary submit handler, rather than duplicating it in a
// fixture. This protects the integration that previously split every history.
const fs=require('node:fs'),vm=require('node:vm'),appSource=fs.readFileSync(require.resolve('../ui/app.js'),'utf8'),handler=appSource.slice(appSource.indexOf("$('command').onsubmit="),appSource.indexOf("\n$('input').addEventListener",appSource.indexOf("$('command').onsubmit=")));
const primaryOwner={history:[],typedCount:0,inputPrefix:'say '},primaryCaptures=[],primaryModel=inputs.createModel({history:primaryOwner.history,onHistoryAdded:text=>primaryCaptures.push(text)}),field={value:'one\n\ntwo',selectionStart:1,selectionEnd:3,setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}},form={},dispatch=[],preferences={inputSticky:false,localEcho:true},echoes=[];
const scope=vm.createContext({$:key=>key==='command'?form:field,current:()=>primaryOwner,preferencesForSession:()=>preferences,window:{BeipDockPanels:{inputModel:()=>primaryModel},BeipDesktopShell:{refreshActivity(){}}},BeipWindowPreferences:{echoStyle:()=>({})},appendText:(owner,text)=>echoes.push([owner,text]),command:(...args)=>dispatch.push(args),resizeInput(){}});
vm.runInContext(handler,scope);form.onsubmit({preventDefault(){}});
assert.deepEqual(primaryOwner.history,['say one\n\ntwo']);assert.deepEqual(primaryCaptures,primaryOwner.history);assert.equal(primaryOwner.typedCount,2);assert.equal(field.value,'');assert.deepEqual([field.selectionStart,field.selectionEnd],[0,0]);assert.equal(dispatch[0][0],'one\r\n\r\ntwo');assert.equal(dispatch[0][4].prefix,'say ');assert.equal(dispatch[0][4].source,'input');assert.deepEqual(echoes.map(item=>item[1]),['> one\n','> \n','> two\n']);
preferences.inputSticky=true;field.value='sticky\ncommand';form.onsubmit({preventDefault(){}});assert.equal(field.value,'sticky\ncommand');assert.deepEqual([field.selectionStart,field.selectionEnd],[0,14]);assert.equal(primaryOwner.draft,field.value);assert.deepEqual({...primaryOwner.draftSelection},{start:0,end:14});
form.onsubmit({preventDefault(){}});assert.equal(primaryCaptures.length,2);assert.equal(primaryOwner.history.length,2);
console.log('PASS shipped primary submit grouped capture, prefix metadata, multiline transport/echo, clear/sticky selection and duplicate capture');

// Exercise the actual additional textarea key handler with a tiny EventTarget
// host: configured actions must work here as they do in the primary field.
class Field extends EventTarget{constructor(doc){super();this.ownerDocument=doc;this.value='';this.selectionStart=this.selectionEnd=0;}append(...children){for(const child of children)child.form=this;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}setAttribute(){}focus(){this.ownerDocument.activeElement=this;}remove(){}requestSubmit(){this.dispatchEvent(new Event('submit',{cancelable:true}));}}
const doc={createElement(){return new Field(doc);}},host=new Field(doc),viewScope={BeipInputPanes:inputs,BeipShortcuts:require('../ui/shortcut-model.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../ui/input-pane-view.js'),'utf8'),viewScope);
const keyHistory=['one\ntwo','last'],keyModel=inputs.createModel({history:keyHistory}),keyPane=keyModel.add().pane,keyPackets=[];let bindings={};
const view=viewScope.BeipInputPaneView.mount(host,{},keyModel,keyPane.id,{valid:()=>true,shortcuts:()=>bindings,submit:(owner,packet)=>keyPackets.push(packet)}),keyInput=view.input;
function key(key,flags={}){const event=new Event('keydown',{cancelable:true});Object.assign(event,{key,...flags});keyInput.dispatchEvent(event);return event;}
keyInput.value='unfinished';assert.equal(key('ArrowUp',{ctrlKey:true}).defaultPrevented,true);assert.equal(keyInput.value,'last');
keyInput.value='edited\nunsent';key('ArrowDown',{ctrlKey:true});assert.equal(keyInput.value,'');assert.equal(keyHistory.at(-1),'edited\nunsent');assert.equal(keyModel.historyPosition,1); // Push does not move the shared cursor.
bindings=viewScope.BeipShortcuts.assign(bindings,'historyDown','Ctrl+Shift+ArrowDown');key('ArrowDown',{ctrlKey:true,shiftKey:true});assert.equal(keyInput.value,'edited\nunsent');key('ArrowDown',{ctrlKey:true,shiftKey:true});assert.equal(keyInput.value,'unfinished');assert.equal(keyModel.historyPosition,null);
bindings=viewScope.BeipShortcuts.assign(bindings,'historyUp','Alt+ArrowUp');keyInput.value='';assert.equal(key('ArrowUp',{ctrlKey:true}).defaultPrevented,false);assert.equal(keyInput.value,'');assert.equal(key('ArrowUp',{altKey:true}).defaultPrevented,true);assert.equal(keyInput.value,'edited\nunsent');
assert.equal(key('Enter',{shiftKey:true}).defaultPrevented,false);assert.equal(key('Enter',{isComposing:true}).defaultPrevented,false);assert.equal(key('ArrowUp',{altKey:true,repeat:true}).defaultPrevented,false);assert.equal(keyPackets.length,0);
bindings=viewScope.BeipShortcuts.assign(bindings,'sendInput','F2');assert.equal(key('Enter').defaultPrevented,false);keyInput.value='remapped\nsend';assert.equal(key('F2').defaultPrevented,true);assert.equal(keyPackets.at(-1).text,'remapped\r\nsend');assert.equal(keyInput.value,'');view.destroy();assert.equal(key('F2').defaultPrevented,false);
console.log('PASS shipped additional configured send/push/history shortcuts, shared cursor, multiline entries, Shift+Enter/IME/repeat and destroyed-handler isolation');
