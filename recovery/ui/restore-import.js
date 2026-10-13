/* Connect original Config metadata to explicitly selected Restore.dat bytes.
 * Bindings must be supplied by the Config import's own character creation loop;
 * matching a display name or inventing a slot index would be ambiguous.
 */
(function(root,factory){const model=typeof module==='object'&&module.exports?require('./restore-model.js'):root.BeipRestoreModel,original=typeof module==='object'&&module.exports?require('./restore-original.js'):root.BeipRestoreOriginal;const api=factory(model,original);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipRestoreImport=api;})(typeof globalThis==='object'?globalThis:this,function(model,original){
'use strict';
const child=(parent,name)=>parent?.children?.find(item=>item.name.toLowerCase()===name.toLowerCase());
const value=(node,name)=>node?.values?.[name];
function boolean(raw,fallback){return raw==null?fallback:/^(true|t|1)$/i.test(raw);}
function integer(raw,fallback){return raw==null?fallback:/^-?\d+$/.test(String(raw))&&Number.isSafeInteger(Number(raw))?Number(raw):null;}
function fromConfig(tree,bindings){
 if(!Array.isArray(bindings))throw Error('Original restore import requires explicit character bindings.');
 const logging=child(child(tree,'Connections'),'Logging'),warnings=[],requested=integer(value(logging,'RestoreBufferSize'),256),current=integer(value(logging,'RestoreBufferSizeCurrent'),64);
 const preferences=model.normalizeGlobal({enabled:boolean(value(logging,'RestoreLogs'),true),bufferKiB:requested??256});
 if(requested===null||requested!==preferences.bufferKiB)warnings.push({code:'buffer-size-adjusted',message:'The requested recovery restore buffer was rounded or bounded.'});
 const validSize=current!==null&&current>=64&&current%64===0&&current<=original.MAX_FILE_BYTES/1024;
 if(!validSize)warnings.push({code:'invalid-current-buffer-size',message:'The original current buffer size is invalid; Restore.dat cannot be decoded until the matching metadata is corrected.'});
 const characters=[],indices=[],formats={},ids=new Set();
 for(const binding of bindings){if(!binding||typeof binding.characterId!=='string'||!binding.characterId||ids.has(binding.characterId)||!binding.characterNode)throw Error('Restore import bindings require unique imported IDs and their original character nodes.');ids.add(binding.characterId);const index=integer(value(binding.characterNode,'RestoreLogIndex'),-1),restore=model.normalizeCharacter({enabled:boolean(value(binding.characterNode,'RestoreLog'),true)});characters.push({characterId:binding.characterId,restore});
  if(index===null||index< -1){warnings.push({code:'invalid-character-index',characterId:binding.characterId,message:'The original character restore index is invalid.'});continue;}
  indices.push({characterId:binding.characterId,index});
  const encoding=String(value(binding.worldNode,'Encoding')??'1').toLowerCase(),known={0:'utf-8',1:'windows-1252',2:'cp437',utf8:'utf-8',cp1252:'windows-1252',cp437:'cp437'};
  formats[binding.characterId]={label:[binding.worldNode?.name,binding.characterNode.name].filter(Boolean).join(' / '),encoding:known[encoding]||null,pueblo:boolean(value(binding.worldNode,'Pueblo'),false)};
  if(!known[encoding])warnings.push({code:'unknown-original-encoding',characterId:binding.characterId,message:'The original world encoding needs review before its restore bytes can be displayed.'});
 }
 return {preferences,characters,source:validSize?{bufferKiB:current,indices,formats}:null,warnings};
}
function readOriginal(bytes,provenance){if(!provenance?.source)throw Error('No valid original Config restore metadata is available.');const parsed=original.parseOriginal(bytes,provenance.source);for(const character of parsed.characters){character.format=provenance.source.formats?.[character.characterId]||{encoding:null,pueblo:false};character.label=character.format.label||character.characterId;}return {...parsed,warnings:[...provenance.warnings,...parsed.warnings]};}
function remap(provenance,idMap){if(!provenance?.source)return provenance;const lookup=id=>typeof idMap?.get==='function'?idMap.get(id):Object.prototype.hasOwnProperty.call(idMap||{},id)?idMap[id]:undefined;const characters=provenance.characters.map(item=>{const characterId=lookup(item.characterId);if(typeof characterId!=='string'||!characterId)throw Error('Every restore mapping needs the final imported character ID.');return {...item,characterId};});if(new Set(characters.map(item=>item.characterId)).size!==characters.length)throw Error('Final restore character IDs must remain unique.');const indices=provenance.source.indices.map(item=>({...item,characterId:lookup(item.characterId)}));return {...provenance,characters,warnings:provenance.warnings.map(item=>item.characterId?{...item,characterId:lookup(item.characterId)}:item),source:{...provenance.source,indices,formats:Object.fromEntries(Object.entries(provenance.source.formats||{}).map(([id,value])=>[lookup(id),value]))}};}
return Object.freeze({fromConfig,readOriginal,remap});
});
