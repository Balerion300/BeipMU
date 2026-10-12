/* Supported window preferences. Original character/global overrides plus a world layer. */
(function(root,factory){const logging=typeof module==='object'&&module.exports?require('./logging-model.js'):root.BeipLogging;const api=factory(logging);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipProfilePreferences=api;})(typeof globalThis==='object'?globalThis:this,function(logging){
'use strict';
const ansi=typeof module==='object'&&module.exports?require('./ansi-model.js'):globalThis.BeipAnsi;
const DEFAULTS=Object.freeze({fontSize:13,fontFamily:'monospace',theme:'dark',scrollback:10000,inlineImages:true,inlineImageHeight:150,avatarWidth:50,avatarHeight:30,animatedImagesStartPaused:false,autoImageViewer:false,localEcho:false,defaultLogging:false,mediaEnabled:false,inputHeight:40,
 outputFontFace:'',outputFontBold:false,outputFontItalic:false,outputFontUnderline:false,outputFontStrikeout:false,
 outputForeground:'',outputBackground:'',linkColor:'',outputMarginLeft:0,outputMarginTop:0,outputMarginRight:0,outputMarginBottom:0,
 paragraphSpacing:0,wrappedIndent:0,fixedWidth:false,fixedWidthChars:80,fanFold:false,fanFoldColor1:'#0f0f0f',fanFoldColor2:'#1e1e1e',scrollToBottom:true,smoothScrolling:false,splitOnPageUp:false,
 inputFontFace:'',inputFontSize:13,inputFontBold:false,inputFontItalic:false,inputFontUnderline:false,inputFontStrikeout:false,inputForeground:'',inputBackground:'',localEchoColor:'',
 inputMarginLeft:0,inputMarginTop:0,inputMarginRight:0,inputMarginBottom:0,inputSticky:false,inputAutoSize:false,inputMinLines:1,inputMaxLines:5,pastePrefix:'',pasteSuffix:'',pasteDelay:100,logging:logging.DEFAULTS,restore:Object.freeze({enabled:true,bufferKiB:256}),emojiEnabled:false,ansi:ansi.DEFAULTS});
const IMAGE_KEYS=Object.freeze(['inlineImageHeight','avatarWidth','avatarHeight','animatedImagesStartPaused','autoImageViewer']);
const OUTPUT_KEYS=Object.freeze(['fontSize','fontFamily','scrollback','inlineImages',...Object.keys(DEFAULTS).filter(key=>key.startsWith('output')), 'linkColor','paragraphSpacing','wrappedIndent','fixedWidth','fixedWidthChars','fanFold','fanFoldColor1','fanFoldColor2','scrollToBottom','smoothScrolling','splitOnPageUp']);
const INPUT_KEYS=Object.freeze(['localEcho','localEchoColor',...Object.keys(DEFAULTS).filter(key=>key.startsWith('input'))]);
const groups={output:OUTPUT_KEYS,input:INPUT_KEYS};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const COLOR_KEYS=new Set(['outputForeground','outputBackground','linkColor','inputForeground','inputBackground','localEchoColor','fanFoldColor1','fanFoldColor2']);
function valid(key,value){
 if(key==='fontFamily')return value==='system'||value==='monospace'?value:undefined;
 if(key==='outputFontFace'||key==='inputFontFace')return typeof value==='string'&&value.length<=80&&!/[\x00-\x1f\x7f";{}\\]/.test(value)?value.trim():undefined;
 if(COLOR_KEYS.has(key))return typeof value==='string'&&(value===''||/^#[0-9a-f]{6}$/i.test(value))?value.toLowerCase():undefined;
 if(typeof DEFAULTS[key]==='boolean')return typeof value==='boolean'?value:undefined;
 const bounds={inlineImageHeight:[0,4096],avatarWidth:[0,4096],avatarHeight:[0,4096],fontSize:[10,30],inputFontSize:[8,72],scrollback:[100,20000],inputHeight:[40,300],paragraphSpacing:[0,100],wrappedIndent:[0,500],fixedWidthChars:[2,500],inputMinLines:[1,30],inputMaxLines:[1,30]}[key]||(/^(input|output)Margin(Left|Top|Right|Bottom)$/.test(key)?[0,100]:null);
 return bounds&&typeof value==='number'&&Number.isFinite(value)?Math.max(bounds[0],Math.min(bounds[1],Math.round(value))):undefined;
}
function normalizeGlobal(raw){
 const source=object(raw),result={...DEFAULTS};
 result.ansi=ansi.normalize(source.ansi);
 result.logging=logging.normalize(source.logging);
 result.restore=(typeof module==='object'&&module.exports?require('./restore-model.js'):globalThis.BeipRestoreModel).normalizeGlobal(source.restore);
 result.emojiEnabled=source.emojiEnabled===true;
 for(const key of [...OUTPUT_KEYS,...INPUT_KEYS,...IMAGE_KEYS])result[key]=valid(key,source[key])??DEFAULTS[key];
 result.theme=source.theme==='light'?'light':'dark';
 for(const key of ['pastePrefix','pasteSuffix'])result[key]=typeof source[key]==='string'?source[key].replace(/[\r\n\x00]/g,'').slice(0,1024):'';
 result.pasteDelay=typeof source.pasteDelay==='number'&&Number.isFinite(source.pasteDelay)?Math.max(0,Math.min(10000,Math.round(source.pasteDelay))):100;
 result.mediaEnabled=source.mediaEnabled===true;result.defaultLogging=source.defaultLogging===true;
 // Older recovery settings used one shared font for both windows.
 if(!Object.hasOwn(source,'inputFontSize'))result.inputFontSize=result.fontSize;
 if(!Object.hasOwn(source,'inputFontFace'))result.inputFontFace=result.fontFamily==='system'?'Segoe UI':'';
 result.inputMaxLines=Math.max(result.inputMinLines,result.inputMaxLines);
 return result;
}
function normalizeOverrides(raw){
 raw=object(raw);const result={};
 for(const [name,keys] of Object.entries(groups)){
  const group=object(raw[name]),values={};
  for(const key of keys){const value=valid(key,object(group.values)[key]);if(value!==undefined)values[key]=value;}
  result[name]={useParent:group.useParent!==false,values};
 }
 return result;
}
function resolve(global,world,character){
 const result={...object(global),...normalizeGlobal(global)};
 for(const key of [...OUTPUT_KEYS,...INPUT_KEYS])result[key]=valid(key,result[key])??DEFAULTS[key];
 for(const profile of [world,character]){
  const overrides=normalizeOverrides(profile?.preferences);
  for(const group of Object.values(overrides))if(!group.useParent)Object.assign(result,group.values);
 }
 result.inputMaxLines=Math.max(result.inputMinLines,result.inputMaxLines);
 return result;
}
function sourceOf(key,world,character){
 const name=OUTPUT_KEYS.includes(key)?'output':INPUT_KEYS.includes(key)?'input':null;
 if(name)for(const [level,profile] of [['character',character],['world',world]]){
  const group=normalizeOverrides(profile?.preferences)[name];
  if(!group.useParent&&Object.hasOwn(group.values,key))return level;
 }
 return 'global';
}
return Object.freeze({DEFAULTS,OUTPUT_KEYS,INPUT_KEYS,IMAGE_KEYS,normalizeGlobal,normalizeOverrides,resolve,sourceOf});
});
