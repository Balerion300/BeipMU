/* Original logging options, safe text/HTML records, and reviewed filename choices. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipLogging=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const DEFAULTS=Object.freeze({defaultFileName:'',fileNameReviewed:false,dateFormat:"yyyy'-'MM'-'dd",timestamp:'none',hour24:false,logTyped:false,typedPrefix:'Typed>',logSent:false,sentPrefix:'Sent>',wrap:false,wrapChars:80,wrapNearestWord:true,hangingIndent:false,hangingIndentChars:2,doubleSpace:false});
const text=(v,max)=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,'').slice(0,max):'';
const number=(v,defaultValue,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):defaultValue;
function normalize(raw){
 const source=raw&&typeof raw==='object'?raw:{},result={...DEFAULTS};
 for(const key of ['fileNameReviewed','hour24','logTyped','logSent','wrap','hangingIndent','doubleSpace'])result[key]=source[key]===true;
 result.wrapNearestWord=source.wrapNearestWord!==false;
 for(const key of ['typedPrefix','sentPrefix'])result[key]=typeof source[key]==='string'?text(source[key],256):DEFAULTS[key];
 result.defaultFileName=text(source.defaultFileName,1024);result.dateFormat=text(source.dateFormat,80)||DEFAULTS.dateFormat;
 result.timestamp=['none','time','date','date-time'].includes(source.timestamp)?source.timestamp:'none';
 result.wrapChars=number(source.wrapChars,80,2,1000);result.hangingIndentChars=number(source.hangingIndentChars,2,0,100);
 return result;
}
function normalizeCharacter(raw){const source=raw&&typeof raw==='object'?raw:{};return {fileName:text(source.fileName,1024),appendDate:source.appendDate===true,reviewed:source.reviewed===true,autoLog:source.autoLog===true&&source.reviewed===true};}
function options(preferences,character){const global=normalize(preferences?.logging),own=normalizeCharacter(character?.logging);return {...global,fileName:own.reviewed&&own.fileName?own.fileName:global.fileNameReviewed?global.defaultFileName:'',appendDate:own.reviewed&&!!own.fileName&&own.appendDate};}
function isHTML(options){return /\.html?$/i.test(options.fileName||'');}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function timePrefix(time,options){
 if(options.timestamp==='none')return '';
 const date=new Date(time??Date.now());if(!Number.isFinite(date.getTime()))return '';
 const settings={};if(options.timestamp==='date'||options.timestamp==='date-time'){settings.year='numeric';settings.month='2-digit';settings.day='2-digit';}
 if(options.timestamp==='time'||options.timestamp==='date-time'){settings.hour='2-digit';settings.minute='2-digit';settings.second='2-digit';settings.hour12=!options.hour24;}
 return date.toLocaleString(undefined,settings)+'  ';
}
function wrapText(value,options,timestampLength){
 if(!options.wrap)return value;
 const width=options.wrapChars,indent=options.hangingIndent?Math.min(200,options.hangingIndentChars+timestampLength):0,lines=[];
 let chars=Array.from(value),first=true;
 while(chars.length){const prefix=first?'':' '.repeat(indent),room=Math.max(20,width-prefix.length);let count=Math.min(room,chars.length);
  if(count<chars.length&&options.wrapNearestWord){const space=chars.slice(0,count).lastIndexOf(' ');if(space>0)count=space;}
  lines.push(prefix+chars.slice(0,count).join(''));chars=chars.slice(count);if(options.wrapNearestWord&&chars.length)while(chars[0]===' ')chars.shift();first=false;
 }
 return lines.join('\r\n');
}
function styledSegments(segments){return segments.slice(0,2048).map(segment=>{
 const style=[];for(const [key,css] of [['color','color'],['background','background-color']])if(typeof segment[key]==='string'&&/^(#[0-9a-f]{3,8}|rgba?\([\d., %]+\)|[a-z]{1,24})$/i.test(segment[key]))style.push(css+':'+segment[key]);
 if(segment.bold)style.push('font-weight:bold');if(segment.italic)style.push('font-style:italic');const decoration=[segment.underline?'underline':'',segment.strike?'line-through':''].filter(Boolean).join(' ');if(decoration)style.push('text-decoration:'+decoration);
 let content=escape(String(segment.text||''));if(style.length)content='<span style="'+escape(style.join(';'))+'">'+content+'</span>';
 if(typeof segment.url==='string'&&/^https?:\/\//i.test(segment.url)&&segment.url.length<=2048)content='<a href="'+escape(segment.url)+'" rel="noreferrer">'+content+'</a>';
 return content;
 }).join('');}
function formatRecord(record,raw){
 const options={...normalize(raw),fileName:raw?.fileName||''},kind=record?.kind||'received';if(kind==='typed'&&!options.logTyped||kind==='sent'&&!options.logSent)return '';
 if(!['received','typed','sent'].includes(kind))return '';
 const value=String(record?.text??'').replace(/\r\n?/g,'\n').replace(/\x00/g,'').slice(0,65536),kindPrefix=kind==='typed'?options.typedPrefix:kind==='sent'?options.sentPrefix:'',stamp=timePrefix(record?.time,options);
 if(isHTML(options)){
  const rich=kind==='received'&&Array.isArray(record.segments)&&record.segments.map(s=>String(s.text||'')).join('')===value?styledSegments(record.segments):escape(value);
  return '<div class="beip-log-line" style="white-space:pre-wrap;margin:0 0 '+(options.doubleSpace?'1em':'0')+'">'+(stamp?'<span class="timestamp">'+escape(stamp)+'</span>':'')+escape(kindPrefix)+rich+'</div>\r\n';
 }
 return value.split('\n').map(line=>wrapText(stamp+kindPrefix+line,options,stamp.length)+'\r\n'+(options.doubleSpace?'\r\n':'')).join('');
}
function header(raw,title='BeipMU log'){return isHTML(raw)?'<!doctype html>\r\n<meta charset="utf-8"><title>'+escape(title)+'</title>\r\n<body style="font-family:monospace">\r\n':'';}
function fromLine(line,kind='received'){const segments=[];function walk(node,inherited={}){if(node.nodeType===3){segments.push({...inherited,text:node.textContent});return;}if(node.nodeType!==1)return;const style=node.style,own={...inherited};if(style){if(style.color)own.color=style.color;if(style.backgroundColor)own.background=style.backgroundColor;if(style.fontWeight==='bold'||Number(style.fontWeight)>=600)own.bold=true;if(style.fontStyle==='italic')own.italic=true;if(style.textDecoration.includes('underline'))own.underline=true;if(style.textDecoration.includes('line-through'))own.strike=true;}if(node.tagName==='A'&&node.dataset?.kind==='url')own.url=node.dataset.value;for(const child of node.childNodes)walk(child,own);}walk(line);return {kind,text:line.textContent||'',time:Number(line.dataset?.logTime)||Date.now(),segments};}
function visibleLines(view,viewport){const top=viewport.getBoundingClientRect().top;const lines=[...view.querySelectorAll('.line')];const first=lines.findIndex(line=>line.getBoundingClientRect().bottom>top);return first<0?[]:lines.slice(first);}
function importOriginal(globalNode,characterNode,report=()=>{}){
 const val=(node,key)=>node?.values?.[key],bool=(node,key)=>/^(true|t|1)$/i.test(val(node,key)||''),global={},character={};
 if(globalNode){
  const strings={DefaultLogFileName:'defaultFileName',FileDateFormat:'dateFormat',SentPrefix:'sentPrefix',TypedPrefix:'typedPrefix'};for(const [source,target] of Object.entries(strings))if(val(globalNode,source)!=null)global[target]=val(globalNode,source);
  for(const [source,target] of Object.entries({LogSent:'logSent',LogTyped:'logTyped',Wrap:'wrap',HangingIndent:'hangingIndent',WrapNearestWord:'wrapNearestWord',DoubleSpace:'doubleSpace'}))if(val(globalNode,source)!=null)global[target]=bool(globalNode,source);
  for(const [source,target] of Object.entries({WrapChars:'wrapChars',HangingIndentChars:'hangingIndentChars'}))if(/^\d+$/.test(val(globalNode,source)||''))global[target]=Number(val(globalNode,source));
  if(val(globalNode,'Path'))report('Original log picker directory needs reselection');
  if(val(globalNode,'TimeFormat')&&val(globalNode,'TimeFormat')!=='0')report('Original numeric log timestamp flags need review');
  global.fileNameReviewed=false;
 }
 if(characterNode){character.fileName=val(characterNode,'LogFileName')||'';character.reviewed=false;character.autoLog=false;if(val(characterNode,'LogFileNameTimeFormat')&&val(characterNode,'LogFileNameTimeFormat')!=='0'){character.appendDate=true;report('Character log append-date choice needs review');}}
 return {global:normalize(global),character:normalizeCharacter(character)};
}
return Object.freeze({DEFAULTS,normalize,normalizeCharacter,options,isHTML,formatRecord,header,fromLine,visibleLines,importOriginal});
});
