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
  function validTitle(value) { return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\u0000-\u0009\u000b-\u001f]/.test(value); }
  function validCoordinate(value) { return Number.isInteger(value) && Math.abs(value) <= MAX_COORDINATE; }
  function validCommand(value) { return typeof value === 'string' && value.trim().length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value); }
  function validColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
  function validRect(value) { return Array.isArray(value) && value.length === 4 && value.every(validCoordinate) && value[0] < value[2] && value[1] < value[3]; }
  function validPoints(value) { return Array.isArray(value) && value.length <= 32 && value.every(point => Array.isArray(point) && point.length === 2 && point.every(validCoordinate)); }
  function validRoomExtras(room) {
    return (room.rect === undefined || validRect(room.rect) && Math.round((room.rect[0]+room.rect[2])/2)===room.x && Math.round((room.rect[1]+room.rect[3])/2)===room.y) &&
      (room.color === undefined || validColor(room.color)) &&
      (room.outlineColor === undefined || validColor(room.outlineColor)) &&
      (room.textAngle === undefined || Number.isInteger(room.textAngle) && room.textAngle >= 0 && room.textAngle < 360) &&
      (room.underConstruction === undefined || typeof room.underConstruction === 'boolean');
  }
  function validExitExtras(exit) {
    return (exit.points === undefined || validPoints(exit.points)) &&
      (exit.pointsSplit === undefined || Number.isInteger(exit.pointsSplit) && exit.pointsSplit >= 0 && exit.pointsSplit <= (exit.points?.length || 0)) &&
      validOrder(exit.order) &&
      (exit.atlasPair === undefined || validId(exit.atlasPair));
  }
  function cloneRoom(room) {
    const result = { id: room.id, title: room.title, x: room.x, y: room.y };
    if (room.rect !== undefined) result.rect = [...room.rect];
    for (const key of ['color', 'outlineColor', 'textAngle', 'underConstruction','layerId','order']) if (room[key] !== undefined) result[key] = room[key];
    return result;
  }
  function cloneExit(exit) {
    const result = { id: exit.id, from: exit.from, to: exit.to, command: exit.command };
    if (exit.points !== undefined) result.points = exit.points.map(point => [...point]);
    if (exit.atlasPair !== undefined) result.atlasPair = exit.atlasPair;
    if (exit.pointsSplit !== undefined) result.pointsSplit = exit.pointsSplit;
    if (exit.order !== undefined) result.order = exit.order;
    return result;
  }
  const clone=value=>JSON.parse(JSON.stringify(value));
  function layerList(raw){
    if(raw.layers===undefined)return null;
    if(!Array.isArray(raw.layers)||!raw.layers.length||raw.layers.length>16)throw new TypeError('Invalid map layers.');
    const ids=new Set();return raw.layers.map(layer=>{if(!layer||!validId(layer.id)||ids.has(layer.id)||!validTitle(layer.name)||layer.name.length>80)throw new TypeError('Invalid map layer.');ids.add(layer.id);return {id:layer.id,name:layer.name};});
  }
  function validOrder(value){return value===undefined||Number.isInteger(value)&&value>=0&&value<=100000;}
  function drawing(raw,layers){
    if(!raw||raw.kind!=='rectangle'||!validId(raw.id)||!layers.some(layer=>layer.id===raw.layerId)||!Array.isArray(raw.rect)||raw.rect.length!==4||!raw.rect.every(validCoordinate)||raw.rect[0]>raw.rect[2]||raw.rect[1]>raw.rect[3]||(raw.color!==undefined&&!validColor(raw.color))||!validOrder(raw.order)||(raw.outlineColor!==undefined&&!validColor(raw.outlineColor)))throw new TypeError('Invalid map drawing.');
    return {id:raw.id,kind:'rectangle',layerId:raw.layerId,rect:raw.rect.slice(),...(raw.color?{color:raw.color}:{}),...(raw.outlineColor?{outlineColor:raw.outlineColor}:{}),...(raw.order!==undefined?{order:raw.order}:{})};
  }
  function normalize(raw) {
    if (raw == null) return { version: 1, rooms: [], exits: [], currentRoomId: null };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        !Array.isArray(raw.rooms) || !Array.isArray(raw.exits) ||
        raw.rooms.length > MAX_ROOMS || raw.exits.length > MAX_EXITS)
      throw new TypeError('Invalid or oversized map data.');
    const layers=layerList(raw),roomIds = new Set(), exitIds = new Set(), rooms = [], exits = [];
    for (const room of raw.rooms) {
      if (!room || !validId(room.id) || roomIds.has(room.id) ||
          !validTitle(room.title) || !validCoordinate(room.x) || !validCoordinate(room.y) || !validRoomExtras(room)||!validOrder(room.order)||layers&&!layers.some(layer=>layer.id===(room.layerId||layers[0].id)))
        throw new TypeError('Invalid room data.');
      roomIds.add(room.id); rooms.push(cloneRoom(layers?{...room,layerId:room.layerId||layers[0].id}:room));
    }
    for (const exit of raw.exits) {
      if (!exit || !validId(exit.id) || exitIds.has(exit.id) ||
          !roomIds.has(exit.from) || !roomIds.has(exit.to) || !validCommand(exit.command) || !validExitExtras(exit))
        throw new TypeError('Invalid exit data.');
      exitIds.add(exit.id); exits.push(cloneExit(exit));
    }
    const currentRoomId = raw.currentRoomId == null ? null : raw.currentRoomId;
    if (currentRoomId !== null && !roomIds.has(currentRoomId))
      throw new TypeError('Current room does not exist.');
    const result = { version: 1, rooms, exits, currentRoomId };
    if(raw.visualExits!==undefined){if(!Array.isArray(raw.visualExits)||raw.visualExits.length>4096)throw new TypeError('Invalid visual exits.');const ids=new Set();result.visualExits=raw.visualExits.map(item=>{if(!item||!validId(item.id)||ids.has(item.id)||!roomIds.has(item.from)||(item.to!==undefined&&!roomIds.has(item.to))||!validExitExtras(item)||['nameFrom','nameTo'].some(key=>item[key]!==undefined&&!validCommand(item[key])))throw new TypeError('Invalid visual exit.');ids.add(item.id);return {id:item.id,from:item.from,...(item.to?{to:item.to}:{}),...(item.points?{points:clone(item.points)}:{}),...(item.pointsSplit!==undefined?{pointsSplit:item.pointsSplit}:{}),...(item.order!==undefined?{order:item.order}:{}),...Object.fromEntries(['nameFrom','nameTo'].filter(key=>item[key]!==undefined).map(key=>[key,item[key]]))};});}
    if(layers){result.version=2;result.layers=layers;const ids=new Set();if(raw.drawings!==undefined&&(!Array.isArray(raw.drawings)||raw.drawings.length>2048))throw new TypeError('Invalid map drawings.');result.drawings=(raw.drawings||[]).map(item=>{const value=drawing(item,layers);if(ids.has(value.id))throw new TypeError('Duplicate drawing identity.');ids.add(value.id);return value;});}
    if(raw.fonts!==undefined){result.fonts={};for(const key of ['rooms','exits','labels']){const font=raw.fonts[key];if(font===undefined)continue;if(!font||typeof font.name!=='string'||font.name.length>80||/[\x00-\x1f";{}\\]/.test(font.name)||typeof font.size!=='number'||!Number.isFinite(font.size)||font.size<1||font.size>100)throw new TypeError('Invalid map font.');result.fonts[key]={name:font.name,size:font.size};}}
    if (raw.name !== undefined) {
      if (typeof raw.name !== 'string' || !raw.name || raw.name.length > 80 || /[\u0000-\u001f]/.test(raw.name)) throw new TypeError('Invalid map name.');
      result.name = raw.name;
    }
    for (const key of ['backgroundColor', 'exitColor']) if (raw[key] !== undefined) {
      if (!validColor(raw[key])) throw new TypeError('Invalid map color.');
      result[key] = raw[key];
    }
    return result;
  }
  function createWorld(initial) {
    const snapshot = normalize(initial);
    const rooms = new Map(snapshot.rooms.map(room => [room.id, room]));
    const exits = new Map(snapshot.exits.map(exit => [exit.id, exit]));
    let layers=snapshot.layers?clone(snapshot.layers):null,drawings=clone(snapshot.drawings||[]),visualExits=clone(snapshot.visualExits||[]);
    let currentRoomId = snapshot.currentRoomId, nextRoom = 1, nextExit = 1;
    function generated(prefix, collection, next) {
      let id;
      do { id = prefix + next(); } while (collection.has(id));
      return id;
    }
    function addRoom(input) {
      if (!input || rooms.size >= MAX_ROOMS) throw new Error('Room limit reached.');
      const id = input.id ?? generated('r', rooms, () => nextRoom++);
      const room = { ...input, id, title: input.title, x: input.x, y: input.y,...(layers?{layerId:input.layerId||layers[0].id}:{}) };
      if (!validId(id) || rooms.has(id) || !validTitle(room.title) ||
          !validCoordinate(room.x) || !validCoordinate(room.y) || !validRoomExtras(room)||!validOrder(room.order)||layers&&!layers.some(layer=>layer.id===room.layerId)) throw new TypeError('Invalid room.');
      rooms.set(id, cloneRoom(room)); return cloneRoom(room);
    }
    function editRoom(id, patch) {
      const old = rooms.get(id);
      if (!old || !patch || patch.id != null) throw new TypeError('Invalid room edit.');
      const updated = { ...old, ...patch };
      if (old.rect && patch.rect === undefined && (patch.x !== undefined || patch.y !== undefined)) {
        const dx=updated.x-old.x,dy=updated.y-old.y;
        updated.rect=[old.rect[0]+dx,old.rect[1]+dy,old.rect[2]+dx,old.rect[3]+dy];
      }
      if (!validTitle(updated.title) || !validCoordinate(updated.x) || !validCoordinate(updated.y))
        throw new TypeError('Invalid room edit.');
      if (!validRoomExtras(updated)||!validOrder(updated.order)||layers&&!layers.some(layer=>layer.id===updated.layerId)) throw new TypeError('Invalid room edit.');
      rooms.set(id, cloneRoom(updated)); return cloneRoom(updated);
    }
    function removeRoom(id) {
      if (!rooms.delete(id)) return false;
      for (const [exitId, exit] of exits)
        if (exit.from === id || exit.to === id) exits.delete(exitId);
      if (currentRoomId === id) currentRoomId = null;
      visualExits=visualExits.filter(exit=>exit.from!==id&&exit.to!==id);
      return true;
    }
    function addExit(input) {
      if (!input || exits.size >= MAX_EXITS) throw new Error('Exit limit reached.');
      const id = input.id ?? generated('e', exits, () => nextExit++);
      const exit = { ...input, id, from: input.from, to: input.to, command: input.command };
      if (!validId(id) || exits.has(id) || !rooms.has(exit.from) || !rooms.has(exit.to) ||
          !validCommand(exit.command) || !validExitExtras(exit)) throw new TypeError('Invalid exit.');
      exits.set(id, cloneExit(exit)); return cloneExit(exit);
    }
    function editExit(id, patch) {
      const old = exits.get(id);
      if (!old || !patch || patch.id != null) throw new TypeError('Invalid exit edit.');
      const updated = { ...old, ...patch };
      if (!rooms.has(updated.from) || !rooms.has(updated.to) || !validCommand(updated.command) || !validExitExtras(updated))
        throw new TypeError('Invalid exit edit.');
      exits.set(id, cloneExit(updated)); return cloneExit(updated);
    }
    function removeExit(id) { return exits.delete(id); }
    function setCurrentRoom(id) {
      if (id !== null && !rooms.has(id)) throw new TypeError('Unknown current room.');
      currentRoomId = id;
      return currentRoomId;
    }
    function shortestPath(targetId,startId=currentRoomId) {
      if (!rooms.has(startId) || !rooms.has(targetId)) return null;
      if (startId === targetId)
        return { rooms: [startId], exits: [], commands: [] };
      const adjacency = new Map();
      for (const exit of exits.values()) {
        if (!adjacency.has(exit.from)) adjacency.set(exit.from, []);
        adjacency.get(exit.from).push(exit);
      }
      const previous = new Map([[startId, null]]), queue = [startId];
      for (let head = 0; head < queue.length && !previous.has(targetId); head++) {
        for (const exit of adjacency.get(queue[head]) || []) {
          if (previous.has(exit.to)) continue;
          previous.set(exit.to, exit);
          queue.push(exit.to);
        }
      }
      if (!previous.has(targetId)) return null;
      const pathExits = [];
      for (let at = targetId; at !== startId;) {
        const exit = previous.get(at);
        pathExits.push(cloneExit(exit));
        at = exit.from;
      }
      pathExits.reverse();
      return { rooms: [startId, ...pathExits.map(exit => exit.to)],
        exits: pathExits, commands: pathExits.map(exit => exit.command) };
    }
    function walkCommands(targetId,startId=currentRoomId) {
      const path = shortestPath(targetId,startId);
      return path ? [...path.commands] : null;
    }
    function suggestCoordinates(fromId, command, step = 100) {
      const room = rooms.get(fromId), offset = directionOffset(command);
      if (!room || !offset || !Number.isInteger(step) || step < 1 || step > 1000) return null;
      const x = room.x + offset[0] * step, y = room.y + offset[1] * step;
      return validCoordinate(x) && validCoordinate(y) ? { x, y } : null;
    }
    function serialize() {
      return { ...Object.fromEntries(['name','backgroundColor','exitColor','fonts'].filter(key=>snapshot[key]!==undefined).map(key=>[key,clone(snapshot[key])])),
        version: layers?2:1,...(layers?{layers:clone(layers),drawings:clone(drawings)}:{}),...(visualExits.length?{visualExits:clone(visualExits)}:{}), rooms: [...rooms.values()].map(cloneRoom), exits: [...exits.values()].map(cloneExit), currentRoomId };
    }
    function upgrade(){if(!layers){layers=[{id:'layer0',name:snapshot.name||'Map'}];for(const room of rooms.values())room.layerId='layer0';}}
    function addLayer(name){if(!validTitle(name)||name.length>80)throw new TypeError('Invalid layer name.');upgrade();if(layers.length>=16)throw new Error('Layer limit reached.');let n=0;while(layers.some(layer=>layer.id==='layer'+n))n++;const layer={id:'layer'+n,name};layers.push(layer);return {...layer};}
    function renameLayer(id,name){upgrade();const layer=layers.find(item=>item.id===id);if(!layer||!validTitle(name)||name.length>80)throw new TypeError('Invalid layer name.');layer.name=name;}
    function removeLayer(id){upgrade();if(layers.length<2)throw new Error('Keep at least one map layer.');if(!layers.some(item=>item.id===id))return false;for(const room of [...rooms.values()])if(room.layerId===id)removeRoom(room.id);drawings=drawings.filter(item=>item.layerId!==id);layers=layers.filter(item=>item.id!==id);return true;}
    function addDrawing(input){upgrade();if(drawings.length>=2048)throw new Error('Drawing limit reached.');let n=1;while(drawings.some(item=>item.id==='d'+n))n++;const value=drawing({...input,id:input.id||'d'+n,layerId:input.layerId||layers[0].id},layers);if(drawings.some(item=>item.id===value.id))throw new Error('Duplicate drawing identity.');drawings.push(value);return clone(value);}
    function editDrawing(id,patch){upgrade();const at=drawings.findIndex(item=>item.id===id);if(at<0||patch.id!==undefined)throw new TypeError('Invalid drawing edit.');drawings[at]=drawing({...drawings[at],...patch},layers);return clone(drawings[at]);}
    function removeDrawing(id){const old=drawings.length;drawings=drawings.filter(item=>item.id!==id);return drawings.length!==old;}
    return { addRoom, editRoom, removeRoom, addExit, editExit, removeExit,
      setCurrentRoom, shortestPath, walkCommands, suggestCoordinates, serialize,
      addLayer,renameLayer,removeLayer,addDrawing,editDrawing,removeDrawing,
      layers:()=>clone(layers||[{id:'layer0',name:snapshot.name||'Map'}]),drawings:layerId=>clone(drawings.filter(item=>!layerId||item.layerId===layerId)),
      rooms: layerId => [...rooms.values()].filter(room=>!layerId||(room.layerId||'layer0')===layerId).map(cloneRoom),
      exits: () => [...exits.values()].map(cloneExit),
      currentRoom: () => currentRoomId };
  }
  return { createWorld, normalize, directionOffset, MAX_ROOMS, MAX_EXITS };
});
