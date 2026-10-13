const assert=require('node:assert/strict');
const prefs=require('../ui/profile-preferences.js'),profiles=require('../ui/profile-model.js'),imports=require('../ui/classic-import-core.js'),render=require('../ui/window-preferences.js');
let checks=0;function check(name,fn){fn();console.log('PASS '+name);checks++;}
const group=values=>({useParent:false,values});
check('Legacy shared font migrates once; independent fonts and scoped colors roundtrip',()=>{
 const old=profiles.normalizeSettings({preferences:{fontFamily:'system',fontSize:19}}).preferences;
 assert.equal(old.inputFontSize,19);assert.equal(old.inputFontFace,'Segoe UI');
 const state={preferences:{...old,inputFontFace:'Georgia',inputFontSize:17,outputFontFace:'Consolas',outputForeground:'#AABBCC'},worlds:[{id:'w',name:'World',host:'example.org',port:23,preferences:{output:group({paragraphSpacing:3,outputBackground:'#001122'}),input:group({inputSticky:true})}}],characters:[{id:'c',worldId:'w',name:'Alice',preferences:{input:group({inputFontSize:22,inputMinLines:8,inputMaxLines:2})}}]};
 const saved=profiles.serializeSettings(state),loaded=profiles.normalizeSettings(JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(loaded,saved);const p=prefs.resolve(loaded.preferences,loaded.worlds[0],loaded.characters[0]);
 assert.equal(p.outputFontFace,'Consolas');assert.equal(p.inputFontFace,'Georgia');assert.equal(p.inputFontSize,22);assert.equal(p.inputMaxLines,8);assert.equal(p.outputForeground,'#aabbcc');assert.equal(p.inputSticky,true);
 loaded.characters[0].preferences.input.useParent=true;assert.equal(prefs.resolve(loaded.preferences,loaded.worlds[0],loaded.characters[0]).inputFontSize,17);
});
check('Hostile CSS and invalid settings cannot escape the allowlist',()=>{
 const p=profiles.normalizeSettings({preferences:{outputFontFace:'";url(evil)',inputBackground:'url(evil)',linkColor:'#12345',paragraphSpacing:Infinity,inputSticky:'true',inputMarginTop:900,extra:'discard'}}).preferences;
 assert.equal(p.outputFontFace,'');assert.equal(p.inputBackground,'');assert.equal(p.linkColor,'');assert.equal(p.paragraphSpacing,0);assert.equal(p.inputSticky,false);assert.equal(p.inputMarginTop,100);assert.equal(p.extra,undefined);
});
check('Original independent font, colors, margins, input behavior and output options import',()=>{
 const source=`Version=400
Windows.MainWindowSettings
{
 Output
 {
 Font.Name="Cascadia Mono"
 Font.Size=18
 Font.Bold=true
 Fore=RGB(220,221,222)
 Back=RGB(10,20,30)
 Link=RGB(80,180,240)
 Margins=(1,2,3,4)
 ParagraphSpacing=5
 LineWrappedIndent=12
 FixedWidth=true
 FixedWidthChars=92
 FanFold=true
 FanFold1=RGB(1,2,3)
 FanFold2=RGB(4,5,6)
 ScrollToBottomOnAdd=false
 SmoothScrolling=true
 SplitOnPageUp=true
 TimeFormat=2
 }
 Input
 {
 Font.Name="Georgia"
 Font.Size=16
 Font.Italic=true
 Fore=RGB(2,3,4)
 Back=RGB(240,241,242)
 LocalEchoColor=RGB(0,255,255)
 LocalEcho=true
 Sticky=true
 AutoSizeVertically=true
 MinimumHeight=2
 MaximumHeight=7
 Margins=(5,6,7,8)
 }
}
Connections.Shortcuts.World
{
 Host="example.org:23"
 Characters.Alice.MainWindowSettings.Input.Font.Size=21
}`;
 const plan=imports.parseConfig(source),p=profiles.normalizeSettings({preferences:plan.preferences}).preferences;
 assert.equal(p.outputFontFace,'Cascadia Mono');assert.equal(p.outputFontBold,true);assert.equal(p.outputBackground,'#0a141e');assert.equal(p.linkColor,'#50b4f0');assert.equal(p.outputMarginBottom,4);assert.equal(p.wrappedIndent,12);assert.equal(p.paragraphSpacing,5);assert.equal(p.fixedWidthChars,92);assert.equal(p.fanFoldColor2,'#040506');assert.equal(p.scrollToBottom,false);assert.equal(p.smoothScrolling,true);assert.equal(p.splitOnPageUp,true);
 assert.equal(p.inputFontFace,'Georgia');assert.equal(p.inputFontSize,16);assert.equal(p.inputFontItalic,true);assert.equal(p.inputSticky,true);assert.equal(p.inputAutoSize,true);assert.equal(p.inputMaxLines,7);assert.equal(p.inputMarginLeft,5);assert.equal(p.localEchoColor,'#00ffff');
 assert.equal(prefs.resolve(p,plan.worlds[0],plan.characters[0]).inputFontSize,21);assert.equal(plan.report.skipped['Output TimeFormat not yet implemented'],1);
});
function element(){return {style:{height:'40px',setProperty(k,v){this[k]=v;}},classList:{add(){}},scrollHeight:75,children:['preserved link','preserved image']};}
check('Rendering only changes styles and preserves output children and default spacing',()=>{
 const view=element(),before=view.children;
 render.applyOutput(view,{...prefs.DEFAULTS,outputFontFace:'Consolas',outputForeground:'#112233',paragraphSpacing:4,wrappedIndent:12,fixedWidth:true,fixedWidthChars:72,fanFold:true});
 assert.equal(view.children,before);assert.equal(view.style.fontFamily,'"Consolas",monospace');assert.equal(view.style.color,'#112233');assert.equal(view.style['--window-line-width'],'72ch');assert.equal(view.style['--window-wrap-indent'],'12px');
 render.applyOutput(view,prefs.DEFAULTS);assert.equal(view.style['--window-wrap-indent'],'0px');assert.equal(view.style['--window-paragraph-gap'],'0px');assert.equal(view.style['--window-fanfold-1'],'transparent');assert.equal(view.style['--window-line-width'],'auto');
});
check('Input size is bounded without changing saved height; sticky, echo and scroll options apply',()=>{
 const input=element(),p={...prefs.DEFAULTS,inputAutoSize:true,inputMinLines:2,inputMaxLines:4,inputFontSize:16,inputSticky:true,localEchoColor:'#008899',scrollToBottom:false};
 render.applyInput(input,p);assert.equal(render.inputHeight(input,p),77);assert.equal(input.style.height,'40px');assert.equal(p.inputHeight,40);
 input.scrollHeight=800;assert.equal(render.inputHeight(input,p),79);assert.equal(render.inputHeight(input,{...p,inputAutoSize:false,inputHeight:110}),110);
 assert.equal(render.shouldClearInput(p),false);assert.equal(render.shouldScroll(p),false);assert.deepEqual(render.echoStyle(p),{color:'#008899'});
});
console.log(`${checks} window preference checks passed.`);
