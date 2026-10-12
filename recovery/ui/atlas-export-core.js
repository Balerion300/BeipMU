/* Bounded, single-map Atlas.xml writer and ZIP container. MIT. */
(function(root,factory){const api=factory(root.BeipMapper||(typeof require==='function'?require('./mapper.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipAtlasExportCore=api;})(typeof globalThis==='object'?globalThis:this,function(mapper){
'use strict';
const MAX_ZIP=4*1024*1024,encoder=new TextEncoder();
function xml(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/\r/g,'&#13;').replace(/\n/g,'&#10;').replace(/\t/g,'&#9;');}
function attr(name,value){return ' '+name+'="'+xml(value)+'"';}
function rect(room){if(room.rect)return room.rect;return [Math.max(-100000,room.x-50),Math.max(-100000,room.y-30),Math.min(100000,room.x+50),Math.min(100000,room.y+30)];}
function exitPoints(exit){return exit.points?.length?attr('points',exit.points.map(point=>point.join(',')).join('|')):'';}
function atlasXml(input,name){
 if(!mapper)throw new Error('Map support is unavailable.');
 const map=mapper.normalize(input),title=(name||map.name||map.layers?.[0]?.name||'Map').trim();if(!title||title.length>80||/[\u0000-\u001f]/.test(title))throw new Error('Invalid Atlas map name.');
 const layers=map.layers||[{id:'layer0',name:title}],layerIndex=new Map(layers.map((layer,i)=>[layer.id,i])),rooms=new Map(map.rooms.map(room=>[room.id,room]));
 const layerOf=room=>room.layerId||layers[0].id,objects=new Map(layers.map(layer=>[layer.id,[]])),far=[],paired=new Map(),used=new Set();
 for(const room of map.rooms)objects.get(layerOf(room)).push({kind:'room',value:room});
 for(const item of map.drawings||[])objects.get(item.layerId).push({kind:'rectangle',value:item});
 for(const exit of map.exits)if(exit.atlasPair){const group=paired.get(exit.atlasPair)||[];group.push(exit);paired.set(exit.atlasPair,group);}
 let records=0;
 for(const exit of map.exits){if(used.has(exit.id))continue;const group=paired.get(exit.atlasPair)||[],back=group.length===2?group.find(other=>other!==exit&&other.from===exit.to&&other.to===exit.from):null;const value={...exit,nameFrom:exit.command,...(back?{nameTo:back.command}:{})};used.add(exit.id);if(back)used.add(back.id);const record={kind:'exit',value};if(layerOf(rooms.get(exit.from))===layerOf(rooms.get(exit.to)))objects.get(layerOf(rooms.get(exit.from))).push(record);else far.push(record);records++;}
 for(const value of map.visualExits||[]){const record={kind:'exit',value};if(!value.to||layerOf(rooms.get(value.from))===layerOf(rooms.get(value.to)))objects.get(layerOf(rooms.get(value.from))).push(record);else far.push(record);records++;}
 const indices=new Map();for(const list of objects.values()){list.sort((a,b)=>(a.value.order??100001)-(b.value.order??100001));list.forEach((item,index)=>{if(item.kind==='room')indices.set(item.value.id,index);});}
 const rootAttrs=(map.backgroundColor?attr('color_background',map.backgroundColor):'')+(map.exitColor?attr('color_exit',map.exitColor):''),lines=['<?xml version="1.0" encoding="UTF-8"?>','<atlas version="2"'+rootAttrs+'>'];
 for(const kind of ['rooms','exits','labels'])if(map.fonts?.[kind])lines.push('<font_'+kind+attr('name',map.fonts[kind].name)+attr('size',map.fonts[kind].size)+'/>');
 function render(item,cross=false){const value=item.value;if(item.kind==='room'){let row='<room'+attr('name',value.title)+attr('rect',rect(value).join(','));for(const [key,target] of [['color','color'],['outlineColor','color_outline'],['textAngle','text_angle']])if(value[key]!==undefined)row+=attr(target,value[key]);if(value.underConstruction)row+=attr('under_construction','t');return row+'/>';}
 if(item.kind==='rectangle')return '<rectangle'+attr('rect',value.rect.join(','))+(value.color?attr('color',value.color):'')+(value.outlineColor?attr('color_outline',value.outlineColor):'')+'/>';
 let row='<exit';if(cross)row+=attr('map_from',layerIndex.get(layerOf(rooms.get(value.from))))+attr('map_to',layerIndex.get(layerOf(rooms.get(value.to))));row+=attr('from',indices.get(value.from));if(value.to)row+=attr('to',indices.get(value.to));if(value.nameFrom)row+=attr('name_from',value.nameFrom);if(value.nameTo)row+=attr('name_to',value.nameTo);row+=exitPoints(value);if(value.pointsSplit!==undefined)row+=attr('points_split',value.pointsSplit);return row+'/>';}
 for(const layer of layers){lines.push('<map'+attr('name',layer.name)+'>');for(const item of objects.get(layer.id))lines.push(render(item));lines.push('</map>');}
 if(far.length){lines.push('<far_exits>');for(const item of far)lines.push(render(item,true));lines.push('</far_exits>');}lines.push('</atlas>','');const source=lines.join('\n');if(encoder.encode(source).length>MAX_ZIP-256)throw new Error('Atlas XML exceeds the 4 MiB export limit.');
 return {xml:source,rooms:map.rooms.length,directions:map.exits.length,exitRecords:records,layers:layers.length,rectangles:map.drawings?.length||0,name:title};
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
