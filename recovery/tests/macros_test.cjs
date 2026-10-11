const assert=require('node:assert/strict');
const {normalizeCombo,match}=require('../ui/macros.js');
let passed=0;
function check(name,fn){fn();console.log('PASS '+name);passed++;}
const key=(code,options={})=>({type:'keydown',code,key:code,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,...options});
const macro=(id,keyName,scope,text,mode='send',extra={})=>({id,key:keyName,scope,text,mode,...extra});
check('Normalize modifier order, aliases, and keyboard event codes',()=>{
 assert.equal(normalizeCombo('Shift+Control+KeyQ'),'Ctrl+Shift+Q');
 assert.equal(normalizeCombo(key('Digit1',{ctrlKey:true,shiftKey:true})),'Ctrl+Shift+1');
 assert.equal(normalizeCombo('Option+['),'Alt+BracketLeft');
 assert.equal(normalizeCombo('Ctrl+Ctrl+Q'),null);
 assert.equal(normalizeCombo('Ctrl+NotAKey'),null);
});
check('Character macro overrides world and global, with first rule winning within a scope',()=>{
 const list=[
  macro('global','Ctrl+2',{level:'global'},'global'),
  macro('world','Ctrl+2',{level:'server',serverId:'w1'},'world'),
  macro('char','Ctrl+2',{level:'character',serverId:'w1',characterId:'c1'},'character'),
  macro('second','Ctrl+2',{level:'character',serverId:'w1',characterId:'c1'},'second')
 ];
 assert.deepEqual(match(key('Digit2',{ctrlKey:true}),{serverId:'w1',characterId:'c1'},list).commands,['character']);
 assert.deepEqual(match(key('Digit2',{ctrlKey:true}),{serverId:'w1',characterId:'c2'},list).commands,['world']);
 assert.deepEqual(match(key('Digit2',{ctrlKey:true}),{serverId:'w2'},list).commands,['global']);
});
check('Send macros return bounded separate commands while type macros fill input',()=>{
 const send=macro('a','Ctrl+3',{level:'global'},'look\r\nsay hi\n','send');
 assert.deepEqual(match(key('Digit3',{ctrlKey:true}),{},[send]).commands,['look','say hi','']);
 const typed=macro('b','Ctrl+4',{level:'global'},'Page ','type');
 assert.equal(match(key('Digit4',{ctrlKey:true}),{},[typed]).input,'Page ');
});
check('Built-in keys stay available unless a macro explicitly overrides them',()=>{
 const reserved=macro('x','Ctrl+Tab',{level:'global'},'north');
 assert.equal(match(key('Tab',{ctrlKey:true}),{},[reserved]),null);
 assert.deepEqual(match(key('Tab',{ctrlKey:true}),{},[{...reserved,overrideBuiltins:true}]).commands,['north']);
 assert.equal(match(key('ArrowUp'),{},[macro('up','ArrowUp',{level:'global'},'up')]),null);
});
check('Composing, repeated, password and unrelated form input are ignored',()=>{
 const m=macro('a','Ctrl+5',{level:'global'},'look');
 assert.equal(match(key('Digit5',{ctrlKey:true,isComposing:true}),{},[m]),null);
 assert.equal(match(key('Digit5',{ctrlKey:true,repeat:true}),{},[m]),null);
 assert.equal(match(key('Digit5',{ctrlKey:true,target:{tagName:'INPUT',type:'password'}}),{},[m]),null);
 assert.equal(match(key('Digit5',{ctrlKey:true,target:{tagName:'TEXTAREA'}}),{},[m]),null);
 const input={tagName:'INPUT',type:'text'};
 assert.ok(match(key('Digit5',{ctrlKey:true,target:input}),{inputElement:input},[m]));
});
check('Disabled and invalid rules do not match; oversized send lists are rejected',()=>{
 const m=macro('a','Ctrl+6',{level:'global'},'hello');
 assert.equal(match(key('Digit6',{ctrlKey:true}),{},[{...m,enabled:false}]),null);
 assert.equal(match(key('Digit6',{ctrlKey:true}),{},[{...m,text:'x\n'.repeat(20)}]),null);
 assert.equal(match(key('Digit6',{ctrlKey:true}),{},[{...m,text:'x'.repeat(8193)}]),null);
});
console.log(passed+' macro checks passed.');
