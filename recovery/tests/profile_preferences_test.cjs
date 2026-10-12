const assert=require('node:assert/strict');
const prefs=require('../ui/profile-preferences.js');
const imports=require('../ui/classic-import-core.js');
const profiles=require('../ui/profile-model.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const group=(values,useParent=false)=>({useParent,values});
const world={id:'w',preferences:{output:group({fontSize:18,scrollback:800}),input:group({localEcho:true,inputHeight:90})}};
const character={id:'c',worldId:'w',preferences:{output:group({fontSize:24}),input:group({localEcho:false},true)}};
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('World and character overrides resolve independently; missing fields inherit',()=>{
 const result=prefs.resolve({...prefs.DEFAULTS,mediaEnabled:true},world,character);
 assert.equal(result.fontSize,24);assert.equal(result.scrollback,800);
 assert.equal(result.localEcho,true);assert.equal(result.inputHeight,90);assert.equal(result.mediaEnabled,true);
 assert.equal(prefs.sourceOf('fontSize',world,character),'character');
 assert.equal(prefs.sourceOf('scrollback',world,character),'world');assert.equal(prefs.sourceOf('theme',world,character),'global');
 assert.equal(prefs.sourceOf('localEcho',world,character),'world');
});
check('Enabling inheritance retains dormant overrides and follows live parent changes',()=>{
 const copy=JSON.parse(JSON.stringify(character));copy.preferences.output.useParent=true;
 assert.equal(prefs.resolve(prefs.DEFAULTS,world,copy).fontSize,18);
 const changed={...world,preferences:{...world.preferences,output:group({fontSize:20})}};
 assert.equal(prefs.resolve(prefs.DEFAULTS,changed,copy).fontSize,20);
 copy.preferences.output.useParent=false;assert.equal(prefs.resolve(prefs.DEFAULTS,changed,copy).fontSize,24);
});
check('Malformed data is rejected, finite numbers bounded, booleans remain strict',()=>{
 const result=prefs.normalizeOverrides({output:{useParent:false,values:{fontSize:99,scrollback:-4,fontFamily:'arbitrary',inlineImages:'false',password:'secret',theme:'light'}},input:{useParent:0,values:{inputHeight:Infinity,localEcho:false,script:'run'}}});
 assert.deepEqual(result,{output:group({fontSize:30,scrollback:100}),input:group({localEcho:false},true)});
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.deepEqual(prefs.normalizeOverrides([]),{output:group({},true),input:group({},true)});
 assert.equal(prefs.resolve({fontSize:'oops',localEcho:'false'},null,null).fontSize,13);
 assert.equal(prefs.resolve({fontSize:'oops',localEcho:'false'},null,null).localEcho,false);
});
check('Normalization and JSON roundtrip preserve supported dormant values',()=>{
 const original=prefs.normalizeOverrides(character.preferences);
 assert.deepEqual(prefs.normalizeOverrides(JSON.parse(JSON.stringify(original))),original);
 assert.deepEqual(prefs.resolve(prefs.DEFAULTS,world,character),prefs.resolve(prefs.DEFAULTS,JSON.parse(JSON.stringify(world)),JSON.parse(JSON.stringify(character))));
});
check('Persistent profile normalization retains overrides and isolates characters',()=>{
 const data={worlds:[{...world,name:'World',host:'example.org',port:'1234'}],characters:[{...character,name:'Alice'},{id:'other',worldId:'w',name:'Bob'}],preferences:{...prefs.DEFAULTS}};
 const saved=profiles.normalizeSettings(data),reloaded=profiles.normalizeSettings(JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(reloaded,saved);assert.deepEqual(saved.worlds[0].preferences,prefs.normalizeOverrides(world.preferences));
 assert.equal(prefs.resolve(saved.preferences,saved.worlds[0],saved.characters[0]).fontSize,24);
 assert.equal(prefs.resolve(saved.preferences,saved.worlds[0],saved.characters[1]).fontSize,18);
 assert.equal(saved.characters[1].preferences.output.useParent,true);
});
check('Absent overrides follow global without mutating their source',()=>{
 const raw={fontSize:15,scrollback:2000,shortcuts:{Find:'Ctrl+F'}};const before=JSON.stringify(raw);
 assert.equal(prefs.resolve(raw,{preferences:{}},{}).fontSize,15);assert.equal(JSON.stringify(raw),before);
 assert.equal(prefs.sourceOf('fontSize',{},{}),'global');
});
check('Original MainWindowSettings imports character output/input and isolated inheritance',()=>{
 const source=`Version=400
Windows.MainWindowSettings.Output.Font.Size=16
Connections
{
 Shortcuts
 {
  World
  {
   Host="example.org:1234"
   Characters
   {
    Alice
    {
     Password="secret-token"
     MainWindowSettings
     {
      InputSize=25
      Output.Font.Size=22
      Output.History=7000
      Input.LocalEcho=true
     }
    }
    Bob
    {
     MainWindowSettings.History.Font.Size=19
    }
   }
  }
 }
}`;
 const plan=imports.parseConfig(source),alice=plan.characters[0],bob=plan.characters[1];
 assert.equal(plan.preferences.fontSize,16);
 assert.deepEqual(alice.preferences,{output:group({fontSize:22,scrollback:7000}),input:group({localEcho:true,inputHeight:40})});
 assert.equal(prefs.resolve(plan.preferences,plan.worlds[0],alice).fontSize,22);
 assert.equal(prefs.resolve(plan.preferences,plan.worlds[0],bob).fontSize,16);
 assert.equal(prefs.resolve(plan.preferences,plan.worlds[0],bob).localEcho,false);
 assert.equal(JSON.stringify(plan).includes('secret-token'),false);
});
check('Import review preference category controls both global and scoped settings',()=>{
 // Exercise the actual review apply function without requiring a native WebView.
 const script=fs.readFileSync(path.join(__dirname,'../ui/classic-import.js'),'utf8');
 const apply=script.slice(script.indexOf('function applyConfig(){'),script.indexOf('function applyAtlas(){'));
 assert.ok(apply.startsWith('function applyConfig(){'));
 const plan={worlds:[{...world,name:'Imported',host:'example.org',port:'1234'}],characters:[{...character,name:'Imported Alice',restore:{enabled:false}}],preferences:{fontSize:27,restore:{enabled:false,bufferKiB:128}},aliases:[],triggers:[],macros:[]};
 function run(categories){
  const state={worlds:[],characters:[],preferences:{...prefs.DEFAULTS},aliases:[],triggers:[],macros:[]};let saved=null,serial=0;
  const app={state,rebuildRules(){},applyPreferences(){},renderProfileChoices(){},renderProfileLists(){},saveSettings(){saved=profiles.normalizeSettings(state);}};
  const sandbox={restorePanel:{loadPlan(value){assert.equal(value,null);}},BeipRestoreImport:require('../ui/restore-import.js'),configPlan:JSON.parse(JSON.stringify(plan)),app:()=>app,one:selector=>({checked:!!categories[/data-part="(.*?)"/.exec(selector)?.[1]]}),unique:(prefix,used)=>{const id=prefix+(++serial);used.add(id);return id;},status(){},error(){},dialog:{close(){}}};
  vm.runInNewContext(apply+'\napplyConfig();',sandbox);return saved;
 }
 const profilesOnly=run({profiles:true});
 assert.equal(profilesOnly.preferences.fontSize,prefs.DEFAULTS.fontSize);
 assert.equal(profilesOnly.preferences.restore.enabled,true);assert.equal(profilesOnly.characters[0].restore.enabled,true);
 assert.equal(profilesOnly.worlds[0].preferences.output.useParent,true);assert.equal(profilesOnly.characters[0].preferences.output.useParent,true);
 const all=run({profiles:true,preferences:true});
 assert.equal(all.preferences.fontSize,27);assert.equal(all.worlds[0].preferences.output.values.fontSize,18);assert.equal(all.characters[0].preferences.output.values.fontSize,24);
 assert.equal(all.characters[0].worldId,all.worlds[0].id);
 assert.deepEqual(all.preferences.restore,{enabled:false,bufferKiB:128});assert.equal(all.characters[0].restore.enabled,false);
 const preferencesOnly=run({preferences:true});assert.equal(preferencesOnly.worlds.length,0);assert.equal(preferencesOnly.characters.length,0);assert.equal(preferencesOnly.preferences.fontSize,27);
});
console.log(`${checks} profile preference checks passed.`);
