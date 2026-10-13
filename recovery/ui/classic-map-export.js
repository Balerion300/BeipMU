/* Reviewable export of one saved world's map to an original-format Atlas ZIP. */
(function(){
'use strict';
const core=window.BeipAtlasExportCore,app=()=>window.BeipPreview;
if(!core)return;
const dialog=document.createElement('dialog');dialog.id='classicMapExportDialog';dialog.className='classic-map-export';
dialog.innerHTML='<h2>Export Atlas Map</h2><label>World<select data-world></select></label><div data-preview></div><p>Exports all maps in this world’s atlas, including cross-map routes, room geometry, rectangles, colors, fonts, construction flags, and exit bends. Image and label objects are not yet supported.</p><div data-status role="status"></div><div class="classic-map-export-actions"><button type="button" data-save>Save .atlas…</button><button type="button" data-close>Cancel</button></div>';
document.body.append(dialog);
const world=dialog.querySelector('[data-world]'),preview=dialog.querySelector('[data-preview]'),status=dialog.querySelector('[data-status]'),save=dialog.querySelector('[data-save]');
let prepared=null;
function selected(){
 prepared=null;save.disabled=true;status.textContent='';preview.replaceChildren();
 const id=world.value,profile=app()?.state.worlds.find(item=>item.id===id),map=app()?.state.maps?.[id];
 if(!profile||!map){status.textContent='Choose a world with a saved map.';return;}
 try{
  prepared=core.exportAtlas(map,map.name||profile.name);
  const table=document.createElement('dl');
  for(const [label,value] of [['Map',prepared.name],['Maps',prepared.layers],['Rectangles',prepared.rectangles],['Rooms',prepared.rooms],['Route directions',prepared.directions],['Atlas exit records',prepared.exitRecords],['File size',prepared.bytes.length+' bytes']]){
   const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=String(value);table.append(term,description);
  }
  preview.append(table);save.disabled=false;
 }catch(error){status.textContent='Cannot export this map: '+String(error?.message||error);}
}
function base64(bytes){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);}
function filename(value){
 const clean=(value||'Map').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim();let result='';
 const encoder=new TextEncoder();for(const character of clean){if(encoder.encode(result+character).length>160)break;result+=character;}
 return result||'Map';
}
function open(){
 const previous=world.value;world.replaceChildren();
 for(const item of app().state.worlds){if(!app().state.maps?.[item.id])continue;const option=document.createElement('option');option.value=item.id;option.textContent=item.name;world.append(option);}
 const current=app().current?.worldId;
 world.value=[...world.options].some(option=>option.value===current)?current:[...world.options].some(option=>option.value===previous)?previous:world.options[0]?.value||'';
 selected();if(!dialog.open)dialog.showModal();
}
world.onchange=selected;
dialog.querySelector('[data-close]').onclick=()=>dialog.close();
save.onclick=()=>{
 if(!prepared)return;save.disabled=true;status.textContent='Opening Save As…';
 const name=new TextEncoder().encode(filename(prepared.name));
 window.chrome?.webview?.postMessage('atlasexport|'+base64(name)+'|'+base64(prepared.bytes));
};
window.chrome?.webview?.addEventListener('message',event=>{
 const message=event.data;if(typeof message!=='string'||!message.startsWith('atlasexportstatus:'))return;
 save.disabled=false;
 if(message==='atlasexportstatus:cancelled'){status.textContent='Save canceled.';return;}
 const error=message.startsWith('atlasexportstatus:error:');
 const encoded=message.slice((error?'atlasexportstatus:error:':'atlasexportstatus:saved:').length);
 let detail='';try{detail=new TextDecoder().decode(Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));}catch{detail='Unknown result.';}
 status.textContent=error?'Could not save Atlas: '+detail:'Saved Atlas map to '+detail;
 if(!error&&dialog.open)dialog.close();
});
window.BeipAtlasExport={open};
})();
