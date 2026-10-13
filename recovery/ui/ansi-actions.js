/* Original ANSI reverse-color, literal OSC8 command and system-bell helpers. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipAnsiActions=api;})(globalThis,function(){
'use strict';
function oscLink(uri){
 if(typeof uri!=='string'||!uri||uri.length>8192)return null;
 const command=/^(send|prompt):/i.exec(uri);
 if(command){let value;try{value=decodeURIComponent(uri.slice(command[0].length));}catch{return null;}if(!value||value.length>8192||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))return null;return {kind:'command',value,prompt:command[1].toLowerCase()==='prompt',literal:true};}
 try{const url=new URL(uri);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;return {kind:'url',value:url.href};}catch{return null;}
}
function activateLiteral(link,session,{sendLines,setPrompt}){if(link?.kind!=='command'||link.literal!==true)return false;if(link.prompt)setPrompt(session,link.value,{selectAll:true});else sendLines(session,link.value);return true;}
function colorNumber(value){if(typeof value!=='string')return null;if(/^#[0-9a-f]{3}$/i.test(value))value='#'+[...value.slice(1)].map(c=>c+c).join('');if(/^#[0-9a-f]{6}$/i.test(value))return parseInt(value.slice(1),16);const match=/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(1(?:\.0*)?))?\s*\)$/i.exec(value);if(!match||match.slice(1,4).some(x=>Number(x)>255))return null;return (Number(match[1])<<16)|(Number(match[2])<<8)|Number(match[3]);}
function resolveStyle(style,{foreground,background},preventInvisible=true){if(preventInvisible&&typeof preventInvisible==='object')preventInvisible=preventInvisible.preventInvisible!==false;const result={...style};for(const key of ['color','background']){if(result[key]==='var(--ansi-default-foreground)')result[key]=foreground;if(result[key]==='var(--ansi-default-background)')result[key]=background;}const fore=colorNumber(result.color),back=colorNumber(result.background);if(preventInvisible&&fore!==null&&fore===back)result.color='#'+((~back)&0xffffff).toString(16).padStart(6,'0');return result;}
function bellRequest(session,preferences,post){if(!session||session.kind!=='world'||session.suppressAutomation||session.restoreReplay||preferences?.beep===false)return false;if(preferences?.beepSystem===false)return false;post('ansibell|'+session.id);return true;}
return {oscLink,activateLiteral,resolveStyle,bellRequest};
});
