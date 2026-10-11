const assert=require('node:assert/strict');
const {words,duration,createScheduler,pasteLines}=require('../ui/client-commands.js');
let checks=0;function check(name,fn){fn();checks++;}
check('quoted arguments preserve spaces',()=>assert.deepEqual(words('every 2s "say hello"'),['every','2s','say hello']));
check('single and backtick quotes',()=>assert.deepEqual(words("'hello world' `a b`"),['hello world','a b']));
check('unterminated quotes rejected',()=>assert.throws(()=>words('"bad')));
check('fractional minutes',()=>assert.equal(duration('3.5m'),210000));
check('random range lower bound',()=>assert.equal(duration('1-5s',()=>0),1000));
check('random range upper bound',()=>assert.equal(duration('1-5s',()=>1),5000));
check('reversed range rejected',()=>assert.throws(()=>duration('5-1s')));
check('zero repeat rejected',()=>assert.throws(()=>duration('0s')));
check('excessive delay rejected',()=>assert.throws(()=>duration('25h')));
check('paste normalizes CRLF and trailing newline',()=>assert.deepEqual(pasteLines('a\r\nb\r\n','say ','!'),['say a!','say b!']));
check('paste preserves empty interior lines',()=>assert.deepEqual(pasteLines('a\n\nb'),['a','','b']));
check('paste command byte cap',()=>assert.throws(()=>pasteLines('☃'.repeat(3000))));
check('paste line cap',()=>assert.throws(()=>pasteLines(Array(501).fill('x').join('\n'))));
check('paste prefix cannot create commands',()=>assert.throws(()=>pasteLines('a','x\n')));
function fixture(){const pending=new Map(),sent=[],reports=[],alive=new Set(['a','b']);let time=0,next=1;const scheduler=createScheduler({setTimer:(fn,ms)=>{const id=next++;pending.set(id,{fn,ms});return id;},clearTimer:id=>pending.delete(id),now:()=>time,random:()=>0,isAlive:id=>alive.has(id),execute:(id,value)=>sent.push([id,value]),report:(id,value)=>reports.push([id,value])});return {scheduler,pending,sent,reports,alive,fire(){const [id,job]=pending.entries().next().value;pending.delete(id);time+=job.ms;job.fn();}};}
check('timer stays bound to originating session',()=>{const f=fixture();f.scheduler.add('a','1s','WHO');f.fire();assert.deepEqual(f.sent,[['a','WHO']]);assert.equal(f.scheduler.list().length,0);});
check('repeating timer rearms until canceled',()=>{const f=fixture(),id=f.scheduler.add('a','1s','WHO',true);f.fire();f.fire();assert.equal(f.sent.length,2);assert.equal(f.pending.size,1);f.scheduler.cancel(id);assert.equal(f.pending.size,0);});
check('disconnected session does not receive delayed commands',()=>{const f=fixture();f.scheduler.add('a','1s','WHO');f.alive.delete('a');f.fire();assert.equal(f.sent.length,0);assert.equal(f.reports.length,1);});
check('closing one session keeps other timers',()=>{const f=fixture();f.scheduler.add('a','1s','WHO');f.scheduler.add('b','1s','LOOK');f.scheduler.cancelSession('a');f.fire();assert.deepEqual(f.sent,[['b','LOOK']]);});
check('nested timer creation rejected',()=>assert.throws(()=>fixture().scheduler.add('a','1s','/delay 1s WHO')));
check('multiline timer commands rejected',()=>assert.throws(()=>fixture().scheduler.add('a','1s','one\ntwo')));
check('timer count bounded',()=>{const f=fixture();for(let i=0;i<64;i++)f.scheduler.add('a','1s','WHO');assert.throws(()=>f.scheduler.add('b','1s','LOOK'));});
console.log(`${checks} client command checks passed.`);
