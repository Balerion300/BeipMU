'use strict';
const assert=require('node:assert/strict');
const rules=require('../ui/rules.js');
const profiles=require('../ui/profile-model.js');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('original variables are case sensitive and stop at unknown tokens',()=>{
 assert.equal(rules.expandVariables('%a%/%A%/%b%',{a:'one',b:'two'}),'one/%A%/%b%');
 assert.equal(rules.expandVariables('%a%/%b%',{a:'%b%',b:'two'}),'%b%/two');
 assert.equal(rules.expandVariables('%missing',{}),'%missing');
 assert.equal(rules.expandVariables('%x%',{x:'1234'},3),null);
});
test('variables reject invalid names, multiline values, excessive count and expansion',()=>{
 const source=JSON.parse('{"__proto__":"safe","x=y":"invalid","ok":"yes","bad":"line\\nnext"}');
 const values=rules.normalizeVariables(source);
 assert.equal(Object.getPrototypeOf(values),null);assert.equal(values.__proto__,'safe');assert.equal(values.ok,'yes');assert.equal(values.bad,undefined);
 assert.equal(Object.keys(rules.normalizeVariables(Object.fromEntries(Array.from({length:140},(_,i)=>['v'+i,'yes'])))).length,128);
});
test('preview never simulates command writes; continuation resumes with actual host variables',()=>{
 const engine=rules.createEngine({triggers:[{match:'hit',sendText:'/set target=friend'},{match:'hit',sendText:'say %target%',sendExpandVariables:true},{match:'hit',sendText:'/unset target'},{match:'hit',sendText:'say %target%',sendExpandVariables:true}]});
 assert.deepEqual(engine.processLine('hit',{variables:{target:'old'}}).actions.map(a=>a.text),['/set target=friend','say old','/unset target','say old']);
 let result=engine.beginLine('hit',{variables:{target:'old'}});const commands=[];
 while(!result.done){commands.push(...result.actions.map(a=>a.text));result=engine.continueLine(result.continuationId,{text:'hit',variables:commands.includes('/unset target')?{}:{target:'friend'}});}
 commands.push(...result.actions.map(a=>a.text));assert.deepEqual(commands,['/set target=friend','say friend','/unset target','say %target%']);
});
test('away once applies across rules and resets on away epoch including no intervening line',()=>{
 const engine=rules.createEngine({triggers:[{id:'a',match:'hit',awayCondition:'away',awayOnce:true,sendText:'first'},{id:'b',match:'hit',awayCondition:'away',awayOnce:true,sendText:'second'},{id:'c',match:'hit',awayCondition:'present',sendText:'present'}]});
 const line=context=>engine.processLine('hit',context).actions.map(a=>a.text);
 assert.deepEqual(line({away:true,awayEpoch:1}),['first']);assert.deepEqual(line({away:true,awayEpoch:1}),[]);assert.deepEqual(line({away:true,awayEpoch:3}),['first']);assert.deepEqual(line({away:false,awayEpoch:4}),['present']);
});
test('repeat matches stop on zero-width second hit and children run once',()=>{
 const engine=rules.createEngine({workerEngine:true,allowRegex:true,triggers:[{id:'p',match:'(?=a)',matchType:'regex',oncePerLine:false,sendText:'empty'},{id:'c',parentId:'p',match:'a',sendText:'child'}]});
 assert.deepEqual(engine.processLine('aa').actions.map(a=>a.text),['empty','child']);
 const alias=rules.createEngine({workerEngine:true,allowRegex:true,aliases:[{match:'(?=a)',matchType:'regex',replacement:'X'}]});
 assert.deepEqual(alias.expandCommand('aa').commands,['Xaa']);
 const repeated=rules.createEngine({triggers:[{match:'a',oncePerLine:false,filterText:'',sendText:'hit'}]}).processLine('aaa');
 assert.equal(repeated.text,'');assert.equal(repeated.actions.filter(a=>a.type==='command').length,3);assert.equal(repeated.actions.filter(a=>a.type==='filter').length,3);
});
test('audio uses configured variable paths, speech uses captures or whole line',()=>{
 const engine=rules.createEngine({triggers:[{match:'page *',matchType:'wildcard',sound:{enabled:true,path:'%audio%'},speech:{enabled:true,text:'From \\1'}},{match:'page',speech:{enabled:true,wholeLine:true}}]});
 const result=engine.processLine('page Alice',{variables:{audio:'C:\\sounds\\page.wav'}});
 assert.deepEqual(result.actions.map(a=>[a.type,a.path||a.text]),[['sound','C:\\sounds\\page.wav'],['speech','From Alice'],['speech','page Alice']]);
 const over=rules.createEngine({triggers:[{match:'x',speech:{enabled:true,wholeLine:true}}]}).processLine('x'.repeat(2049));
 assert.equal(over.actions.length,0);assert.match(over.diagnostics[0],/2048/);
});
test('profile persistence retains bounded supported original automation fields',()=>{
 const result=profiles.normalizeSettings({worlds:[{id:'w',name:'World',host:'example.test',port:'23'}],characters:[{id:'c',worldId:'w',name:'Character',variables:{target:'friend'}}],aliases:[{id:'a',match:'hi',replacement:'say %target%',expandVariables:true,phase:'after'}],triggers:[{id:'t',match:'hit',phase:'after',awayCondition:'away',awayOnce:true,oncePerLine:false,sendExpandVariables:true,filterExpandVariables:true,sound:{enabled:true,path:'C:\\sound.wav'},speech:{enabled:true,wholeLine:true,text:'hi'}}]});
 assert.equal(result.characters[0].variables.target,'friend');assert.equal(result.aliases[0].expandVariables,true);assert.equal(result.aliases[0].phase,'after');
 const t=result.triggers[0];assert.equal(t.oncePerLine,false);assert.equal(t.awayCondition,'away');assert.equal(t.awayOnce,true);assert.equal(t.sound.path,'C:\\sound.wav');assert.equal(t.speech.wholeLine,true);
});
console.log(checks+' automation parity checks passed.');
