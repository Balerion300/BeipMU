const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../ui/classic-import-core.js');
const mapper=require('../ui/mapper.js');
const root=path.join(__dirname,'../..');
let checks=0;
async function check(name,fn){await fn();console.log('PASS '+name);checks++;}
(async()=>{
 await check('DefaultConfig world, character and WHO capture import without login command',()=>{
  const plan=core.parseConfig(fs.readFileSync(path.join(root,'Assets/DefaultConfig.txt'),'utf8'));
  assert.equal(plan.worlds.length,1);assert.equal(plan.worlds[0].host,'lambda.moo.mud.org');assert.equal(plan.worlds[0].port,8888);
  assert.equal(plan.characters.length,1);assert.equal(plan.characters[0].name,'Guest');assert.equal(plan.characters[0].autoLogin,false);
  assert.equal(plan.characters[0].loginName,'');assert.equal(plan.triggers.length,1);
  assert.equal(plan.triggers[0].captureUntil,'^Total: [0-9]+ players');
  assert.equal(plan.triggers[0].scope.serverId,plan.worlds[0].id);
 });
 await check('Sample config imports supported rules and excludes scripts and passwords',()=>{
  const plan=core.parseConfig(fs.readFileSync(path.join(root,'Assets/SampleConfig.txt'),'utf8'));
  assert.equal(plan.worlds.length,3);assert.equal(plan.characters.length,3);
  assert.ok(plan.aliases.some(x=>x.match==='Mag'&&x.replacement==='Magdalena'));
  assert.ok(plan.triggers.some(x=>x.spawnTitle==='\\1'));
  assert.ok(plan.macros.some(x=>x.key==='Ctrl+Alt+A'));
  assert.ok(plan.macros.every(x=>!x.text.includes('window.')));
  assert.ok(plan.characters.every(x=>!x.password&&!x.autoLogin));
  assert.ok(plan.report.skipped['Unsupported or script aliases']>=2);
  assert.ok(plan.report.skipped['Credentials and login commands omitted']>=1);
 });
 await check('Malformed and oversized configs fail without a partial plan',()=>{
  assert.throws(()=>core.parseConfig('Connections\n{\n  Shortcuts\n{'),/scope/);
  assert.throws(()=>core.parseConfig('x'.repeat(core.MAX_CONFIG+1)),/large/);
  assert.throws(()=>core.parseConfig('Version=10\nOther\n{\n}\n'),/supported/);
 });
 await check('Preferences map only supported settings and secret values are discarded',()=>{
  const source='Version=400\nInlineImages=false\nTheme=0\nWindows\n{\n MainWindowSettings\n {\n InputSize=88\n Output\n {\n Font.Size=18\n Font.Name="Courier New"\n History=5000\n }\n Input.LocalEcho=true\n }\n}\nConnections\n{\n Shortcuts\n {\n Test\n {\n Host="example.org:1234"\n Characters\n {\n Alice.Password="secret-token-984"\n Alice.Connect="connect Alice secret-token-984"\n }\n }\n }\n}\n';
  const plan=core.parseConfig(source);
  assert.deepEqual(plan.preferences,{fontSize:18,outputFontFace:'Courier New',scrollback:5000,localEcho:true,inputHeight:88,inlineImages:false,theme:'light'});
  assert.equal(JSON.stringify(plan).includes('secret-token-984'),false);
 });
 await check('Plain XML Atlas preserves room centers and directed commands',async()=>{
  const plan=await core.readAtlas(fs.readFileSync(path.join(root,'Maps/Fluff.atlas')));
  assert.equal(plan.maps.length,3);
  const main=mapper.normalize(plan.maps[0].graph);
  assert.equal(main.rooms.length,65);assert.equal(main.rooms[0].title,'Fluff Park');
  assert.deepEqual([main.rooms[0].x,main.rooms[0].y],[130,240]);
  assert.ok(main.exits.some(x=>x.from==='r0'&&x.to==='r1'&&x.command==='north'));
  assert.ok(main.exits.some(x=>x.from==='r1'&&x.to==='r0'&&x.command==='south'));
  assert.ok(plan.report.skipped['Unresolved exits']>0);
 });
 await check('ZIP Atlas validates checksum and imports supported graph subset',async()=>{
  const bytes=fs.readFileSync(path.join(root,'Maps/Arx_Map_by_Precisi.atlas'));
  const plan=await core.readAtlas(bytes);
  assert.equal(plan.maps.length,1);
  const graph=mapper.normalize(plan.maps[0].graph);
  assert.ok(graph.rooms.length>400);assert.ok(graph.exits.length>300);
  assert.ok(plan.report.skipped['Unresolved exits']>0);
  const corrupt=Uint8Array.from(bytes);corrupt[Math.floor(corrupt.length/2)]^=1;
  await assert.rejects(core.readAtlas(corrupt),/(validation|decompress|invalid|failed)/i);
 });
 await check('XML entities and unsafe DTD are bounded',()=>{
  const plan=core.parseAtlasXml('<atlas><map name="A &amp; B"><room name="Hall &lt;One&gt;" rect="0,0,10,10"/></map></atlas>');
  assert.equal(plan.maps[0].name,'A & B');assert.equal(plan.maps[0].graph.rooms[0].title,'Hall <One>');
  assert.throws(()=>core.parseAtlasXml('<!DOCTYPE atlas [<!ENTITY x SYSTEM "file:///x">]><atlas/>'),/entities/);
 });
 console.log(checks+' classic import checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
