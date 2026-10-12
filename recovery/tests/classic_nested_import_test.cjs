const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../ui/classic-import-core.js');
const rules=require('../ui/rules.js');
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/classic_nested_config.txt'),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function config(body){return 'Version=400\nConnections\n{\n'+body+'\n}';}
function action(match='ready'){return '{\nFindString.MatchText="'+match+'"\nSend.Active=true\nSend.Send="say matched"\n}';}
check('Serialized original trees retain conditional parents, source order, and root after phases',()=>{
 const plan=core.parseConfig(fixture),a=plan.aliases,t=plan.triggers;
 assert.equal(a.length,6);assert.equal(a[1].parentId,a[0].id);assert.equal(a[3].parentId,a[2].id);
 assert.equal(a[0].folder,undefined);assert.equal(a[2].folder,true);assert.equal(a[2].phase,'after');
 assert.equal(a[1].phase,undefined);assert.equal(a[3].phase,undefined);assert.equal(a[4].phase,'after');assert.equal(a[5].phase,undefined);
 assert.equal(t[0].folder,true);assert.equal(t[0].sendText,undefined);assert.equal(t[0].enabled,true);
 assert.equal(t[1].parentId,t[0].id);assert.equal(t[1].match,'ready');assert.equal(t[1].stopProcessing,true);assert.equal(t[1].folder,undefined);
 assert.equal(t[2].parentId,t[1].id);assert.equal(t[2].phase,undefined);
 assert.equal(t[3].processChildren,false);assert.equal(t[4].enabled,false);
 assert.equal(t.at(-1).phase,'after');assert.deepEqual(rules.hierarchy(a).errors,[]);assert.deepEqual(rules.hierarchy(t).errors,[]);
 assert.equal(plan.report.skipped['Folders flattened'],undefined);assert.equal(plan.report.skipped['Conditional nested rules'],undefined);
});
check('Original activation differs between aliases and triggers without silently enabling descendants',()=>{
 const plan=core.parseConfig(fixture);
 assert.ok(plan.aliases.every(rule=>rule.enabled));assert.equal(plan.aliases[0].processChildren,true);
 const disabled=core.parseConfig(fixture.replace('Aliases\n {\n  Active=true','Aliases\n {\n  Active=false'));
 assert.ok(disabled.aliases.every(rule=>!rule.enabled));
 const triggerDisabled=core.parseConfig(config('Triggers.Active=false\nShortcuts\n{\nTest\n{\nHost="example.org:1234"\nTriggers\n{\n'+action()+'\n}\nCharacters\n{\nAlice\n{\nTriggers\n{\n'+action()+'\n}\n}\n}\n}\n}'));
 assert.equal(triggerDisabled.triggers.length,2);assert.ok(triggerDisabled.triggers.every(rule=>!rule.enabled));
});
check('Variables, variable expansion flags, away conditions, and sound/speech-only rules survive',()=>{
 const plan=core.parseConfig(fixture),a=plan.aliases,t=plan.triggers,c=plan.characters[0];
 assert.equal(a[0].expandVariables,true);assert.equal(a[1].expandVariables,true);
 assert.equal(t[2].sendExpandVariables,true);assert.equal(t[2].filterExpandVariables,true);
 assert.equal(t[2].awayCondition,'away');assert.equal(t[2].awayOnce,true);assert.equal(t.at(-1).awayCondition,'present');
 assert.deepEqual(t.at(-2).sound,{enabled:true,path:'C:\\Windows\\Media\\chord.wav'});
 assert.deepEqual(t.at(-1).speech,{enabled:true,wholeLine:true,text:''});
 assert.equal(Object.getPrototypeOf(c.variables),null);assert.equal(c.variables.target,'friend');assert.equal(c.variables.__proto__,'literal user variable');
 assert.equal(JSON.stringify(plan).includes('do-not-import-password'),false);assert.ok(plan.report.notes.some(note=>note.includes('stay silent')));
});
check('Imported conditional aliases and disabled trigger folders obey original runtime semantics',()=>{
 const plan=core.parseConfig(config('Aliases\n{\nActive=true\n{\nFindString.MatchText="start"\nReplace="middle"\nAliases\n{\n{\nFindString.MatchText="middle"\nReplace="finish"\n}\n}\n}\n}\nTriggers\n{\n{\nDisabled=true\nTriggers\n{\n{\nFindString.MatchText="ready"\nTriggers\n{\n'+action('child')+'\n}\n}\n}\n}\n}'));
 const engine=rules.createEngine(plan);
 assert.deepEqual(engine.expandCommand('start',{}).commands,['finish']);assert.deepEqual(engine.expandCommand('middle',{}).commands,['middle']);
 assert.equal(engine.processLine('child',{}).actions.length,0);
 assert.equal(engine.processLine('ready child',{}).actions.filter(x=>x.type==='command').length,1);
});
check('Unsupported parents omit their subtree and temporal child conditions are never flattened',()=>{
 const nested='Triggers\n{\n'+action()+'\n}';
 const plan=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="["\nFindString.RegularExpression=true\n'+nested+'\n}\n{\nFindString.MatchText="ready"\nMultiline=true\n'+nested+'\n}\n}'));
 assert.equal(plan.triggers.length,0);assert.equal(plan.report.skipped['Unusable trigger patterns'],1);assert.equal(plan.report.skipped['Multiline trigger subtrees'],1);
 const script=core.parseConfig(config('Aliases\n{\nActive=true\n{\nFindString.MatchText="run"\nReplace="/script dangerous"\nAliases\n{\n{\nFindString.MatchText="run"\nReplace="dangerous child"\n}\n}\n}\n}'));
 assert.equal(script.aliases.length,0);assert.equal(script.report.skipped['Unsupported or script aliases'],1);
 const click=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="ready"\nSend.Active=true\nSend.SendOnClick=true\nSend.Send="never auto send"\n'+nested+'\n}\n}'));
 assert.equal(click.triggers.length,2);assert.equal(click.triggers[0].sendText,undefined);assert.equal(click.triggers[1].parentId,click.triggers[0].id);
 assert.equal(click.report.skipped['Click-only trigger sends'],1);
 const capture=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="ready"\nSpawn.Active=true\nSpawn.Title="Capture"\nSpawn.CaptureUntil="done"\nSpawn.OnlyChildrenDuringCapture=true\n'+nested+'\n}\n}'));
 assert.equal(capture.triggers.length,0);assert.equal(capture.report.skipped['Capture-only child trigger subtrees'],1);
 for(const unsupported of ['Script.Active=true\nScript.Function="mutateLine"','Filter.Active=true\nFilter.HTML=true\nFilter.Replace="<b>changed</b>"']){
  const mutated=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="ready"\n'+unsupported+'\n'+nested+'\n}\n}'));
  assert.equal(mutated.triggers.length,0);assert.equal(mutated.report.skipped['Unsupported text-changing trigger subtrees'],1);
 }
});
check('Variable and unsupported sound limits are reported without importing credential fields',()=>{
 const variable=(name,text)=>'{\nName="'+name+'"\nValue="'+text+'"\n}';
 const source=variables=>config('Shortcuts\n{\nTest\n{\nHost="example.org:1234"\nCharacters\n{\nAlice\n{\nVariables\n{\n'+variables+'\n}\n}\n}\n}\n}');
 const wide=core.parseConfig(source(Array.from({length:130},(_,i)=>variable('n'+i,'value')).join('\n')));
 assert.equal(Object.keys(wide.characters[0].variables).length,128);assert.equal(wide.report.skipped['Invalid or excess variables'],2);
 const large=core.parseConfig(source(variable('long','x'.repeat(4097))+'\n'+variable('n'.repeat(129),'x')+'\n'+Array.from({length:17},(_,i)=>variable('n'+i,'x'.repeat(4096))).join('\n')));
 assert.equal(Object.keys(large.characters[0].variables).length,15);assert.equal(large.report.skipped['Invalid or excess variables'],4);
 const sound=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="ready"\nSound.Active=true\nSound.Sound="%WINDIR%/Media/chord.wav"\n}\n}'));
 assert.equal(sound.triggers.length,0);assert.equal(sound.report.skipped['Unsupported variable or invalid sound paths'],1);
 const duplicate=core.parseConfig(source(variable('same','first')+'\n'+variable('same','second')));
 assert.equal(duplicate.characters[0].variables.same,'first');assert.equal(duplicate.report.skipped['Duplicate variable names'],1);
});
check('Rule count and depth limits preserve valid parent identities',()=>{
 let nested=action();for(let i=0;i<9;i++)nested='{\nDisabled=true\nTriggers\n{\n'+nested+'\n}\n}';
 const deep=core.parseConfig(config('Triggers\n{\n'+nested+'\n}'));
 assert.equal(deep.triggers.length,8);assert.equal(deep.report.skipped['Rule trees beyond eight levels'],1);assert.deepEqual(rules.hierarchy(deep.triggers).errors,[]);
 const wide=core.parseConfig(config('Triggers\n{\n{\nDisabled=true\nTriggers\n{\n'+Array.from({length:140},()=>action()).join('\n')+'\n}\n}\n}'));
 assert.equal(wide.triggers.length,128);assert.equal(wide.report.skipped['Excess triggers'],13);assert.deepEqual(rules.hierarchy(wide.triggers).errors,[]);
});
check('Original scope traversal runs global pre, server pre, character, server post, global post',()=>{
 // Connection.cpp ProcessAliases/Display call Pre(), character, then Post(); Root.prp defines Post as Last(AfterCount).
 const alias=(from,to)=>'{\nFindString.MatchText="'+from+'"\nFindString.StartsWith=true\nFindString.EndsWith=true\nReplace="'+to+'"\n}';
 const trigger=command=>'{\nFindString.MatchText="ping"\nSend.Active=true\nSend.Send="'+command+'"\n}';
 const container=(kind,entries,after=0)=>kind+'\n{\nActive=true\nAfterCount='+after+'\n'+entries.join('\n')+'\n}';
 const plan=core.parseConfig(config(container('Aliases',[alias('a','b'),alias('e','f')],1)+'\n'+container('Triggers',[trigger('global pre'),trigger('global post')],1)+'\nShortcuts\n{\nTest\n{\nHost="example.org:1234"\n'+container('Aliases',[alias('b','c'),alias('d','e')],1)+'\n'+container('Triggers',[trigger('server pre'),trigger('server post')],1)+'\nCharacters\n{\nAlice\n{\n'+container('Aliases',[alias('c','d')],1)+'\n'+container('Triggers',[trigger('character')],1)+'\n}\n}\n}\n}'));
 const context={serverId:plan.worlds[0].id,characterId:plan.characters[0].id},engine=rules.createEngine(plan);
 assert.deepEqual(engine.expandCommand('a',context).commands,['f']);
 assert.deepEqual(engine.processLine('ping',context).actions.filter(x=>x.type==='command').map(x=>x.text),['global pre','server pre','character','server post','global post']);
});
check('Original OncePerLine default repeats matches and child trees run once after the parent',()=>{
 // Connection.cpp RunTriggers loops search.Next(), checks OncePerLine, then descends after the loop.
 const leaf=extra=>'{\nFindString.MatchText="ping"\n'+extra+'\nSend.Active=true\nSend.Send="say parent"\nTriggers\n{\n'+action('child')+'\n}\n}';
 for(const once of [false,true]){
  const plan=core.parseConfig(config('Triggers\n{\n'+leaf(once?'OncePerLine=true':'')+'\n}'));
  assert.equal(plan.triggers[0].oncePerLine,once);
  const commands=rules.createEngine(plan).processLine('ping ping child',{}).actions.filter(x=>x.type==='command').map(x=>x.text);
  assert.deepEqual(commands,once?['say parent','say matched']:['say parent','say parent','say matched']);
 }
 const regex=core.parseConfig(config('Triggers\n{\n{\nFindString.MatchText="(.+)"\nFindString.RegularExpression=true\nOncePerLine=true\nSend.Active=true\nSend.Send="say \\\\1"\n}\n}'));
 assert.deepEqual(rules.createEngine({...regex,workerEngine:true,allowRegex:true}).processLine('hello world',{}).actions.filter(x=>x.type==='command').map(x=>x.text),['say hello world']);
});
check('Imported literal variables expand only on selected original actions, including case-sensitive names',()=>{
 const plan=core.parseConfig(fixture),context={variables:plan.characters[0].variables,away:true,awayEpoch:1};
 const engine=rules.createEngine(plan);
 assert.deepEqual(engine.expandCommand('start',context).commands,['say friend']);
 const first=engine.processLine('ready',context);
 assert.equal(first.text,'friend');assert.deepEqual(first.actions.filter(x=>x.type==='command').map(x=>x.text),['say friend']);
 assert.equal(engine.processLine('ready',context).actions.filter(x=>x.type==='command').length,0);
 assert.equal(engine.processLine('ready',{...context,awayEpoch:2}).actions.filter(x=>x.type==='command').length,1);
 const literal=core.parseConfig(config('Aliases\n{\nActive=true\n{\nFindString.MatchText="x"\nReplace="%target% %Target%"\n}\n}'));
 assert.deepEqual(rules.createEngine(literal).expandCommand('x',context).commands,['%target% %Target%']);
 literal.aliases[0].expandVariables=true;
 assert.deepEqual(rules.createEngine(literal).expandCommand('x',context).commands,['friend %Target%']);
});
check('Review apply remaps parent identities, profile scopes, and repeated imports independently',()=>{
 const script=fs.readFileSync(path.join(__dirname,'../ui/classic-import.js'),'utf8');
 const apply=script.slice(script.indexOf('function applyConfig(){'),script.indexOf('function applyAtlas(){'));
 function run(importProfiles){
  const plan=core.parseConfig(fixture),state={worlds:[],characters:[],aliases:[],triggers:[],macros:[],preferences:{}};let serial=0,saved=0;
  const app={state,rebuildRules(){},applyPreferences(){},renderProfileChoices(){},saveSettings(){saved++;}};
  const sandbox={configPlan:plan,app:()=>app,one:selector=>({checked:!selector.includes('profiles')||importProfiles}),unique:(prefix,used)=>{const id=prefix+(++serial);used.add(id);return id;},status(){},error(){},dialog:{close(){}}};
  vm.runInNewContext(apply+'\napplyConfig();\napplyConfig();',sandbox);
  assert.equal(saved,2);
  for(const kind of ['aliases','triggers']){
   const ids=new Set(state[kind].map(x=>x.id));assert.equal(ids.size,state[kind].length);assert.deepEqual(rules.hierarchy(state[kind]).errors,[]);
   for(const rule of state[kind]){assert.ok(!rule.id.startsWith('imp'));if(rule.parentId)assert.ok(ids.has(rule.parentId));}
   const half=state[kind].length/2,first=new Set(state[kind].slice(0,half).map(x=>x.id));
   for(const rule of state[kind].slice(half))if(rule.parentId)assert.ok(!first.has(rule.parentId));
  }
  return state;
 }
 const all=run(true);assert.equal(all.worlds.length,2);assert.equal(all.characters.length,2);
 for(const rule of all.aliases.filter(x=>x.scope.level==='character'))assert.ok(all.characters.some(c=>c.id===rule.scope.characterId&&c.worldId===rule.scope.serverId));
 const global=run(false);assert.equal(global.worlds.length,0);assert.ok(global.aliases.every(x=>x.scope.level==='global'));
});
console.log(checks+' nested classic import checks passed.');
