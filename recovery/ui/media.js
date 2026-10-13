/* Opt-in Client.Media subset. The caller decides whether to enable sound. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipMedia = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_CACHE = 32, MAX_ACTIVE = 16;
  function safeURL(value) {
    if (typeof value !== 'string' || !value || value.length > 2048) return null;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') &&
        !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function safeName(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
      !/[\\?#:\u0000-\u001f]/.test(value) && !value.startsWith('/') &&
      !value.split('/').some(part => part === '..' || part === '.');
  }
  function sourceURL(base, name) {
    if (!safeName(name)) return null;
    const validBase = safeURL(base);
    if (!validBase) return null;
    try {
      const baseURL = new URL(validBase);
      if (baseURL.search || baseURL.hash) return null;
      const result = new URL(baseURL.href + name);
      if (result.origin !== baseURL.origin || !result.pathname.startsWith(baseURL.pathname)) return null;
      return safeURL(result.href);
    } catch { return null; }
  }
  function createController(options) {
    options = options || {};
    const AudioClass = options.AudioClass || (typeof Audio === 'function' ? Audio : null);
    let enabled = options.enabled === true, defaultURL = '';
    const cache = new Map(), active = new Map();
    function cacheSet(name, url) {
      if (cache.has(name)) cache.delete(name);
      cache.set(name, url);
      while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
    function stop(name) {
      const item = active.get(name);
      if (!item) return false;
      item.audio.onended = null;
      try { item.audio.pause(); item.audio.currentTime = 0; } catch {}
      active.delete(name);
      return true;
    }
    function stopAll() {
      for (const name of [...active.keys()]) stop(name);
    }
    function setEnabled(value) {
      enabled = value === true;
      if (!enabled) stopAll();
      return enabled;
    }
    function handle(packageName, payload) {
      if (typeof packageName !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      const kind = packageName.toLowerCase();
      if (kind === 'client.media.default') {
        const url = safeURL(payload.url);
        if (!url) return false;
        defaultURL = url; return true;
      }
      if (kind === 'client.media.load') {
        const url = sourceURL(payload.url || defaultURL, payload.name);
        if (!url) return false;
        cacheSet(payload.name, url); return true;
      }
      if (kind === 'client.media.stop') {
        if (payload.name == null || payload.name === '') { stopAll(); return true; }
        return safeName(payload.name) ? stop(payload.name) : false;
      }
      if (kind !== 'client.media.play' || !enabled || !AudioClass || !safeName(payload.name)) return false;
      const name = payload.name;
      let url = cache.get(name);
      if (!url) url = sourceURL(payload.url || defaultURL, name);
      if (!url) return false;
      cacheSet(name, url);
      if (active.has(name)) stop(name);
      if (active.size >= MAX_ACTIVE) return false;
      const loops = payload.loops == null ? 1 : Number(payload.loops);
      if (!Number.isSafeInteger(loops) || loops < -1 || loops > 32) return false;
      const volume = payload.volume == null ? 50 : Number(payload.volume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) return false;
      let audio;
      try { audio = new AudioClass(url); }
      catch { return false; }
      audio.preload = 'none';
      audio.volume = volume / 100;
      audio.loop = loops === -1;
      const item = { audio, remaining: loops === 0 ? 1 : loops };
      audio.onended = () => {
        if (active.get(name) !== item) return;
        if (item.remaining === -1) return;
        item.remaining--;
        if (item.remaining > 0) {
          try { audio.currentTime = 0; const started = audio.play(); if (started?.catch) started.catch(() => stop(name)); }
          catch { stop(name); }
        } else stop(name);
      };
      active.set(name, item);
      try { const started = audio.play(); if (started?.catch) started.catch(() => stop(name)); }
      catch { stop(name); return false; }
      return true;
    }
    function snapshot() {
      return { enabled, defaultURL, cached: [...cache.keys()], playing: [...active.keys()] };
    }
    return { handle, setEnabled, stopAll, snapshot };
  }
  return { createController, safeURL, sourceURL, MAX_CACHE, MAX_ACTIVE };
});
