'use strict';
const assert = require('node:assert/strict');
const { createController, sourceURL } = require('../ui/media.js');
class FakeAudio {
  static instances = [];
  constructor(url) { this.url = url; this.plays = 0; this.pauses = 0; FakeAudio.instances.push(this); }
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
}
let checks = 0;
function test(name, body) { body(); checks++; console.log('ok ' + name); }
test('server sound is disabled until opted in', () => {
  const media = createController({ AudioClass: FakeAudio });
  assert.equal(media.handle('Client.Media.Default', { url: 'https://example.org/media/' }), true);
  assert.equal(media.handle('Client.Media.Play', { name: 'bell.mp3' }), false);
  assert.equal(FakeAudio.instances.length, 0);
  media.setEnabled(true);
  assert.equal(media.handle('Client.Media.Play', { name: 'bell.mp3', volume: 25 }), true);
  assert.equal(FakeAudio.instances.at(-1).volume, 0.25);
});
test('media names cannot escape the server media base URL', () => {
  assert.equal(sourceURL('https://example.org/media/', 'effects/bell.mp3'), 'https://example.org/media/effects/bell.mp3');
  for (const name of ['../secret', '//evil.invalid/a', 'https://evil.invalid/a', '/root', 'a?x'])
    assert.equal(sourceURL('https://example.org/media/', name), null);
  assert.equal(sourceURL('file:///tmp/', 'a.mp3'), null);
});
test('finite replay and named stop', () => {
  const media = createController({ AudioClass: FakeAudio, enabled: true });
  assert.equal(media.handle('Client.Media.Play', { name: 'a.mp3', url: 'https://example.org/', loops: 2 }), true);
  const audio = FakeAudio.instances.at(-1);
  audio.onended(); assert.equal(audio.plays, 2);
  audio.onended(); assert.deepEqual(media.snapshot().playing, []);
  assert.equal(audio.pauses, 1);
});
test('infinite loop remains controllable; disabling stops all', () => {
  const media = createController({ AudioClass: FakeAudio, enabled: true });
  assert.equal(media.handle('Client.Media.Play', { name: 'rain.mp3', url: 'https://example.org/', loops: -1 }), true);
  const audio = FakeAudio.instances.at(-1);
  assert.equal(audio.loop, true);
  media.setEnabled(false);
  assert.equal(audio.pauses, 1);
  assert.deepEqual(media.snapshot().playing, []);
});
test('active and cached media are bounded', () => {
  const media = createController({ AudioClass: FakeAudio, enabled: true });
  media.handle('Client.Media.Default', { url: 'https://example.org/' });
  for (let i = 0; i < 16; i++) assert.equal(media.handle('Client.Media.Play', { name: `${i}.mp3` }), true);
  assert.equal(media.handle('Client.Media.Play', { name: '17.mp3' }), false);
  for (let i = 0; i < 40; i++) media.handle('Client.Media.Load', { name: `cached${i}.mp3` });
  assert.ok(media.snapshot().cached.length <= 32);
  media.handle('Client.Media.Stop', {});
  assert.deepEqual(media.snapshot().playing, []);
});
test('invalid volume and loop counts cannot start playback', () => {
  const media = createController({ AudioClass: FakeAudio, enabled: true });
  for (const payload of [{ volume: -1 }, { volume: 101 }, { loops: 33 }, { loops: -2 }])
    assert.equal(media.handle('Client.Media.Play', { name: 'x.mp3', url: 'https://example.org/', ...payload }), false);
});
console.log(`${checks} media checks passed`);
