const assert=require('node:assert/strict');
const {normalizeSettings,serializeSettings,startupPlan}=require('../ui/profile-model.js');
let passed=0;
function check(name,fn){fn();console.log('PASS '+name);passed++;}
const world=(id,extra={})=>({id,name:'World '+id,host:'mud.example',port:'4000',...extra});
const character=(id,worldId,extra={})=>({id,worldId,name:'Character '+id,...extra});
check('World and character identity fields survive, credentials and session data do not',()=>{
 const raw={worlds:[world('w1',{tls:true,password:'secret',history:['look'],transcript:'private'})],
  characters:[character('c1','w1',{loginName:'PlayerOne',autoLogin:true,allowPlainLogin:true,password:'secret',credential:{password:'secret'},connectString:'connect secret',commandHistory:['quit'],openAtStartup:true})],
  preferences:{fontSize:17},password:'top secret',transcripts:['private'],history:['look']};
 const result=serializeSettings(raw),json=JSON.stringify(result);
 assert.equal(result.worlds[0].tls,true);
 assert.equal(result.characters[0].openAtStartup,true);
 assert.equal(result.characters[0].loginName,'PlayerOne');
 assert.equal(result.characters[0].autoLogin,true);
 assert.equal(result.characters[0].allowPlainLogin,true);
 for(const forbidden of ['password','secret','connectString','commandHistory','transcript','history'])assert.equal(json.includes(forbidden),false,forbidden);
});
check('Invalid login names disable automatic login and vault status is never serialized',()=>{
 const result=serializeSettings({worlds:[world('w1')],characters:[character('c1','w1',{loginName:'bad\nname',autoLogin:true,vaultStatus:'on',password:'private'})],secretStatuses:new Map([['c1','on']])});
 assert.equal(result.characters[0].loginName,'');
 assert.equal(result.characters[0].autoLogin,false);
 assert.equal(JSON.stringify(result).includes('private'),false);
 assert.equal(JSON.stringify(result).includes('vaultStatus'),false);
 assert.equal(JSON.stringify(result).includes('secretStatuses'),false);
});
check('Invalid hosts, IDs, ports, duplicates, and orphaned characters are dropped',()=>{
 const result=normalizeSettings({worlds:[world('w1'),world('w1',{host:'different.example'}),world('bad id'),world('w2',{port:'0'}),world('w3',{host:'bad host'})],
  characters:[character('c1','w1'),character('c2','missing'),character('c1','w1')]});
 assert.deepEqual(result.worlds.map(x=>x.id),['w1']);
 assert.deepEqual(result.characters.map(x=>x.id),['c1']);
});
check('Preferences are clamped and unknown fields are excluded',()=>{
 const result=normalizeSettings({preferences:{fontSize:300,scrollback:1,theme:'sunset',fontFamily:'Comic Sans',inlineImages:false,localEcho:true,defaultLogging:true,secret:'discard'}});
 assert.deepEqual(result.preferences,{fontSize:30,fontFamily:'monospace',theme:'dark',scrollback:100,inlineImages:false,localEcho:true,defaultLogging:true,mediaEnabled:false,shortcuts:{},inputHeight:40});
});
check('Input pane height persists within usable limits',()=>{
 assert.equal(serializeSettings({preferences:{inputHeight:125}}).preferences.inputHeight,125);
 assert.equal(normalizeSettings({preferences:{inputHeight:1000}}).preferences.inputHeight,300);
 assert.equal(normalizeSettings({preferences:{inputHeight:0}}).preferences.inputHeight,40);
});
check('Scoped rules and macros retain only supported bounded fields',()=>{
 const raw={worlds:[world('w1')],characters:[character('c1','w1')],
  aliases:[{id:'a1',scope:{level:'character',serverId:'w1',characterId:'c1'},match:'foo',replacement:'bar',password:'secret'},
   {id:'a2',scope:{level:'server',serverId:'missing'},match:'x',replacement:'y'}],
  triggers:[{id:'t1',scope:{level:'global'},match:'Warning',sendText:'look',notify:true,highlight:{color:'#ff0000',background:'url(evil)',bold:true},arbitrary:'discard'}],
  macros:[{id:'m1',scope:{level:'server',serverId:'w1'},key:'Shift+Ctrl+KeyQ',mode:'type',text:'Page ',overrideBuiltins:true,password:'secret'},
   {id:'m2',scope:{level:'global'},key:'no such key',text:'bad'}]};
 const result=normalizeSettings(raw),json=JSON.stringify(result);
 assert.equal(result.aliases.length,1);
 assert.equal(result.triggers.length,1);
 assert.deepEqual(result.triggers[0].highlight,{wholeLine:false,color:'#ff0000',bold:true,italic:false,underline:false,strike:false});
 assert.equal(result.macros[0].key,'Ctrl+Shift+Q');
 assert.equal(result.macros.length,1);
 assert.equal(json.includes('password'),false);
 assert.equal(json.includes('url(evil)'),false);
});
check('Spawn capture settings persist with bounds and without arbitrary fields',()=>{
 const result=serializeSettings({triggers:[{id:'report',scope:{level:'global'},match:'START',spawnTitle:'Report',
  spawnGroup:'Lists',spawnCopy:true,spawnGagLog:true,captureUntil:'E'.repeat(300),unexpectedCommand:'secret'}]});
 const trigger=result.triggers[0];
 assert.equal(trigger.spawnTitle,'Report');assert.equal(trigger.spawnGroup,'Lists');
 assert.equal(trigger.spawnCopy,true);assert.equal(trigger.spawnGagLog,true);
 assert.equal(trigger.captureUntil.length,256);
 assert.equal(JSON.stringify(result).includes('unexpectedCommand'),false);
});
check('Character startup choices take precedence over world fallback',()=>{
 const settings={worlds:[world('w1',{autoConnect:true}),world('w2',{autoConnect:true}),world('w3',{openAtStartup:true})],
  characters:[character('c1','w1',{openAtStartup:true,autoConnect:false}),character('c2','w1',{autoConnect:true}),character('c3','w2')]};
 assert.deepEqual(startupPlan(settings),[
  {worldId:'w1',characterId:'c1',connect:false},
  {worldId:'w1',characterId:'c2',connect:true},
  {worldId:'w2',characterId:'',connect:true},
  {worldId:'w3',characterId:'',connect:false}
 ]);
});
check('Script source is explicit and bounded; enable needs nonempty source',()=>{
 const off=normalizeSettings({scriptEnabled:true,scriptSource:''});assert.equal(off.scriptEnabled,false);
 const on=normalizeSettings({scripts:{source:'window.output.write("Hi")',enabled:true,password:'secret'}});
 assert.equal(on.scriptEnabled,true);
 assert.equal(on.scriptSource,'window.output.write("Hi")');
 assert.equal(JSON.stringify(on).includes('secret'),false);
});

check('Shortcut overrides and named trigger callbacks persist through allowlisting',()=>{
 const source={preferences:{shortcuts:{clearInput:'Ctrl+K',unknown:'Ctrl+Q'}},triggers:[{id:'scripted',match:'ping',scriptName:'onPing',scope:{level:'global'}},{id:'invalidscript',match:'pong',scriptName:'alert(1)',scope:{level:'global'}}]};
 const settings=normalizeSettings(source);
 assert.equal(settings.preferences.shortcuts.clearInput,'Ctrl+K');assert.equal(settings.preferences.shortcuts.unknown,undefined);
 assert.equal(settings.triggers[0].scriptName,'onPing');assert.equal(settings.triggers[1].scriptName,'');
});

console.log(`${passed} profile checks passed.`);
