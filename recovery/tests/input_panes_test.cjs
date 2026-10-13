'use strict';
const assert=require('node:assert/strict'),inputs=require('../ui/input-panes.js'),{createPipeline}=require('../ui/command-pipeline.js');
// These unusual parsing cases match Commands.cpp WordList + newinput, not shell parsing.
assert.deepEqual(inputs.parseNewInput('/UNIQUE "say "'),{unique:true,prefix:'say '});
assert.deepEqual(inputs.parseNewInput('ignored `pose `'),{unique:false,prefix:'pose '});
assert.deepEqual(inputs.parseNewInput('say /unique'),{unique:true,prefix:''});
assert.deepEqual(inputs.parseNewInput('"unfinished prefix'),{unique:false,prefix:'unfinished prefix'});
assert.deepEqual(inputs.words('a\tb c'),['a\tb','c']);
assert.throws(()=>inputs.parseNewInput('"/not-prefix"'),/Unknown option/);
assert.throws(()=>inputs.parseNewInput('/unique\tpose'),/Unknown option/);
const history=[],a=inputs.createModel({history,defaults:{sticky:false,localEcho:true}}),b=inputs.createModel();
const first=a.add({prefix:'say '}).pane,second=a.add({prefix:'pose ',title:'Roleplay',sticky:true}).pane;
assert.equal(a.add({prefix:'say ',unique:true}).pane,first);
assert.equal(b.add({prefix:'say ',unique:true}).created,true);
assert.equal(a.find('Roleplay'),second);assert.equal(a.find('roleplay'),null);
assert.equal(inputs.caption(second),'Roleplay - pose ');
a.set(first.id,'say hello');assert.equal(first.text,'hello');
a.set(first.id,'say literal',{stripPrefix:false});assert.equal(first.text,'say literal');
a.set(first.id,'hello\r\nagain');const sent=a.submit(first.id);
assert.equal(sent.text,'hello\r\nagain');assert.equal(sent.prefix,'say ');assert.equal(sent.echoText,'hello\nagain');assert.equal(first.text,'');
assert.deepEqual(history,['say hello\nagain']);
a.set(first.id,'hello\nagain');assert.equal(a.submit(first.id).historyAdded,false);
a.set(second.id,'smiles');a.submit(second.id);assert.equal(second.text,'smiles');assert.equal(second.start,0);assert.equal(second.end,6);
a.set(first.id,'draft');a.recall(first.id,-1);assert.equal(first.text,'pose smiles');a.recall(first.id,-1);assert.equal(first.text,'hello\nagain');a.recall(first.id,1);a.recall(first.id,1);assert.equal(first.text,'draft');
a.set(first.id,'saved unsent');a.recall(first.id,1);assert.equal(first.text,'');assert.equal(history.at(-1),'say saved unsent');
a.activate(second.id);assert.equal(a.next(),'primary');a.activate(first.id);a.close(first.id);assert.equal(a.active,'primary');assert.throws(()=>a.get(first.id),/closed/);
const saved=a.serialize();assert.ok(!JSON.stringify(saved).includes('smiles'));const round=inputs.createModel({saved});assert.equal(round.get(second.id).prefix,'pose ');assert.equal(round.get(second.id).text,'');
const bounded=inputs.createModel();for(let n=0;n<inputs.MAX_PANES;n++)bounded.add();assert.throws(()=>bounded.add(),/At most/);assert.throws(()=>a.set(second.id,'x'.repeat(inputs.MAX_DRAFT+1)),/Invalid/);
const defaultAppearance={inputFontFace:'Consolas',inputFontSize:17,inputForeground:'#abcdef',inputMarginLeft:11,unsafe:'discard'};const copied=inputs.createModel({defaults:{appearance:defaultAppearance}}).add({prefix:'say '}).pane;defaultAppearance.inputFontSize=22;assert.equal(copied.appearance.inputFontSize,17);assert.equal(copied.appearance.inputFontFace,'Consolas');assert.equal(copied.appearance.inputMarginLeft,11);assert.equal(copied.appearance.unsafe,undefined);assert.equal(copied.inherit,false);
// Exercise the shipped command pipeline: the model must pass prefix as metadata,
// not concatenate it before aliases or internal commands.
(async()=>{
 const alpha={id:'alpha',epoch:1},beta={id:'beta',epoch:1},wire=[],internal=[],evaluated=[];
 const pipeline=createPipeline({valid:(owner,epoch)=>owner.epoch===epoch,epoch:owner=>owner.epoch,connected:()=>true,settings:()=>({active:true,processCommands:true}),aliases:(owner,text)=>text==='alias'?{matched:true,text:'one\r\n/echo local\r\ntwo'}:{matched:false,text},onCommand:()=>false,onSend:()=>false,internal:(owner,text)=>{internal.push([owner.id,text]);return true;},evaluate:(owner,text)=>evaluated.push([owner.id,text]),transport:(owner,packet)=>wire.push([owner.id,packet.text])});
 const m=inputs.createModel(),pane=m.add({prefix:'say '}).pane;m.set(pane.id,'first\n/echo local\n//literal\nalias');let packet=m.submit(pane.id);await pipeline.submit(alpha,packet.text,{prefix:packet.prefix});
 assert.deepEqual(wire,[['alpha','say first'],['alpha','/literal'],['alpha','say one'],['alpha','say two']]);assert.deepEqual(internal,[['alpha','/echo local'],['alpha','/echo local']]);
 m.set(pane.id,'/@window.Run("look");');packet=m.submit(pane.id);await pipeline.submit(alpha,packet.text,{prefix:packet.prefix});assert.deepEqual(evaluated,[['alpha','window.Run("look");']]);
 await pipeline.submit(beta,'other',{prefix:'pose '});assert.deepEqual(wire.at(-1),['beta','pose other']);
 console.log('PASS original input parsing, identity, prefix stripping, sticky/clear, shared history, limits and real command-pipeline prefix/owner behavior');
})().catch(error=>{console.error(error);process.exitCode=1;});
