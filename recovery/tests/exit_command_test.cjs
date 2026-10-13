'use strict';
const assert=require('node:assert/strict'),Exit=require('../ui/exit-command.js');
function bridge(){const listeners=new Set(),sent=[];return {sent,listeners,addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn),postMessage:text=>sent.push(text),emit:data=>{for(const fn of listeners)fn({data});}};}
(async()=>{
 let b=bridge(),valid=true,saved=false,requestId;
 let work=Exit.run({bridge:b,valid:()=>valid,save:id=>{saved=true;requestId=id;}});
 assert(saved);assert.deepEqual(b.sent,[]);b.emit('settings:saved');await Promise.resolve();assert.deepEqual(b.sent,[]);
 b.emit('exit:saved:'+requestId);await work;assert.deepEqual(b.sent,['window:exit']);assert.equal(b.listeners.size,0);
 b=bridge();work=Exit.run({bridge:b,valid:()=>true,save:id=>{requestId=id;}});b.emit('exit:error:'+requestId+':Write failed');await assert.rejects(work,/Write failed/);assert.deepEqual(b.sent,[]);assert.equal(b.listeners.size,0);
 b=bridge();valid=true;work=Exit.run({bridge:b,valid:()=>valid,save:id=>{requestId=id;}});valid=false;b.emit('exit:saved:'+requestId);await assert.rejects(work,/owner/);assert.deepEqual(b.sent,[]);
 b=bridge();await assert.rejects(Exit.run({bridge:b,valid:()=>false,save:()=>assert.fail('stale save')}),/owner/);assert.equal(b.listeners.size,0);
 b=bridge();await assert.rejects(Exit.run({bridge:b,valid:()=>true,save:id=>{requestId=id;},timeoutMs:10}),/timed out/);assert.deepEqual(b.sent,[]);assert.equal(b.listeners.size,0);
 b=bridge();work=Exit.run({bridge:b,valid:()=>true,save:id=>{requestId=id;}});await assert.rejects(Exit.run({bridge:b,valid:()=>true,save:()=>assert.fail('duplicate save')}),/already/);b.emit('exit:saved:'+requestId);await work;
 b=bridge();await assert.rejects(Exit.run({bridge:b,valid:()=>true,save:()=>{throw Error('serialize failed');}}),/serialize/);assert.deepEqual(b.sent,[]);assert.equal(b.listeners.size,0);
 const oldId=requestId;b=bridge();await assert.rejects(Exit.run({bridge:b,valid:()=>true,save:id=>{requestId=id;},timeoutMs:10}),/timed out/);const expiredId=requestId;
 work=Exit.run({bridge:b,valid:()=>true,save:id=>{requestId=id;}});b.emit('exit:saved:'+expiredId);b.emit('exit:saved:'+oldId);await Promise.resolve();assert.deepEqual(b.sent,[]);b.emit('exit:saved:'+requestId);await work;assert.deepEqual(b.sent,['window:exit']);
 console.log('PASS exit save acknowledgement/order, failure, stale owner, timeout, duplicate request and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
