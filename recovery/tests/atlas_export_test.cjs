'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mapper=require('../ui/mapper.js'),reader=require('../ui/classic-import-core.js'),writer=require('../ui/atlas-export-core.js');
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
const sample=name=>fs.readFileSync(path.join(__dirname,'../../Maps',name));
(async()=>{
 await test('one-way and paired exits survive Atlas ZIP round-trip',async()=>{
  const graph={version:1,name:'A & B',rooms:[{id:'a',title:'Hall <west>',x:0,y:0,rect:[-40,-20,40,20],color:'#ff0000',outlineColor:'#00ff00',textAngle:270,underConstruction:true},{id:'b',title:'Yard',x:100,y:0}],exits:[{id:'ab',from:'a',to:'b',command:'east & enter',atlasPair:'pair1',points:[[20,10],[80,10]]},{id:'ba',from:'b',to:'a',command:'west',atlasPair:'pair1',points:[[80,10],[20,10]]},{id:'bb',from:'b',to:'b',command:'portal'}],currentRoomId:null,backgroundColor:'#112233',exitColor:'#445566'};
  const exported=writer.exportAtlas(graph),result=await reader.readAtlas(exported.bytes),map=mapper.normalize(result.maps[0].graph);
  const view=new DataView(exported.bytes.buffer),end=exported.bytes.length-22,centralSize=view.getUint32(end+12,true),centralOffset=view.getUint32(end+16,true);
  assert.equal(view.getUint32(centralOffset,true),0x02014b50);
  assert.equal(centralOffset+centralSize,end);
  assert.equal(exported.exitRecords,2);assert.equal(result.maps[0].name,'A & B');assert.equal(map.backgroundColor,'#112233');
  assert.equal(map.rooms[0].title,'Hall <west>');assert.deepEqual(map.rooms[0].rect,[-40,-20,40,20]);assert.equal(map.rooms[0].textAngle,270);assert.equal(map.rooms[0].underConstruction,true);
  assert.deepEqual(map.exits.map(({from,to,command})=>[from,to,command]),[['r0','r1','east & enter'],['r1','r0','west'],['r1','r1','portal']]);
  assert.deepEqual(map.exits[0].points,[[20,10],[80,10]]);assert.deepEqual(map.exits[1].points,[[80,10],[20,10]]);
 });
 await test('Fluff sample map layers remain separately selectable; cross-layer links are reported',async()=>{
  const imported=await reader.readAtlas(sample('Fluff.atlas'));assert.equal(imported.maps.length,3);assert.ok(imported.report.skipped['Cross-layer exits']>=2);
  const chosen=imported.maps[1],result=await reader.readAtlas(writer.exportAtlas(chosen.graph).bytes);
  assert.equal(result.maps.length,1);assert.equal(result.maps[0].name,chosen.name);
  assert.equal(result.maps[0].graph.rooms.length,chosen.graph.rooms.length);assert.equal(result.maps[0].graph.exits.length,chosen.graph.exits.length);
 });
 await test('FurryMUCK colors, rectangles, and construction flags survive',async()=>{
  const source=await reader.readAtlas(sample('FurryMUCK.atlas')),map=source.maps[0].graph;
  const restored=(await reader.readAtlas(writer.exportAtlas(map).bytes)).maps[0].graph;
  assert.equal(restored.rooms.length,map.rooms.length);assert.equal(restored.exits.length,map.exits.length);
  assert.equal(restored.rooms.find(x=>x.title==='Jazmyn\'s Puma Pad').underConstruction,true);
  assert.equal(restored.rooms.find(x=>x.title==='North Furry Avenue').outlineColor,'#F717E0');
  assert.deepEqual(restored.rooms[0].rect,map.rooms[0].rect);
 });
 await test('Arx compressed source exports as a valid stored ZIP and retains supported graph',async()=>{
  const source=await reader.readAtlas(sample('Arx_Map_by_Precisi.atlas')),original=source.maps[0].graph;
  const exported=writer.exportAtlas(original),restored=(await reader.readAtlas(exported.bytes)).maps[0].graph;
  assert.equal(exported.bytes[0],0x50);assert.equal(exported.bytes[1],0x4b);
  assert.equal(restored.rooms.length,original.rooms.length);assert.equal(restored.exits.length,original.exits.length);
  assert.ok(exported.bytes.length<writer.MAX_ZIP);
 });
 await test('metadata validation and room edits keep stored coordinates consistent',async()=>{
  const map=mapper.createWorld({version:1,name:'Grid',rooms:[{id:'a',title:'A',x:0,y:0,rect:[-10,-10,10,10]}],exits:[],currentRoomId:null});
  map.editRoom('a',{x:100,y:20});assert.deepEqual(map.rooms()[0].rect,[90,10,110,30]);
  assert.throws(()=>map.addRoom({title:'Bad',x:0,y:0,color:'red'}),/Invalid room/);
  assert.throws(()=>map.addExit({from:'a',to:'a',command:'door',points:[[100001,0]]}),/Invalid exit/);
  assert.deepEqual(mapper.createWorld(map.serialize()).serialize(),map.serialize());
 });
 await test('export rejects oversized XML and does not emit an incomplete archive',async()=>{
  const rooms=Array.from({length:1024},(_,i)=>({id:'r'+i,title:'R'.repeat(160),x:i,y:0}));
  const exits=Array.from({length:4096},(_,i)=>({id:'e'+i,from:'r0',to:'r1',command:'&'.repeat(256),points:Array.from({length:32},(_,j)=>[j,j])}));
  assert.throws(()=>writer.exportAtlas({version:1,rooms,exits,currentRoomId:null}),/4 MiB export limit/);
 });
 console.log(checks+' Atlas export checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
