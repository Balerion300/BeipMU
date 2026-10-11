const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createEngine}=require('../ui/rules.js');
const {Runtime,DEADLINE_MS}=require('../ui/regex-rules.js');
let passed=0;
async function check(name,fn){await fn();console.log('PASS '+name);passed++;}
const scope={serverId:'w1',characterId:'c1'};
class FakeWorker{
 constructor(){this.terminated=false;}
 postMessage(job){
  if(job.type==='start'){this.engine=createEngine({aliases:job.aliases,triggers:job.triggers,allowRegex:true,workerEngine:true});queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));return;}
  queueMicrotask(()=>{if(this.terminated)return;const result=job.type==='expand'?this.engine.expandCommand(job.value,job.scope):this.engine.processLine(job.value,job.scope,job.nowMs);this.onmessage?.({data:{id:job.id,result}});});
 }
 terminate(){this.terminated=true;}
}
class NeverWorker extends FakeWorker{
 postMessage(job){if(job.type==='start')super.postMessage(job);}
}
async function main(){
 await check('Synchronous engine does not opt into regex execution',()=>{
  const alias={id:'r',match:'^go (.*)$',matchType:'regex',replacement:'north \\1'};
  assert.deepEqual(createEngine({aliases:[alias],allowRegex:true}).expandCommand('go east',scope).commands,['go east']);
  assert.deepEqual(createEngine({aliases:[alias],workerEngine:true}).expandCommand('go east',scope).commands,['go east']);
 });
 await check('Worker engine preserves global, world, character order and regex captures',()=>{
  const aliases=[
   {id:'character',scope:{level:'character',serverId:'w1',characterId:'c1'},match:'^n (.*)$',matchType:'regex',replacement:'walk \\1'},
   {id:'global',scope:{level:'global'},match:'^go (.*)$',matchType:'regex',replacement:'north \\1'},
   {id:'world',scope:{level:'server',serverId:'w1'},match:'north',replacement:'n'}
  ];
  const engine=createEngine({aliases,allowRegex:true,workerEngine:true});
  assert.deepEqual(engine.expandCommand('go east',scope).commands,['walk east']);
 });
 await check('Regex triggers return original numbered captures and actions',()=>{
  const engine=createEngine({triggers:[{id:'page',match:'^(\\w+) pages, (.*)$',matchType:'regex',scope:{level:'global'},sendText:'page \\1=\\2',notify:true}],allowRegex:true,workerEngine:true});
  const result=engine.processLine('Arya pages, hello',scope);
  assert.deepEqual(result.matches[0].captures,['Arya pages, hello','Arya','hello']);
  assert.equal(result.actions[0].text,'page Arya=hello');
 });
 await check('Bad regex is reported and skipped without suppressing later rules',()=>{
  const engine=createEngine({triggers:[{id:'bad',match:'(',matchType:'regex',notify:true},{id:'good',match:'hit',notify:true}],allowRegex:true,workerEngine:true});
  const result=engine.processLine('hit',scope);
  assert.deepEqual(result.actions.map(a=>a.type),['notification']);
  assert.ok(result.diagnostics.some(d=>d.includes('Invalid regex in rule bad')));
 });
 await check('Worker entry point imports rules and returns correlated results',()=>{
  const replies=[],context=vm.createContext({postMessage:message=>replies.push(message)});
  context.self=context;
  context.importScripts=name=>{assert.equal(name,'rules.js');vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/rules.js'),'utf8'),context);};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/rules-worker.js'),'utf8'),context);
  context.onmessage({data:{type:'start',aliases:[{match:'^look$',matchType:'regex',replacement:'examine'}],triggers:[]}});
  context.onmessage({data:{id:7,type:'expand',value:'look',scope}});
  assert.equal(replies[0].type,'ready');
  assert.equal(replies[1].id,7);
  assert.deepEqual(Array.from(replies[1].result.commands),['examine']);
 });
 await check('Runtime jobs are asynchronous and keep rule engine state',async()=>{
  const errors=[],runtime=new Runtime(e=>errors.push(e),FakeWorker);
  runtime.start({triggers:[{id:'once',match:'^hit$',matchType:'regex',notify:true,once:true}]});
  const first=await runtime.processLine('hit',scope,1000),second=await runtime.processLine('hit',scope,2000);
  assert.equal(first.actions.length,1);assert.equal(second.actions.length,0);
  assert.deepEqual(errors,[]);runtime.stop();
 });
 await check('Invalid regex diagnostics surface once while worker keeps running',async()=>{
  const errors=[],runtime=new Runtime(e=>errors.push(e),FakeWorker);
  runtime.start({triggers:[{id:'bad',match:'(',matchType:'regex',notify:true},{id:'good',match:'ok',notify:true}]});
  const a=await runtime.processLine('ok',scope),b=await runtime.processLine('ok',scope);
  assert.equal(a.actions.length,1);assert.equal(b.actions.length,1);
  assert.deepEqual(errors,['Invalid regex in rule bad.']);runtime.stop();
 });
 await check('A stalled worker is terminated and queued work resolves safely',async()=>{
  const errors=[],runtime=new Runtime(e=>errors.push(e),NeverWorker,{timeoutMs:20});
  runtime.start({aliases:[{match:'x',replacement:'y'}]});
  const command=runtime.expandCommand('x',scope),line=runtime.processLine('hello',scope);
  const [a,b]=await Promise.all([command,line]);
  assert.deepEqual(a.commands,[]);assert.equal(b.text,'hello');assert.equal(b.actions.length,0);
  assert.ok(errors[0].includes('pattern exceeded'));assert.equal(runtime.worker,null);
 });
 await check('Catastrophic regex exceeds an isolated VM deadline',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../ui/rules.js'),'utf8');
  const run=source+'\nconst engine=BeipRules.createEngine({triggers:[{id:"slow",match:"(a+)+$",matchType:"regex",notify:true}],allowRegex:true,workerEngine:true});engine.processLine("a".repeat(1200)+"!",{});';
  assert.throws(()=>vm.runInNewContext(run,{}, {timeout:50}),/Script execution timed out/);
  assert.equal(DEADLINE_MS,500);
 });
 console.log(passed+' regex rule checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
