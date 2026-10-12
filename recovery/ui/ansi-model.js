/* Original global ANSI preferences. MIT. Source: Root.prp 381–427. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipAnsi=api;})(globalThis,function(){
'use strict';
const NAMES=Object.freeze(['Black','Red','Green','Yellow','Blue','Magenta','Cyan','White','BoldBlack','BoldRed','BoldGreen','BoldYellow','BoldBlue','BoldMagenta','BoldCyan','BoldWhite']);
const palette=s=>Object.freeze(s.split(' ').map(x=>'#'+x));
const PRESETS=Object.freeze({
 XTerm:palette('000000 cd0000 00cd00 cdcd00 0000ee cd00cd 00cdcd e5e5e5 7f7f7f ff0000 00ff00 ffff00 5c5cff ff00ff 00ffff ffffff'),
 CMD:palette('000000 800000 008000 808000 000080 800080 008080 c0c0c0 808080 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff'),
 VGA:palette('000000 aa0000 00aa00 aa5500 0000aa aa00aa 00aaaa aaaaaa 555555 ff5555 55ff55 ffff55 5555ff ff55ff 55ffff ffffff'),
 Old:palette('000000 ff0000 00ff00 c0c000 0000ff c000c0 00c0c0 c0c0c0 808080 ff8080 80ff80 ffff00 8080ff ff00ff 00ffff ffffff'),
 Bright:palette('000000 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff 808080 ff8080 80ff80 ffff80 8080ff ff80ff 80ffff ffffff')
});
const DEFAULTS=Object.freeze({colors:PRESETS.XTerm,fontBold:false,preventInvisible:true,parse:true,resetOnNewLine:false});
const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
function normalize(raw){raw=raw&&typeof raw==='object'?raw:{};const result={colors:DEFAULTS.colors.map((v,i)=>hex(raw.colors?.[i])||v)};for(const key of ['fontBold','preventInvisible','parse','resetOnNewLine'])result[key]=typeof raw[key]==='boolean'?raw[key]:DEFAULTS[key];return result;}
function originalColor(raw){if(hex(raw))return hex(raw);const m=typeof raw==='string'&&/^(?:RGB)?\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?$/i.exec(raw);return m&&m.slice(1).every(x=>Number(x)<=255)?'#'+m.slice(1).map(x=>Number(x).toString(16).padStart(2,'0')).join(''):null;}
function importOriginal(node,skipped=()=>{}){if(!node)return null;const result=normalize(),colors=node.children?.find(x=>x.name==='Colors');for(const [original,key] of [['FontBold','fontBold'],['PreventInvisible','preventInvisible'],['Parse','parse'],['ResetOnNewLine','resetOnNewLine']]){const value=node.values?.[original];if(value!=null){if(/^(true|false|t|f|1|0)$/i.test(value))result[key]=/^(true|t|1)$/i.test(value);else skipped('Invalid ANSI '+original);}}for(let i=0;i<NAMES.length;i++){const value=colors?.values?.[NAMES[i]];if(value!=null){const color=originalColor(value);if(color)result.colors[i]=color;else skipped('Invalid ANSI color '+NAMES[i]);}}for(const name of ['FlashSpeed','Beep','BeepSystem','BeepFileName'])if(node.values?.[name]!=null)skipped('ANSI '+name+' is not yet implemented');return result;}
return {NAMES,PRESETS,DEFAULTS,normalize,importOriginal};
});
