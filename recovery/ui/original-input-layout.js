/* Original InputWindow definitions; Root.prp and Config.cpp schema. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipOriginalInputLayout=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const child=(node,name)=>(node?.children||[]).find(item=>item.name.toLowerCase()===name.toLowerCase()),field=(node,name)=>node?.values?.[name];
const flag=(node,name,fallback=false)=>field(node,name)==null?fallback:/^(true|t|1)$/i.test(field(node,name));
function appearance(node,skipped){
 const font=child(node,'Font'),out={inputFontFace:'Courier New',inputFontSize:13,inputFontBold:false,inputFontItalic:false,inputFontUnderline:false,inputFontStrikeout:false,inputMarginLeft:0,inputMarginTop:0,inputMarginRight:0,inputMarginBottom:0,inputAutoSize:true,inputMinLines:1,inputMaxLines:5};
 function number(raw,key,min,max){if(raw==null)return;if(!/^-?\d+$/.test(raw)){skipped('Invalid original input '+key);return;}const value=Number(raw);out[key]=Math.max(min,Math.min(max,value));if(out[key]!==value)skipped('Original input '+key+' bounded');}
 function color(raw,key){if(raw==null)return false;const rgb=/^RGB\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(raw);if(rgb&&rgb.slice(1).every(n=>Number(n)<=255)){out[key]='#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');return true;}if(/^#[0-9a-f]{6}$/i.test(raw)){out[key]=raw.toLowerCase();return true;}skipped('Unsupported original input color');return false;}
 const face=field(font,'Name');if(face!=null){if(face.length<=80&&!/[\x00-\x1f\x7f";{}\\]/.test(face))out.inputFontFace=face;else skipped('Invalid original input font');}number(field(font,'Size'),'inputFontSize',8,72);for(const name of ['Bold','Italic','Underline','Strikeout'])out['inputFont'+name]=flag(font,name);
 if(field(font,'CharSet')!=null&&Number(field(font,'CharSet'))!==1)skipped('Original input font charset');
 const specifiedColors=[color(field(node,'Fore')??field(node,'ForeColor'),'inputForeground'),color(field(node,'Back')??field(node,'BackColor'),'inputBackground'),color(field(node,'LocalEchoColor'),'localEchoColor')];if(specifiedColors.some(value=>!value))skipped('Original default input colors adapted');
 const rawMargins=field(node,'Margins');if(rawMargins!=null){const found=/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/.exec(rawMargins);if(found)found.slice(1).forEach((value,index)=>number(value,'inputMargin'+['Left','Top','Right','Bottom'][index],0,100));else skipped('Invalid original input margins');}
 out.inputSticky=flag(node,'Sticky');out.localEcho=flag(node,'LocalEcho');out.inputAutoSize=flag(node,'AutoSizeVertically',true);number(field(node,'MinimumHeight'),'inputMinLines',1,30);number(field(node,'MaximumHeight'),'inputMaxLines',2,30);out.inputMaxLines=Math.max(out.inputMinLines,out.inputMaxLines);return out;
}
function definition(entry,index,skipped=()=>{},{globalInput,version}={}){
 let settings=child(entry,'InputWindow');const id='input:import-'+index;
 // Config.cpp <309 copies former global settings, retaining only pane Prefix.
 if(Number.isFinite(version)&&version<309){const prefix=field(settings,'Prefix')||'';settings={...(globalInput||{}),values:{...globalInput?.values,Prefix:prefix}};skipped('Original pre-309 input settings migrated');}
 const title=field(settings||globalInput,'Title')||'',prefix=field(settings||globalInput,'Prefix')||'';
 if(title.length>160||prefix.length>2048||/[\r\n\0]/.test(title+prefix)){skipped('Invalid original input title or prefix');return null;}
 if(!settings)return {id,title,prefix,inherit:true,inheritSource:'global',sticky:false,localEcho:false};
 return {id,title,prefix,inherit:false,sticky:flag(settings,'Sticky'),localEcho:flag(settings,'LocalEcho'),appearance:appearance(settings,skipped)};
}
return {appearance,definition};
});
