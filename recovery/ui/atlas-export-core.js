/* Bounded, single-map Atlas.xml writer and ZIP container. MIT. */
(function(root,factory){const api=factory(root.BeipMapper||(typeof require==='function'?require('./mapper.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipAtlasExportCore=api;})(typeof globalThis==='object'?globalThis:this,function(mapper){
'use strict';
const MAX_ZIP=4*1024*1024,encoder=new TextEncoder();
function xml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function attr(name,value){return ' '+name+'="'+xml(value)+'"';}
function rect(room){if(room.rect)return room.rect;return [Math.max(-100000,room.x-50),Math.max(-100000,room.y-30),Math.min(100000,room.x+50),Math.min(100000,room.y+30)];}
function exitPoints(exit){return exit.points?.length?attr('points',exit.points.map(point=>point.join(',')).join('|')):'';}
function atlasXml(input,name){
 if(!mapper)throw new Error('Map support is unavailable.');
 const map=mapper.normalize(input),title=(name||map.name||'Map').trim();
 if(!title||title.length>80||/[\u0000-\u001f]/.test(title))throw new Error('Invalid Atlas map name.');
 const rootAttrs=(map.backgroundColor?attr('color_background',map.backgroundColor):'')+(map.exitColor?attr('color_exit',map.exitColor):'');
 const lines=['<?xml version="1.0" encoding="UTF-8"?>','<atlas version="1"'+rootAttrs+'>','<map'+attr('name',title)+'>'];
 const index=new Map(map.rooms.map((room,i)=>[room.id,i]));
 for(const room of map.rooms){
  let row='<room'+attr('name',room.title)+attr('rect',rect(room).join(','));
  if(room.color)row+=attr('color',room.color);
  if(room.outlineColor)row+=attr('color_outline',room.outlineColor);
  if(room.textAngle!==undefined)row+=attr('text_angle',room.textAngle);
  if(room.underConstruction)row+=attr('under_construction','t');
  lines.push(row+'/>');
 }
 const paired=new Map();for(const exit of map.exits)if(exit.atlasPair){const list=paired.get(exit.atlasPair)||[];list.push(exit);paired.set(exit.atlasPair,list);}
 const used=new Set();let records=0;
 for(const exit of map.exits){
  if(used.has(exit.id))continue;
  const group=paired.get(exit.atlasPair)||[];
  const back=group.length===2&&group[0]!==group[1]&&group[0].from===group[1].to&&group[0].to===group[1].from?group.find(x=>x.id!==exit.id):null;
  let row='<exit'+attr('from',index.get(exit.from))+attr('to',index.get(exit.to))+attr('name_from',exit.command);
  if(back){row+=attr('name_to',back.command);used.add(back.id);}
  row+=exitPoints(exit);
  lines.push(row+'/>');used.add(exit.id);records++;
 }
 lines.push('</map>','</atlas>','');
 const source=lines.join('\n');
 if(encoder.encode(source).length>MAX_ZIP-256)throw new Error('Atlas XML exceeds the 4 MiB export limit.');
 return {xml:source,rooms:map.rooms.length,directions:map.exits.length,exitRecords:records,name:title};
}
function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=crc>>>1^(crc&1?0xedb88320:0);}return (crc^-1)>>>0;}
function zipAtlas(source){const body=encoder.encode(source),name=encoder.encode('Atlas.xml'),localSize=30+name.length,centralSize=46+name.length,total=localSize+body.length+centralSize+22;if(total>MAX_ZIP)throw new Error('Atlas ZIP exceeds the 4 MiB export limit.');const bytes=new Uint8Array(total),view=new DataView(bytes.buffer),checksum=crc32(body);let at=0;
 const u16=value=>{view.setUint16(at,value,true);at+=2;},u32=value=>{view.setUint32(at,value,true);at+=4;};
 u32(0x04034b50);u16(20);u16(0);u16(0);u16(0);u16(0);u32(checksum);u32(body.length);u32(body.length);u16(name.length);u16(0);bytes.set(name,at);at+=name.length;bytes.set(body,at);at+=body.length;
 const central=at;u32(0x02014b50);u16(20);u16(20);u16(0);u16(0);u16(0);u16(0);u32(checksum);u32(body.length);u32(body.length);u16(name.length);u16(0);u16(0);u16(0);u16(0);u32(0);u32(0);bytes.set(name,at);at+=name.length;
 const centralLength=at-central;
 u32(0x06054b50);u16(0);u16(0);u16(1);u16(1);u32(centralLength);u32(central);u16(0);
 return bytes;
}
function exportAtlas(map,name){const result=atlasXml(map,name);return {...result,bytes:zipAtlas(result.xml)};}
return {atlasXml,zipAtlas,exportAtlas,MAX_ZIP};
});
