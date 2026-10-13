/* Beip.Tilemap state and canvas renderer; no HTML or server code execution. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipTilemap = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_MAPS = 8, MAX_CELLS = 16384, MAX_PIXELS = 4096;
  const ENCODINGS = new Set(['hex_4', 'hex_8', 'base64_8', 'zbase64_8']);
  function safeURL(value) {
    if (typeof value !== 'string' || !value || value.length > 2048) return null;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') &&
        !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function dimensions(value, max) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{1,3}),(\d{1,3})$/.exec(value);
    if (!match) return null;
    const x = Number(match[1]), y = Number(match[2]);
    return x > 0 && y > 0 && x <= max && y <= max ? [x, y] : null;
  }
  function bytesFromBase64(text, maxBytes) {
    if (typeof text !== 'string' || text.length > Math.ceil(maxBytes / 3) * 4 + 4 ||
        text.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) return null;
    try {
      if (typeof atob === 'function') {
        const binary = atob(text);
        return binary.length <= maxBytes ? Uint8Array.from(binary, c => c.charCodeAt(0)) : null;
      }
      if (typeof Buffer !== 'undefined') {
        const bytes = Buffer.from(text, 'base64');
        return bytes.length <= maxBytes ? Uint8Array.from(bytes) : null;
      }
    } catch {}
    return null;
  }
  async function inflateBounded(bytes, maxBytes, override) {
    if (override) {
      const result = await override(bytes, maxBytes);
      const output = result instanceof Uint8Array ? result : null;
      return output && output.length <= maxBytes ? output : null;
    }
    if (typeof DecompressionStream === 'function') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const reader = stream.getReader(), parts = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > maxBytes) { await reader.cancel(); return null; }
          parts.push(value);
        }
      } catch { return null; }
      const output = new Uint8Array(length);
      let offset = 0;
      for (const part of parts) { output.set(part, offset); offset += part.length; }
      return output;
    }
    if (typeof require === 'function') {
      try { return Uint8Array.from(require('node:zlib').inflateSync(bytes, { maxOutputLength: maxBytes })); }
      catch { return null; }
    }
    return null;
  }
  async function decode(text, encoding, cells, inflate) {
    if (typeof text !== 'string') return null;
    if (encoding === 'hex_4' || encoding === 'hex_8') {
      const factor = encoding === 'hex_4' ? 1 : 2;
      if (text.length !== cells * factor || !/^[0-9a-fA-F]+$/.test(text)) return null;
      const tiles = new Uint8Array(cells);
      for (let i = 0; i < cells; i++) tiles[i] = parseInt(text.slice(i * factor, (i + 1) * factor), 16);
      return tiles;
    }
    const bytes = bytesFromBase64(text, encoding === 'zbase64_8' ? 131072 : cells);
    if (!bytes) return null;
    const tiles = encoding === 'zbase64_8' ? await inflateBounded(bytes, cells, inflate) : bytes;
    return tiles && tiles.length === cells ? tiles : null;
  }
  function createState(options) {
    options = options || {};
    const maps = new Map();
    async function apply(packageName, payload) {
      const errors = [], updated = [];
      if (typeof packageName !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload))
        return { updated, errors: ['Invalid tilemap message.'] };
      const kind = packageName.toLowerCase();
      if (kind !== 'beip.tilemap.info' && kind !== 'beip.tilemap.data')
        return { updated, errors: ['Unsupported tilemap message.'] };
      for (const [name, value] of Object.entries(payload).slice(0, MAX_MAPS)) {
        if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) { errors.push('Invalid map name.'); continue; }
        const previous = maps.get(name);
        if (kind.endsWith('.info')) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(name + ': invalid info.'); continue; }
          const url = value['tile-url'] == null ? previous?.url : safeURL(value['tile-url']);
          const tile = value['tile-size'] == null ? previous?.tile : dimensions(value['tile-size'], 256);
          const size = value['map-size'] == null ? previous?.size : dimensions(value['map-size'], 256);
          const encoding = String(value.encoding ?? previous?.encoding ?? '').toLowerCase();
          if (!url || !tile || !size || !ENCODINGS.has(encoding) ||
              size[0] * size[1] > MAX_CELLS || tile[0] * size[0] > MAX_PIXELS ||
              tile[1] * size[1] > MAX_PIXELS || (!previous && maps.size >= MAX_MAPS)) {
            errors.push(name + ': invalid or oversized map info.'); continue;
          }
          const changedSize = !previous || previous.size[0] !== size[0] || previous.size[1] !== size[1];
          maps.set(name, { name, url, tile, size, encoding,
            tiles: changedSize ? new Uint8Array(size[0] * size[1]) : previous.tiles });
          updated.push(name);
        } else {
          if (!previous) { errors.push(name + ': info required before data.'); continue; }
          const tiles = await decode(value, previous.encoding, previous.size[0] * previous.size[1], options.inflate);
          if (!tiles) { errors.push(name + ': invalid map data.'); continue; }
          previous.tiles = tiles;
          updated.push(name);
        }
      }
      return { updated, errors };
    }
    function get(name) {
      const map = maps.get(name);
      return map ? { name: map.name, url: map.url, tile: [...map.tile], size: [...map.size],
        encoding: map.encoding, tiles: Uint8Array.from(map.tiles) } : null;
    }
    function render(canvas, name, image) {
      const map = maps.get(name);
      if (!map || !canvas || typeof canvas.getContext !== 'function' || !image) return false;
      const cols = Math.floor(image.width / map.tile[0]);
      const rows = Math.floor(image.height / map.tile[1]);
      if (!cols || !rows || Math.max(...map.tiles) >= cols * rows) return false;
      const context = canvas.getContext('2d');
      if (!context || typeof context.drawImage !== 'function') return false;
      canvas.width = map.size[0] * map.tile[0];
      canvas.height = map.size[1] * map.tile[1];
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < map.tiles.length; index++) {
        const tile = map.tiles[index];
        context.drawImage(image, (tile % cols) * map.tile[0], Math.floor(tile / cols) * map.tile[1],
          map.tile[0], map.tile[1], (index % map.size[0]) * map.tile[0],
          Math.floor(index / map.size[0]) * map.tile[1], map.tile[0], map.tile[1]);
      }
      return true;
    }
    return { apply, get, list: () => [...maps.keys()], render };
  }
  return { createState, safeURL, MAX_MAPS, MAX_CELLS, MAX_PIXELS };
});
