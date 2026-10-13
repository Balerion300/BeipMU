/* Documented original Emoji.txt grammar with bounded literal matching. */
(function(root,factory){const source=typeof module==='object'&&module.exports?require('./emoji-default.js'):root.BeipEmojiDefault;const api=factory(source);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipEmojiModel=api;})(typeof globalThis==='object'?globalThis:this,function(defaultSource){
'use strict';
const MAX_SOURCE=131072,MAX_RULES=8192,MAX_LINE=65536,MAX_MATCHES=2048;
const word=char=>!!char&&/[\p{L}\p{N}_]/u.test(char);
function compile(source){
 if(typeof source!=='string'||source.length>MAX_SOURCE||new TextEncoder().encode(source).length>MAX_SOURCE||source.includes('\0'))throw Error('Emoji.txt must be plain text of at most 128 KiB.');
 const rules=[],seen=new Set(),root=new Map();let ignore=0,replace=false,lineNumber=0;
 for(const raw of source.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/)){
  lineNumber++;const line=raw.trim();if(!line||line.startsWith('#'))continue;
  if(line==='IGNORE_BEGIN'){if(++ignore>16)throw Error('Too many nested ignore sections.');continue;}
  if(line==='IGNORE_END'){if(!ignore)throw Error('IGNORE_END without IGNORE_BEGIN on line '+lineNumber+'.');ignore--;continue;}
  if(ignore)continue;
  if(line==='REPLACE_BEGIN'){replace=true;continue;}if(line==='REPLACE_END'){replace=false;continue;}
  const match=/^(\S+)\s+(.+)$/.exec(line);if(!match||match[1].length>64)throw Error('Expected an emoji followed by search text on line '+lineNumber+'.');
  for(const entry of match[2].split(',')){const text=entry.trim();if(!text)continue;if(text.length>256)throw Error('Search text is too long on line '+lineNumber+'.');const key=text.toLowerCase();if(seen.has(key))continue;seen.add(key);
   const rule={text,emoji:match[1],replace};rules.push(rule);if(rules.length>MAX_RULES)throw Error('Emoji.txt has too many search phrases.');
   let node=root;for(const char of text){const folded=char.toLowerCase();if(!node.has(folded))node.set(folded,new Map());node=node.get(folded);}node.rule=rule;
  }
 }
 if(ignore)throw Error('Emoji.txt ends inside an IGNORE section.');
 return {source,rules,root};
}
function matches(text,table){
 if(typeof text!=='string'||text.length>MAX_LINE)return [];
 const urls=[...text.matchAll(/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>]+/gi)].map(hit=>[hit.index,hit.index+hit[0].length]),result=[];
 let offset=0,previous='',urlIndex=0;
 while(offset<text.length&&result.length<MAX_MATCHES){
  while(urlIndex<urls.length&&offset>=urls[urlIndex][1])urlIndex++;
  if(urlIndex<urls.length&&offset>=urls[urlIndex][0]){offset=urls[urlIndex][1];previous=text[offset-1]||'';continue;}
  const first=String.fromCodePoint(text.codePointAt(offset));let found=null,node=table.root,at=offset;
  if(!word(previous))while(at<text.length&&at-offset<=256){const char=String.fromCodePoint(text.codePointAt(at));node=node.get(char.toLowerCase());if(!node)break;at+=char.length;const next=at<text.length?String.fromCodePoint(text.codePointAt(at)):'';if(node.rule&&!word(next))found={start:offset,end:at,...node.rule};}
  if(found){result.push(found);previous=text[found.end-1];offset=found.end;}else{offset+=first.length;previous=first;}
 }
 return result;
}
function transform(text,table){let result='',offset=0;for(const hit of matches(text,table)){result+=text.slice(offset,hit.start)+(hit.replace?'':text.slice(hit.start,hit.end))+hit.emoji;offset=hit.end;}return result+text.slice(offset);}
return Object.freeze({MAX_SOURCE,MAX_RULES,MAX_LINE,MAX_MATCHES,defaultSource,compile,matches,transform});
});
