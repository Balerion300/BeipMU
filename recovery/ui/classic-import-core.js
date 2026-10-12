/* Bounded readers for the original Config.txt and Atlas map formats. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipImportCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
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
// Original saves character Output/Input nodes only when those settings override global.
// Window height is stored separately. Only the recovery's supported fields survive.
function profileWindowPreferences(profile){
 const main=child(profile,'MainWindowSettings');if(!main)return null;
 const output=child(main,'Output'),input=child(main,'Input'),outputValues={},inputValues={};
 function bounded(raw,min,max){if(raw==null||!/^\d+(?:\.\d+)?$/.test(raw))return undefined;const n=Number(raw);return Number.isFinite(n)&&n>0?Math.max(min,Math.min(max,Math.round(n))):undefined;}
 const font=bounded(field(output,'Font.Size'),10,30),history=bounded(value(output,'History'),100,20000),height=bounded(value(main,'InputSize'),40,300);
 if(font!==undefined)outputValues.fontSize=font;
 const family=field(output,'Font.Name');if(family)outputValues.fontFamily=/^(consolas|courier new|lucida console)$/i.test(family)?'monospace':'system';
 if(history!==undefined)outputValues.scrollback=history;
 const echo=value(input,'LocalEcho');if(echo!=null&&/^(true|false|t|f|1|0)$/i.test(echo))inputValues.localEcho=flag(input,'LocalEcho');
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
 const globalAliasActive=flag(child(connections,'Aliases'),'Active'),globalTriggerActive=flag(child(connections,'Triggers'),'Active',true);
 function walkRules(container,kind,where,active=true,parentId=null,depth=1){
  if(!container)return;
  const target=kind==='trigger'?result.triggers:result.aliases,nestedName=kind==='trigger'?'Triggers':'Aliases';
  const enabled=active&&(kind==='trigger'?flag(container,'Active',true):globalAliasActive);
  const entries=children(container,''),rawAfter=Number(value(container,'AfterCount')||0),after=Number.isSafeInteger(rawAfter)&&rawAfter>=0?Math.min(entries.length,rawAfter):0;
  for(const [index,n] of entries.entries()){
   if(depth>8){skipped('Rule trees beyond eight levels');continue;}
   if(target.length>=128){skipped('Excess '+(kind==='trigger'?'triggers':'aliases'));continue;}
   const nested=child(n,nestedName),hasChildren=!!children(nested,'').length;
   // Original Disabled bypasses a trigger's own match/effects, but processes its children.
   const folder=kind==='trigger'?flag(n,'Disabled'):flag(n,'Folder');
   if(kind==='trigger'&&flag(n,'Multiline')){skipped('Multiline trigger subtrees');continue;}
   if(kind==='trigger'&&flag(child(n,'Spawn'),'Active')&&flag(child(n,'Spawn'),'OnlyChildrenDuringCapture')&&value(child(n,'Spawn'),'CaptureUntil')){skipped('Capture-only child trigger subtrees');continue;}
   // A skipped text mutation could make a previously false child condition true.
   if(kind==='trigger'&&!folder&&hasChildren&&(flag(child(n,'Script'),'Active')||flag(child(n,'Filter'),'Active')&&(flag(child(n,'Filter'),'HTML')||(value(child(n,'Filter'),'Replace')||'').length>4096))){skipped('Unsupported text-changing trigger subtrees');continue;}
   const found=findRule(n);
   if(!folder&&(!found.match||found.match.length>128||found.matchType==='regex'&&(()=>{try{new RegExp(found.match);return false;}catch{return true;}})())){skipped('Unusable '+kind+' patterns');continue;}
   const basic={id:safeId(kind==='trigger'?'impt':'impa',kind==='trigger'?++nextTrigger:++nextAlias),scope:where,enabled,description:(value(n,'Description')||'').slice(0,80),...(!folder?found:{folder:true}),stopProcessing:!folder&&flag(n,'StopProcessing')};
   if(parentId)basic.parentId=parentId;
   else if(where.level!=='character'&&index>=entries.length-after)basic.phase='after';
   if(nested)basic.processChildren=kind==='alias'||flag(nested,'Active',true);
   if(folder){target.push(basic);walkRules(nested,kind,where,enabled,basic.id,depth+1);continue;}
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
     if(flag(send,'SendOnClick'))skipped('Click-only trigger sends');
     else if(command&&!/[\r\n]/.test(command)&&command.length<=4096&&safeAutomation(command)){rule.sendText=command;rule.sendExpandVariables=flag(send,'ExpandVariables');}
     else skipped('Unsupported or script trigger sends');
    }
    if(flag(spawn,'Active')){rule.spawnTitle=(value(spawn,'Title')||'').slice(0,80);rule.spawnGroup=(value(spawn,'TabGroup')||'').slice(0,80);rule.captureUntil=(value(spawn,'CaptureUntil')||'').slice(0,256);rule.spawnCopy=flag(spawn,'Copy');rule.spawnGagLog=flag(spawn,'GagLog');if(rule.captureUntil){try{new RegExp(rule.captureUntil);}catch{rule.captureUntil='';skipped('Unsupported capture patterns');}}if(!rule.spawnTitle){delete rule.spawnTitle;skipped('Untitled spawn actions');}}
    if(flag(filter,'Active')){
     const replacement=value(filter,'Replace')||'';
     if(flag(filter,'HTML')||replacement.length>4096)skipped('Unsupported trigger filters');
     else {rule.filterText=replacement;rule.filterExpandVariables=flag(filter,'ExpandVariables');}
    }
    rule.gag=flag(gag,'Active');rule.logGag=flag(gag,'Log');rule.notify=flag(toast,'Active');
    const highlight={};if(flag(color,'UseForeColor')){const c=rgb(value(color,'ForeColor'));if(c)highlight.color=c;else skipped('Unsupported trigger colors');}if(flag(color,'UseBackColor')){const c=rgb(value(color,'BackColor'));if(c)highlight.background=c;else skipped('Unsupported trigger colors');}highlight.wholeLine=flag(color,'WholeLine')||flag(style,'WholeLine');for(const x of ['Bold','Italic','Underline','Strikeout'])if(flag(style,'Set'+x))highlight[x==='Strikeout'?'strike':x.toLowerCase()]=flag(style,x);if(Object.keys(highlight).length>1||Object.values(highlight).some(Boolean))rule.highlight=highlight;
    if(flag(n,'Cooldown'))rule.cooldownMs=Math.max(0,Math.min(86400000,Math.round(Number(value(n,'CooldownTime')||0)*1000)||0));
    if(flag(sound,'Active')){const path=value(sound,'Sound')||'';if(path&&path.length<=1024&&!/[\u0000-\u001f]/.test(path)&&!/%[^%]+%/.test(path))rule.sound={enabled:true,path};else skipped('Unsupported variable or invalid sound paths');}
    if(flag(speech,'Active')){const text=value(speech,'Say')||'',wholeLine=flag(speech,'WholeLine');if(text.length<=2048&&(wholeLine||text))rule.speech={enabled:true,wholeLine,text};else skipped('Unsupported speech text');}
    if(child(n,'Paragraph')||child(n,'Script')||child(n,'Stat')||child(n,'Extensions'))skipped('Unsupported trigger effects');
    if(!hasChildren&&!rule.stopProcessing&&!rule.highlight&&!rule.gag&&!rule.logGag&&!rule.sendText&&!rule.spawnTitle&&!rule.notify&&!rule.sound&&!rule.speech&&typeof rule.filterText!=='string'){skipped('Triggers with no supported action');continue;}
    target.push(rule);
   }
   walkRules(nested,kind,where,enabled,basic.id,depth+1);
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
 function walkMacros(container,where,active=true,folder=''){if(!container)return;const enabled=active&&flag(container,'Active',true);for(const n of children(container,'')){const nested=child(n,'KeyboardMacros2');if(flag(n,'Folder')||nested){skipped('Folders flattened');walkMacros(nested,where,enabled,folder+(value(n,'Description')||'')+' / ');continue;}const text=value(n,'Macro')||'',key=macroKey(value(n,'key')||'');if(!key||!text||text.length>65536||!safeAutomation(text)){skipped('Unsupported or script macros');continue;}result.macros.push({id:safeId('impm',++nextMacro),scope:where,enabled,description:(folder+(value(n,'Description')||'')).slice(0,80),key,text,mode:flag(n,'Type')?'type':'send'});}}
 walkRules(child(connections,'Aliases'),'alias',{level:'global'});walkRules(child(connections,'Triggers'),'trigger',{level:'global'});walkMacros(child(connections,'KeyboardMacros2'),{level:'global'});
 for(const server of shortcuts?.children||[]){const host=hostPort(value(server,'Host'));if(!host||result.worlds.length>=128){skipped('Invalid or excess worlds');continue;}const world={id:safeId('impw',++nextWorld),name:(server.name||'World').slice(0,80),...host,tls:flag(server,'TLS'),autoConnect:false,openAtStartup:false,notes:(value(server,'Info')||'').slice(0,16384)};const worldPreferences=profileWindowPreferences(server);if(worldPreferences)world.preferences=worldPreferences;result.worlds.push(world);const ws={level:'server',serverId:world.id};walkRules(child(server,'Aliases'),'alias',ws);walkRules(child(server,'Triggers'),'trigger',ws,globalTriggerActive);walkMacros(child(server,'KeyboardMacros2'),ws);const chars=child(server,'Characters');for(const character of chars?.children||[]){if(!character.name||result.characters.length>=256){skipped('Invalid or excess characters');continue;}const id=safeId('impc',++nextCharacter),name=character.name.slice(0,80);result.characters.push({id,worldId:world.id,name,variables:characterVariables(character),loginName:'',autoLogin:false,openAtStartup:false,autoConnect:false,allowPlainLogin:false,notes:(value(character,'Info')||'').slice(0,16384),...(profileWindowPreferences(character)?{preferences:profileWindowPreferences(character)}:{})});const cs={level:'character',serverId:world.id,characterId:id};walkRules(child(character,'Aliases'),'alias',cs);walkRules(child(character,'Triggers'),'trigger',cs,globalTriggerActive&&flag(child(server,'Triggers'),'Active',true));walkMacros(child(character,'KeyboardMacros2'),cs);if(value(character,'Password')||value(character,'Connect'))skipped('Credentials and login commands omitted');}}
 if(result.aliases.length>128){skipped('Excess aliases',result.aliases.length-128);result.aliases.length=128;}if(result.triggers.length>128){skipped('Excess triggers',result.triggers.length-128);result.triggers.length=128;}if(result.macros.length>128){skipped('Excess macros',result.macros.length-128);result.macros.length=128;}
 const global=child(tree,'Global')||tree,windows=child(tree,'Windows'),main=child(windows,'MainWindowSettings'),output=child(main,'Output'),input=child(main,'Input');const pref=result.preferences;const font=Number(field(output,'Font.Size'));if(Number.isInteger(font)&&font>=10&&font<=30)pref.fontSize=font;const family=field(output,'Font.Name');if(family)pref.fontFamily=/^(consolas|courier new|lucida console)$/i.test(family)?'monospace':'system';const history=Number(value(output,'History'));if(Number.isInteger(history)&&history>=100&&history<=20000)pref.scrollback=history;if(value(input,'LocalEcho')!=null)pref.localEcho=flag(input,'LocalEcho');const size=Number(value(main,'InputSize'));if(Number.isInteger(size)&&size>=40&&size<=300)pref.inputHeight=size;if(value(global,'InlineImages')!=null)pref.inlineImages=flag(global,'InlineImages');const theme=Number(value(global,'Theme'));if(theme===0||theme===1)pref.theme=theme===1?'dark':'light';result.report.notes.push('Passwords, connect strings, startup actions, scripts, and unsupported effects are not imported.');if(result.triggers.some(rule=>rule.sound))result.report.notes.push('Imported sound paths stay silent until trigger sounds are enabled in Preferences.');return result;
}
function xmlEntities(value){return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos);/gi,(_,entity)=>{const table={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity[0]==='#'){const code=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isInteger(code)&&code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}return table[entity.toLowerCase()]||'';});}
function attrs(source){const result=Object.create(null),regex=/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let hit;while((hit=regex.exec(source)))result[hit[1]]=xmlEntities(hit[2]??hit[3]);return result;}
function parseAtlasXml(source){
 if(typeof source!=='string'||source.length>MAX_ATLAS)throw new Error('Atlas XML is too large.');
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('Atlas XML entities are unsupported.');
 const atlasTag=/<atlas\b([^>]*)>/i.exec(source);if(!atlasTag)throw new Error('Not an Atlas XML file.');
 const maps=[],report={skipped:Object.create(null),notes:['Rooms, supported styles, and traversable exits retain their map coordinates and route bends. Drawings, images, labels, and cross-layer links are not imported.']};
 const skipped=key=>{report.skipped[key]=(report.skipped[key]||0)+1;};
 const validColor=value=>/^#[0-9a-f]{6}$/i.test(value||'');
 const palette=attrs(atlasTag[1]);
 const points=value=>{if(!value)return undefined;const parsed=value.split('|').map(pair=>pair.split(',').map(Number));return parsed.length<=32&&parsed.every(pair=>pair.length===2&&pair.every(x=>Number.isInteger(x)&&Math.abs(x)<=100000))?parsed:null;};
 const mapRegex=/<map\b([^>]*)>([\s\S]*?)<\/map\s*>/gi;let match;
 while((match=mapRegex.exec(source))){
  if(maps.length>=16){skipped('Excess maps');break;}
  const meta=attrs(match[1]),body=match[2],rooms=[],exits=[];
  let index=0;
  for(const tag of body.matchAll(/<room\b([^>]*?)\/?\s*>/gi)){
   if(index>=1024){skipped('Excess rooms');break;}
   const a=attrs(tag[1]),numbers=(a.rect||'').split(',').map(Number),title=(a.name||'').replace(/[\u0000-\u001f]/g,' ').trim();
   if(numbers.length!==4||numbers.some(x=>!Number.isFinite(x))||!title||title.length>160){rooms.push(null);skipped('Invalid rooms');index++;continue;}
   const x=Math.round((numbers[0]+numbers[2])/2),y=Math.round((numbers[1]+numbers[3])/2);
   if(Math.abs(x)>100000||Math.abs(y)>100000){rooms.push(null);skipped('Out-of-range rooms');index++;continue;}
   const room={id:'r'+index,title,x,y};
   if(numbers.every(Number.isInteger)&&numbers[0]<numbers[2]&&numbers[1]<numbers[3])room.rect=numbers;
   else skipped('Unsupported room rectangles');
   if(a.color){if(validColor(a.color))room.color=a.color;else skipped('Unsupported room colors');}
   if(a.color_outline){if(validColor(a.color_outline))room.outlineColor=a.color_outline;else skipped('Unsupported room colors');}
   if(a.text_angle){const angle=Number(a.text_angle);if(Number.isInteger(angle)&&angle>=0&&angle<360)room.textAngle=angle;else skipped('Unsupported text angles');}
   if(a.under_construction)room.underConstruction=/^(?:t|true|1)$/i.test(a.under_construction);
   rooms.push(room);index++;
  }
  let exitIndex=0,sourceExits=0;
  for(const tag of body.matchAll(/<exit\b([^>]*?)\/?\s*>/gi)){
   if(++sourceExits>8192){skipped('Excess exits');break;}
   const a=attrs(tag[1]),mapIndex=maps.length;
   if((a.map_from!==undefined&&Number(a.map_from)!==mapIndex)||(a.map_to!==undefined&&Number(a.map_to)!==mapIndex)){skipped('Cross-layer exits');continue;}
   const from=rooms[Number(a.from)],to=rooms[Number(a.to)];
   if(!from||!to){skipped('Unresolved exits');continue;}
   const route=points(a.points);if(route===null)skipped('Unsupported exit points');
   if(a.points_split)skipped('Split exit routing');
   const pair='p'+sourceExits;
   for(const [origin,target,command,reverse] of [[from,to,a.name_from,false],[to,from,a.name_to,true]]){
    if(!command||command.length>256||/[\u0000-\u001f\u007f]/.test(command)){skipped('Unroutable exit directions');continue;}
    if(exits.length>=4096){skipped('Excess exits');break;}
    const exit={id:'e'+exitIndex++,from:origin.id,to:target.id,command,atlasPair:pair};
    if(route)exit.points=reverse?[...route].reverse():route.map(point=>[...point]);
    exits.push(exit);
   }
  }
  const name=(meta.name||'Map '+(maps.length+1)).replace(/[\u0000-\u001f]/g,' ').slice(0,80);
  const graph={version:1,name,rooms:rooms.filter(Boolean),exits,currentRoomId:null};
  for(const [source,target] of [['color_background','backgroundColor'],['color_exit','exitColor']])if(palette[source]){if(validColor(palette[source]))graph[target]=palette[source];else skipped('Unsupported atlas colors');}
  maps.push({name,graph});
 }
 const outside=source.replace(/<map\b[^>]*>[\s\S]*?<\/map\s*>/gi,'');
 for(const tag of outside.matchAll(/<exit\b[^>]*\/?\s*>/gi))skipped('Cross-layer exits');
 if(!maps.length)throw new Error('Atlas contains no maps.');
 return {maps,report};
}
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc>>>1^(crc&1?0xedb88320:0);}return (crc^-1)>>>0;}
async function readAtlas(bytes){if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);if(bytes.length>MAX_ZIP)throw new Error('Atlas file is too large.');let xml;if(bytes[0]===0x50&&bytes[1]===0x4b){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(view.getUint32(at,true)===0x06054b50){end=at;break;}if(end<0)throw new Error('ZIP directory is missing.');const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);if(count>128||offset>=bytes.length)throw new Error('ZIP directory is invalid.');let at=offset,entry=null;for(let i=0;i<count;i++){if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw new Error('ZIP entry is invalid.');const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),size=view.getUint32(at+20,true),expanded=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);if(at+46+nameLength+extra+comment>bytes.length)throw new Error('ZIP entry overruns file.');const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));if(/^Atlas\.xml$/i.test(name)){if(entry)throw new Error('ZIP has duplicate Atlas.xml entries.');entry={flags,method,crc,size,expanded,local};}at+=46+nameLength+extra+comment;}if(!entry)throw new Error('ZIP has no Atlas.xml.');if(entry.flags&1||entry.expanded>MAX_ATLAS||entry.size>MAX_ZIP||entry.local+30>bytes.length||view.getUint32(entry.local,true)!==0x04034b50)throw new Error('Atlas ZIP entry is unsupported.');const dataAt=entry.local+30+view.getUint16(entry.local+26,true)+view.getUint16(entry.local+28,true);if(dataAt+entry.size>bytes.length)throw new Error('Atlas ZIP data is incomplete.');let raw=bytes.subarray(dataAt,dataAt+entry.size);if(entry.method===8){if(typeof DecompressionStream!=='function')throw new Error('This WebView cannot decompress Atlas ZIP files.');const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_ATLAS){await reader.cancel();throw new Error('Atlas ZIP expands beyond the size limit.');}parts.push(value);}raw=new Uint8Array(total);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}}else if(entry.method!==0)throw new Error('Atlas ZIP compression is unsupported.');if(raw.length!==entry.expanded||crc32(raw)!==entry.crc)throw new Error('Atlas ZIP data failed validation.');xml=new TextDecoder('utf-8',{fatal:true}).decode(raw);}else xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return parseAtlasXml(xml);}
return {parseConfigTree,parseConfig,parseAtlasXml,readAtlas,MAX_CONFIG,MAX_ATLAS,MAX_ZIP};
});
