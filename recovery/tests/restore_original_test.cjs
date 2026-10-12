const assert=require('node:assert/strict'),restore=require('../ui/restore-original.js');
const size=65536,capacity=size-8,epoch=116444736000000000n;
function record(type,payload=[],ticks=epoch){const bytes=new Uint8Array(12+payload.length),view=new DataView(bytes.buffer);bytes[0]=type;bytes[1]=payload.length&255;bytes[2]=(payload.length>>>8)&255;bytes[3]=(payload.length>>>16)&255;view.setBigUint64(4,ticks,true);bytes.set(payload,12);return bytes;}
function slot(records,start=0){const bytes=new Uint8Array(size),view=new DataView(bytes.buffer),data=Uint8Array.from(records.flatMap(item=>Array.from(item)));assert.ok(data.length<=capacity);view.setUint32(0,start,true);view.setUint32(4,data.length,true);for(let at=0;at<data.length;at++)bytes[8+(start+at)%capacity]=data[at];return bytes;}
function parse(bytes,index=0){return restore.parseOriginal(bytes,{bufferKiB:64,indices:[{characterId:'fixture-character',index}]}).characters[0];}
let checks=0;function check(name,test){test();checks++;console.log('PASS '+name);}
check('Exact raw payloads, record order and FILETIME survive a wrapped header and payload',()=>{
 const original=[record(2),record(0,[0x1b,0x5b,0x31,0x6d,0x80,0xff,0,0x0a],epoch+12345n),record(1,[0xe9,0x20,0x41]),record(4,[0x7b,0x22,0x78,0x22,0x7d])];
 for(const start of [0,capacity-6,capacity-15]){const bytes=slot(original,start),unchanged=bytes.slice(),output=parse(bytes);assert.equal(output.complete,true);assert.deepEqual(output.records.map(item=>item.kind),['start','received','sent','gmcp']);assert.deepEqual([...output.records[1].payload],[0x1b,0x5b,0x31,0x6d,0x80,0xff,0,0x0a]);assert.equal(output.records[1].fileTime,(epoch+12345n).toString());assert.equal(output.records[1].timeMs,1);assert.deepEqual(bytes,unchanged);output.records[1].payload[0]=99;assert.deepEqual(bytes,unchanged);}
});
check('Metadata explicitly chooses slots and supports -1 without inventing ownership',()=>{
 const bytes=new Uint8Array(size*2);bytes.set(slot([record(0,[65])]));bytes.set(slot([record(0,[66])]),size);
 const decoded=restore.parseOriginal(bytes,{bufferKiB:64,indices:[{characterId:'second',index:1},{characterId:'no-log',index:-1}]});assert.equal(decoded.characters[0].records[0].payload[0],66);assert.deepEqual(decoded.characters[1].records,[]);assert.equal(decoded.warnings[0].code,'unmapped-slots');
 const duplicate=restore.parseOriginal(bytes,{bufferKiB:64,indices:[{characterId:'a',index:0},{characterId:'b',index:0}]});assert.ok(duplicate.characters.every(item=>!item.complete&&item.records.length===0&&item.warnings[0].code==='duplicate-index'));
 assert.equal(parse(bytes,2).warnings[0].code,'missing-slot');
});
check('Invalid slot/header/type/payload bounds preserve a valid prefix without modifying input',()=>{
 for(const [field,value] of [[0,capacity],[4,capacity+1]]){const bytes=slot([]);new DataView(bytes.buffer).setUint32(field,value,true);assert.equal(parse(bytes).warnings[0].code,'invalid-ring-bounds');}
 const short=slot([record(0,[65])]);new DataView(short.buffer).setUint32(4,14,true);assert.equal(parse(short).warnings[0].code,'truncated-header');assert.equal(parse(short).records.length,1);
 const long=slot([record(0,[65]),record(0,[66])]);long[8+13+1]=20;const output=parse(long);assert.equal(output.records.length,1);assert.equal(output.warnings[0].code,'truncated-payload');
 for(const [type,code] of [[3,'unexpected-end-marker'],[255,'unknown-record-type']])assert.equal(parse(slot([record(type)])).warnings[0].code,code);
 assert.equal(parse(slot([record(2,[0])])).warnings[0].code,'invalid-start-record');
 const partial=new Uint8Array(size+1);partial.set(slot([record(0,[67])]));const salvage=restore.parseOriginal(partial,{bufferKiB:64,indices:[{characterId:'a',index:0}]});assert.equal(salvage.warnings[0].code,'partial-slot');assert.equal(salvage.characters[0].records[0].payload[0],67);
});
check('FILETIME before Unix epoch and maximum uint64 retain exact precision',()=>{
 const output=parse(slot([record(0,[],epoch-1n),record(0,[],0n),record(0,[],0xffffffffffffffffn)]));assert.equal(output.records[0].timeMs,-1);assert.equal(output.records[1].timeMs,-11644473600000);assert.equal(output.records[2].fileTime,'18446744073709551615');assert.ok(Number.isSafeInteger(output.records[2].timeMs));
});
check('Input byte offsets and 24-bit lengths are honored; metadata mistakes are rejected',()=>{
 const payload=new Uint8Array(66000);payload[65536]=123;const big=new Uint8Array(size*2),view=new DataView(big.buffer);view.setUint32(4,12+payload.length,true);big.set(record(0,payload),8);const decoded=restore.parseOriginal(big,{bufferKiB:128,indices:[{characterId:'large',index:0}]});assert.equal(decoded.characters[0].records[0].payload.length,66000);assert.equal(decoded.characters[0].records[0].payload[65536],123);
 const padded=new Uint8Array(size+8);padded.set(slot([record(0,[90])]),4);assert.equal(parse(padded.subarray(4,4+size)).records[0].payload[0],90);
 for(const bufferKiB of [undefined,0,63,65,64.5])assert.throws(()=>restore.parseOriginal(new Uint8Array(),{bufferKiB,indices:[]}));
 for(const indices of [undefined,[{characterId:'a',index:0.5}],[{characterId:'a',index:-2}],[{characterId:'a',index:0},{characterId:'a',index:1}]])assert.throws(()=>restore.parseOriginal(new Uint8Array(),{bufferKiB:64,indices}));
});
console.log(checks+' original restore parser checks passed.');
