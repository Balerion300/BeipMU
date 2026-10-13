'use strict';
const assert=require('node:assert/strict'),edits=require('../ui/line-edits.js');
const plan=edits.planEdits('red blue',[{type:'style',start:0,end:3,style:{underline:false}},{type:'delete',start:4,end:8},{type:'insert',at:4,line:{text:'gold',runs:[{text:'gold',style:{color:'#ffff00'}}]}}]);assert.equal(plan.text,'red gold');assert.deepEqual(plan.edits[0].style,{underline:false});
assert.throws(()=>edits.planEdits('a',[{type:'insert',at:1,line:{text:'safe',runs:[{text:'different',style:{}}]}}]),/match/);
assert.throws(()=>edits.planEdits('a',[{type:'delete',start:0,end:2}]),/range/);assert.throws(()=>edits.planEdits('a',[{type:'style',start:0,end:1,style:{onclick:'bad'}}]),/style/);assert.throws(()=>edits.planEdits('a',Array(129).fill({type:'delete',start:0,end:0})),/many/);
console.log('PASS preflight validates sequential ranges, exact snapshots, explicit-off styles and bounded operations');
