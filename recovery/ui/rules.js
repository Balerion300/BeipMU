/* BeipMU recovery rules: data in, effects out. No DOM, network, or script execution. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipRules = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_LIMITS = Object.freeze({
    maxRules: 128, maxDepth: 8, maxPattern: 128, maxLine: 4096, maxCommand: 4096,
    maxActions: 32, maxReplacements: 32, maxCommands: 16,
    maxCapturePattern: 256, maxCaptureLines: 200, maxCaptureMs: 5000,
    maxMultilineLines: 9999, maxMultilineMs: 86400000
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
  // Flat persistence keeps old profiles compatible. Parent identity supplies the
  // hierarchy; scope belongs to the root and enablement gates each whole subtree.
  function hierarchy(rules, limit = DEFAULT_LIMITS.maxRules, maxDepth = DEFAULT_LIMITS.maxDepth) {
    const entries = [], roots = [], errors = [], ids = new Map();
    for (const [index, rule] of (Array.isArray(rules) ? rules : []).slice(0, limit).entries()) {
      if (!rule || typeof rule !== 'object') continue;
      const entry = { rule, index, children: [], parent: null, depth: 0, root: null };
      entries.push(entry);
      if (rule.id != null) {
        const id = String(rule.id);
        if (ids.has(id)) errors.push('Duplicate rule identity: ' + id + '.');
        else ids.set(id, entry);
      }
    }
    if (Array.isArray(rules) && rules.length > limit) errors.push('Rule count limit reached.');
    for (const entry of entries) {
      if (entry.rule.parentId) {
        entry.parent = ids.get(String(entry.rule.parentId));
        if (!entry.parent) errors.push('Missing rule parent: ' + entry.rule.parentId + '.');
      }
      if (entry.parent) entry.parent.children.push(entry); else if (!entry.rule.parentId) roots.push(entry);
      const seen = new Set([entry]); let cursor = entry;
      while (cursor.parent) {
        cursor = cursor.parent;
        if (seen.has(cursor)) { errors.push('Rule hierarchy contains a cycle.'); break; }
        seen.add(cursor);
      }
    }
    // Resolve ancestry only after all parent links have been assigned.
    for (const entry of entries) {
      const seen = new Set([entry]); let cursor = entry, depth = 0;
      while (cursor.parent && !seen.has(cursor.parent)) { cursor = cursor.parent; seen.add(cursor); depth++; }
      if (cursor.parent) errors.push('Rule hierarchy contains a cycle.');
      if (depth >= maxDepth) errors.push('Rule hierarchy exceeds ' + maxDepth + ' levels.');
      entry.depth = depth; entry.root = cursor;
    }
    return { entries, roots, errors: [...new Set(errors)] };
  }
  function normalizeHierarchy(items) {
    const tree = hierarchy(items);
    if (tree.errors.some(error => error.startsWith('Duplicate'))) return { items: [], diagnostics: tree.errors };
    const valid = tree.entries.filter(entry => {
      const seen = new Set(); let cursor = entry, depth = 0;
      while (cursor) {
        if (seen.has(cursor) || ++depth > DEFAULT_LIMITS.maxDepth || cursor.rule.parentId && !cursor.parent) return false;
        seen.add(cursor); cursor = cursor.parent;
      }
      return true;
    });
    return { items: valid.map(entry => {
      const scope = entry.root.rule.scope;
      return { ...entry.rule, scope: typeof scope === 'string' ? { level: scope } : { ...(scope || { level: 'global' }) } };
    }), diagnostics: tree.errors };
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
        return { start: at, end, captures: [text.slice(at, end)], ranges: [at, end] };
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
    const captures = [text], ranges = [0, text.length];
    let pi = 0, ti = 0;
    while (pi < glob.length) {
      if (glob[pi] === '*') {
        const start = ti;
        while (!possible(pi + 1, ti)) ti++;
        captures.push(text.slice(start, ti));ranges.push(start,ti);
        pi++;
      } else { pi++; ti++; }
    }
    return { start: 0, end: text.length, captures, ranges };
  }
  function regexMatch(text, pattern, rule, from, diagnostics) {
    let regex;
    try { regex = new RegExp(pattern, rule.matchCase ? 'gd' : 'gid'); }
    catch { diagnostics.push('Invalid regex in rule ' + String(rule.id ?? '(unnamed)') + '.'); return null; }
    regex.lastIndex = from;
    let hit;
    while ((hit = regex.exec(text))) {
      const start = hit.index, end = start + hit[0].length;
      if ((!rule.lineStart || start === 0) && (!rule.lineEnd || end === text.length) &&
          (!rule.wholeWord || wholeWordAt(text, start, end)))
        return { start, end, captures: Array.from(hit, value => value ?? ''),
          ranges: hit.indices.flatMap(pair => pair ? pair : [-1, -1]) };
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
  function normalizeVariables(input) {
    const values = Object.create(null); let total = 0;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return values;
    for (const [name, value] of Object.entries(input).slice(0, 128)) {
      if (!name || name.length > 128 || /[=\r\n\x00]/.test(name) || typeof value !== 'string' || value.length > 4096 || /[\r\n\x00]/.test(value)) continue;
      if ((total += name.length + value.length) > 65536) break;
      values[name] = value;
    }
    return values;
  }
  // Match original FindStringReplacement: case sensitive, nonrecursive, and
  // stop at the first unknown variable (rather than expanding later tokens).
  function expandVariables(template, variables, maxLength = 65536) {
    let text = String(template), start = text.indexOf('%');
    const values = normalizeVariables(variables);
    while (start >= 0) {
      const end = text.indexOf('%', start + 1);
      if (end < 0) break;
      const name = text.slice(start + 1, end);
      if (!Object.hasOwn(values, name)) break;
      const replacement = values[name];
      if (text.length - (end + 1 - start) + replacement.length > maxLength) return null;
      text = text.slice(0, start) + replacement + text.slice(end + 1);
      start = text.indexOf('%', start + replacement.length);
    }
    return text.length <= maxLength ? text : null;
  }
  function makeId(rule, index, prefix) { return rule.id == null ? prefix + index : String(rule.id); }
  function createEngine(config) {
    config = config || {};
    const aliases = Array.isArray(config.aliases) ? config.aliases.slice() : [];
    const triggers = Array.isArray(config.triggers) ? config.triggers.slice() : [];
    const limits = limitsFrom(config.limits);
    const aliasTree = hierarchy(aliases, limits.maxRules, limits.maxDepth);
    const triggerTree = hierarchy(triggers, limits.maxRules, limits.maxDepth);
    function rootsFor(tree, context, diagnostics) {
      const structural = tree.errors.filter(error => error !== 'Rule count limit reached.');
      diagnostics.push(...tree.errors);
      if (structural.length) return [];
      const group = (level, after) => tree.roots.filter(entry => levelOf(entry.rule) === level && inScope(entry.rule, context) && (level === 'character' || (entry.rule.phase === 'after') === after));
      return [...group('global', false), ...group('server', false), ...group('character', false), ...group('server', true), ...group('global', true)];
    }
    // Regex is only available to the bounded worker entry point. The default
    // synchronous engine intentionally ignores regex rules.
    const allowRegex = config.allowRegex === true && config.workerEngine === true;
    const lastFire = new Map(), firedOnce = new Set(), captures = new Map(), awayStates = new Map(), multilineStates = new Map();
    function contextKey(context) { return [context.serverId || '', context.characterId || ''].join('\u0000'); }

    function expandCommand(input, scope) {
      const diagnostics = [];
      if (typeof input !== 'string' || input.length > limits.maxCommand)
        return { commands: [], matched: false, diagnostics: ['Command exceeds length limit.'] };
      let text = input, matched = false, replacements = 0;
      let stopped = false;
      function visit(list) { for (const entry of list) {
        const rule = entry.rule;
        if (stopped) break;
        if (rule.enabled === false) continue;
        if (replacements >= limits.maxReplacements) { diagnostics.push('Alias replacement limit reached.'); break; }
        if (rule.folder) { if (rule.processChildren !== false) visit(entry.children); continue; }
        const replacement = typeof rule.replacement === 'string' ? rule.replacement : '';
        if (!rule.match) continue;
        let from = 0, hit, thisRuleMatched = false, sawEmpty = false;
        while ((hit = findMatch(text, rule, from, limits, allowRegex, diagnostics))) {
          if (hit.start === hit.end) { if (sawEmpty) break; sawEmpty = true; }
          let inserted = interpolate(replacement, hit.captures);
          if (rule.expandVariables) inserted = expandVariables(inserted, scope?.variables, limits.maxCommand * limits.maxCommands);
          if (inserted === null) { diagnostics.push('Alias variable expansion exceeds length limit.'); break; }
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
        if (thisRuleMatched && rule.processChildren !== false) visit(entry.children);
        if (thisRuleMatched && rule.stopProcessing) stopped = true;
      } }
      visit(rootsFor(aliasTree, scope || {}, diagnostics));
      const commands = splitCommands(text, limits);
      if (!commands) return { commands: [input], matched: false, diagnostics: diagnostics.concat('Alias command limit reached.') };
      return { commands, matched, diagnostics };
    }

    function processLine(input, scope, nowMs) {
      const diagnostics = [], actions = [], matches = [];
      if (typeof input !== 'string' || input.length > limits.maxLine)
        return { text: input, actions, matches, gagged: false, logGagged: false,
          diagnostics: ['Line exceeds rule processing limit.'] };
      const context = { ...(scope || {}), variables: normalizeVariables(scope?.variables) };
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      let text = input, gagged = false, logGagged = false;
      const captureKey = contextKey(context);
      let awayState = awayStates.get(captureKey);
      if (!awayState || awayState.epoch !== context.awayEpoch || awayState.away !== !!context.away) {
        awayState = { epoch: context.awayEpoch, away: !!context.away, notified: false };
        awayStates.set(captureKey, awayState);
      }
      let activeCapture = captures.get(captureKey);
      if (activeCapture && (now - activeCapture.startedAt >= limits.maxCaptureMs ||
          activeCapture.lines >= limits.maxCaptureLines)) {
        captures.delete(captureKey);
        activeCapture = null;
        diagnostics.push('Spawn capture limit reached; output returned to the main window.');
      }
      if (activeCapture) {
        actions.push({ type: 'spawn', title: activeCapture.title, group: activeCapture.group, text });
        if (!activeCapture.copy) gagged = true;
        if (activeCapture.gagLog) logGagged = true;
        activeCapture.lines++;
      }
      let spawnedThisLine = !!activeCapture;
      let stopped = false;
      const activeWindows = (multilineStates.get(captureKey) || []).filter(window => !window.expiresAt || now < window.expiresAt);
      const pendingWindows = new Map();
      function activateChildren(entry) {
        const lines = entry.rule.multilineLines ?? 0, time = entry.rule.multilineMs ?? 0;
        if (!Number.isSafeInteger(lines) || lines < 0 || lines > limits.maxMultilineLines ||
            !Number.isSafeInteger(time) || time < 0 || time > limits.maxMultilineMs || (!lines && !time)) {
          diagnostics.push('Multiline trigger needs a valid line or time limit: ' + makeId(entry.rule, entry.index, 'trigger-') + '.');
          return;
        }
        // One activation per parent. A re-hit resets both limits and moves it
        // ahead of earlier activations, after this line has finished processing.
        pendingWindows.delete(entry);
        pendingWindows.set(entry, { entry, remaining: lines, expiresAt: time ? now + time : 0 });
      }
      function visit(list) { for (const entry of list) {
        if (stopped) break;
        if (actions.length >= limits.maxActions) { diagnostics.push('Trigger action limit reached.'); break; }
        const rule = entry.rule, id = makeId(rule, entry.index, 'trigger-');
        if (rule.enabled === false) continue;
        if (rule.folder) { if (rule.multiline) activateChildren(entry); else if (rule.processChildren !== false) visit(entry.children); continue; }
        if (rule.awayCondition === 'away' && (!context.away || rule.awayOnce && awayState.notified) || rule.awayCondition === 'present' && context.away) continue;
        const key = [id, context.serverId || '', context.characterId || ''].join('\u0000');
        if (rule.once && firedOnce.has(key)) continue;
        const cooldown = Math.max(0, Math.min(Number(rule.cooldownMs) || 0, 86400000));
        if (cooldown && lastFire.has(key) && now - lastFire.get(key) < cooldown) continue;
        let from = 0, hit, thisRuleMatched = false, occurrences = 0, sawEmpty = false;
        while ((hit = findMatch(text, rule, from, limits, allowRegex, diagnostics))) {
        if (hit.start === hit.end) { if (sawEmpty) break; sawEmpty = true; }
        thisRuleMatched = true;
        if (++occurrences > limits.maxReplacements || actions.length >= limits.maxActions) { diagnostics.push('Trigger match/action limit reached.'); break; }
        matches.push({ triggerId: id, start: hit.start, end: hit.end, captures: hit.captures.slice() });
        const detail = { triggerId: id };
        if (rule.highlight && typeof rule.highlight === 'object') {
          const highlight = rule.highlight, color = {}, style = {};
          for (const field of ['color', 'background']) if (highlight[field] != null) color[field] = highlight[field];
          for (const field of ['bold', 'italic', 'underline', 'strike'])
            if (highlight[field] === true || highlight.styleExplicit && highlight[field] === false) style[field] = highlight[field];
          const ranges = highlight.captureGroups && hit.ranges.length > 2 ? hit.ranges.slice(2) : [hit.start, hit.end];
          const add = (value, wholeLine) => {
            if (!Object.keys(value).length) return;
            const selected = wholeLine ? [0, text.length] : ranges;
            for (let index = 0; index < selected.length && actions.length < limits.maxActions; index += 2) {
              const start = selected[index], end = selected[index + 1];
              if (start >= 0 && end > start) actions.push({ type: 'highlight', start, end, style: value, ...detail });
            }
          };
          const colorWholeLine = highlight.colorWholeLine ?? highlight.wholeLine;
          const styleWholeLine = highlight.styleWholeLine ?? highlight.wholeLine;
          if (!!colorWholeLine === !!styleWholeLine) add({ ...color, ...style }, colorWholeLine);
          else { add(color, colorWholeLine); add(style, styleWholeLine); }
        }
        if (rule.gag) gagged = true;
        if (rule.logGag) logGagged = true;
        if (typeof rule.sendText === 'string' && rule.sendText) {
          let command = interpolate(rule.sendText, hit.captures);
          if (rule.sendExpandVariables) command = expandVariables(command, context.variables, limits.maxCommand);
          if (command !== null && command.length <= limits.maxCommand && (!rule.sendOnClick || !/[\r\n]/.test(command))) {
            if (rule.sendOnClick) {
              const index = Number.isSafeInteger(rule.sendCaptureIndex) && rule.sendCaptureIndex >= 0 ? rule.sendCaptureIndex : 1;
              const at = index * 2 < hit.ranges.length ? index * 2 : 0;
              const start = hit.ranges[at], end = hit.ranges[at + 1];
              if (start >= 0 && end > start) actions.push({ type: 'commandLink', start, end, text: command, ...detail });
            } else actions.push({ type: 'command', text: command, ...detail });
            // A following rule on this same line sees a successful original
            // /set or /unset action; the caller later persists those effects.
            const set = /^\/set\s+([^=]+)=([^\r\n]*)$/i.exec(command);
            const unset = /^\/unset\s+(.+)$/i.exec(command);
            if (set && !rule.sendOnClick) {
              const candidate = Object.assign(Object.create(null), context.variables, { [set[1]]: set[2] });
              const normalized = normalizeVariables(candidate);
              if (Object.hasOwn(normalized, set[1]) && Object.keys(candidate).length === Object.keys(normalized).length) context.variables = normalized;
            } else if (unset && !rule.sendOnClick) delete context.variables[unset[1]];
          } else diagnostics.push('Trigger command exceeds its text limit or clickable one-line limit.');
        }
        if (rule.spawnTitle && !spawnedThisLine && actions.length < limits.maxActions) {
          spawnedThisLine = true;
          const title = interpolate(String(rule.spawnTitle), hit.captures).slice(0, 80);
          const group = interpolate(String(rule.spawnGroup || ''), hit.captures).slice(0, 80);
          actions.push({ type: 'spawn', title, group, text, ...detail });
          if (!rule.spawnCopy) gagged = true;
          if (rule.spawnGagLog) logGagged = true;
          if (rule.captureUntil) {
            if (!allowRegex) diagnostics.push('Spawn capture-until requires the rules worker.');
            else if (typeof rule.captureUntil !== 'string' || rule.captureUntil.length > limits.maxCapturePattern)
              diagnostics.push('Spawn capture-until pattern is too long.');
            else {
              try {
                captures.set(captureKey, { title, group, copy: !!rule.spawnCopy, entry,
                  onlyChildren: !!rule.captureOnlyChildren,
                  gagLog: !!rule.spawnGagLog, until: new RegExp(rule.captureUntil),
                  startedAt: now, lines: 0 });
              } catch { diagnostics.push('Invalid capture-until regex in rule ' + id + '.'); }
            }
          }
        }
        if (rule.notify) actions.push({ type: 'notification', text, ...detail });
        if (rule.sound?.enabled && typeof rule.sound.path === 'string') {
          const path = expandVariables(rule.sound.path, context.variables, 1024);
          if (path) actions.push({ type: 'sound', path, ...detail });
        }
        if (rule.speech?.enabled) {
          const spoken = rule.speech.wholeLine ? text : interpolate(rule.speech.text || '', hit.captures);
          if (spoken && spoken.length <= 2048) actions.push({ type: 'speech', text: spoken, ...detail });
          else if (spoken) diagnostics.push('Speech text exceeds the 2048-character limit.');
        }
        if (typeof rule.scriptName === 'string' && rule.scriptName) {
          if (!/^[A-Za-z_$][\w$]{0,79}$/.test(rule.scriptName))diagnostics.push('Invalid trigger script name in rule ' + id + '.');
          else if(actions.length < limits.maxActions)
            actions.push({ type: 'script', name: rule.scriptName, text, ranges: hit.ranges.slice(0, 32), ...detail });
        }
        let nextFrom = hit.end;
        if (typeof rule.filterText === 'string') {
          let replacement = interpolate(rule.filterText, hit.captures);
          if (rule.filterExpandVariables) replacement = expandVariables(replacement, context.variables, limits.maxLine);
          const next = replacement === null ? null : text.slice(0, hit.start) + replacement + text.slice(hit.end);
          if (next !== null && next.length <= limits.maxLine) { text = next; nextFrom = hit.start + replacement.length; }
          else diagnostics.push('Filtered line exceeds length limit.');
        }
        if (rule.once) firedOnce.add(key);
        if (cooldown) lastFire.set(key, now);
        if (rule.awayOnce) awayState.notified = true;
        if (rule.oncePerLine !== false || rule.matchType === 'exact' || rule.matchType === 'wildcard') break;
        from = nextFrom + (hit.start === hit.end ? 1 : 0);
        if (from > text.length) break;
        }
        if (!thisRuleMatched) continue;
        if (rule.multiline) activateChildren(entry);
        else if (rule.processChildren !== false) visit(entry.children);
        if (rule.stopProcessing) stopped = true;
      } }
      const roots = rootsFor(triggerTree, context, diagnostics);
      // Original capture-only children have priority over every other trigger
      // family. Like the original, this uses the stored child list directly.
      if (activeCapture?.onlyChildren) { visit(activeCapture.entry.children); stopped = true; }
      for (const window of activeWindows) if (!pendingWindows.has(window.entry)) visit(window.entry.children);
      visit(roots);
      const surviving = activeWindows.filter(window => !pendingWindows.has(window.entry) &&
        (window.remaining === 0 || --window.remaining > 0));
      const nextWindows = [...pendingWindows.values()].reverse().concat(surviving);
      if (nextWindows.length) multilineStates.set(captureKey, nextWindows); else multilineStates.delete(captureKey);
      // The terminating line is still captured. Its regex sees the processed
      // text, including filters from capture children, as in Connection.cpp.
      if (activeCapture && activeCapture.until.test(text)) captures.delete(captureKey);
      for (const action of actions) if (action.type === 'spawn') action.text = text;
      return { text, actions: actions.slice(0, limits.maxActions), matches, gagged, logGagged, diagnostics };
    }
    function cancelCapture(scope) {
      return { cancelled: captures.delete(contextKey(scope || {})) };
    }
    function resetTemporal(scope) {
      if (scope === undefined) { captures.clear(); multilineStates.clear(); }
      else { const key = contextKey(scope || {}); captures.delete(key); multilineStates.delete(key); }
      return { reset: true };
    }
    return { expandCommand, processLine, cancelCapture, resetTemporal };
  }
  return { createEngine, interpolate, expandVariables, normalizeVariables, hierarchy, normalizeHierarchy, DEFAULT_LIMITS };
});
