const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {Runtime,contextOf,validEffect}=require('../ui/scripts.js');
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
function worker(){
 const results=[],context=vm.createContext({postMessage:value=>results.push(value)});context.self=context;
 vm.runInContext(fs.readFileSync(require.resolve('../ui/script-worker.js'),'utf8'),context);
 let id=0;
 return {context,run:async(type,value,extra={})=>{
  context.onmessage({data:{id:++id,type,value,...extra}});
  for(let i=0;i<4&&!results.length;i++)await Promise.resolve();
  assert.ok(results.length,'worker did not answer '+type);
  return results.pop();
 }};
}
function fakeTimers(){
 const jobs=new Map();let id=0;
 return {jobs,setTimer(fn,ms){const key=++id;jobs.set(key,{fn,ms});return key;},clearTimer(key){jobs.delete(key);},fire(key){const job=jobs.get(key);assert.ok(job);jobs.delete(key);job.fn();}};
}
(async()=>{
 await test('Original output/send API and persistent functions',async()=>{
  const w=worker();assert.equal((await w.run('eval','function greet(){window.output.write("Hello");} greet();')).effects[0].value,'Hello');
  assert.equal((await w.run('eval','greet();window.connection.send("look");')).effects[1].value,'look');
 });
 await test('Receive hook gets userdata and may suppress original line',async()=>{
  const w=worker();await w.run('eval','window.connection.SetOnReceive(function(text,data){data.output.write("Seen: "+text);return true;}, window);');
  const result=await w.run('line','hello');assert.equal(result.handled,true);assert.deepEqual(Array.from(result.effects,x=>x.value),['Seen: hello']);
 });
 await test('Documented receive display example replaces source line',async()=>{
  const w=worker();await w.run('eval','window.connection.SetOnReceive(function(text,win){win.connection.display("<Trigger>"+text);return true;},window);');
  const result=await w.run('line','Hello');assert.equal(result.handled,true);assert.equal(result.effects[0].type,'display');assert.equal(result.effects[0].value,'<Trigger>Hello');
 });
 await test('Send hook can handle a client command while Transmit bypasses it',async()=>{
  const w=worker();await w.run('eval','window.connection.SetOnSend(function(text,win){if(text==="@@practice"){win.output.write("Handled");return true;}return false;},window);');
  const handled=await w.run('send','@@practice'),normal=await w.run('send','look');
  assert.equal(handled.handled,true);assert.equal(handled.effects[0].value,'Handled');assert.equal(normal.handled,false);
  const direct=await w.run('eval','window.connection.Transmit("raw");window.connection.Send("@@practice");');
  assert.deepEqual(Array.from(direct.effects,x=>x.type),['send','output']);
 });
 await test('GMCP hook receives documented raw package string and userdata',async()=>{
  const w=worker();await w.run('eval','window.connection.SetOnGMCP(function(raw,win){let at=raw.indexOf(" ");win.output.write(raw.slice(0,at)+":"+JSON.parse(raw.slice(at+1)).hp);},window);');
  assert.equal((await w.run('gmcp','Char.Vitals {"hp":50}')).effects[0].value,'Char.Vitals:50');
 });
 await test('Recovery client.on GMCP helper retains parsed callback',async()=>{
  const w=worker();await w.run('eval','client.on("gmcp",function(name,data){client.write(name+":"+data.hp);});');
  assert.equal((await w.run('gmcp','Char.Vitals {"hp":42}')).effects[0].value,'Char.Vitals:42');
 });
 await test('Connect/disconnect hooks see session context and userdata',async()=>{
  const w=worker();await w.run('eval','window.connection.SetOnConnect(function(win){win.output.write(String(win.connection.IsConnected())+":"+win.connection.Character.name);},window);window.connection.SetOnDisconnect(function(win){win.output.write(String(win.connection.IsConnected()));},window);');
  const context={connected:true,character:{id:'c1',name:'Aria'}};
  assert.equal((await w.run('connect','',{context})).effects[0].value,'true:Aria');
  assert.equal((await w.run('disconnect','',{context:{connected:false}})).effects[0].value,'false');
 });
 await test('App world collection and window userdata remain session-local',async()=>{
  const w=worker(),context={world:{id:'w1',name:'Harbor'},worlds:[{id:'w1',name:'Harbor'},{id:'w2',name:'Woods'}],buildNumber:600};
  const first=await w.run('eval','window.UserData={n:7};window.output.write(app.Worlds.Count+":"+app.Worlds(1).name+":"+app.BuildNumber);',{context});
  assert.equal(first.effects[0].value,'2:Woods:600');
  assert.equal((await w.run('eval','window.output.write(window.UserData.n+":"+window.connection.World.name);',{context})).effects[0].value,'7:Harbor');
  assert.equal((await worker().run('eval','window.output.write(String(window.UserData));')).effects[0].value,'null');
 });
 await test('Original trigger callback can read line and capture ranges',async()=>{
  const w=worker();await w.run('eval','function ShowText(win,line,ranges){win.output.write(line.string.slice(ranges(2),ranges(3))+":"+ranges.Count);}');
  const result=await w.run('trigger',{name:'ShowText',text:'foo one',ranges:[0,7,4,7]});
  assert.equal(result.effects[0].value,'one:4');
 });
 await test('App timers carry userdata, repeat, and stop on true',async()=>{
  const w=worker();const init=await w.run('eval','var once=app.CreateTimeout(100,function(data){window.output.write("once:"+data);},"A");var repeat=app.CreateInterval(200,function(data){window.output.write("repeat:"+data);return true;},"B");');
  assert.deepEqual(Array.from(init.effects,x=>[x.type,x.delay,x.repeat]),[['timer-start',100,false],['timer-start',200,true]]);
  assert.equal((await w.run('timer',init.effects[0].id)).effects[0].value,'once:A');
  const repeat=await w.run('timer',init.effects[1].id);
  assert.deepEqual(Array.from(repeat.effects,x=>x.type),['output','timer-stop']);
  assert.equal((await w.run('timer',init.effects[1].id)).effects.length,0);
 });
 await test('Worker blocks native networking, timers, DOM and direct messaging',async()=>{
  const w=worker(),result=await w.run('eval','window.output.write([typeof fetch,typeof WebSocket,typeof importScripts,typeof Worker,typeof setTimeout,typeof document,typeof postMessage].join(","));');
  assert.equal(result.effects[0].value,'undefined,undefined,undefined,undefined,undefined,undefined,undefined');
 });
 await test('Action overflow and thrown exceptions drop partial effects',async()=>{
  const w=worker();const overflow=await w.run('eval','for(let i=0;i<33;i++)window.connection.Transmit("look");');
  assert.match(overflow.error,/limit/);assert.equal(overflow.effects.length,0);
  const thrown=await w.run('eval','window.connection.Transmit("look");throw Error("Oops");');
  assert.equal(thrown.error,'Oops');assert.equal(thrown.effects.length,0);
 });
 await test('Runtime invokes browser host timers with their global receiver',async()=>{
  class Fake{postMessage(value){this.last=value;}terminate(){this.dead=true;}}
  const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout,calls=[];
  globalThis.setTimeout=function(callback,delay){assert.equal(this,globalThis);calls.push(['set',delay]);return 42;};
  globalThis.clearTimeout=function(handle){assert.equal(this,globalThis);calls.push(['clear',handle]);};
  try{
   const runtime=new Runtime(()=>{},()=>{},Fake),pending=runtime.start('window.output.write("ready")');
   const worker=runtime.worker;runtime.result({id:worker.last.id,effects:[]});await pending;runtime.stop();
   assert.ok(calls.some(([kind,delay])=>kind==='set'&&delay===1000));
   assert.ok(calls.some(([kind,handle])=>kind==='clear'&&handle===42));
  }finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
 });
 await test('Runtime filters unknown effects and resolves handled event',async()=>{
  class Fake{postMessage(value){this.last=value;}terminate(){this.dead=true;}}
  const seen=[],errors=[],runtime=new Runtime(effects=>seen.push(effects),error=>errors.push(error),Fake);
  const start=runtime.start('window.output.write("ready")',{sessionId:'alpha'}),instance=runtime.worker;
  runtime.result({id:999,effects:[{type:'send',value:'forged'}]});assert.equal(seen.length,0);
  runtime.result({id:instance.last.id,effects:[{type:'output',value:'ready'},{type:'file',value:'bad'}]});await start;
  const pending=runtime.dispatch('line','hello',{sessionId:'alpha'});runtime.result({id:instance.last.id,effects:[{type:'display',value:'Hello'}],handled:true});
  assert.equal((await pending).handled,true);assert.equal(seen.length,2);assert.equal(seen[1][0].type,'display');assert.equal(errors.length,0);
  runtime.stop();assert.equal(instance.dead,true);
 });
 await test('Runtime timer is session-owned and cleared on stop',async()=>{
  class Fake{postMessage(value){this.last=value;}terminate(){this.dead=true;}}
  const clock=fakeTimers(),seen=[];const runtime=new Runtime(effects=>seen.push(effects),()=>{},Fake,clock);
  const start=runtime.start('app.CreateTimeout(100,()=>{})',{sessionId:'alpha'}),instance=runtime.worker;
  runtime.result({id:instance.last.id,effects:[{type:'timer-start',id:1,delay:100,repeat:false}]});await start;
  const timerJob=[...clock.jobs.entries()].find(([,job])=>job.ms===100);assert.ok(timerJob);clock.fire(timerJob[0]);
  assert.equal(instance.last.type,'timer');runtime.result({id:instance.last.id,effects:[{type:'output',value:'fired'}]});assert.equal(seen[0][0].value,'fired');
  const pending=runtime.dispatch('send','look');runtime.stop();assert.equal((await pending).handled,false);assert.equal(clock.jobs.size,0);
 });
 await test('Repeating timer stops when callback requests Kill',async()=>{
  class Fake{postMessage(value){this.last=value;}terminate(){this.dead=true;}}
  const clock=fakeTimers(),runtime=new Runtime(()=>{},()=>{},Fake,clock),start=runtime.start('startup'),instance=runtime.worker;
  runtime.result({id:instance.last.id,effects:[{type:'timer-start',id:8,delay:100,repeat:true}]});await start;
  const timerJob=[...clock.jobs.entries()].find(([,job])=>job.ms===100);clock.fire(timerJob[0]);
  runtime.result({id:instance.last.id,effects:[{type:'timer-stop',id:8}]});await Promise.resolve();
  assert.equal(runtime.timers.size,0);assert.equal(clock.jobs.size,0);runtime.stop();
 });
 await test('Context and effects are allowlisted',async()=>{
  const safe=contextOf({sessionId:'alpha',world:{id:'w',name:'World',password:'secret'},worlds:[{id:'w',name:'World'}],token:'secret'});
  assert.equal(safe.world.name,'World');assert.equal('password' in safe.world,false);assert.equal('token' in safe,false);
  assert.equal(validEffect({type:'send',value:'look'}).value,'look');assert.equal(validEffect({type:'send',value:'one\ntwo'}),null);assert.equal(validEffect({type:'file',value:'bad'}),null);
 });
 await test('Worker startup failure and event timeout fail closed',async()=>{
  class Broken{constructor(){throw Error('Unavailable');}}
  const errors=[],bad=new Runtime(()=>{},error=>errors.push(error),Broken);
  await bad.start('window.output.write(1)');assert.equal(bad.enabled,false);assert.match(errors[0],/Unavailable/);
  class Fake{postMessage(value){this.last=value;}terminate(){this.dead=true;}}
  const clock=fakeTimers(),slow=new Runtime(()=>{},error=>errors.push(error),Fake,clock);
  const pending=slow.start('while(true){}'),instance=slow.worker;
  const watchdog=[...clock.jobs.entries()].find(([,job])=>job.ms===1000);clock.fire(watchdog[0]);
  assert.equal((await pending).handled,false);assert.equal(slow.enabled,false);assert.equal(instance.dead,true);assert.match(errors.at(-1),/execution time limit/);
 });
 console.log(`${checks} scripting checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
