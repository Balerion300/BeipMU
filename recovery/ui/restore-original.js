/* Read-only original Restore.dat decoder.
 * Layout: src/Logging.h Header/Buffer, Logging.cpp View::Write/Read and
 * RestoreLogReplay::Read. Windows little-endian fixed-size character slots.
 * RestoreBufferSizeCurrent and RestoreLogIndex must come from the matching Config.
 * The comment mentioning a LineFeed in Logging.h is stale: Write adds none.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipRestoreOriginal=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const HEADER_BYTES=12,SLOT_HEADER_BYTES=8,MAX_FILE_BYTES=256*1024*1024,MAX_RECORDS=1000000;
const KINDS=Object.freeze({0:'received',1:'sent',2:'start',4:'gmcp'}),EPOCH_TICKS=116444736000000000n;
function fileTime(ticks){const delta=ticks-EPOCH_TICKS;return {fileTime:ticks.toString(),timeMs:Number((delta-(delta<0n?9999n:0n))/10000n)};}
function byteView(value){if(value instanceof ArrayBuffer)return new Uint8Array(value);if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);throw new TypeError('Restore.dat must be an ArrayBuffer or byte view.');}
function parseOriginal(value,options={}){
 const bytes=byteView(value),bufferKiB=options.bufferKiB,indices=options.indices;
 if(!Number.isSafeInteger(bufferKiB)||bufferKiB<64||bufferKiB%64||bufferKiB>MAX_FILE_BYTES/1024)throw new RangeError('Use the exact original RestoreBufferSizeCurrent: a multiple of 64 KiB, at most 256 MiB.');
 if(bytes.byteLength>MAX_FILE_BYTES)throw new RangeError('Restore.dat exceeds the 256 MiB import limit.');
 if(!Array.isArray(indices)||indices.length>10000)throw new TypeError('Pass discovered character/index mappings as an array.');
 const ids=new Set(),owners=new Map();
 for(const mapping of indices){if(!mapping||typeof mapping.characterId!=='string'||!mapping.characterId||mapping.characterId.length>256||/[\x00-\x1f\x7f]/.test(mapping.characterId)||ids.has(mapping.characterId)||!Number.isSafeInteger(mapping.index)||mapping.index< -1)throw new TypeError('Each mapping needs a unique characterId and an exact index (-1 means no log).');ids.add(mapping.characterId);if(mapping.index>=0)owners.set(mapping.index,(owners.get(mapping.index)||0)+1);}
 const slotBytes=bufferKiB*1024,slotCount=Math.floor(bytes.byteLength/slotBytes),dataSize=slotBytes-SLOT_HEADER_BYTES;
 const result={bufferKiB,slotBytes,slotCount,characters:[],warnings:[]};
 if(bytes.byteLength%slotBytes)result.warnings.push({code:'partial-slot',message:'File size is not a multiple of the supplied original buffer size; trailing bytes were not read.',bytes:bytes.byteLength%slotBytes});
 const selected=new Set([...owners.keys()].filter(index=>index<slotCount));
 if(selected.size<slotCount)result.warnings.push({code:'unmapped-slots',message:'Slots without a discovered character mapping were not read.',count:slotCount-selected.size});
 for(const mapping of indices){
  const output={characterId:mapping.characterId,index:mapping.index,records:[],warnings:[],complete:true};result.characters.push(output);
  const warn=(code,message,details={})=>{output.warnings.push({code,message,...details});output.complete=false;};
  if(mapping.index===-1)continue;
  if(owners.get(mapping.index)>1){warn('duplicate-index','More than one character refers to this slot; resolve the original metadata before importing.');continue;}
  if(mapping.index>=slotCount){warn('missing-slot','The discovered character index is outside the complete slots in this file.');continue;}
  const base=mapping.index*slotBytes,view=new DataView(bytes.buffer,bytes.byteOffset+base,slotBytes),start=view.getUint32(0,true),count=view.getUint32(4,true);
  if(start>=dataSize||count>dataSize){warn('invalid-ring-bounds','The slot start/count is outside its ring buffer.',{start,count});continue;}
  // Copy only requested bytes, including a header or payload split across the ring end.
  function read(relative,length){const offset=(start+relative)%dataSize,head=Math.min(length,dataSize-offset),copy=new Uint8Array(length);copy.set(bytes.subarray(base+SLOT_HEADER_BYTES+offset,base+SLOT_HEADER_BYTES+offset+head));if(head<length)copy.set(bytes.subarray(base+SLOT_HEADER_BYTES,base+SLOT_HEADER_BYTES+length-head),head);return copy;}
  let offset=0;
  while(offset<count){
   if(output.records.length>=MAX_RECORDS){warn('record-limit','The slot exceeds the bounded record import limit.',{recordOffset:offset});break;}
   if(count-offset<HEADER_BYTES){warn('truncated-header','The slot ends inside a record header.',{recordOffset:offset});break;}
   const header=read(offset,HEADER_BYTES),data=new DataView(header.buffer),type=header[0],length=header[1]|(header[2]<<8)|(header[3]<<16);
   if(!Object.hasOwn(KINDS,type)){warn(type===3?'unexpected-end-marker':'unknown-record-type',type===3?'End is an in-memory replay sentinel, not an on-disk record.':'Unknown original restore record type.',{recordOffset:offset,type});break;}
   if(length>count-offset-HEADER_BYTES){warn('truncated-payload','The record payload extends beyond the used ring bytes.',{recordOffset:offset,length});break;}
   if(type===2&&length!==0){warn('invalid-start-record','A connection Start record must have an empty payload.',{recordOffset:offset,length});break;}
   const ticks=BigInt(data.getUint32(4,true))+(BigInt(data.getUint32(8,true))<<32n);
   output.records.push({type,kind:KINDS[type],...fileTime(ticks),payload:read(offset+HEADER_BYTES,length)});
   offset+=HEADER_BYTES+length;
  }
 }
 return result;
}
return Object.freeze({parseOriginal,HEADER_BYTES,SLOT_HEADER_BYTES,MAX_FILE_BYTES,MAX_RECORDS});
});
