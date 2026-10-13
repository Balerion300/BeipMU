/* Trigger-owned local WAV and plain-text Windows speech. Never call this from markup. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipTriggerAudio = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_PATH = 2048, MAX_TEXT = 2048;
  function safePath(path) {
    return typeof path === 'string' && path.length <= MAX_PATH && /^[a-z]:[\\/]/i.test(path) &&
      /\.wav$/i.test(path) && !/[\u0000-\u001f\u007f<>"|?*]/.test(path) &&
      !path.slice(2).includes(':') && !path.split(/[\\/]/).some(p => p === '..' || p === '.');
  }
  function safeText(text) {
    return typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_TEXT &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
  }
  function encode(value) {
    const bytes = new TextEncoder().encode(value);
    return typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(String.fromCharCode(...bytes));
  }
  function createController(options = {}) {
    const id = options.sessionId;
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id)) throw new TypeError('A trigger audio session is required.');
    const post = typeof options.post === 'function' ? options.post : () => false;
    let enabled = options.enabled === true, closed = false;
    const events = [];
    function send(action, value = '') {
      if (closed) return false;
      try { return post(`triggeraudio|${id}|${action}|${encode(value)}`) !== false; } catch { return false; }
    }
    function stop() { return send('stop'); }
    function playSound(path) { return enabled && !closed && safePath(path) && send('sound', path); }
    function speak(text) { return enabled && !closed && safeText(text) && send('speech', text); }
    function handle(action) {
      if (!action || typeof action !== 'object') return false;
      return action.type === 'sound' ? playSound(action.path) : action.type === 'speech' ? speak(action.text) : false;
    }
    function handleEvent(data) {
      if (closed) return false;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch { return false; }
      if (!data || !['sound', 'speech', 'stop', 'browse'].includes(data.action) || typeof data.status !== 'string' || data.status.length > 64) return false;
      // Content stays out of playback evidence. An explicit Browse result includes the selected path.
      const event = { action: data.action, status: data.status, stream: Number.isSafeInteger(data.stream) ? data.stream : 0 };
      if (data.action === 'browse' && data.status === 'selected') {
        if (!safePath(data.path)) return false;
        event.path = data.path;
      }
      events.push(event);
      if (events.length > 64) events.shift();
      return true;
    }
    return { playSound, speak, handle, handleEvent, stop, browse() { return send('browse'); },
      setEnabled(value) { const next = value === true; if (enabled && !next) stop(); enabled = next; return enabled; },
      close() { if (!closed) stop(); closed = true; enabled = false; },
      snapshot() { return { sessionId: id, enabled, closed, events: events.map(e => ({ ...e })) }; }
    };
  }
  return { createController, safePath, safeText, MAX_PATH, MAX_TEXT };
});
