const assert=require('node:assert/strict'),logging=require('../ui/logging-model.js'),profiles=require('../ui/profile-model.js'),imports=require('../ui/classic-import-core.js'),commands=require('../ui/logging-runtime.js');
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('Global formatting and reviewed character filenames survive allowlisted roundtrips',()=>{
 const saved=profiles.normalizeSettings({preferences:{logging:{defaultFileName:'%server%/%date%.html',fileNameReviewed:true,logSent:true,wrapChars:1500,typedPrefix:'Typed> ',secret:'discard'}},worlds:[{id:'w',name:'World',host:'example.org',port:'4000'}],characters:[{id:'c',worldId:'w',name:'Alice',logging:{fileName:'Alice.html',autoLog:true,appendDate:true,reviewed:true}},{id:'d',worldId:'w',name:'Bob',logging:{fileName:'unreviewed.txt',autoLog:true}}]});
 assert.deepEqual(profiles.normalizeSettings(JSON.parse(JSON.stringify(saved))),saved);assert.equal(saved.preferences.logging.wrapChars,1000);assert.equal(saved.preferences.logging.secret,undefined);
 assert.equal(logging.options(saved.preferences,saved.characters[0]).fileName,'Alice.html');assert.equal(saved.characters[0].logging.autoLog,true);assert.equal(saved.characters[1].logging.autoLog,false);assert.equal(logging.options(saved.preferences,saved.characters[1]).fileName,'%server%/%date%.html');
});
check('Text formatting preserves WHO spaces by default and separates typed/sent opt-ins',()=>{
 const line='Name     Alias  Idle';assert.equal(logging.formatRecord({text:line},{}),line+'\r\n');assert.equal(logging.formatRecord({text:'look',kind:'typed'},{}),'');
 assert.equal(logging.formatRecord({text:'look',kind:'typed'},{logTyped:true,typedPrefix:'Typed> '}),'Typed> look\r\n');assert.equal(logging.formatRecord({text:'north',kind:'sent'},{logSent:true,sentPrefix:'Sent> ',doubleSpace:true}),'Sent> north\r\n\r\n');
 const wrapped=logging.formatRecord({text:'alpha beta gamma delta epsilon zeta eta theta'},{wrap:true,wrapChars:24,hangingIndent:true,hangingIndentChars:3});assert.equal(wrapped,'alpha beta gamma delta\r\n   epsilon zeta eta\r\n   theta\r\n');
 const unicode=logging.formatRecord({text:'\u{1f431}'.repeat(25)},{wrap:true,wrapChars:20,wrapNearestWord:false});assert.equal(unicode,'\u{1f431}'.repeat(20)+'\r\n'+'\u{1f431}'.repeat(5)+'\r\n');
});
check('HTML escapes text and URLs and permits only generated safe styles',()=>{
 const text='<script>alert("x")</script>',html=logging.formatRecord({text,segments:[{text,color:'red;background:url(evil)',bold:true,url:'javascript:alert(1)'}]},{fileName:'log.html'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('font-weight:bold'));assert.equal(html.includes('javascript:'),false);assert.equal(html.includes('url(evil)'),false);assert.equal(html.includes('<script>'),false);
 const linked=logging.formatRecord({text:'Link',segments:[{text:'Link',color:'#aabbcc',url:'https://example.org/?a=1&b="2"'}]},{fileName:'log.htm'});assert.ok(linked.includes('a=1&amp;b=&quot;2&quot;'));assert.ok(linked.includes('color:#aabbcc'));
 const mismatched=logging.formatRecord({text:'real text',segments:[{text:'other'}]},{fileName:'log.html'});assert.ok(mismatched.includes('real text'));assert.equal(mismatched.includes('other'),false);assert.ok(logging.header({fileName:'log.html'},'<Unsafe>').includes('&lt;Unsafe&gt;'));
});
check('Timestamps use record time; original log names import disabled and gaps reported',()=>{
 const time=new Date(2020,0,2,13,4,5).getTime(),record=logging.formatRecord({text:'hello',time},{timestamp:'date-time',hour24:true});assert.ok(record.includes('2020'));assert.ok(record.includes('13:04:05'));assert.ok(record.endsWith('  hello\r\n'));
 const source='Version=400\nConnections.Logging\n{\nDefaultLogFileName="%server%-%character%-%date%.html"\nFileDateFormat="yyyyMMdd"\nLogSent=true\nWrap=true\nWrapChars=60\nTimeFormat=2\nPath="C:\\\\OldLogs"\n}\nConnections.Shortcuts.World\n{\nHost="example.org:4000"\nCharacters.Alice\n{\nLogFileName="Alice.txt"\nLogFileNameTimeFormat=2\n}\n}';
 const plan=imports.parseConfig(source);assert.equal(plan.preferences.logging.defaultFileName,'%server%-%character%-%date%.html');assert.equal(plan.preferences.logging.fileNameReviewed,false);assert.equal(plan.preferences.logging.logSent,true);assert.equal(plan.preferences.logging.wrapChars,60);assert.equal(plan.characters[0].logging.fileName,'Alice.txt');assert.equal(plan.characters[0].logging.autoLog,false);assert.equal(plan.characters[0].logging.reviewed,false);assert.ok(plan.report.skipped['Original numeric log timestamp flags need review']);
});
check('Original log commands preserve quoted filenames and select their start point',()=>{
 const calls=[],session={id:'s',connected:true,logging:false},app={startLogging:(...args)=>calls.push(args),stopLogging:s=>calls.push(['stop',s]),state:{characters:[],preferences:{}}};
 assert.equal(commands.handle('/log "file with spaces.txt"',session,app),true);assert.equal(calls.at(-1)[1],'now');assert.equal(calls.at(-1)[2],'file with spaces.txt');commands.handle('/logall "all.txt"',session,app);assert.equal(calls.at(-1)[1],'beginning');commands.handle('/logtop "visible.txt"',session,app);assert.equal(calls.at(-1)[1],'window');commands.handle('/stoplogs',session,app);assert.equal(calls.at(-1)[0],'stop');assert.equal(commands.handle('/look',session,app),false);
 session.logging=true;assert.throws(()=>commands.handle('/log next.txt',session,app),/Stop/);commands.handle('/log',session,app);assert.equal(calls.at(-1)[0],'stop');
});
console.log(`${checks} logging checks passed.`);
