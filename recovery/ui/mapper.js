/* Bounded per-world room graph. Produces route commands; performs no I/O. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BeipMapper = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_ROOMS = 1024, MAX_EXITS = 4096, MAX_COORDINATE = 100000;
  const directions = Object.freeze({
    n: [0, -1], north: [0, -1], s: [0, 1], south: [0, 1],
    e: [1, 0], east: [1, 0], w: [-1, 0], west: [-1, 0],
    ne: [1, -1], northeast: [1, -1], nw: [-1, -1], northwest: [-1, -1],
    se: [1, 1], southeast: [1, 1], sw: [-1, 1], southwest: [-1, 1]
  });
  function directionOffset(command) {
    if (typeof command !== 'string') return null;
    const result = directions[command.trim().toLowerCase()];
    return result ? [...result] : null;
  }
  function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
  function validTitle(value) { return typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\u0000-\u001f]/.test(value); }
  function validCoordinate(value) { return Number.isInteger(value) && Math.abs(value) <= MAX_COORDINATE; }
  function validCommand(value) { return typeof value === 'string' && value.trim().length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value); }
  function cloneRoom(room) { return { id: room.id, title: room.title, x: room.x, y: room.y }; }
  function cloneExit(exit) { return { id: exit.id, from: exit.from, to: exit.to, command: exit.command }; }
  function normalize(raw) {
    if (raw == null) return { version: 1, rooms: [], exits: [], currentRoomId: null };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        !Array.isArray(raw.rooms) || !Array.isArray(raw.exits) ||
        raw.rooms.length > MAX_ROOMS || raw.exits.length > MAX_EXITS)
      throw new TypeError('Invalid or oversized map data.');
    const roomIds = new Set(), exitIds = new Set(), rooms = [], exits = [];
    for (const room of raw.rooms) {
      if (!room || !validId(room.id) || roomIds.has(room.id) ||
          !validTitle(room.title) || !validCoordinate(room.x) || !validCoordinate(room.y))
        throw new TypeError('Invalid room data.');
      roomIds.add(room.id); rooms.push(cloneRoom(room));
    }
    for (const exit of raw.exits) {
      if (!exit || !validId(exit.id) || exitIds.has(exit.id) ||
          !roomIds.has(exit.from) || !roomIds.has(exit.to) || !validCommand(exit.command))
        throw new TypeError('Invalid exit data.');
      exitIds.add(exit.id); exits.push(cloneExit(exit));
    }
    const currentRoomId = raw.currentRoomId == null ? null : raw.currentRoomId;
    if (currentRoomId !== null && !roomIds.has(currentRoomId))
      throw new TypeError('Current room does not exist.');
    return { version: 1, rooms, exits, currentRoomId };
  }
  function createWorld(initial) {
    const snapshot = normalize(initial);
    const rooms = new Map(snapshot.rooms.map(room => [room.id, room]));
    const exits = new Map(snapshot.exits.map(exit => [exit.id, exit]));
    let currentRoomId = snapshot.currentRoomId, nextRoom = 1, nextExit = 1;
    function generated(prefix, collection, next) {
      let id;
      do { id = prefix + next(); } while (collection.has(id));
      return id;
    }
    function addRoom(input) {
      if (!input || rooms.size >= MAX_ROOMS) throw new Error('Room limit reached.');
      const id = input.id ?? generated('r', rooms, () => nextRoom++);
      const room = { id, title: input.title, x: input.x, y: input.y };
      if (!validId(id) || rooms.has(id) || !validTitle(room.title) ||
          !validCoordinate(room.x) || !validCoordinate(room.y)) throw new TypeError('Invalid room.');
      rooms.set(id, room); return cloneRoom(room);
    }
    function editRoom(id, patch) {
      const old = rooms.get(id);
      if (!old || !patch || patch.id != null) throw new TypeError('Invalid room edit.');
      const updated = { ...old, ...patch };
      if (!validTitle(updated.title) || !validCoordinate(updated.x) || !validCoordinate(updated.y))
        throw new TypeError('Invalid room edit.');
      rooms.set(id, updated); return cloneRoom(updated);
    }
    function removeRoom(id) {
      if (!rooms.delete(id)) return false;
      for (const [exitId, exit] of exits)
        if (exit.from === id || exit.to === id) exits.delete(exitId);
      if (currentRoomId === id) currentRoomId = null;
      return true;
    }
    function addExit(input) {
      if (!input || exits.size >= MAX_EXITS) throw new Error('Exit limit reached.');
      const id = input.id ?? generated('e', exits, () => nextExit++);
      const exit = { id, from: input.from, to: input.to, command: input.command };
      if (!validId(id) || exits.has(id) || !rooms.has(exit.from) || !rooms.has(exit.to) ||
          !validCommand(exit.command)) throw new TypeError('Invalid exit.');
      exits.set(id, exit); return cloneExit(exit);
    }
    function editExit(id, patch) {
      const old = exits.get(id);
      if (!old || !patch || patch.id != null) throw new TypeError('Invalid exit edit.');
      const updated = { ...old, ...patch };
      if (!rooms.has(updated.from) || !rooms.has(updated.to) || !validCommand(updated.command))
        throw new TypeError('Invalid exit edit.');
      exits.set(id, updated); return cloneExit(updated);
    }
    function removeExit(id) { return exits.delete(id); }
    function setCurrentRoom(id) {
      if (id !== null && !rooms.has(id)) throw new TypeError('Unknown current room.');
      currentRoomId = id;
      return currentRoomId;
    }
    function shortestPath(targetId) {
      if (!currentRoomId || !rooms.has(targetId)) return null;
      if (currentRoomId === targetId)
        return { rooms: [currentRoomId], exits: [], commands: [] };
      const adjacency = new Map();
      for (const exit of exits.values()) {
        if (!adjacency.has(exit.from)) adjacency.set(exit.from, []);
        adjacency.get(exit.from).push(exit);
      }
      const previous = new Map([[currentRoomId, null]]), queue = [currentRoomId];
      for (let head = 0; head < queue.length && !previous.has(targetId); head++) {
        for (const exit of adjacency.get(queue[head]) || []) {
          if (previous.has(exit.to)) continue;
          previous.set(exit.to, exit);
          queue.push(exit.to);
        }
      }
      if (!previous.has(targetId)) return null;
      const pathExits = [];
      for (let at = targetId; at !== currentRoomId;) {
        const exit = previous.get(at);
        pathExits.push(cloneExit(exit));
        at = exit.from;
      }
      pathExits.reverse();
      return { rooms: [currentRoomId, ...pathExits.map(exit => exit.to)],
        exits: pathExits, commands: pathExits.map(exit => exit.command) };
    }
    function walkCommands(targetId) {
      const path = shortestPath(targetId);
      return path ? [...path.commands] : null;
    }
    function suggestCoordinates(fromId, command, step = 100) {
      const room = rooms.get(fromId), offset = directionOffset(command);
      if (!room || !offset || !Number.isInteger(step) || step < 1 || step > 1000) return null;
      const x = room.x + offset[0] * step, y = room.y + offset[1] * step;
      return validCoordinate(x) && validCoordinate(y) ? { x, y } : null;
    }
    function serialize() {
      return { version: 1, rooms: [...rooms.values()].map(cloneRoom),
        exits: [...exits.values()].map(cloneExit), currentRoomId };
    }
    return { addRoom, editRoom, removeRoom, addExit, editExit, removeExit,
      setCurrentRoom, shortestPath, walkCommands, suggestCoordinates, serialize,
      rooms: () => [...rooms.values()].map(cloneRoom),
      exits: () => [...exits.values()].map(cloneExit),
      currentRoom: () => currentRoomId };
  }
  return { createWorld, normalize, directionOffset, MAX_ROOMS, MAX_EXITS };
});
