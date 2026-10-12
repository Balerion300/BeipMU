/* User-authored, opt-in scripts run in an isolated, disposable worker. MIT. */
'use strict';
(function(){
const post=postMessage.bind(self),MAX_EFFECTS=32,MAX_VALUE=8192,MAX_TIMERS=16;
let effects=[],context={},windowData=null,nextTimer=1,clientGMCP=null,eventType='',resultLine=null,resultEdits=null;
const hooks=new Map(),timers=new Map();
function expose(object){for(const key of Object.getOwnPropertyNames(object)){const lower=key.toLowerCase();if(!(lower in object))Object.defineProperty(object,lower,Object.getOwnPropertyDescriptor(object,key));}return Object.freeze(object);}
function effect(item){if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');effects.push(item);}
function bounded(value,max=MAX_VALUE){value=String(value);if(value.length>max)throw Error('Script value is too long.');return value;}
function unsupported(name){throw Error(name+' requires a native capability not implemented by this recovery runtime. See SCRIPT-PARITY.md.');}
const lineData=new WeakMap();
function htmlEscape(value){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function color(value){value=Number(value);if(!Number.isInteger(value)||value<0||value>0xffffff)throw Error('Color must be a Windows RGB value.');return '#'+[value&255,(value>>>8)&255,(value>>>16)&255].map(x=>x.toString(16).padStart(2,'0')).join('');}
function lineObject(text,html=false){
 const state={chars:[],changed:false,edits:[]};let style={};text=bounded(text);
 const add=value=>{for(const char of value.split(''))state.chars.push({char,style:{...style}});};
 if(html){const stack=[];for(const token of text.match(/<[^>]*>|[^<]+|</g)||[]){if(token[0]!=='<'){add(token.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,(all,key)=>{const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(named[key])return named[key];const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isSafeInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):all;}));continue;}
  const m=/^<\s*(\/?)\s*([a-z]+)\b([^>]*)>/i.exec(token);if(!m)continue;const name=m[2].toLowerCase();if(m[1]){const at=stack.map(x=>x.name).lastIndexOf(name);if(at>=0){style=stack[at].style;stack.splice(at);}continue;}if(name==='br'){add('\n');continue;}if(['b','strong','i','em','u','s','strike','font'].includes(name)){stack.push({name,style:{...style}});const attr={b:'bold',strong:'bold',i:'italic',em:'italic',u:'underline',s:'strike',strike:'strike'}[name];if(attr)style[attr]=true;if(name==='font'){const c=/\bcolor\s*=\s*["']?(#[\da-f]{6}|[a-z]+)\b/i.exec(m[3]);if(c)style.color=c[1];}}
 }}else add(text);
 const range=(start,end)=>{start=Number(start);end=Number(end);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>state.chars.length)throw Error('Invalid text range.');return [start,end];};
 const record=edit=>{if(state.edits.length>=128)throw Error('Line edit limit exceeded.');state.edits.push(edit);};
 const set=(key,start,end,value)=>{[start,end]=range(start,end);record({type:'style',start,end,style:{[key]:value}});for(let i=start;i<end;i++)state.chars[i].style[key]=value;state.changed=true;};
 const object={get String(){return state.chars.map(x=>x.char).join('');},get Length(){return state.chars.length;},get HTMLString(){return lineHTML(object);},
  Delete(start,end){[start,end]=range(start,end);record({type:'delete',start,end});state.chars.splice(start,end-start);state.changed=true;},
  Insert(position,line){range(position,position);const source=lineData.get(line);if(!source||source===state)throw Error('Insert expects a different TextWindowLine.');if(state.chars.length+source.chars.length>MAX_VALUE)throw Error('Text line is too long.');record({type:'insert',at:position,line:lineSnapshot(line)});state.chars.splice(position,0,...source.chars.map(x=>({char:x.char,style:{...x.style}})));state.changed=true;},
  Color:(start,end,value=0)=>set('color',start,end,color(value)),BgColor:(start,end,value=0)=>set('background',start,end,color(value)),
  Bold:(start,end,value=true)=>set('bold',start,end,!!value),Italic:(start,end,value=true)=>set('italic',start,end,!!value),Underline:(start,end,value=true)=>set('underline',start,end,!!value),Strikeout:(start,end,value=true)=>set('strike',start,end,!!value),
  Flash:()=>unsupported('TextWindowLine.Flash'),FlashMode:()=>unsupported('TextWindowLine.FlashMode'),Blink:()=>unsupported('TextWindowLine.Blink')};
 expose(object);lineData.set(object,state);return object;
}
function lineSnapshot(line){const state=lineData.get(line);if(!state)throw Error('Expected a TextWindowLine.');const runs=[];for(const item of state.chars){const previous=runs.at(-1);if(previous&&JSON.stringify(previous.style)===JSON.stringify(item.style))previous.text+=item.char;else runs.push({text:item.char,style:{...item.style}});}if(runs.length>512)throw Error('Text line has too many style runs.');return {text:line.String,runs};}
function lineHTML(line){return lineSnapshot(line).runs.map(run=>{let text=htmlEscape(run.text);for(const [key,tag] of [['bold','b'],['italic','i'],['underline','u'],['strike','s']])if(run.style[key])text='<'+tag+'>'+text+'</'+tag+'>';if(run.style.color||run.style.background)text='<font'+(run.style.color?' color="'+run.style.color+'"':'')+(run.style.background?' bgcolor="'+run.style.background+'"':'')+'>'+text+'</font>';return text;}).join('');}
function fromSnapshot(value){const line=lineObject(value?.text??value??'');if(Array.isArray(value?.runs)){const chars=lineData.get(line).chars;let offset=0;for(const run of value.runs)for(let i=0;i<run.text.length&&offset<chars.length;i++)chars[offset++].style={...run.style};}return line;}
function isAddress(value){
 const ipv4=text=>{const parts=text.split('.');return parts.length===4&&parts.every(x=>/^(0|[1-9]\d{0,2})$/.test(x)&&Number(x)<=255);};
 const text=String(value);if(!text.includes(':'))return ipv4(text);if(/[^\da-f:.]/i.test(text)||text.includes(':::')||text.split('::').length>2)return false;
 const compressed=text.includes('::');let groups=text.split(':').filter(Boolean);if(groups.at(-1)?.includes('.')){if(!ipv4(groups.pop()))return false;groups.push('0','0');}
 if(!groups.every(x=>/^[\da-f]{1,4}$/i.test(x)))return false;return compressed?groups.length<8:groups.length===8&&!text.startsWith(':')&&!text.endsWith(':');
}
function emit(type,value){
 if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');
 value=String(value);if(value.length>MAX_VALUE)throw Error('Script output is too long.');
 effects.push({type,value});
}
function timerEffect(type,timer){if(effects.length>=MAX_EFFECTS)throw Error('Script action limit exceeded.');effects.push(type==='timer-start'?{type,id:timer.id,delay:timer.delay,repeat:timer.repeat}:{type,id:timer.id});}
function hook(name,fn,data){if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');if(fn===null)hooks.delete(name);else hooks.set(name,{fn,data});}
function call(name,...args){const item=hooks.get(name);return item?item.fn(...args,item.data)===true:false;}
function outputLine(type,value){emit(type,value);}
const output=expose({write:value=>outputLine('output',value),Write:value=>outputLine('output',value),writeHTML:value=>outputLine('html',value),WriteHTML:value=>outputLine('html',value),Create:value=>lineObject(value),CreateHTML:value=>lineObject(value,true),Add:line=>effect({type:'output-line',line:lineSnapshot(line)}),get Paused(){return !!context.paused;},SetOnPause:fn=>hook('pause',fn),get Properties(){return expose({get Title(){return context.title||'';},get HWND(){return unsupported('Window_Properties.HWND');}});}});
function collection(items){
 const list=Array.isArray(items)?items:[];
 const get=value=>typeof value==='number'?list[value]||null:list.find(item=>item.name?.toLocaleLowerCase()===String(value).toLocaleLowerCase())||null;
 const result=value=>get(value);result.Item=get;Object.defineProperty(result,'Count',{get:()=>list.length});return expose(result);
}
function profileProperties(object,item,kind){
 const resolve=()=>{const active=context[kind];if(active?.id===item.id)return active;if(kind==='world')return (context.worlds||[]).find(x=>x.id===item.id)||item;return (context.worlds||[]).flatMap(x=>x.characters||[]).find(x=>x.id===item.id)||item;};
 for(const [property,key,max] of [['Name','name',160],['Shortcut','name',160],['Info','notes',1024],...(kind==='world'?[['Host','host',256]]:[])])Object.defineProperty(object,property,{enumerable:true,get(){return resolve()[key]||'';},set(value){if(context[kind]?.id!==item.id)throw Error('Profile changes require the owning session.');value=bounded(value,max);if((key==='name'||key==='host')&&(!value.trim()||/[\r\n\0]/.test(value)))throw Error('Invalid profile value.');effect({type:'profile-set',kind,id:item.id,key,value});resolve()[key]=value;}});
 return expose(object);
}
function characterObject(item){if(!item)return null;return profileProperties({id:item.id,LastUsed:item.lastUsed?new Date(item.lastUsed):undefined,TimeCreated:item.timeCreated?new Date(item.timeCreated):undefined,get Connect(){return unsupported('Character.Connect (credential-sensitive)');},set Connect(value){unsupported('Character.Connect (credential-sensitive)');},get LogFileName(){return item.logFileName||'';},set LogFileName(value){unsupported('Character.LogFileName');},get Puppets(){return unsupported('Character.Puppets');},get Triggers(){return unsupported('Character.Triggers');},get Aliases(){return unsupported('Character.Aliases');}},item,'character');}
function worldObject(item){if(!item)return null;const characters=collection((item.characters||[]).map(characterObject));return profileProperties({id:item.id,Characters:characters,get Triggers(){return unsupported('World.Triggers');},get Aliases(){return unsupported('World.Aliases');}},item,'world');}
function windowSummary(item){if(item.id===context.sessionId)return windowObject;return expose({id:item.id,name:item.title,Title:item.title,get Connection(){return unsupported('Cross-session Connection');},Run:()=>unsupported('Cross-session Run')});}
function inputObject(id,generation){
 const resolve=()=>{const value=id==='primary'?context.input:(context.inputs||[]).find(pane=>pane.id===id&&pane.generation===generation);if(!value)throw Error('Input pane is closed or was replaced.');return value;};
 const target=value=>value.generation?{id,generation:value.generation}:{};
 const text=value=>{value=bounded(value,65536);if(value.includes('\0'))throw Error('Invalid input text.');return value.replace(/\r\n?|\n/g,'\n');};
 const property=(key,max,value)=>{const pane=resolve();if(!pane.generation)throw Error('Input metadata is unavailable.');value=bounded(value,max);if(/[\r\n\0]/.test(value))throw Error('Input '+key+' must be one line.');effect({type:'input-configure',key,value,...target(pane)});pane[key]=value;};
 return expose({
  Get:()=>resolve().text||'',
  Set(value){const pane=resolve();value=text(value);effect({type:'input-set',value,...target(pane)});pane.text=pane.prefix&&value.startsWith(pane.prefix)?value.slice(pane.prefix.length):value;pane.start=pane.end=pane.text.length;},
  SetSel(start,end){const pane=resolve(),length=pane.text?.length||0;start=Number(start);end=Number(end);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))throw Error('Invalid input selection.');start=Math.max(0,Math.min(length,start));end=Math.max(start,Math.min(length,end));effect({type:'input-select',start,end,...target(pane)});pane.start=start;pane.end=end;},
  GetSelStart:()=>resolve().start||0,GetSelEnd:()=>resolve().end||0,
  get Length(){return resolve().text?.length||0;},
  get Prefix(){return resolve().prefix||'';},set Prefix(value){property('prefix',2048,value);},
  get Title(){return resolve().title||'';},set Title(value){property('title',160,value);}
 });
}
const input=inputObject('primary');
const connection={
 send(value){value=bounded(value);if(!context.connected)return;effect({type:'send-event',value});if(!call('send',value))effect({type:'send',value,event:true});},
 Send(value){return connection.send(value);},
 transmit(value){if(context.connected)effect({type:'send',value:bounded(value),event:false});},Transmit(value){return connection.transmit(value);},
 display:value=>emit('display',value),Display:value=>emit('display',value),
 Receive(value){if(eventType==='line')throw Error('Receive during a Receive callback is not allowed; use Display.');emit('receive',value);},
 SetOnDisplay:(fn,data)=>hook('display',fn,data),
 Reconnect(){if(context.connected||!context.canReconnect)return false;emit('reconnect','');return true;},
 get Window_Main(){return windowObject;},get Puppet(){return null;},
 get Log(){if(!context.logging)return null;return expose({get FileName(){return context.logFileName||'';},Write:value=>emit('log-write',value),WriteLine:line=>emit('log-write',lineSnapshot(line).text)});},
 SetOnSend:(fn,data)=>hook('send',fn,data),SetOnReceive:(fn,data)=>hook('receive',fn,data),
 SetOnGMCP:(fn,data)=>hook('gmcp',fn,data),
 SetOnConnect:(fn,data)=>hook('connect',fn,data),SetOnDisconnect:(fn,data)=>hook('disconnect',fn,data),
 IsConnected:()=>!!context.connected,IsLogging:()=>!!context.logging,
 isconnected:()=>!!context.connected,islogging:()=>!!context.logging,
 get World(){return worldObject(context.world);},get Character(){return characterObject(context.character);}
};
expose(connection);
const windowObject={output,Output:output,input,Input:input,connection,Connection:connection,
 GetInput(title){title=bounded(title,160);const pane=(context.inputs||[]).find(pane=>pane.title===title);return pane?inputObject(pane.id,pane.generation):null;},
 SetOnCommand:(fn,data)=>hook('command',fn,data),Run:value=>emit('run',value),RunFile:()=>unsupported('Window_Main.RunFile'),
 SetOnActivate:(fn,data)=>hook('activate',fn,data),SetOnClose:(fn,data)=>hook('close',fn,data),Close:()=>emit('close',''),
 GetVariable(name){return Object.hasOwn(context.variables||{},String(name))?context.variables[String(name)]:null;},
 SetVariable(name,value){name=bounded(name,128);value=bounded(value,4096);if(!name||/[\r\n\0]/.test(name))throw Error('Invalid variable name.');const variables={...context.variables,[name]:value};if(Object.keys(variables).length>128||Object.entries(variables).reduce((n,[k,v])=>n+k.length+v.length,0)>65536)throw Error('Variable limit exceeded.');effect({type:'variable-set',name,value});context.variables=variables;},
 DeleteVariable(name){name=bounded(name,128);if(!Object.hasOwn(context.variables||{},name))throw Error('Variable not found.');effect({type:'variable-delete',name});delete context.variables[name];},
 get TitlePrefix(){return context.titlePrefix||'';},set TitlePrefix(value){value=bounded(value,160);emit('title-prefix',value);context.titlePrefix=value;},
 Activity:()=>effect({type:'activity',important:false}),AddImportantActivity:()=>effect({type:'activity',important:true}),
 CreateDialogConnect(){if(context.connected)throw Error('Already connected.');emit('connect-dialog','');},
 get UserData(){return windowData;},set UserData(value){windowData=value;},
 get userdata(){return windowData;},set userdata(value){windowData=value;},
 get Title(){return context.title||context.character?.name||context.world?.name||'';}};
expose(windowObject);
function newTimer(delay,fn,data,repeat){
 delay=Number(delay);
 if(!Number.isSafeInteger(delay)||delay<100||delay>3600000)throw Error('Timer interval must be 100–3600000 ms.');
 if(typeof fn!=='function')throw Error('Expected a timer callback.');
 if(timers.size>=MAX_TIMERS)throw Error('Script timer limit exceeded.');
 const timer={id:nextTimer++,delay,repeat,fn,data};timerEffect('timer-start',timer);timers.set(timer.id,timer);
 const result={get Active(){return timers.has(timer.id);},get UserData(){return timer.data;},set UserData(value){timer.data=value;},Kill(){if(!timers.has(timer.id))return;timerEffect('timer-stop',timer);timers.delete(timer.id);}};
 return expose(result);
}
const app={
 CreateTimeout:(ms,fn,data)=>newTimer(ms,fn,data,false),
 CreateInterval:(ms,fn,data)=>newTimer(ms,fn,data,true),
 createtimeout:(ms,fn,data)=>newTimer(ms,fn,data,false),
 createinterval:(ms,fn,data)=>newTimer(ms,fn,data,true),
 get Worlds(){return collection((context.worlds||[]).map(worldObject));},get worlds(){return collection((context.worlds||[]).map(worldObject));},
 get Windows(){return collection((context.windows||[]).map(windowSummary));},get windows(){return collection((context.windows||[]).map(windowSummary));},
 get Version(){return Number(context.version)||0;},get BuildDate(){return context.buildDate?new Date(context.buildDate):undefined;},
 IsAddress:isAddress,
 ActiveXObject:()=>unsupported('App.ActiveXObject'),get ConfigPath(){return unsupported('App.ConfigPath');},
 New_Socket:()=>unsupported('App.New_Socket'),New_SocketServer:()=>unsupported('App.New_SocketServer'),ForwardDNSLookup:()=>unsupported('App.ForwardDNSLookup'),ReverseDNSLookup:()=>unsupported('App.ReverseDNSLookup'),
 NewWindow:()=>unsupported('App.NewWindow'),NewWindow_Text:()=>unsupported('App.NewWindow_Text'),NewWindow_FixedText:()=>unsupported('App.NewWindow_FixedText'),NewWindow_Graphics:()=>unsupported('App.NewWindow_Graphics'),
 NewTrigger:()=>unsupported('App.NewTrigger'),get Triggers(){return unsupported('App.Triggers');},get Aliases(){return unsupported('App.Aliases');},
 PlaySound(filename,volume=1){if(Number(volume)!==1)throw Error('Per-script volume is not implemented.');emit('play-sound',filename);},StopSounds:()=>emit('stop-sounds',''),
 OutputDebugHTML:value=>emit('debug',lineObject(bounded(value,512),true).String),
 OutputDebugText:value=>emit('debug',String(value).slice(0,512)),outputdebugtext:value=>emit('debug',String(value).slice(0,512)),
 get BuildNumber(){return Number(context.buildNumber)||0;},get buildnumber(){return Number(context.buildNumber)||0;}
};
expose(app);
const client=Object.freeze({send:connection.send,write:output.write,on:(name,fn)=>{
 if(name==='line')connection.SetOnReceive(fn);
 else if(name==='gmcp'){if(fn!==null&&typeof fn!=='function')throw Error('Expected a function.');clientGMCP=fn;}
 else if(name==='send')connection.SetOnSend(fn);
 else throw Error('Supported events: line, gmcp, send.');
}});
for(const [name,value] of [['window',windowObject],['app',app],['client',client]])Object.defineProperty(self,name,{value,writable:false,configurable:false});
// Keep all native I/O and scheduling behind the host's allowlisted effect bridge.
for(const name of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','BroadcastChannel','Worker','SharedWorker','setTimeout','setInterval','postMessage']){
 try{Object.defineProperty(self,name,{value:undefined,writable:false,configurable:false});}catch{}
}
if(typeof self.postMessage==='function')throw Error('Script worker could not isolate messaging.');
function triggerRanges(values){
 const list=Array.isArray(values)?values:[];
 const at=index=>list[Number(index)]||0;at.Item=at;Object.defineProperty(at,'Count',{get:()=>list.length});return Object.freeze(at);
}
async function run(type,value){
 if(type==='eval'){const result=(0,eval)(String(value));if(result&&typeof result.then==='function')await result;return false;}
 if(type==='line')return call('receive',String(value));
 if(type==='display'){const line=fromSnapshot(value);const handled=call('display',line);if(lineData.get(line).changed){resultLine=lineSnapshot(line);resultEdits=lineData.get(line).edits;}return handled;}
 if(type==='activate')return call('activate',value==='true'||value===true);
 if(type==='close')return call('close');
 if(type==='pause')return call('pause',output,value==='true'||value===true);
 if(type==='send')return call('send',String(value));
 if(type==='gmcp'){
  const raw=String(value),item=hooks.get('gmcp');let handled=item?item.fn(raw,item.data)===true:false;
  if(clientGMCP){const at=raw.indexOf(' ');if(clientGMCP(at<0?raw:raw.slice(0,at),at<0?null:JSON.parse(raw.slice(at+1)))===true)handled=true;}
  return handled;
 }
 if(type==='connect'||type==='disconnect')return call(type);
 if(type==='command'){const raw=String(value).replace(/^\/(?!\/)/,''),space=raw.indexOf(' ');return call('command',space<0?raw:raw.slice(0,space),space<0?'':raw.slice(space+1));}
 if(type==='timer'){
  const timer=timers.get(Number(value));if(!timer)return false;
  if(!timer.repeat)timers.delete(timer.id);
  if(timer.fn(timer.data)===true&&timer.repeat){timers.delete(timer.id);timerEffect('timer-stop',timer);}
  return false;
 }
 if(type==='trigger'){
  const name=String(value?.name||'');if(!/^[A-Za-z_$][\w$]{0,79}$/.test(name))throw Error('Trigger script name is invalid.');
  const fn=self[name];if(typeof fn!=='function')throw Error('Trigger script '+name+' was not found.');
  const text=String(value?.text||'');
  const line=value?.line?fromSnapshot(value.line):lineObject(text);const handled=fn(windowObject,line,triggerRanges(value?.ranges))===true;
  if(lineData.get(line).changed){resultLine=lineSnapshot(line);resultEdits=lineData.get(line).edits;}return handled;
 }
 return false;
}
self.onmessage=async event=>{
 const {id,type,value}=event.data||{};effects=[];resultLine=null;resultEdits=null;eventType=type;
 try{
  if(event.data?.context&&typeof event.data.context==='object')context=event.data.context;
  const handled=await run(type,value);
  post({id,handled,effects,...(resultLine?{line:resultLine,lineEdits:resultEdits}:{})});
 }catch(error){
  // No partial commands or display updates escape a failed script event.
  effects=[];post({id,handled:false,effects,error:String(error?.message||error).slice(0,512)});
 }
};
})();
