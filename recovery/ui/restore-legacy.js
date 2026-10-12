/* OEM 437 upper half from the standard code page, used only for original raw replay. */
(function(root,factory){const model=typeof module==='object'&&module.exports?require('./restore-model.js'):root.BeipRestoreModel;const api=factory(model);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipRestoreLegacy=api;})(typeof globalThis==='object'?globalThis:this,function(model){
'use strict';
const CP437="ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
function decode(bytes,encoding){if(encoding==='cp437')return Array.from(bytes,byte=>byte<128?String.fromCharCode(byte):CP437[byte-128]).join('');if(!['utf-8','windows-1252'].includes(encoding))throw Error('Original world encoding is unknown.');return new TextDecoder(encoding,{fatal:true}).decode(bytes);}
function convert(character,{Parser=globalThis.BeipProtocol?.Parser}={}){
 if(!Parser)throw Error('The safe display parser is unavailable.');if(!character?.format?.encoding)throw Error('The matching original world encoding is required.');
 const records=[],warnings=[{code:'semantic-replay-gap',message:'Original raw bytes are rendered with the recovery display parser. Original visual trigger/spawn re-evaluation and unsupported original markup are not reproduced. Restored output runs no scripts, commands, media or network requests.'}];let parts=[],time=0;
 function flush(force=false){if(parts.length||force){records.push(model.normalizeRecord({v:1,kind:'line',time,parts}));parts=[];}}
 const parser=new Parser(event=>{if(event.type==='text'){const lines=event.text.split('\n');for(let index=0;index<lines.length;index++){if(index)flush(true);if(lines[index])parts.push({type:'text',text:lines[index],style:event.style||{},...(event.link?{link:event.link}:{})});}}else if(event.type==='image')parts.push({type:'image',url:event.url,alt:event.alt||'',...(event.height?{height:Math.min(4096,event.height)}:{}),...(event.link?{link:event.link}:{})});},()=>{warnings.push({code:'replay-send-suppressed',message:'An original protocol handshake/request was suppressed during replay.'});});
 parser.pueblo=!!character.format.pueblo;
 for(const [index,entry] of character.records.entries()){
  time=entry.timeMs;try{
   if(entry.kind==='start'){flush();parser.reset();records.push(model.normalizeRecord({v:1,kind:'reset',time}));}
   else if(entry.kind==='received'){const before=records.length;parser.feed(decode(entry.payload,character.format.encoding));flush(records.length===before);}
   else if(entry.kind==='sent'){const text=decode(entry.payload,'utf-8');records.push(model.normalizeRecord({v:1,kind:'history',time,text}));}
   else if(entry.kind==='gmcp'){const text=decode(entry.payload,'utf-8'),at=text.indexOf(' ');records.push(model.normalizeRecord({v:1,kind:'gmcp',time,package:at<0?text:text.slice(0,at),data:at<0?'':text.slice(at+1)}));}
  }catch(error){parts=[];parser.reset();warnings.push({code:'record-conversion-failed',recordIndex:index,message:error.message});}
 }
 parser.finish();flush();return {characterId:character.characterId,records,warnings};
}
return Object.freeze({decode,convert});
});
