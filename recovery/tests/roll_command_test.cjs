/* Matrix observed offline in original BeipMU 4.335; no original code dependencies. */
'use strict';
const assert=require('node:assert/strict'),roll=require('../ui/roll-command.js'),{createPipeline}=require('../ui/command-pipeline.js');
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
check('Original numeric-prefix and bonus syntax matrix',()=>{
 for(const [text,expected]of [['1d1',[1,1,0]],['2d6',[2,6,0]],['2d6+3',[2,6,3]],['2d6tail',[2,6,0]],['2d6+bad',[2,6,0]],['2d6+-1',[2,6,0]],['2junkd1',[2,1,0]],['1d1+9tail',[1,1,9]],['1d1+',[1,1,0]],['1d4294967295',[1,4294967295,0]],['1d1+4294967295',[1,1,4294967295]],['1d1+4294967296',[1,1,0]],['1d1+4294967297',[1,1,0]]]){const p=roll.parse(text);assert.deepEqual([p.count,p.sides,p.bonus],expected,text);}
 for(const text of ['2D6','d6','+2d6','2d+6','2d0','0d6','1001d6','1d4294967296','1d4294967297','4294967297d1','" 2d1"'])assert.equal(roll.parse(text).error,roll.BAD,text);
 for(const text of ['', '1d1 extra'])assert.equal(roll.parse(text).error,roll.MISSING);
});
check('Original fixed/scientific boundary and zero formatting',()=>{for(const [value,text]of [[0,'0'],[1,'1.00'],[100000000,'100000000.00'],[999999936,'999999936.00'],[1e9,'1.00e+9'],[Math.fround(4294967295),'4.29e+9']])assert.equal(roll.formatFloat(value),text);});
check('Known dice results and exact three output lines',()=>{const rolls=[0,5],r=roll.rollRecords(2,6,3,max=>{assert.equal(max,5);return rolls.shift();});assert.deepEqual(roll.lines(r),['🎲 Rolling 2 6-sided dice with a +3 bonus  Min: 5 Max: 15 Ave: 10.00','🎲 Rolled 1 6','🎲 Average roll: 3.50  Roll Total +3: 10']);});
check('Original unsigned wrapping and float32 calculations',()=>{const r=roll.rollRecords(1,1,4294967295,()=>0);assert.deepEqual(roll.lines(r),['🎲 Rolling 1 1-sided dice with a +4294967295 bonus  Min: 0 Max: 0 Ave: 4.29e+9','🎲 Rolled 1','🎲 Average roll: 1.00  Roll Total +4294967295: 0']);const high=roll.rollRecords(1,4294967295,0,()=>1294513353);assert.equal(high.expectedMean,0);assert.equal(roll.formatFloat(high.average),'1.29e+9');});
check('Bounds reject invalid counts/draws without partial output',()=>{for(const args of [[0,6,0],[1001,6,0],[1,0,0],[1,6,-1],[1,6,4294967296]])assert.throws(()=>roll.rollRecords(...args,()=>0),/Invalid/);assert.throws(()=>roll.rollRecords(1,6,0,()=>6),/outside/);assert.equal(roll.rollRecords(1000,1,0,()=>0).rolls.length,1000);});
(async()=>{const a={id:'a',epoch:1},b={id:'b',epoch:1},lines=[],wire=[],hooks=[];let consume=false;const command=roll.createCommand({valid:o=>o===a||o===b,randomInclusive:()=>0,write:(o,text)=>lines.push([o.id,text])});const pipeline=createPipeline({epoch:o=>o.epoch,valid:(o,e)=>o.epoch===e,connected:()=>true,settings:()=>({active:false}),onCommand:(o,text)=>{hooks.push(text);return consume;},internal:(o,text,options,execution)=>command(text,o,execution,options),transport:(o,p)=>wire.push(p.text)});
 await pipeline.submit(a,'/silent/roll 2d1+3');assert.equal(lines.length,3);assert.equal(lines[2][1],'🎲 Average roll: 1.00  Roll Total +3: 5');assert.ok(lines.every(x=>x[0]==='a'));assert.deepEqual(hooks,['silent/roll 2d1+3']);assert.equal(wire.length,0);
 lines.length=0;await pipeline.submit(b,'/roll');assert.deepEqual(lines,[['b',roll.MISSING]]);lines.length=0;consume=true;await pipeline.submit(a,'/roll 1d1');assert.equal(lines.length,0);
 assert.throws(()=>command('/roll 1d1',a,{owner:b,isCurrent:()=>true}),/current/);assert.throws(()=>command('/roll 1d1',a,{owner:a,isCurrent:()=>false}),/current/);assert.equal(command('/quit',a,{}),false);
 console.log('PASS real dispatcher silent feedback, OnCommand interception, local-only output and owner checks');console.log((count+1)+' dice checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
