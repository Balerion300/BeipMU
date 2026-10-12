/* Session-owned map position and view. Never sends game commands. MIT. */
(function(root,factory){const api=factory(root,root.BeipMapper||(typeof require==='function'?require('./mapper.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipMapSessions=api;})(typeof globalThis==='object'?globalThis:this,function(root,mapper){
'use strict';
function createController(app,storage=null,changed=()=>{}){
 const sessions=new Map(),key=session=>'beipmu:map-view:'+String(session.characterId||session.worldId||session.id).slice(0,80);
 function source(session){return app().state.maps?.[session.worldId];}
 function get(session){let value=sessions.get(session.id);if(!value||value.worldId!==session.worldId||value.characterId!==session.characterId){let saved={};try{saved=JSON.parse(storage?.getItem(key(session))||'{}');}catch{}const graph=mapper.createWorld(source(session)),layers=graph.layers(),room=graph.rooms().find(item=>item.id===(saved.currentRoomId||graph.currentRoom()));value={worldId:session.worldId,characterId:session.characterId,currentRoomId:room?.id||null,layerId:layers.some(layer=>layer.id===saved.layerId)?saved.layerId:room?.layerId||layers[0].id,tracking:saved.tracking===true,view:null};sessions.set(session.id,value);}return value;}
 function graph(session){const result=mapper.createWorld(source(session)),state=get(session);if(!result.layers().some(layer=>layer.id===state.layerId)){state.layerId=result.layers()[0].id;state.view=null;}if(state.currentRoomId&&!result.rooms().some(room=>room.id===state.currentRoomId))state.currentRoomId=null;result.setCurrentRoom(state.currentRoomId);return result;}
 function save(session){const state=get(session);if(session.worldId)try{storage?.setItem(key(session),JSON.stringify({currentRoomId:state.currentRoomId,layerId:state.layerId,tracking:state.tracking}));}catch{}changed(session);}
 function pin(session,id){const data=graph(session),room=data.rooms().find(item=>item.id===id);if(id!==null&&!room)return false;const state=get(session);state.currentRoomId=id;if(room){state.layerId=room.layerId||data.layers()[0].id;state.view=null;}save(session);return true;}
 function setLayer(session,id){if(!graph(session).layers().some(layer=>layer.id===id))return false;const state=get(session);state.layerId=id;state.view=null;save(session);return true;}
 const text=value=>String(value||'').replace(/\s+/g,' ').trim();
 function matched(line,room){const title=text(room.title),value=text(line);return title.length>=2&&(value===title||value.startsWith(title+' (#')||value.startsWith(title+' [#'));}
 function locate(session,lines){const rooms=graph(session).rooms();for(const line of lines.slice(-1000).reverse()){const hits=rooms.filter(room=>matched(line,room));if(hits.length===1){pin(session,hits[0].id);return hits[0].id;}}return null;}
 function observe(session,line){if(!session||session.kind!=='world'||!session.worldId)return false;const state=get(session);if(!state.tracking||!state.currentRoomId)return false;const data=graph(session),reachable=new Set(data.exits().filter(exit=>exit.from===state.currentRoomId).map(exit=>exit.to));const hits=data.rooms().filter(room=>reachable.has(room.id)&&matched(line,room));return hits.length===1?pin(session,hits[0].id):false;}
 function setTracking(session,value){get(session).tracking=value===true;save(session);}
 return {get,graph,pin,setLayer,locate,observe,setTracking,forget:session=>sessions.delete(typeof session==='string'?session:session.id)};
}
const runtime=createController(()=>root.BeipPreview,(()=>{try{return root.localStorage;}catch{return null;}})(),session=>{if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent('beip-map-position',{detail:{sessionId:session.id}}));});
return {...runtime,createController};
});
