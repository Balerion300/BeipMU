/* Bounded readers for the original Config.txt and Atlas map formats. MIT. */
(function(root,factory){const dock=typeof module==='object'&&module.exports?require('./dock-layout.js'):root.BeipDockLayout;const templates=typeof module==='object'&&module.exports?require('./connect-template.js'):root.BeipConnectTemplate;const logging=typeof module==='object'&&module.exports?require('./logging-model.js'):root.BeipLogging;const api=factory(dock,templates,logging);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipImportCore=api;})(typeof globalThis==='object'?globalThis:this,function(dock,templates,logging){
'use strict';
const MAX_CONFIG=4*1024*1024,MAX_ATLAS=16*1024*1024,MAX_ZIP=8*1024*1024;
const node=name=>({name,values:Object.create(null),children:[]});
function decoded(value){value=value.trim();if(!value.startsWith('"'))return value;let out='';for(let i=1;i<value.length;i++){const c=value[i];if(c==='"')return out;if(c==='\\'&&i+1<value.length){const next=value[++i];out+=next==='n'?'\n':next==='r'?'\r':next==='t'?'\t':next;}else out+=c;}throw new Error('Unclosed quoted value.');}
function keyParts(value){const parts=[],match=/(?:"(?:\\.|[^"\\])*"|[^.\s]+)(?:\.|$)/g;let hit;while((hit=match.exec(value))){const raw=hit[0].endsWith('.')?hit[0].slice(0,-1):hit[0];parts.push(decoded(raw));}if(!parts.length||parts.some(x=>!x||x.length>256))throw new Error('Invalid config key.');return parts;}
function scope(parent,parts){let at=parent;for(const name of parts){let child=name?at.children.find(x=>x.name===name):null;if(!child){child=node(name);at.children.push(child);}at=child;}return at;}
function parseConfigTree(source){if(typeof source!=='string'||source.length>MAX_CONFIG)throw new Error('Config.txt is too large.');const root=node(''),stack=[root];let pending=null,count=0;for(const raw of source.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/)){const line=raw.trim();if(!line||line.startsWith(';'))continue;if(++count>60000)throw new Error('Config.txt has too many lines.');if(line==='}') {if(stack.length===1||pending)throw new Error('Unbalanced config scope.');stack.pop();continue;}if(line==='{'||line.endsWith('{')){const label=line==='{'?pending??'':line.slice(0,-1).trim();const parts=label===''?['']:keyParts(label);stack.push(scope(stack.at(-1),parts));if(stack.length>32)throw new Error('Config nesting is too deep.');pending=null;continue;}const equal=line.indexOf('=');if(equal>=0){if(pending)throw new Error('Scope has no opening brace.');const parts=keyParts(line.slice(0,equal).trim());const parent=parts.length>1?scope(stack.at(-1),parts.slice(0,-1)):stack.at(-1);parent.values[parts.at(-1)]=decoded(line.slice(equal+1));}else{if(pending)throw new Error('Scope has no opening brace.');pending=line;}}if(stack.length!==1||pending)throw new Error('Config.txt ends inside a scope.');return root;}
function child(parent,name){return parent?.children.find(x=>x.name.toLowerCase()===name.toLowerCase())||null;}
function children(parent,name){return parent?.children.filter(x=>x.name.toLowerCase()===name.toLowerCase())||[];}
function value(parent,key){return parent?.values[key];}
function flag(parent,key,fallback=false){const raw=value(parent,key);return raw==null?fallback:/^(true|t|1)$/i.test(raw);}
function field(parent,path){let at=parent;const bits=path.split('.');for(const bit of bits.slice(0,-1))at=child(at,bit);return value(at,bits.at(-1));}
// Keep original pixel font sizes and independent input/output appearance.
function windowValues(parent,kind){
 const out={},prefix=kind==='input'?'input':'output';if(!parent)return out;
 function num(path,key,min,max){const raw=path.includes('.')?field(parent,path):value(parent,path);if(raw!=null&&/^\d+$/.test(raw))out[key]=Math.max(min,Math.min(max,Number(raw)));}
 function boolean(path,key){const raw=path.includes('.')?field(parent,path):value(parent,path);if(raw!=null&&/^(true|false|t|f|1|0)$/i.test(raw))out[key]=/^(true|t|1)$/i.test(raw);}
 function color(path,key){const raw=value(parent,path);if(raw==null)return;const parsed=rgb(raw)||(/^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():null);if(parsed)out[key]=parsed;}
 num('Font.Size',kind==='input'?'inputFontSize':'fontSize',kind==='input'?8:10,kind==='input'?72:30);
 const face=field(parent,'Font.Name');if(face&&face.length<=80&&!/[\x00-\x1f\x7f";{}\\]/.test(face))out[prefix+'FontFace']=face;
 for(const style of ['Bold','Italic','Underline','Strikeout'])boolean('Font.'+style,prefix+'Font'+style);
 color('Fore',prefix+'Foreground');color('Back',prefix+'Background');
 const margins=value(parent,'Margins')?.replace(/^\((.*)\)$/,'$1');if(margins&&/^\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+$/.test(margins))margins.split(',').forEach((v,i)=>out[prefix+'Margin'+['Left','Top','Right','Bottom'][i]]=Math.min(100,Number(v)));
 if(kind==='input'){
  boolean('LocalEcho','localEcho');color('LocalEchoColor','localEchoColor');boolean('Sticky','inputSticky');boolean('AutoSizeVertically','inputAutoSize');
  num('MinimumHeight','inputMinLines',1,30);num('MaximumHeight','inputMaxLines',1,30);
 }else{
  color('Link','linkColor');num('History','scrollback',100,20000);num('ParagraphSpacing','paragraphSpacing',0,100);num('LineWrappedIndent','wrappedIndent',0,500);
  boolean('FixedWidth','fixedWidth');num('FixedWidthChars','fixedWidthChars',2,500);boolean('FanFold','fanFold');color('FanFold1','fanFoldColor1');color('FanFold2','fanFoldColor2');
  boolean('SmoothScrolling','smoothScrolling');boolean('ScrollToBottomOnAdd','scrollToBottom');boolean('SplitOnPageUp','splitOnPageUp');
 }
 return out;
}
function profileWindowPreferences(profile){
 const main=child(profile,'MainWindowSettings');if(!main)return null;
 const output=child(main,'Output'),input=child(main,'Input'),outputValues=windowValues(output,'output'),inputValues=windowValues(input,'input');
 const raw=value(main,'InputSize'),height=raw!=null&&/^\d+$/.test(raw)?Math.max(40,Math.min(300,Number(raw))):undefined;
 if(height!==undefined)inputValues.inputHeight=height;
 return {output:{useParent:!output,values:outputValues},input:{useParent:!input&&height===undefined,values:inputValues}};
}
function safeId(prefix,index){return prefix+String(index).padStart(3,'0');}
function hostPort(raw){if(typeof raw!=='string'||raw.length>256)return null;const match=/^(\[[^\]]+\]|[^\s:|]+):(\d{1,5})$/.exec(raw.trim());if(!match||Number(match[2])<1||Number(match[2])>65535)return null;return {host:match[1].replace(/^\[|\]$/g,''),port:Number(match[2])};}
function safeAutomation(text){return typeof text==='string'&&!/(?:^|[\s;])\/(?:script|@)|\b(?:window\.|eval\s*\(|javascript:)/i.test(text);}
function rgb(text){const hit=/^RGB\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text||'');if(!hit||hit.slice(1).some(x=>Number(x)>255))return null;return '#'+hit.slice(1).map(x=>Number(x).toString(16).padStart(2,'0')).join('');}
function macroKey(text){if(typeof text!=='string'||text.length>80||text.includes('?'))return null;const parts=text.split('+').map(x=>x.trim());const key=parts.pop();const mods=[];for(const p of parts){const name=/^control$/i.test(p)?'Ctrl':/^alt$/i.test(p)?'Alt':/^shift$/i.test(p)?'Shift':null;if(!name||mods.includes(name))return null;mods.push(name);}let last=/^numpad[0-9]$/i.test(key)?'Numpad'+key.at(-1):/^f(?:[1-9]|1\d|2[0-4])$/i.test(key)?key.toUpperCase():/^[a-z0-9]$/i.test(key)?key.toUpperCase():null;if(!last)return null;return [...['Ctrl','Alt','Shift'].filter(x=>mods.includes(x)),last].join('+');}
function parseConfig(source){const tree=parseConfigTree(source),connections=child(tree,'Connections'),shortcuts=child(connections,'Shortcuts')||child(connections,'Servers');if(!connections||!/^\d+$/.test(value(tree,'Version')||''))throw new Error('Not a supported BeipMU Config.txt file.');const result={version:value(tree,'Version')||'',worlds:[],characters:[],preferences:{},aliases:[],triggers:[],macros:[],report:{skipped:Object.create(null),notes:[]}};const skipped=(name,n=1)=>{result.report.skipped[name]=(result.report.skipped[name]||0)+n;};let nextWorld=0,nextCharacter=0,nextAlias=0,nextTrigger=0,nextMacro=0;
 function findRule(n){const f=child(n,'FindString');const match=field(n,'FindString.MatchText')??value(n,'MatchText')??'';return {match,matchType:flag(f,'RegularExpression')?'regex':'simple',matchCase:flag(f,'MatchCase'),lineStart:flag(f,'StartsWith'),lineEnd:flag(f,'EndsWith'),wholeWord:flag(f,'WholeWord')};}
 // Original alias activation is global only; trigger scope activation also gates descendants.
 const restoreBindings=[];
 const globalAliasActive=flag(child(connections,'Aliases'),'Active'),globalTriggerActive=flag(child(connections,'Triggers'),'Active',true);
 result.commandSettings={active:globalAliasActive,echo:flag(child(connections,'Aliases'),'Echo',true),processCommands:flag(child(connections,'Aliases'),'ProcessCommands'),sendUnknown:flag(child(tree,'Global')||tree,'SendUnrecognizedCommands'),legacyVariableAliases:false};
 function walkRules(container,kind,where,active=true,parentId=null,depth=1,temporalChildren=false){
  if(!container)return;
  const target=kind==='trigger'?result.triggers:result.aliases,nestedName=kind==='trigger'?'Triggers':'Aliases';
  const enabled=active&&(kind==='trigger'?(temporalChildren||flag(container,'Active',true)):true);
  const entries=children(container,''),rawAfter=Number(value(container,'AfterCount')||0),after=Number.isSafeInteger(rawAfter)&&rawAfter>=0?Math.min(entries.length,rawAfter):0;
  for(const [index,n] of entries.entries()){
   if(depth>8){skipped('Rule trees beyond eight levels');continue;}
   if(target.length>=128){skipped('Excess '+(kind==='trigger'?'triggers':'aliases'));continue;}
   const nested=child(n,nestedName),hasChildren=!!children(nested,'').length;
   // Original Disabled bypasses a trigger's own match/effects, but processes its children.
   const folder=kind==='trigger'?flag(n,'Disabled'):flag(n,'Folder');
   let temporal=null;
   if(kind==='trigger'&&flag(n,'Multiline')){
    const lines=Number(value(n,'Multiline_Limit')||0),seconds=Number(value(n,'Multiline_Time')||0),time=Math.round(seconds*1000);
    if(!Number.isSafeInteger(lines)||lines<0||lines>9999||!Number.isFinite(seconds)||seconds<0||time>86400000||(!lines&&!time)){skipped('Invalid or excessive multiline trigger limits');continue;}
    temporal={multiline:true,multilineLines:lines,multilineMs:time};
   }
   // A capture that cannot be represented must never promote its restricted children.
   if(kind==='trigger'&&flag(child(n,'Spawn'),'Active')&&flag(child(n,'Spawn'),'OnlyChildrenDuringCapture')&&value(child(n,'Spawn'),'CaptureUntil')){
    const spawn=child(n,'Spawn'),pattern=value(spawn,'CaptureUntil');
    if(!value(spawn,'Title')||pattern.length>256||(()=>{try{new RegExp(pattern);return false;}catch{return true;}})()){skipped('Unsupported capture-only child trigger subtrees');continue;}
   }
   // A skipped text mutation could make a previously false child condition true.
   if(kind==='trigger'&&!folder&&hasChildren&&(flag(child(n,'Script'),'Active')||flag(child(n,'Filter'),'Active')&&(flag(child(n,'Filter'),'HTML')||(value(child(n,'Filter'),'Replace')||'').length>4096))){skipped('Unsupported text-changing trigger subtrees');continue;}
   const found=findRule(n);
   if(!folder&&(!found.match||found.match.length>128||found.matchType==='regex'&&(()=>{try{new RegExp(found.match);return false;}catch{return true;}})())){skipped('Unusable '+kind+' patterns');continue;}
   const basic={id:safeId(kind==='trigger'?'impt':'impa',kind==='trigger'?++nextTrigger:++nextAlias),scope:where,enabled,description:(value(n,'Description')||'').slice(0,80),...(!folder?found:{folder:true}),stopProcessing:!folder&&flag(n,'StopProcessing')};
   if(temporal)Object.assign(basic,temporal);
   if(parentId)basic.parentId=parentId;
   else if(where.level!=='character'&&index>=entries.length-after)basic.phase='after';
   if(nested)basic.processChildren=kind==='alias'||flag(nested,'Active',true);
   if(folder){target.push(basic);walkRules(nested,kind,where,enabled,basic.id,depth+1,!!temporal);continue;}
   if(kind==='alias'){
    const replacement=value(n,'Replace')||'';
    if(replacement.length>65536||!safeAutomation(replacement)){skipped('Unsupported or script aliases');continue;}
    target.push({...basic,replacement,expandVariables:flag(n,'ExpandVariables')});
   }else{
    const send=child(n,'Send'),spawn=child(n,'Spawn'),filter=child(n,'Filter'),gag=child(n,'Gag'),color=child(n,'Color'),style=child(n,'Style'),toast=child(n,'Toast'),sound=child(n,'Sound'),speech=child(n,'Speech');
    const rule={...basic,oncePerLine:flag(n,'OncePerLine')};
    if(flag(n,'AwayPresent')){rule.awayCondition=flag(n,'Away',true)?'away':'present';if(flag(n,'AwayPresentOnce'))rule.awayOnce=true;}
    if(flag(send,'Active')){
     const command=value(send,'Send')||'';
     if(command&&!/[\r\n]/.test(command)&&command.length<=4096&&safeAutomation(command)){rule.sendText=command;rule.sendExpandVariables=flag(send,'ExpandVariables');rule.sendOnClick=flag(send,'SendOnClick');rule.sendCaptureIndex=Math.max(0,Math.min(99,Math.round(Number(value(send,'CaptureIndex')??1)||0)));}
     else skipped('Unsupported or script trigger sends');
    }
    if(flag(spawn,'Active')){rule.spawnTitle=(value(spawn,'Title')||'').slice(0,80);rule.spawnGroup=(value(spawn,'TabGroup')||'').slice(0,80);rule.captureUntil=(value(spawn,'CaptureUntil')||'').slice(0,256);rule.spawnCopy=flag(spawn,'Copy');rule.spawnGagLog=flag(spawn,'GagLog');rule.captureOnlyChildren=flag(spawn,'OnlyChildrenDuringCapture');if(rule.captureUntil){try{new RegExp(rule.captureUntil);}catch{rule.captureUntil='';skipped('Unsupported capture patterns');}}if(!rule.spawnTitle){delete rule.spawnTitle;skipped('Untitled spawn actions');}}
    if(flag(filter,'Active')){
     const replacement=value(filter,'Replace')||'';
     if(flag(filter,'HTML')||replacement.length>4096)skipped('Unsupported trigger filters');
     else {rule.filterText=replacement;rule.filterExpandVariables=flag(filter,'ExpandVariables');}
    }
    rule.gag=flag(gag,'Active');rule.logGag=flag(gag,'Log');rule.notify=flag(toast,'Active');
    const highlight={};if(flag(color,'UseForeColor')){const c=rgb(value(color,'ForeColor'));if(c)highlight.color=c;else skipped('Unsupported trigger colors');}if(flag(color,'UseBackColor')){const c=rgb(value(color,'BackColor'));if(c)highlight.background=c;else skipped('Unsupported trigger colors');}for(const x of ['Bold','Italic','Underline','Strikeout'])if(flag(style,'Set'+x))highlight[x==='Strikeout'?'strike':x.toLowerCase()]=flag(style,x);if(Object.keys(highlight).length)rule.highlight={...highlight,captureGroups:true,styleExplicit:true,colorWholeLine:flag(color,'WholeLine'),styleWholeLine:flag(style,'WholeLine')};
    if(flag(n,'Cooldown'))rule.cooldownMs=Math.max(0,Math.min(86400000,Math.round(Number(value(n,'CooldownTime')||0)*1000)||0));
    if(flag(sound,'Active')){const path=value(sound,'Sound')||'';if(path&&path.length<=1024&&!/[\u0000-\u001f]/.test(path)&&!/%[^%]+%/.test(path))rule.sound={enabled:true,path};else skipped('Unsupported variable or invalid sound paths');}
    if(flag(speech,'Active')){const text=value(speech,'Say')||'',wholeLine=flag(speech,'WholeLine');if(text.length<=2048&&(wholeLine||text))rule.speech={enabled:true,wholeLine,text};else skipped('Unsupported speech text');}
    if(child(n,'Paragraph')||child(n,'Script')||child(n,'Stat')||child(n,'Extensions'))skipped('Unsupported trigger effects');
    if(!hasChildren&&!rule.stopProcessing&&!rule.highlight&&!rule.gag&&!rule.logGag&&!rule.sendText&&!rule.spawnTitle&&!rule.notify&&!rule.sound&&!rule.speech&&typeof rule.filterText!=='string'){skipped('Triggers with no supported action');continue;}
    target.push(rule);
   }
   walkRules(nested,kind,where,enabled,basic.id,depth+1,!!temporal||kind==='trigger'&&flag(child(n,'Spawn'),'Active')&&flag(child(n,'Spawn'),'OnlyChildrenDuringCapture')&&!!value(child(n,'Spawn'),'CaptureUntil'));
  }
 }
 function characterVariables(character){
  const variables=Object.create(null);let count=0,total=0;
  for(const entry of children(child(character,'Variables'),'')){
   const name=value(entry,'Name')||'',text=value(entry,'Value')||'';
   if(!name||name.length>128||text.length>4096||count>=128||total+name.length+text.length>65536){skipped('Invalid or excess variables');continue;}
   // Keep literal user data, including special object-property names, inert.
   if(Object.hasOwn(variables,name)){skipped('Duplicate variable names');continue;}
   variables[name]=text;count++;total+=name.length+text.length;
  }
  return variables;
 }
 function characterIdle(character){
  if(value(character,'IdleEnabled')==null&&value(character,'IdleTimeout')==null&&value(character,'IdleString')==null)return {};
  const minutes=Number(value(character,'IdleTimeout')||0),text=value(character,'IdleString')||'';
  const password=value(character,'Password')||'';
  if(password&&text.includes(password)||/(?:^|[;\r\n])\s*\/?(?:connect|create|login|auth(?:enticate)?|password|pass)\b/i.test(text)){skipped('Credential-like idle commands omitted');return {};}
  if(!Number.isSafeInteger(minutes)||minutes<0||minutes>1440||/[\r\n\x00]/.test(text)||new TextEncoder().encode(text).length>8192||!safeAutomation(text)){skipped('Unsupported idle timer settings');return {};}
  const note='Imported idle timers remain disabled. Review the command, then enable it with /idle minutes "command".';if(!result.report.notes.includes(note))result.report.notes.push(note);
  return {idle:{enabled:false,minutes:Math.max(1,minutes),text}};
 }
 function walkMacros(container,where,active=true,folder=''){if(!container)return;const enabled=active&&flag(container,'Active',true);for(const n of children(container,'')){const nested=child(n,'KeyboardMacros2');if(flag(n,'Folder')||nested){skipped('Folders flattened');walkMacros(nested,where,enabled,folder+(value(n,'Description')||'')+' / ');continue;}const text=value(n,'Macro')||'',key=macroKey(value(n,'key')||'');if(!key||!text||text.length>65536||!safeAutomation(text)){skipped('Unsupported or script macros');continue;}result.macros.push({id:safeId('impm',++nextMacro),scope:where,enabled,description:(folder+(value(n,'Description')||'')).slice(0,80),key,text,mode:flag(n,'Type')?'type':'send'});}}
 walkRules(child(connections,'Aliases'),'alias',{level:'global'});walkRules(child(connections,'Triggers'),'trigger',{level:'global'});walkMacros(child(connections,'KeyboardMacros2'),{level:'global'});
 for(const server of shortcuts?.children||[]){const host=hostPort(value(server,'Host'));if(!host||result.worlds.length>=128){skipped('Invalid or excess worlds');continue;}const world={id:safeId('impw',++nextWorld),name:(server.name||'World').slice(0,80),...host,tls:flag(server,'TLS'),autoConnect:false,openAtStartup:false,notes:(value(server,'Info')||'').slice(0,16384)};const worldPreferences=profileWindowPreferences(server);if(worldPreferences)world.preferences=worldPreferences;const worldDock=dock?.fromOriginal?.(server,skipped);if(worldDock)world.dockLayout=worldDock;result.worlds.push(world);const ws={level:'server',serverId:world.id};walkRules(child(server,'Aliases'),'alias',ws);walkRules(child(server,'Triggers'),'trigger',ws,globalTriggerActive);walkMacros(child(server,'KeyboardMacros2'),ws);const chars=child(server,'Characters');for(const character of chars?.children||[]){if(!character.name||result.characters.length>=256){skipped('Invalid or excess characters');continue;}const id=safeId('impc',++nextCharacter),name=character.name.slice(0,80),template=templates.importOriginal(value(character,'Connect'),value(character,'Password'));if(template.reason)skipped(template.reason);result.characters.push({...characterIdle(character),logging:logging.importOriginal(null,character,skipped).character,...template.fields,...(dock?.fromOriginal?{dockLayout:dock.fromOriginal(character,skipped)}:{}),id,worldId:world.id,name,variables:characterVariables(character),loginName:'',autoLogin:false,openAtStartup:false,autoConnect:false,allowPlainLogin:false,notes:(value(character,'Info')||'').slice(0,16384),...(profileWindowPreferences(character)?{preferences:profileWindowPreferences(character)}:{})});restoreBindings.push({characterId:id,characterNode:character,worldNode:server});const cs={level:'character',serverId:world.id,characterId:id};walkRules(child(character,'Aliases'),'alias',cs);walkRules(child(character,'Triggers'),'trigger',cs,globalTriggerActive&&flag(child(server,'Triggers'),'Active',true));walkMacros(child(character,'KeyboardMacros2'),cs);if(value(character,'Password')||(value(character,'Connect')&&!template.fields))skipped('Credentials and login commands omitted');}}
 if(result.aliases.length>128){skipped('Excess aliases',result.aliases.length-128);result.aliases.length=128;}if(result.triggers.length>128){skipped('Excess triggers',result.triggers.length-128);result.triggers.length=128;}if(result.macros.length>128){skipped('Excess macros',result.macros.length-128);result.macros.length=128;}
 const restoreAdapter=typeof module==='object'&&module.exports?require('./restore-import.js'):globalThis.BeipRestoreImport;
 result.restoreProvenance=restoreAdapter.fromConfig(tree,restoreBindings);result.preferences.restore=result.restoreProvenance.preferences;for(const item of result.restoreProvenance.characters){const character=result.characters.find(value=>value.id===item.characterId);if(character)character.restore=item.restore;}for(const warning of result.restoreProvenance.warnings)result.report.notes.push(warning.message);
 const global=child(tree,'Global')||tree,windows=child(tree,'Windows'),main=child(windows,'MainWindowSettings'),output=child(main,'Output'),input=child(main,'Input');const pref=result.preferences;if(child(connections,'Logging'))pref.logging=logging.importOriginal(child(connections,'Logging'),null,skipped).global;Object.assign(pref,windowValues(output,'output'),windowValues(input,'input'));const size=Number(value(main,'InputSize'));if(Number.isInteger(size)&&size>=40&&size<=300)pref.inputHeight=size;if(value(global,'ParseEmoticons')!=null)pref.emojiEnabled=flag(global,'ParseEmoticons');if(value(global,'InlineImages')!=null)pref.inlineImages=flag(global,'InlineImages');for(const [original,key] of [['InlineImageHeight','inlineImageHeight'],['AvatarWidth','avatarWidth'],['AvatarHeight','avatarHeight']]){const raw=value(global,original);if(raw!=null&&Number.isFinite(Number(raw)))pref[key]=Math.min(4096,Math.abs(Math.round(Number(raw))));}for(const [original,key] of [['AnimatedImagesStartPaused','animatedImagesStartPaused'],['AutoImageViewer','autoImageViewer']])if(value(global,original)!=null)pref[key]=flag(global,original);const theme=Number(value(global,'Theme'));if(theme===0||theme===1)pref.theme=theme===1?'dark':'light';for(const profile of [main,...(shortcuts?.children||[]).flatMap(server=>[child(server,'MainWindowSettings'),...(child(server,'Characters')?.children||[]).map(c=>child(c,'MainWindowSettings'))])]){const out=child(profile,'Output'),inp=child(profile,'Input');for(const key of ['InvertBrightness','TimeFormat','TimeFormatToolTip','BackgroundImage','BackgroundImageStyle'])if(value(out,key)!=null)skipped('Output '+key+' not yet implemented');for(const key of ['Prefix','Title'])if(value(inp,key))skipped('Additional-input '+key+' not yet implemented');if(child(profile,'History'))skipped('Independent input-history appearance not yet implemented');}result.report.notes.push('Passwords, literal login commands, startup actions, scripts, and unsupported effects are not imported. Placeholder connect templates import disabled and require review in the character editor.');if(result.triggers.some(rule=>rule.sound))result.report.notes.push('Imported sound paths stay silent until trigger sounds are enabled in Preferences.');return result;
}
function xmlEntities(value){return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos);/gi,(_,entity)=>{const table={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity[0]==='#'){const code=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isInteger(code)&&code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}return table[entity.toLowerCase()]||'';});}
function attrs(source){const result=Object.create(null),regex=/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let hit;while((hit=regex.exec(source)))result[hit[1]]=xmlEntities(hit[2]??hit[3]);return result;}
// Minimal structured reader for Atlas' attribute-only XML; no DTDs or external entities.
function atlasTree(source){
 const root={tag:'',attrs:{},children:[]},stack=[root];let count=0,last=0;
 const tokens=/<\?[^?]*\?>|<!--[\s\S]*?-->|<[^>]+>/g;let match;
 while((match=tokens.exec(source))){if(source.slice(last,match.index).trim())throw new Error('Unexpected Atlas XML text.');last=tokens.lastIndex;const token=match[0];if(token.startsWith('<?')||token.startsWith('<!--'))continue;if(++count>40000)throw new Error('Atlas has too many objects.');
  if(token.startsWith('</')){const name=/^<\/([\w:-]+)\s*>$/.exec(token)?.[1];if(stack.length===1||stack.at(-1).tag!==name)throw new Error('Unbalanced Atlas XML.');stack.pop();continue;}
  const opening=/^<([\w:-]+)\b([\s\S]*?)(\/?)>$/.exec(token);if(!opening)throw new Error('Invalid Atlas XML tag.');const entry={tag:opening[1],attrs:attrs(opening[2]),children:[]};stack.at(-1).children.push(entry);if(!opening[3]){stack.push(entry);if(stack.length>16)throw new Error('Atlas nesting is too deep.');}
 }
 if(source.slice(last).trim()||stack.length!==1||root.children.length!==1||root.children[0].tag!=='atlas')throw new Error('Not a complete Atlas XML file.');return root.children[0];
}
function parseAtlasXml(source){
 if(typeof source!=='string'||source.length>MAX_ATLAS)throw new Error('Atlas XML is too large.');
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('Atlas XML entities are unsupported.');
 const root=atlasTree(source.replace(/^\uFEFF/,'')),version=Number(root.attrs.version||1);if(![1,2].includes(version))throw new Error('Unsupported Atlas version.');
 const report={skipped:Object.create(null),notes:['All map layers, room geometry, rectangles, palette/fonts, route bends and cross-layer exits are imported. Image and label objects are reported when unsupported.']},skipped=key=>{report.skipped[key]=(report.skipped[key]||0)+1;};
 const color=value=>/^#[0-9a-f]{1,6}$/i.test(value||'')?'#'+value.slice(1).padStart(6,'0').toLowerCase():null;
 const coordinate=value=>Number.isInteger(value)&&Math.abs(value)<=100000;
 const rect=(value,degenerate=false)=>{const numbers=String(value||'').split(',').map(Number);return numbers.length===4&&numbers.every(coordinate)&&(degenerate?numbers[0]<=numbers[2]&&numbers[1]<=numbers[3]:numbers[0]<numbers[2]&&numbers[1]<numbers[3])?numbers:null;};
 const points=value=>{if(!value)return undefined;const parsed=value.split('|').map(pair=>pair.split(',').map(Number));return parsed.length<=32&&parsed.every(pair=>pair.length===2&&pair.every(coordinate))?parsed:null;};
 const mapNodes=root.children.filter(item=>item.tag==='map');if(!mapNodes.length||mapNodes.length>16)throw new Error('Atlas must contain one to sixteen map layers.');
 const graph={version:2,layers:[],rooms:[],exits:[],drawings:[],visualExits:[],currentRoomId:null,fonts:{}},indices=[],pending=[];let nextExit=0,nextDrawing=0;
 for(const [key,target] of [['color_background','backgroundColor'],['color_exit','exitColor']])if(root.attrs[key]){const value=color(root.attrs[key]);if(value)graph[target]=value;else skipped('Invalid atlas colors');}
 for(const kind of ['rooms','exits','labels']){const font=root.children.find(item=>item.tag==='font_'+kind)?.attrs;if(!font)continue;const size=Number(font.size);if(font.name&&font.name.length<=80&&!/[\x00-\x1f";{}\\]/.test(font.name)&&Number.isFinite(size)&&size>=1&&size<=100)graph.fonts[kind]={name:font.name,size};else skipped('Invalid map fonts');}
 for(const [mapIndex,map] of mapNodes.entries()){
  const layerId='layer'+mapIndex,name=(map.attrs.name||'Map '+(mapIndex+1)).replace(/[\u0000-\u001f]/g,' ').slice(0,80);graph.layers.push({id:layerId,name});const refs=new Map();indices.push(refs);let roomIndex=0;
  for(const [order,entry] of map.children.entries()){
   const a=entry.attrs;
   if(entry.tag==='room'){
    const index=version===2?order:roomIndex;roomIndex++;const box=rect(a.rect),title=(a.name||' ').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f]/g,' ');if(!box||title.length>1024||graph.rooms.length>=1024){skipped('Invalid or excess rooms');continue;}
    const room={id:'m'+mapIndex+'_r'+index,layerId,title,x:Math.round((box[0]+box[2])/2),y:Math.round((box[1]+box[3])/2),rect:box,order};for(const [key,target] of [['color','color'],['color_outline','outlineColor']])if(a[key]){const value=color(a[key]);if(value)room[target]=value;else skipped('Invalid room colors');}
    if(a.text_angle!==undefined){const n=Number(a.text_angle);if(Number.isInteger(n)&&n>=0&&n<360)room.textAngle=n;else skipped('Invalid room text angles');}if(a.under_construction!==undefined)room.underConstruction=/^(t|true|1)$/i.test(a.under_construction);refs.set(index,room);graph.rooms.push(room);
   }else if(entry.tag==='rectangle'){
    const box=rect(a.rect,true),fill=a.color?color(a.color):undefined;if(!box||a.color&&!fill||graph.drawings.length>=2048){skipped('Invalid or excess rectangles');continue;}const item={id:'d'+nextDrawing++,kind:'rectangle',layerId,rect:box,...(fill?{color:fill}:{}),order};if(a.color_outline){const value=color(a.color_outline);if(value)item.outlineColor=value;else skipped('Invalid rectangle outline colors');}graph.drawings.push(item);
   }else if(entry.tag==='exit')pending.push({entry,mapIndex,order});
   else skipped('Unsupported '+entry.tag+' objects');
  }
 }
 for(const far of root.children.filter(item=>item.tag==='far_exits'))for(const entry of far.children)if(entry.tag==='exit')pending.push({entry,mapIndex:0,order:undefined});else skipped('Unsupported far-exit objects');
 for(const {entry,mapIndex,order} of pending){
  let a=entry.attrs;if(a.from===undefined&&a.to!==undefined){a={...a,from:a.to,to:undefined,map_from:a.map_to??mapIndex,map_to:a.map_from,name_from:a.name_to,name_to:a.name_from};const path=points(a.points);if(path)a.points=[...path].reverse().map(point=>point.join(',')).join('|');if(a.points_split!==undefined&&path)a.points_split=String(path.length-Number(a.points_split));}
  const fromMap=a.map_from===undefined?mapIndex:Number(a.map_from),toMap=a.map_to===undefined?mapIndex:Number(a.map_to),from=a.from===undefined?null:indices[fromMap]?.get(Number(a.from)),to=a.to===undefined?null:indices[toMap]?.get(Number(a.to));
  if(!from||a.to!==undefined&&!to){skipped('Unresolved exits');continue;}const route=points(a.points);if(route===null)skipped('Invalid exit points');let split=a.points_split===undefined?undefined:Number(a.points_split);if(split!==undefined&&(!Number.isInteger(split)||split<0||split>(route?.length||0))){skipped('Invalid split routing');split=undefined;}
  const extras={...(route?{points:route}:{}),...(split!==undefined?{pointsSplit:split}:{}),...(order!==undefined?{order}:{})},pair='p'+nextExit++;let routed=0;
  if(to)for(const [origin,target,command,reverse] of [[from,to,a.name_from,false],[to,from,a.name_to,true]]){if(!command)continue;if(command.length>256||/[\u0000-\u001f\u007f]/.test(command)||graph.exits.length>=4096){skipped('Invalid or excess exit directions');continue;}graph.exits.push({id:'e'+graph.exits.length,from:origin.id,to:target.id,command,atlasPair:pair,...extras,...(reverse&&route?{points:[...route].reverse().map(point=>point.slice())}:{}),...(reverse&&split!==undefined?{pointsSplit:route.length-split}:{})});routed++;}
  if(!routed)graph.visualExits.push({id:pair,from:from.id,...(to?{to:to.id}:{}),...extras,...Object.fromEntries([['name_from','nameFrom'],['name_to','nameTo']].filter(([key])=>a[key]&&a[key].length<=256&&!/[\u0000-\u001f\u007f]/.test(a[key])).map(([key,target])=>[target,a[key]]))});
 }
 if(!graph.visualExits.length)delete graph.visualExits;if(!Object.keys(graph.fonts).length)delete graph.fonts;
 // Preserve the old per-map review API while adding the complete atlas graph.
 const maps=graph.layers.map(layer=>{const rooms=graph.rooms.filter(room=>room.layerId===layer.id),ids=new Map(rooms.map((room,index)=>[room.id,'r'+index])),remap=exit=>({...exit,from:ids.get(exit.from),...(exit.to?{to:ids.get(exit.to)}:{})});const single={...graph,layers:[layer],rooms:rooms.map(room=>({...room,id:ids.get(room.id)})),exits:graph.exits.filter(exit=>ids.has(exit.from)&&ids.has(exit.to)).map(remap),drawings:graph.drawings.filter(item=>item.layerId===layer.id),name:layer.name};if(graph.visualExits)single.visualExits=graph.visualExits.filter(exit=>ids.has(exit.from)&&(!exit.to||ids.has(exit.to))).map(remap);return {name:layer.name,graph:single};});
 return {maps,atlas:graph,report};
}
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc>>>1^(crc&1?0xedb88320:0);}return (crc^-1)>>>0;}
async function readAtlas(bytes){if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);if(bytes.length>MAX_ZIP)throw new Error('Atlas file is too large.');let xml;if(bytes[0]===0x50&&bytes[1]===0x4b){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(view.getUint32(at,true)===0x06054b50){end=at;break;}if(end<0)throw new Error('ZIP directory is missing.');const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(count>128||offset>=bytes.length)throw new Error('ZIP directory is invalid.');let at=offset,entry=null;for(let i=0;i<count;i++){if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw new Error('ZIP entry is invalid.');const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),size=view.getUint32(at+20,true),expanded=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);if(at+46+nameLength+extra+comment>bytes.length)throw new Error('ZIP entry overruns file.');const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));if(/^Atlas\.xml$/i.test(name)){if(entry)throw new Error('ZIP has duplicate Atlas.xml entries.');entry={flags,method,crc,size,expanded,local};}at+=46+nameLength+extra+comment;}if(!entry)throw new Error('ZIP has no Atlas.xml.');if(entry.flags&1||entry.expanded>MAX_ATLAS||entry.size>MAX_ZIP||entry.local+30>bytes.length||view.getUint32(entry.local,true)!==0x04034b50)throw new Error('Atlas ZIP entry is unsupported.');const dataAt=entry.local+30+view.getUint16(entry.local+26,true)+view.getUint16(entry.local+28,true);if(dataAt+entry.size>bytes.length)throw new Error('Atlas ZIP data is incomplete.');let raw=bytes.subarray(dataAt,dataAt+entry.size);if(entry.method===8){if(typeof DecompressionStream!=='function')throw new Error('This WebView cannot decompress Atlas ZIP files.');const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_ATLAS){await reader.cancel();throw new Error('Atlas ZIP expands beyond the size limit.');}parts.push(value);}raw=new Uint8Array(total);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}}else if(entry.method!==0)throw new Error('Atlas ZIP compression is unsupported.');if(raw.length!==entry.expanded||crc32(raw)!==entry.crc)throw new Error('Atlas ZIP data failed validation.');xml=new TextDecoder('utf-8',{fatal:true}).decode(raw);}else xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return parseAtlasXml(xml);}
return {parseConfigTree,parseConfig,parseAtlasXml,readAtlas,MAX_CONFIG,MAX_ATLAS,MAX_ZIP};
});
