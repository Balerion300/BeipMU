'use strict';
const assert = require('node:assert/strict');
const { createEngine, interpolate } = require('../ui/rules.js');

let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write('ok ' + name + '\n'); }
const scope = { serverId: 'westeros', characterId: 'arya' };

test('original backslash capture syntax and escaped slash', () => {
  assert.equal(interpolate('\\0 / \\1 / \\2 / \\\\', ['whole', 'one']), 'whole / one / \\2 / \\');
});
test('simple aliases replace each nonoverlapping match without recursive restart', () => {
  const engine = createEngine({ aliases: [{ match: 'Xyl', replacement: 'Xylophone' }] });
  assert.deepEqual(engine.expandCommand('Xyl and Xyl', scope).commands, ['Xylophone and Xylophone']);
});
test('wildcard alias captures and emits bounded separate lines', () => {
  const engine = createEngine({ aliases: [{ match: 'test *-*', matchType: 'wildcard', replacement: 'say \\1\r\nsay \\2' }] });
  assert.deepEqual(engine.expandCommand('test alpha-beta', scope).commands, ['say alpha', 'say beta']);
});
test('scope and disabled status select only applicable rules', () => {
  const engine = createEngine({ aliases: [
    { match: 'x', replacement: 'g', scope: { level: 'global' }, stopProcessing: true, enabled: false },
    { match: 'x', replacement: 's', scope: { level: 'server', serverId: 'other' }, stopProcessing: true },
    { match: 'x', replacement: 'c', scope: { level: 'character', serverId: 'westeros', characterId: 'arya' } }
  ] });
  assert.deepEqual(engine.expandCommand('x', scope).commands, ['c']);
  assert.deepEqual(engine.expandCommand('x', { serverId: 'westeros', characterId: 'sansa' }).commands, ['x']);
});
test('global, server, character order and stop processing are deterministic', () => {
  const engine = createEngine({ aliases: [
    { match: 'C', replacement: 'D', scope: { level: 'character', serverId: 'westeros', characterId: 'arya' } },
    { match: 'A', replacement: 'B', scope: { level: 'global' } },
    { match: 'B', replacement: 'C', scope: { level: 'server', serverId: 'westeros' }, stopProcessing: true }
  ] });
  assert.deepEqual(engine.expandCommand('A', scope).commands, ['C']);
});
test('triggers return actions and capture metadata without effects', () => {
  const engine = createEngine({ triggers: [{ id: 'page', match: 'pages, ',
    highlight: { color: '#ff0', wholeLine: true }, gag: true, logGag: true,
    sendText: 'page \\0', spawnTitle: 'Pages', notify: true }] });
  const result = engine.processLine('Arya pages, hello', scope);
  assert.equal(result.gagged, true);
  assert.equal(result.logGagged, true);
  assert.deepEqual(result.matches[0], { triggerId: 'page', start: 5, end: 12, captures: ['pages, '] });
  assert.deepEqual(result.actions.map(a => a.type), ['highlight', 'command', 'spawn', 'notification']);
  assert.equal(result.actions[1].text, 'page pages, ');
});
test('case, whole word, line anchor, and wildcard capture', () => {
  const engine = createEngine({ triggers: [
    { id: 'word', match: 'Page', matchCase: true, wholeWord: true, lineStart: true, notify: true },
    { id: 'wild', match: '[*] *', matchType: 'wildcard', spawnTitle: '\\1', notify: true }
  ] });
  assert.equal(engine.processLine('pages,', scope).actions.length, 0);
  assert.equal(engine.processLine('Page here', scope).actions[0].type, 'notification');
  const hit = engine.processLine('[public] hello', scope);
  assert.equal(hit.actions[0].title, 'public');
  assert.deepEqual(hit.matches[0].captures, ['[public] hello', 'public', 'hello']);
});
test('cooldown and once per engine instance', () => {
  const engine = createEngine({ triggers: [
    { id: 'cool', match: 'hit', notify: true, cooldownMs: 1000 },
    { id: 'once', match: 'hit', notify: true, once: true }
  ] });
  assert.equal(engine.processLine('hit', scope, 1000).actions.length, 2);
  assert.equal(engine.processLine('hit', scope, 1500).actions.length, 0);
  assert.equal(engine.processLine('hit', scope, 2000).actions.length, 1);
});
test('rule and action limits block runaway output', () => {
  const engine = createEngine({ aliases: [{ match: 'a', replacement: 'aa' }],
    triggers: Array.from({ length: 40 }, (_, i) => ({ id: String(i), match: 'x', notify: true })) });
  assert.equal(engine.expandCommand('a', scope).commands[0], 'aa');
  const line = engine.processLine('x', scope);
  assert.equal(line.actions.length, 32);
  assert.ok(line.diagnostics.some(message => message.includes('limit')));
});
test('unsupported arbitrary regex and oversize patterns do not execute', () => {
  const engine = createEngine({ triggers: [
    { match: '(a+)+$', matchType: 'regex', notify: true },
    { match: 'a'.repeat(129), notify: true }
  ] });
  assert.equal(engine.processLine('a'.repeat(4000) + '!', scope).actions.length, 0);
});
process.stdout.write(`${checks} rule checks passed\n`);
