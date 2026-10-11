'use strict';
const assert = require('node:assert/strict');
const { createWorld, normalize, directionOffset, MAX_ROOMS, MAX_EXITS } = require('../ui/mapper.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('ok ' + name); }

test('rooms and directed exits support a shortest route', () => {
  const map = createWorld();
  const a = map.addRoom({ title: 'Hall', x: 0, y: 0 });
  const b = map.addRoom({ title: 'Stairs', x: 100, y: 0 });
  const c = map.addRoom({ title: 'Tower', x: 200, y: 0 });
  map.addExit({ from: a.id, to: b.id, command: 'east' });
  map.addExit({ from: b.id, to: c.id, command: 'up' });
  map.setCurrentRoom(a.id);
  assert.deepEqual(map.walkCommands(c.id), ['east', 'up']);
  assert.deepEqual(map.shortestPath(c.id).rooms, [a.id, b.id, c.id]);
  assert.equal(map.shortestPath(a.id).commands.length, 0);
  assert.equal(map.shortestPath('missing'), null);
});
test('shortest path uses fewest exits and deterministic insertion order', () => {
  const map = createWorld();
  for (const id of ['a', 'b', 'c', 'd']) map.addRoom({ id, title: id, x: 0, y: 0 });
  map.addExit({ id: 'ab', from: 'a', to: 'b', command: 'n' });
  map.addExit({ id: 'ac', from: 'a', to: 'c', command: 'e' });
  map.addExit({ id: 'bd', from: 'b', to: 'd', command: 'e' });
  map.addExit({ id: 'cd', from: 'c', to: 'd', command: 'n' });
  map.setCurrentRoom('a');
  assert.deepEqual(map.walkCommands('d'), ['n', 'e']);
  map.addExit({ id: 'ad', from: 'a', to: 'd', command: 'portal' });
  assert.deepEqual(map.walkCommands('d'), ['portal']);
});
test('an exit is one-way until a return exit is added', () => {
  const map = createWorld();
  map.addRoom({ id: 'a', title: 'A', x: 0, y: 0 });
  map.addRoom({ id: 'b', title: 'B', x: 1, y: 0 });
  map.addExit({ id: 'out', from: 'a', to: 'b', command: 'east' });
  map.setCurrentRoom('b');
  assert.equal(map.walkCommands('a'), null);
  map.addExit({ id: 'back', from: 'b', to: 'a', command: 'west' });
  assert.deepEqual(map.walkCommands('a'), ['west']);
});
test('editing and removal keep route state consistent', () => {
  const map = createWorld();
  map.addRoom({ id: 'a', title: 'A', x: 0, y: 0 });
  map.addRoom({ id: 'b', title: 'B', x: 1, y: 0 });
  map.addExit({ id: 'x', from: 'a', to: 'b', command: 'east' });
  map.editRoom('b', { title: 'New B', y: 3 });
  map.editExit('x', { command: 'door' });
  map.setCurrentRoom('a');
  assert.deepEqual(map.walkCommands('b'), ['door']);
  assert.equal(map.rooms().find(room => room.id === 'b').title, 'New B');
  assert.equal(map.removeRoom('b'), true);
  assert.equal(map.exits().length, 0);
  assert.equal(map.walkCommands('b'), null);
  map.removeRoom('a');
  assert.equal(map.currentRoom(), null);
});
test('serialization returns detached data and round-trips', () => {
  const map = createWorld();
  map.addRoom({ id: 'a', title: 'A', x: 0, y: 0 });
  const saved = map.serialize();
  saved.rooms[0].title = 'Changed';
  assert.equal(map.rooms()[0].title, 'A');
  const restored = createWorld(map.serialize());
  assert.deepEqual(restored.serialize(), map.serialize());
});
test('malformed and oversized persisted data are rejected', () => {
  assert.throws(() => normalize({ rooms: [{}], exits: [] }), /Invalid room/);
  assert.throws(() => normalize({ rooms: [], exits: [{ id: 'e', from: 'a', to: 'b', command: 'e' }] }), /Invalid exit/);
  assert.throws(() => normalize({ rooms: Array(MAX_ROOMS + 1).fill({}), exits: [] }), /oversized/);
  assert.throws(() => normalize({ rooms: [], exits: Array(MAX_EXITS + 1).fill({}) }), /oversized/);
});
test('commands cannot embed extra lines or exceed 256 characters', () => {
  const map = createWorld();
  map.addRoom({ id: 'a', title: 'A', x: 0, y: 0 });
  map.addRoom({ id: 'b', title: 'B', x: 1, y: 0 });
  assert.throws(() => map.addExit({ from: 'a', to: 'b', command: 'east\nsay hi' }), /Invalid exit/);
  assert.throws(() => map.addExit({ from: 'a', to: 'b', command: 'x'.repeat(257) }), /Invalid exit/);
});
test('documented compass aliases suggest coordinates', () => {
  assert.deepEqual(directionOffset('northwest'), [-1, -1]);
  assert.deepEqual(directionOffset('SE'), [1, 1]);
  assert.equal(directionOffset('portal'), null);
  const map = createWorld();
  map.addRoom({ id: 'a', title: 'A', x: 100, y: 100 });
  assert.deepEqual(map.suggestCoordinates('a', 'north'), { x: 100, y: 0 });
});
console.log(`${checks} mapper checks passed`);
