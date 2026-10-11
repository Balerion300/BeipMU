'use strict';
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { createState } = require('../ui/tilemap.js');
let checks = 0;
async function test(name, body) { await body(); checks++; console.log('ok ' + name); }
(async () => {
  const info = { 'tile-url': 'https://example.org/tiles.png', 'tile-size': '16,16',
    'map-size': '2,2', encoding: 'Hex_4' };
  await test('info precedes data and hex_4 decodes documented order', async () => {
    const maps = createState();
    assert.equal((await maps.apply('beip.tilemap.data', { One: '0123' })).errors.length, 1);
    assert.deepEqual((await maps.apply('beip.tilemap.info', { One: info })).updated, ['One']);
    assert.deepEqual([...maps.get('One').tiles], [0, 0, 0, 0]);
    assert.deepEqual((await maps.apply('beip.tilemap.data', { One: '0123' })).updated, ['One']);
    assert.deepEqual([...maps.get('One').tiles], [0, 1, 2, 3]);
  });
  await test('hex_8, base64_8 and zbase64_8 decode exact cell count', async () => {
    const maps = createState();
    for (const [name, encoding, data] of [
      ['hex', 'hex_8', '0001feff'],
      ['base', 'base64_8', Buffer.from([0, 1, 254, 255]).toString('base64')],
      ['zip', 'zbase64_8', zlib.deflateSync(Buffer.from([0, 1, 254, 255])).toString('base64')]
    ]) {
      await maps.apply('Beip.Tilemap.Info', { [name]: { ...info, encoding } });
      assert.deepEqual((await maps.apply('Beip.Tilemap.Data', { [name]: data })).errors, []);
      assert.deepEqual([...maps.get(name).tiles], [0, 1, 254, 255]);
    }
  });
  await test('partial info update preserves cells; resize clears them', async () => {
    const maps = createState();
    await maps.apply('beip.tilemap.info', { One: info });
    await maps.apply('beip.tilemap.data', { One: '1234' });
    await maps.apply('beip.tilemap.info', { One: { 'tile-url': 'https://example.org/new.png' } });
    assert.deepEqual([...maps.get('One').tiles], [1, 2, 3, 4]);
    await maps.apply('beip.tilemap.info', { One: { 'map-size': '1,2' } });
    assert.deepEqual([...maps.get('One').tiles], [0, 0]);
  });
  await test('malformed data does not overwrite prior map', async () => {
    const maps = createState();
    await maps.apply('beip.tilemap.info', { One: info });
    await maps.apply('beip.tilemap.data', { One: '1234' });
    assert.equal((await maps.apply('beip.tilemap.data', { One: '12xx' })).errors.length, 1);
    assert.deepEqual([...maps.get('One').tiles], [1, 2, 3, 4]);
  });
  await test('unsafe URLs and oversized maps are rejected', async () => {
    const maps = createState();
    for (const changed of [
      { 'tile-url': 'file:///etc/passwd' },
      { 'map-size': '256,256' },
      { 'tile-size': '256,256', 'map-size': '32,32' }
    ]) assert.equal((await maps.apply('beip.tilemap.info', { Bad: { ...info, ...changed } })).errors.length, 1);
    assert.deepEqual(maps.list(), []);
  });
  await test('canvas draw uses row-major tiles and source grid', async () => {
    const maps = createState();
    await maps.apply('beip.tilemap.info', { One: info });
    await maps.apply('beip.tilemap.data', { One: '0123' });
    const draws = [], context = { clearRect() {}, drawImage(...args) { draws.push(args); } };
    const canvas = { getContext() { return context; } };
    assert.equal(maps.render(canvas, 'One', { width: 32, height: 32 }), true);
    assert.equal(canvas.width, 32);
    assert.equal(draws.length, 4);
    assert.deepEqual(draws[3].slice(1), [16, 16, 16, 16, 16, 16, 16, 16]);
  });
  console.log(`${checks} tilemap checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
