'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createEngine,hierarchy,normalizeHierarchy}=require('../ui/rules.js');
let passed=0;const scope={serverId:'w1',characterId:'c1'};
function check(name,fn){fn();console.log('PASS '+name);passed++;}
check('Aliases gate children on parent match and process the replaced whole command',()=>{
 const aliases=[{id:'parent',match:'a',replacement:'b',stopProcessing:true},{id:'child',parentId:'parent',match:'b',replacement:'c'},{id:'later',match:'c',replacement:'d'}];
 assert.deepEqual(createEngine({aliases}).expandCommand('a',scope).commands,['c']);
 assert.deepEqual(createEngine({aliases}).expandCommand('b',scope).commands,['b']);
});
check('Folder children inherit root scope and disabled ancestry gates descendants',()=>{
 const aliases=[{id:'folder',folder:true,scope:{level:'server',serverId:'w1'}},{id:'child',parentId:'folder',scope:{level:'server',serverId:'other'},match:'a',replacement:'b'}];
 assert.deepEqual(createEngine({aliases}).expandCommand('a',scope).commands,['b']);
 assert.deepEqual(createEngine({aliases}).expandCommand('a',{serverId:'other'}).commands,['a']);
 for(const changes of [{enabled:false},{processChildren:false}])assert.deepEqual(createEngine({aliases:[{...aliases[0],...changes},aliases[1]]}).expandCommand('a',scope).commands,['a']);
 assert.equal(normalizeHierarchy(aliases).items[1].scope.serverId,'w1');
});
check('Descendant alias stop propagates through folders and later scopes',()=>{
 const aliases=[{id:'f',folder:true},{id:'a',parentId:'f',match:'a',replacement:'b',stopProcessing:true},{id:'z',match:'b',replacement:'c',scope:{level:'server',serverId:'w1'}}];
 assert.deepEqual(createEngine({aliases}).expandCommand('a',scope).commands,['b']);
});
check('Empty alias replacement deletes matched text before child processing',()=>{
 assert.deepEqual(createEngine({aliases:[{id:'a',match:'prefix ',replacement:''},{parentId:'a',match:'x',replacement:'y'}]}).expandCommand('prefix x',scope).commands,['y']);
});
check('Trigger children act on whole filtered line; parent stop waits for children',()=>{
 const triggers=[{id:'parent',match:'Game> ',filterText:'Event> ',sendText:'parent',stopProcessing:true},{id:'child',parentId:'parent',match:'Event> bounty',sendText:'child',highlight:{bold:true}},{id:'later',match:'bounty',sendText:'later'}];
 const result=createEngine({triggers}).processLine('Game> bounty',scope);
 assert.deepEqual(result.matches.map(m=>m.triggerId),['parent','child']);
 assert.deepEqual(result.actions.filter(a=>a.type==='command').map(a=>a.text),['parent','child']);
 assert.equal(result.actions.find(a=>a.type==='highlight').start,0);
 assert.equal(createEngine({triggers}).processLine('bounty',scope).matches.length,1);
});
check('Trigger folders ignore actions; child stop suppresses outer siblings',()=>{
 const triggers=[{id:'f',folder:true,sendText:'wrong',stopProcessing:true},{id:'a',parentId:'f',match:'x',sendText:'a',stopProcessing:true},{id:'b',parentId:'f',match:'x',sendText:'b'},{id:'c',match:'x',sendText:'c'}];
 assert.deepEqual(createEngine({triggers}).processLine('x',scope).actions.map(a=>a.text),['a']);
});
check('Hierarchy rejects cycles, orphans, duplicates and excessive depth',()=>{
 for(const items of [[{id:'a',parentId:'b'},{id:'b',parentId:'a'}],[{id:'a',parentId:'missing'}],[{id:'a'},{id:'a'}],Array.from({length:9},(_,i)=>({id:String(i),parentId:i?String(i-1):''}))]){
  assert.ok(hierarchy(items).errors.length);
  assert.equal(createEngine({triggers:items.map(item=>({...item,match:'x',notify:true}))}).processLine('x',scope).actions.length,0);
 }
 const normalized=normalizeHierarchy([{id:'valid',folder:true},{id:'orphan',parentId:'missing'},{id:'child',parentId:'orphan'}]);assert.deepEqual(normalized.items.map(x=>x.id),['valid']);
 assert.deepEqual(normalizeHierarchy(normalized.items).items,normalized.items);
});
check('Total rule and action caps include nested descendants',()=>{
 const triggers=[{id:'f',folder:true},...Array.from({length:128},(_,i)=>({id:'t'+i,parentId:'f',match:'x',notify:true}))];
 const result=createEngine({triggers}).processLine('x',scope);assert.equal(result.actions.length,32);assert.ok(result.diagnostics.some(x=>x.includes('limit')));
});
check('Worker entry evaluates nested regex and retains capture-until cancellation',()=>{
 const replies=[],ctx=vm.createContext({postMessage:r=>replies.push(r)});ctx.self=ctx;ctx.importScripts=name=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui',name),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/rules-worker.js'),'utf8'),ctx);
 ctx.onmessage({data:{type:'start',aliases:[{id:'f',folder:true},{id:'a',parentId:'f',match:'^go (.*)$',matchType:'regex',replacement:'walk \\1'}],triggers:[{id:'p',match:'^START$',matchType:'regex'},{id:'c',parentId:'p',match:'^START$',matchType:'regex',spawnTitle:'Nested',captureUntil:'END'}]}});
 ctx.onmessage({data:{id:1,type:'expand',value:'go east',scope}});assert.deepEqual(Array.from(replies[1].result.commands),['walk east']);
 ctx.onmessage({data:{id:2,type:'line',value:'START',scope,nowMs:1000}});assert.equal(replies[2].result.gagged,true);
 ctx.onmessage({data:{id:3,type:'cancel-capture',scope}});assert.equal(replies[3].result.cancelled,true);
 ctx.onmessage({data:{id:4,type:'line',value:'body',scope,nowMs:1100}});assert.equal(replies[4].result.gagged,false);
});
console.log(passed+' hierarchy checks passed.');
