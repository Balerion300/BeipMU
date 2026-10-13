'use strict';
const assert = require('node:assert/strict');
const { createController, safePath, safeText } = require('../ui/trigger-audio.js');
let checks = 0;
function test(name, run) { run(); ++checks; console.log('ok ' + name); }
test('local WAV policy excludes URLs, UNC, device paths, traversal, ADS and control bytes', () => {
  assert.equal(safePath('C:\\Audio\\bell.wav'), true);
  assert.equal(safePath('D:/Sound files/écho.WAV'), true);
  for (const path of ['https://example.org/a.wav','file:///C:/a.wav','\\\\server\\a.wav','\\\\?\\C:\\a.wav','C:a.wav','a.wav','C:/../a.wav','C:/./a.wav','C:/a.wav:stream.wav','C:/a.mp3','C:/a\0.wav','C:/' + 'x'.repeat(2048) + '.wav']) assert.equal(safePath(path), false, path);
});
test('disabled by default, Unicode payload preserved, no path or markup interpolation', () => {
  const sent = [], audio = createController({ sessionId: 'owner-a', post: m => sent.push(m) });
  assert.equal(audio.playSound('C:/bell.wav'), false);
  assert.equal(audio.speak('Hello'), false);
  assert.equal(sent.length, 0);
  audio.setEnabled(true);
  assert.equal(audio.handle({type:'sound',path:'C:/écho.wav'}), true);
  assert.equal(Buffer.from(sent[0].split('|')[3], 'base64').toString(), 'C:/écho.wav');
  assert.equal(audio.handle({type:'speech',text:'<audio src="file:///C:/x.wav"/> literal text'}), true);
  assert.equal(sent[1].startsWith('triggeraudio|owner-a|speech|'), true);
  assert.equal(audio.handle({type:'remote-media',path:'C:/bell.wav'}), false);
});
test('bounded text rejects controls and blank input', () => {
  assert.equal(safeText('hello\nworld'), true);
  for (const text of ['', '  \r\n', 'bad\0text', 'bad\x1btext', 'x'.repeat(2049)]) assert.equal(safeText(text), false);
});
test('disable and close stop only the owner; stale actions cannot restart', () => {
  const sent = [], a = createController({sessionId:'a',enabled:true,post:m=>sent.push(m)}), b = createController({sessionId:'b',enabled:true,post:m=>sent.push(m)});
  a.speak('first'); b.speak('second'); a.setEnabled(false);
  assert.equal(sent.at(-1),'triggeraudio|a|stop|'); assert.equal(b.speak('still enabled'),true);
  a.setEnabled(true); a.close(); const n = sent.length;
  assert.equal(a.speak('stale'),false); a.setEnabled(true); assert.equal(a.playSound('C:/a.wav'),false); a.close();
  assert.equal(sent.length,n);
});
test('event evidence is bounded, copied and contains no local paths or spoken text', () => {
  const audio=createController({sessionId:'a'});
  assert.equal(audio.handleEvent('not-json'),false);
  assert.equal(audio.handleEvent({action:'speech',status:'started',stream:3,text:'private'}),true);
  assert.deepEqual(audio.snapshot().events[0],{action:'speech',status:'started',stream:3});
  const copy=audio.snapshot(); copy.events[0].status='mutated'; assert.equal(audio.snapshot().events[0].status,'started');
  for(let i=0;i<100;i++)audio.handleEvent({action:'speech',status:'ended',stream:i});
  assert.equal(audio.snapshot().events.length,64);
});
test('failed or absent native dispatch is honest', () => {
  assert.equal(createController({sessionId:'a',enabled:true}).speak('test'),false);
  assert.equal(createController({sessionId:'a',enabled:true,post(){throw Error('closed');}}).speak('test'),false);
  assert.throws(()=>createController({sessionId:'bad|session'}));
});
test('explicit Browse selects without enabling playback and retains only a validated WAV path', () => {
  const sent=[], audio=createController({sessionId:'a',post:m=>sent.push(m)});
  assert.equal(audio.browse(),true); assert.equal(sent[0],'triggeraudio|a|browse|');
  assert.equal(audio.playSound('C:/bell.wav'),false);
  assert.equal(audio.handleEvent({action:'browse',status:'selected',path:'C:/bell.wav'}),true);
  assert.equal(audio.snapshot().events.at(-1).path,'C:/bell.wav');
  assert.equal(audio.handleEvent({action:'browse',status:'selected',path:'https://bad/a.wav'}),false);
  audio.close();assert.equal(audio.browse(),false);
});
console.log(`${checks} trigger audio tests passed`);
