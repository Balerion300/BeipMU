/* BeipMU recovery rules: data in, effects out. No DOM, network, or script execution. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipRules = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_LIMITS = Object.freeze({
    maxRules: 128, maxPattern: 128, maxLine: 4096, maxCommand: 4096,
    maxActions: 32, maxReplacements: 32, maxCommands: 16
  });
  const LEVELS = ['global', 'server', 'character'];

  function boundedInt(value, fallback, ceiling) {
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, ceiling) : fallback;
  }
  function limitsFrom(input) {
    const result = {};
    for (const [key, value] of Object.entries(DEFAULT_LIMITS))
      result[key] = boundedInt(input && input[key], value, value);
    return result;
  }
  function levelOf(rule) {
    const scope = rule && rule.scope;
    return typeof scope === 'string' ? scope : scope && scope.level || 'global';
  }
  function inScope(rule, context) {
    const level = levelOf(rule);
    const scope = rule.scope || {};
    if (level === 'global') return true;
    if (level === 'server') return !!context.serverId && String(scope.serverId) === String(context.serverId);
    if (level === 'character') return !!context.serverId && !!context.characterId &&
      String(scope.serverId) === String(context.serverId) && String(scope.characterId) === String(context.characterId);
    return false;
  }
  function ordered(rules, context, limit) {
    const list = [];
    for (const level of LEVELS) {
      for (const rule of rules) {
        if (list.length >= limit) return list;
        if (rule && rule.enabled !== false && levelOf(rule) === level && inScope(rule, context)) list.push(rule);
      }
    }
    return list;
  }
  function wordChar(char) { return !!char && /[\p{L}\p{N}_]/u.test(char); }
  function wholeWordAt(text, start, end) {
    return !wordChar(text[start - 1]) && !wordChar(text[end]);
  }
  function simpleMatch(text, pattern, rule, from) {
    const source = rule.matchCase ? text : text.toLocaleLowerCase();
    const needle = rule.matchCase ? pattern : pattern.toLocaleLowerCase();
    let at = source.indexOf(needle, from);
    while (at >= 0) {
      const end = at + pattern.length;
      if ((!rule.lineStart || at === 0) && (!rule.lineEnd || end === text.length) &&
          (!rule.wholeWord || wholeWordAt(text, at, end)))
        return { start: at, end, captures: [text.slice(at, end)] };
      at = source.indexOf(needle, at + 1);
    }
    return null;
  }
  // Full-line glob matching, with memoized feasibility. Runtime is O(pattern * line).
  // Each * is one capture; shortest successful capture wins.
  function wildcardMatch(text, pattern, matchCase) {
    const source = matchCase ? text : text.toLocaleLowerCase();
    const glob = matchCase ? pattern : pattern.toLocaleLowerCase();
    const width = source.length + 1;
    const memo = new Int8Array((glob.length + 1) * width);
    function possible(pi, ti) {
      const key = pi * width + ti;
      if (memo[key]) return memo[key] === 2;
      let yes;
      if (pi === glob.length) yes = ti === source.length;
      else if (glob[pi] === '*') yes = possible(pi + 1, ti) ||
        (ti < source.length && possible(pi, ti + 1));
      else yes = ti < source.length && (glob[pi] === '?' || glob[pi] === source[ti]) &&
        possible(pi + 1, ti + 1);
      memo[key] = yes ? 2 : 1;
      return yes;
    }
    if (!possible(0, 0)) return null;
    const captures = [text];
    let pi = 0, ti = 0;
    while (pi < glob.length) {
      if (glob[pi] === '*') {
        const start = ti;
        while (!possible(pi + 1, ti)) ti++;
        captures.push(text.slice(start, ti));
        pi++;
      } else { pi++; ti++; }
    }
    return { start: 0, end: text.length, captures };
  }
  function regexMatch(text, pattern, rule, from, diagnostics) {
    let regex;
    try { regex = new RegExp(pattern, rule.matchCase ? 'g' : 'gi'); }
    catch { diagnostics.push('Invalid regex in rule ' + String(rule.id ?? '(unnamed)') + '.'); return null; }
    regex.lastIndex = from;
    let hit;
    while ((hit = regex.exec(text))) {
      const start = hit.index, end = start + hit[0].length;
      if ((!rule.lineStart || start === 0) && (!rule.lineEnd || end === text.length) &&
          (!rule.wholeWord || wholeWordAt(text, start, end)))
        return { start, end, captures: Array.from(hit, value => value ?? '') };
      regex.lastIndex = start + Math.max(1, hit[0].length);
    }
    return null;
  }
  function findMatch(text, rule, from, limits, allowRegex, diagnostics) {
    const pattern = rule.match;
    if (typeof pattern !== 'string' || !pattern || pattern.length > limits.maxPattern) return null;
    if (rule.matchType === 'regex') return allowRegex ? regexMatch(text, pattern, rule, from, diagnostics) : null;
    if (rule.matchType === 'wildcard') return from ? null : wildcardMatch(text, pattern, !!rule.matchCase);
    if (rule.matchType && rule.matchType !== 'simple' && rule.matchType !== 'exact') return null;
    if (rule.matchType === 'exact') {
      const hit = simpleMatch(text, pattern, { ...rule, lineStart: true, lineEnd: true }, from);
      return hit;
    }
    return simpleMatch(text, pattern, rule, from);
  }
  // BeipMU's FindStringReplacement accepts \0, \1... and \\ for a literal slash.
  function interpolate(template, captures) {
    if (typeof template !== 'string') return '';
    return template.replace(/\\(\\|a\d\d|\d)/g, (whole, token) => {
      if (token === '\\') return '\\';
      const index = token[0] === 'a' ? Number(token.slice(1)) : Number(token);
      return index < captures.length ? captures[index] : whole;
    });
  }
  function splitCommands(text, limits) {
    const commands = text.split(/\r\n|\n|\r/);
    if (commands.length > limits.maxCommands || commands.some(command => command.length > limits.maxCommand)) return null;
    return commands;
  }
  function makeId(rule, index, prefix) { return rule.id == null ? prefix + index : String(rule.id); }
  function createEngine(config) {
    config = config || {};
    const aliases = Array.isArray(config.aliases) ? config.aliases.slice() : [];
    const triggers = Array.isArray(config.triggers) ? config.triggers.slice() : [];
    const limits = limitsFrom(config.limits);
    // Regex is only available to the bounded worker entry point. The default
    // synchronous engine intentionally ignores regex rules.
    const allowRegex = config.allowRegex === true && config.workerEngine === true;
    const lastFire = new Map(), firedOnce = new Set();

    function expandCommand(input, scope) {
      const diagnostics = [];
      if (typeof input !== 'string' || input.length > limits.maxCommand)
        return { commands: [], matched: false, diagnostics: ['Command exceeds length limit.'] };
      let text = input, matched = false, replacements = 0;
      for (const rule of ordered(aliases, scope || {}, limits.maxRules)) {
        if (replacements >= limits.maxReplacements) { diagnostics.push('Alias replacement limit reached.'); break; }
        const replacement = typeof rule.replacement === 'string' ? rule.replacement : '';
        if (!rule.match || !replacement) continue;
        let from = 0, hit, thisRuleMatched = false;
        while ((hit = findMatch(text, rule, from, limits, allowRegex, diagnostics))) {
          const inserted = interpolate(replacement, hit.captures);
          const next = text.slice(0, hit.start) + inserted + text.slice(hit.end);
          if (next.length > limits.maxCommand * limits.maxCommands) {
            diagnostics.push('Alias output exceeds length limit.');
            break;
          }
          text = next;
          matched = thisRuleMatched = true;
          replacements++;
          from = hit.start + inserted.length;
          if (rule.matchType === 'wildcard' || rule.matchType === 'exact' ||
              replacements >= limits.maxReplacements) break;
        }
        if (thisRuleMatched && rule.stopProcessing) break;
      }
      const commands = splitCommands(text, limits);
      if (!commands) return { commands: [input], matched: false, diagnostics: diagnostics.concat('Alias command limit reached.') };
      return { commands, matched, diagnostics };
    }

    function processLine(input, scope, nowMs) {
      const diagnostics = [], actions = [], matches = [];
      if (typeof input !== 'string' || input.length > limits.maxLine)
        return { text: input, actions, matches, gagged: false, logGagged: false,
          diagnostics: ['Line exceeds rule processing limit.'] };
      const context = scope || {};
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      let text = input, gagged = false, logGagged = false;
      for (let index = 0, list = ordered(triggers, context, limits.maxRules); index < list.length; index++) {
        if (actions.length >= limits.maxActions) { diagnostics.push('Trigger action limit reached.'); break; }
        const rule = list[index], id = makeId(rule, index, 'trigger-');
        const key = [id, context.serverId || '', context.characterId || ''].join('\u0000');
        if (rule.once && firedOnce.has(key)) continue;
        const cooldown = Math.max(0, Math.min(Number(rule.cooldownMs) || 0, 86400000));
        if (cooldown && lastFire.has(key) && now - lastFire.get(key) < cooldown) continue;
        const hit = findMatch(text, rule, 0, limits, allowRegex, diagnostics);
        if (!hit) continue;
        matches.push({ triggerId: id, start: hit.start, end: hit.end, captures: hit.captures.slice() });
        const detail = { triggerId: id };
        if (rule.highlight && typeof rule.highlight === 'object') {
          const style = {};
          for (const field of ['color', 'background', 'bold', 'italic', 'underline', 'strike'])
            if (rule.highlight[field] != null) style[field] = rule.highlight[field];
          actions.push({ type: 'highlight', start: rule.highlight.wholeLine ? 0 : hit.start,
            end: rule.highlight.wholeLine ? text.length : hit.end, style, ...detail });
        }
        if (rule.gag) gagged = true;
        if (rule.logGag) logGagged = true;
        if (typeof rule.sendText === 'string' && rule.sendText) {
          const command = interpolate(rule.sendText, hit.captures);
          if (command.length <= limits.maxCommand && !/[\r\n]/.test(command))
            actions.push({ type: 'command', text: command, ...detail });
          else diagnostics.push('Trigger command exceeds one-line limit.');
        }
        if (rule.spawnTitle) {
          const title = interpolate(String(rule.spawnTitle), hit.captures).slice(0, 80);
          actions.push({ type: 'spawn', title, text, ...detail });
        }
        if (rule.notify) actions.push({ type: 'notification', text, ...detail });
        if (typeof rule.filterText === 'string') {
          const replacement = interpolate(rule.filterText, hit.captures);
          const next = text.slice(0, hit.start) + replacement + text.slice(hit.end);
          if (next.length <= limits.maxLine) text = next;
          else diagnostics.push('Filtered line exceeds length limit.');
        }
        if (rule.once) firedOnce.add(key);
        if (cooldown) lastFire.set(key, now);
        if (rule.stopProcessing) break;
      }
      return { text, actions: actions.slice(0, limits.maxActions), matches, gagged, logGagged, diagnostics };
    }
    return { expandCommand, processLine };
  }
  return { createEngine, interpolate, DEFAULT_LIMITS };
});
