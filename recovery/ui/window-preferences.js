/* Rendering adapter for allowlisted per-window settings; does not rewrite output DOM. */
(function(root,factory){const prefs=typeof module==='object'&&module.exports?require('./profile-preferences.js'):root.BeipProfilePreferences;const api=factory(prefs);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipWindowPreferences=api;})(typeof globalThis==='object'?globalThis:this,function(model){
'use strict';
const normalized=p=>model.normalizeGlobal(p);
function font(p,kind){const face=p[kind+'FontFace'];return face?'"'+face+'",monospace':kind==='output'&&p.fontFamily==='system'?'"Segoe UI",sans-serif':'"Courier New",Consolas,monospace';}
function textStyle(target,p,kind){
 const s=target.style;s.fontFamily=font(p,kind);s.fontSize=(kind==='output'?p.fontSize:p.inputFontSize)+'px';
 s.fontWeight=p[kind+'FontBold']?'bold':'normal';s.fontStyle=p[kind+'FontItalic']?'italic':'normal';
 s.textDecoration=[p[kind+'FontUnderline']?'underline':'',p[kind+'FontStrikeout']?'line-through':''].filter(Boolean).join(' ')||'none';
 s.color=p[kind+'Foreground']||'var(--output-color)';s.backgroundColor=p[kind+'Background']||'var(--output-bg)';
 s.padding=[p[kind+'MarginTop'],p[kind+'MarginRight'],p[kind+'MarginBottom'],p[kind+'MarginLeft']].map(n=>n+'px').join(' ');
}
function applyOutput(view,preferences){
 const p=normalized(preferences);textStyle(view,p,'output');view.classList.add('configured-output');
 const s=view.style;s.setProperty('--window-link',p.linkColor||'var(--accent)');s.setProperty('--window-paragraph-gap',p.paragraphSpacing+'px');
 s.setProperty('--window-wrap-indent',p.wrappedIndent+'px');s.setProperty('--window-line-width',p.fixedWidth?p.fixedWidthChars+'ch':'auto');
 s.setProperty('--window-fanfold-1',p.fanFold?p.fanFoldColor1:'transparent');s.setProperty('--window-fanfold-2',p.fanFold?p.fanFoldColor2:'transparent');
 return p;
}
function applyInput(input,preferences){const p=normalized(preferences);textStyle(input,p,'input');return p;}
function inputHeight(input,preferences){
 const p=normalized(preferences);if(!p.inputAutoSize)return p.inputHeight;
 const lineHeight=p.inputFontSize*1.2,padding=p.inputMarginTop+p.inputMarginBottom+2;
 const prior=input.style.height;input.style.height='0px';const measured=input.scrollHeight;input.style.height=prior;
 return Math.round(Math.max(40,Math.min(300,Math.max(p.inputMinLines*lineHeight+padding,Math.min(p.inputMaxLines*lineHeight+padding,measured+2)))));
}
function echoStyle(preferences){return {color:normalized(preferences).localEchoColor||'var(--echo)'};}
function shouldClearInput(preferences){return !normalized(preferences).inputSticky;}
function shouldScroll(preferences){return normalized(preferences).scrollToBottom;}
return Object.freeze({applyOutput,applyInput,inputHeight,echoStyle,shouldClearInput,shouldScroll,font});
});
