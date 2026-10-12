/* Per-world character encodings. Original Root.prp 836–840. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipEncoding=api;})(globalThis,function(){
'use strict';
const ENCODINGS=Object.freeze(['utf-8','windows-1252','cp437']);
const LABELS=Object.freeze({'utf-8':'UTF8 - Unicode','windows-1252':'CP-1252 - Windows',cp437:'CP-437 - DOS'});
const ORIGINAL_DEFAULT='windows-1252',RECOVERY_DEFAULT='utf-8';
const CP437='ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
function normalizeWorld(raw,{source='recovery'}={}){raw=raw&&typeof raw==='object'?raw:{};const missing=raw.encoding===undefined;const encoding=missing?(source==='new'?ORIGINAL_DEFAULT:RECOVERY_DEFAULT):ENCODINGS.includes(raw.encoding)?raw.encoding:null;return {encoding,encodingNeedsReview:encoding===null,limitTelnetCharset:raw.limitTelnetCharset===true};}
function newWorld(){return normalizeWorld({}, {source:'new'});}
function importOriginal(node,report=()=>{}){const raw=node?.values?.Encoding,aliases={0:'utf-8',1:'windows-1252',2:'cp437',utf8:'utf-8',cp1252:'windows-1252',cp437:'cp437'};const encoding=raw===undefined?ORIGINAL_DEFAULT:aliases[String(raw).toLowerCase()]||null;if(!encoding)report('Unknown original world encoding; select an encoding before connecting.');const limit=node?.values?.LimitTelnetCharset;const limitTelnetCharset=/^(true|t|1)$/i.test(limit||'');if(limit!=null&&!/^(true|false|t|f|1|0)$/i.test(limit))report('Invalid LimitTelnetCharset value.');if(limitTelnetCharset)report('Restricted Telnet charset negotiation is retained for review; automatic charset negotiation is not yet implemented.');return {encoding,encodingNeedsReview:encoding===null,limitTelnetCharset};}
function bytesOf(input){if(input===undefined)return new Uint8Array();if(input instanceof ArrayBuffer)return new Uint8Array(input);if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);throw TypeError('Expected an ArrayBuffer or byte view.');}
function createDecoder(encoding){if(!ENCODINGS.includes(encoding))throw Error('Select a supported world encoding before connecting.');if(encoding!=='cp437')return new TextDecoder(encoding);return {encoding:'cp437',decode(input){let out='';for(const byte of bytesOf(input))out+=byte<128?String.fromCharCode(byte):CP437[byte-128];return out;}};}
return {ENCODINGS,LABELS,ORIGINAL_DEFAULT,RECOVERY_DEFAULT,CP437,normalizeWorld,newWorld,importOriginal,createDecoder};
});
