const assert=require('node:assert/strict'),model=require('../ui/restore-model.js'),imports=require('../ui/restore-import.js'),runtime=require('../ui/restore-runtime.js');
const record={v:1,kind:'line',time:1000,parts:[{type:'text',text:'WHO  Name  Idle',style:{color:'#aabbcc',bold:true},link:{kind:'command',value:'look name',hint:'Look'}}]};
let checks=0;function check(name,test){test();checks++;console.log('PASS '+name);}
check('Original defaults and future-buffer rounding normalize independently of storage metadata',()=>{
 assert.deepEqual(model.normalizeGlobal(),{enabled:true,bufferKiB:256});assert.deepEqual(model.normalizeGlobal({enabled:false,bufferKiB:65}),{enabled:false,bufferKiB:128});assert.equal(model.normalizeGlobal({bufferKiB:9000}).bufferKiB,4096);assert.equal(model.normalizeGlobal({bufferKiB:0}).bufferKiB,64);assert.equal(model.enabled({restore:{enabled:false}},{}),false);assert.equal(model.enabled({}, {restore:{enabled:false}}),false);
});
check('Structured snapshots preserve spaces, styles and command targets while dropping unknown properties',()=>{
 const copy=model.deserialize(model.serialize({...record,password:'never persist',parts:[{...record.parts[0],onclick:'do not persist'}]}));assert.deepEqual(copy,record);assert.equal(copy.parts[0].text,'WHO  Name  Idle');
 assert.deepEqual(model.deserialize(model.serialize({v:1,kind:'gmcp',time:0,package:'Char.Vitals',data:'{"hp":10}'})),{v:1,kind:'gmcp',time:0,package:'Char.Vitals',data:'{"hp":10}'});
 assert.deepEqual(model.normalizeRecord({v:1,kind:'reset',time:0,command:'login'}),{v:1,kind:'reset',time:0});
});
check('Unsafe content and invalid records fail before capture or replay',()=>{
 for(const link of [{kind:'url',value:'javascript:alert(1)'},{kind:'url',value:'https://user:password@example.org/'},{kind:'command',value:'north\nsouth'}])assert.throws(()=>model.normalizeRecord({...record,parts:[{type:'text',text:'x',link}]}));
 assert.throws(()=>model.normalizeRecord({...record,parts:[{type:'text',text:'x',style:{color:'red;background:url(x)'}}]}));
 assert.throws(()=>model.normalizeRecord({...record,parts:[{type:'text',text:'🙂'.repeat(16000)}]}),/60 KiB/);assert.throws(()=>model.normalizeRecord({v:1,kind:'script',time:0,source:'run()'}));assert.throws(()=>model.deserialize('{broken'));assert.throws(()=>model.normalizeRecord({v:1,kind:'gmcp',time:0,package:'Char.Vitals',data:'not JSON'}));
});
check('Grouped history preserves complete multiline entries with the serialized byte cap',()=>{
 for(const text of ['north\nsouth','say first\r\nsay second','prefix: first\n\n  WHO\tName  Idle\n','look 🙂\nsay é']){
  const entry={v:1,kind:'history',time:2000,text};assert.deepEqual(model.deserialize(model.serialize(entry)),entry);
 }
 const empty={v:1,kind:'history',time:0,text:''},overhead=new TextEncoder().encode(model.serialize(empty)).length;
 assert.equal(new TextEncoder().encode(model.serialize({...empty,text:'x'.repeat(model.MAX_RECORD_BYTES-overhead)})).length,model.MAX_RECORD_BYTES);
 for(const text of ['x'.repeat(model.MAX_RECORD_BYTES-overhead+1),'\n'.repeat(31000),'🙂'.repeat(16000)])assert.throws(()=>model.serialize({...empty,text}),/60 KiB/);
 assert.throws(()=>model.serialize({...empty,text:'a\0b'}),/history/);assert.throws(()=>model.serialize({...empty,text:'x'.repeat(65537)}),/history/);
});
check('Import uses exact original current buffer and explicit node bindings, including duplicate names',()=>{
 const node=(name,values={},children=[])=>({name,values,children}),a=node('Same',{RestoreLog:'false',RestoreLogIndex:'2'}),b=node('Same',{RestoreLogIndex:'0'}),tree=node('',{},[node('Connections',{},[node('Logging',{RestoreBufferSize:'65',RestoreBufferSizeCurrent:'128',RestoreLogs:'true'})])]);
 const plan=imports.fromConfig(tree,[{characterId:'import-a',characterNode:a},{characterId:'import-b',characterNode:b}]);assert.equal(plan.preferences.bufferKiB,128);assert.equal(plan.source.bufferKiB,128);assert.deepEqual(plan.source.indices,[{characterId:'import-a',index:2},{characterId:'import-b',index:0}]);assert.equal(plan.characters[0].restore.enabled,false);
 const remapped=imports.remap(plan,{'import-a':'final-a','import-b':'final-b'});assert.equal(remapped.source.indices[0].characterId,'final-a');assert.equal(plan.source.indices[0].characterId,'import-a');assert.throws(()=>imports.remap(plan,{'import-a':'same','import-b':'same'}));
 tree.children[0].children[0].values.RestoreBufferSizeCurrent='65';assert.equal(imports.fromConfig(tree,[]).source,null);
 tree.children[0].children[0].values.RestoreBufferSizeCurrent='64';tree.children[0].children[0].values.RestoreBufferSize='1024';const correct=imports.fromConfig(tree,[]);assert.equal(correct.source.bufferKiB,64);assert.equal(correct.preferences.bufferKiB,1024);
});
check('Original encoding and isolated raw parsing preserve links, bytes and suppress protocol sends',()=>{
 const legacy=require('../ui/restore-legacy.js'),Parser=require('../ui/parser.js').Parser;
 assert.equal(legacy.decode(Uint8Array.from([0x82,0xb3,0xdb]),'cp437'),'é│█');assert.equal(legacy.decode(Uint8Array.from([0x80]),'windows-1252'),'€');assert.throws(()=>legacy.decode(Uint8Array.from([0xff]),'utf-8'));
 const payload=new TextEncoder().encode('This world is Pueblo 2.01\n</xch_mudtext><a xch_cmd="look">WHO  A  B</a>');
 const result=legacy.convert({characterId:'test',format:{encoding:'utf-8',pueblo:false},records:[{kind:'received',timeMs:10,payload}]},{Parser});assert.ok(result.warnings.some(item=>item.code==='replay-send-suppressed'));assert.ok(result.warnings.some(item=>item.code==='semantic-replay-gap'));assert.ok(result.records.some(item=>item.parts?.some(part=>part.link?.kind==='command'&&part.link.value==='look'&&part.text==='WHO  A  B')));
 const multiline=legacy.convert({characterId:'test',format:{encoding:'utf-8',pueblo:true},records:['<pre>First  A  B','Second  C  D','</pre>'].map(text=>({kind:'received',timeMs:10,payload:new TextEncoder().encode(text)}))},{Parser});assert.ok(multiline.records.some(item=>item.parts?.some(part=>part.text==='Second  C  D')));
});
async function protocolChecks(){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64'),posts=[],errors=[],replayed=[];let release;const held=new Promise(resolve=>release=resolve);
 const controller=runtime.createController({sessionId:'s',characterId:'c',epoch:7,post:value=>posts.push(value),onError:error=>errors.push(error),onReplay:async records=>{replayed.push(...records);await held;}});controller.start();assert.equal(posts[0],'restoreconfig|s|c|7|1|256');assert.equal(posts[1],'restoreload|s|c|7');controller.capture({v:1,kind:'history',time:2000,text:'live'});assert.equal(posts.length,2);
 controller.message('restorebegin:c:6:1');assert.equal(controller.mode,'loading');controller.message('restorebegin:c:7:1');controller.message('restoreitem:c:7:0:'+encode(record));controller.message('restoreend:c:7:1');assert.equal(controller.mode,'replaying');assert.equal(replayed.length,1);controller.capture({v:1,kind:'reset',time:2001});assert.equal(posts.length,2);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(controller.mode,'live');assert.equal(posts.length,4);assert.equal(model.deserialize(Buffer.from(posts[2].split('|')[4],'base64').toString()).kind,'history');controller.clear();assert.equal(posts.at(-1),'restoreclear|s|c|7');controller.message('restorecleared:c:7');controller.cancel();controller.message('restorebegin:c:7:0');assert.equal(controller.mode,'cancelled');assert.equal(controller.capture(record),false);assert.deepEqual(errors,[]);
 checks++;console.log('PASS Replay buffers capture until validated epoch/order batch completes and cancellation rejects late data');
 for(const messages of [['restorebegin:c:7:1','restoreitem:c:7:1:'+encode(record)],['restorebegin:c:7:1','restoreend:c:7:1'],['restorebegin:c:7:1','restoreitem:c:7:0:'+encode({v:1,kind:'script',time:0})]]){let rendered=false,failed='';const broken=runtime.createController({sessionId:'s',characterId:'c',epoch:7,post:()=>{},onReplay:()=>rendered=true,onError:error=>failed=error});broken.start();for(const message of messages)broken.message(message);assert.equal(broken.mode,'failed');assert.equal(rendered,false);assert.ok(failed);broken.cancel();}
 checks++;console.log('PASS Missing, reordered and unsafe native records fail before any replay callback');
 const groupedPosts=[],groupedErrors=[],groupedReplay=[],grouped={v:1,kind:'history',time:3000,text:'say prefix first\n\n  WHO\tName  Idle\nlast 🙂'};
 const groupedController=runtime.createController({sessionId:'grouped',characterId:'history',epoch:8,post:value=>groupedPosts.push(value),onError:error=>groupedErrors.push(error),onReplay:records=>groupedReplay.push(...records)});groupedController.start();
 assert.equal(groupedController.capture(grouped),true);assert.equal(groupedController.capture({...grouped,text:'🙂'.repeat(16000)}),false);assert.equal(groupedController.mode,'loading');assert.equal(groupedErrors.length,1);
 groupedController.message('restorebegin:history:8:1');groupedController.message('restoreitem:history:8:0:'+encode(grouped));groupedController.message('restoreend:history:8:1');await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(groupedReplay,[grouped]);assert.equal(groupedPosts.length,3);assert.deepEqual(model.deserialize(Buffer.from(groupedPosts[2].split('|')[4],'base64').toString('utf8')),grouped);
 assert.equal(groupedController.capture({...grouped,time:3001}),true);assert.equal(groupedPosts.length,4);assert.equal(groupedController.capture({...grouped,text:'a\0b'}),false);assert.equal(groupedPosts.length,4);assert.equal(groupedController.mode,'live');groupedController.cancel();
 checks++;console.log('PASS Complete multiline history loads and captures as one record; oversized or unsafe history is rejected without disabling valid capture');
}
protocolChecks().then(()=>console.log(checks+' restore model/import/runtime checks passed.'),error=>{console.error(error);process.exitCode=1;});
