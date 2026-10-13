/* Shared semantic Atlas canvas for dock, editor and floating windows. MIT. */
(function(root){
'use strict';
const ns='http://www.w3.org/2000/svg';
let clipSequence=0;
function wrapLabel(title,width,maxLines,measure){
 const lines=[];for(const paragraph of title.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(measure(candidate)<=width){line=candidate;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&measure(line+char)>width){lines.push(line);line='';}line+=char;}}lines.push(line);}
 if(lines.length>maxLines){lines.length=maxLines;let last=lines.at(-1)||'';while(last&&measure(last+'…')>width)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}return lines;
}
function labelColor(color){const rgb=(color.match(/[0-9a-f]{2}/gi)||['ce','ce','ce']).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000000':'#ffffff';}
function mount(container,source,options={}){
 const data=typeof source.serialize==='function'?source.serialize():source,layers=data.layers||[{id:'layer0',name:data.name||'Map'}],layerId=layers.some(layer=>layer.id===options.layerId)?options.layerId:layers[0].id;
 const all=new Map(data.rooms.map(room=>[room.id,room])),layerOf=room=>room.layerId||layers[0].id,rooms=data.rooms.filter(room=>layerOf(room)===layerId),drawings=(data.drawings||[]).filter(item=>item.layerId===layerId);
 const node=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(tag==='text'){if(attrs.fill)el.style.fill=attrs.fill;if(attrs['font-family'])el.style.fontFamily=attrs['font-family'];if(attrs['font-size'])el.style.fontSize=attrs['font-size']+'px';}return el;};
 // Dock panes are assembled off-document. SVG metrics there are zero; measure
 // identical text in a connected, invisible SVG before calculating geometry.
 const measurement=node('svg',{'aria-hidden':'true',width:1,height:1});measurement.style.cssText='position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none';document.body.append(measurement);
 const svg=node('svg',{'aria-label':'Map layer '+layers.find(layer=>layer.id===layerId).name,role:'img',tabindex:0});svg.classList.add('beip-map-canvas');Object.assign(svg.style,{width:'100%',height:'100%',minHeight:'120px',flex:'1',display:'block',touchAction:'none',background:data.backgroundColor||'#151515'});container.append(svg);
 const box=room=>room.rect||[room.x-50,room.y-30,room.x+50,room.y+30],bounds=[...rooms.map(box),...drawings.map(item=>item.rect)];let fitView,view;
 const apply=()=>{svg.setAttribute('viewBox',[view.x,view.y,view.width,view.height].join(' '));options.onView?.({...view});};
 const font=(kind,fallback)=>({family:data.fonts?.[kind]?.name||'Arial',size:(data.fonts?.[kind]?.size||fallback)*4/3});
 const routeIds=new Set(options.route?.exits?.map(exit=>exit.id)||[]),pairs=new Set();
 for(const exit of [...data.exits,...(data.visualExits||[])]){
  const from=all.get(exit.from),to=all.get(exit.to);if(!from||layerOf(from)!==layerId&&(!to||layerOf(to)!==layerId))continue;
  const key=exit.atlasPair||exit.id;if(pairs.has(key))continue;pairs.add(key);let path=[],foreign='';
  if(!to)path=[[from.x,from.y],...(exit.points||[])];
  else if(layerOf(from)===layerOf(to))path=[[from.x,from.y],...(exit.points||[]),[to.x,to.y]];
  else if(layerOf(from)===layerId){path=[[from.x,from.y],...(exit.pointsSplit!==undefined?(exit.points||[]).slice(0,exit.pointsSplit):[])];if(path.length===1)path.push([from.x+70,from.y]);foreign=layers.find(layer=>layer.id===layerOf(to))?.name||'Other map';}
  else{path=[...(exit.pointsSplit!==undefined?(exit.points||[]).slice(exit.pointsSplit):[]),[to.x,to.y]];if(path.length===1)path.unshift([to.x-70,to.y]);foreign=layers.find(layer=>layer.id===layerOf(from))?.name||'Other map';}
  if(path.length<2)continue;const highlighted=routeIds.has(exit.id)||data.exits.some(other=>other.atlasPair&&other.atlasPair===exit.atlasPair&&routeIds.has(other.id));const line=node('polyline',{points:path.map(point=>point.join(',')).join(' '),fill:'none',stroke:highlighted?'#ffd34f':data.exitColor||'#aaaaaa','stroke-width':highlighted?4:2,'data-map-exit':exit.id});svg.append(line);
  for(const point of path)bounds.push([point[0]-3,point[1]-3,point[0]+3,point[1]+3]);
  if(foreign){const end=layerOf(from)===layerId?path.at(-1):path[0],label=node('text',{x:end[0]+4,y:end[1]-5,fill:data.exitColor||'#cccccc','font-size':font('exits',7).size,'font-family':font('exits',7).family,'data-map-foreign':exit.id});label.textContent='→ '+foreign;svg.append(label);const probe=label.cloneNode(true);measurement.append(probe);const size=probe.getBBox();bounds.push([size.x,size.y,size.x+size.width,size.y+size.height]);probe.remove();}
 }
 const objects=[...rooms.map(value=>({kind:'room',value})),...drawings.map(value=>({kind:'rectangle',value}))].sort((a,b)=>(a.value.order??100001)-(b.value.order??100001));
 for(const item of objects){const value=item.value,rect=item.kind==='room'?box(value):value.rect,group=node('g',item.kind==='room'?{'data-map-room':value.id,tabindex:0,role:'button','aria-label':value.title}:{'data-map-drawing':value.id}),shape=node('rect',{x:rect[0],y:rect[1],width:rect[2]-rect[0],height:rect[3]-rect[1],fill:value.color||(item.kind==='room'?'#cecece':'#404040'),stroke:value.outlineColor||'#808080','stroke-width':1});group.append(shape);
  if(item.kind==='room'){
   if(value.id===options.currentRoomId)group.append(node('rect',{x:rect[0]-3,y:rect[1]-3,width:rect[2]-rect[0]+6,height:rect[3]-rect[1]+6,fill:'none',stroke:'#ffbd27','stroke-width':3,'data-current-room':'true'}));
   const roomFont=font('rooms',9),center=[(rect[0]+rect[2])/2,(rect[1]+rect[3])/2],text=node('text',{x:center[0],y:center[1],fill:labelColor(value.color||'#cecece'),'font-family':roomFont.family,'font-size':roomFont.size,'text-anchor':'middle','dominant-baseline':'middle',...(value.textAngle?{transform:'rotate('+value.textAngle+' '+center[0]+' '+center[1]+')'}:{})});
   const title=node('title');title.textContent=value.title;group.prepend(title);const clipId='map-room-label-'+(++clipSequence),clip=node('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});clip.append(node('rect',{x:rect[0]+2,y:rect[1]+2,width:Math.max(0,rect[2]-rect[0]-4),height:Math.max(0,rect[3]-rect[1]-4)}));const labelGroup=node('g',{'clip-path':'url(#'+clipId+')'});group.append(clip,labelGroup);labelGroup.append(text);svg.append(group);
   const probe=text.cloneNode(false);measurement.append(probe);const measure=line=>{probe.textContent=line;return probe.getComputedTextLength();},lines=wrapLabel(value.title,Math.max(1,rect[2]-rect[0]-8),Math.max(1,Math.floor((rect[3]-rect[1]-6)/(roomFont.size*1.1))),measure);probe.remove();for(const [index,line] of lines.entries()){const span=node('tspan',{x:center[0],dy:index?roomFont.size*1.1:-(lines.length-1)*roomFont.size*.55});span.textContent=line;text.append(span);}if(value.underConstruction)shape.setAttribute('stroke-dasharray','5 3');group.style.cursor='pointer';group.addEventListener('click',event=>{if(!moved){options.onRoom?.(value.id,event);}});group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();options.onRoom?.(value.id,event);}});
  }else if(options.onDrawing){group.style.cursor='pointer';group.addEventListener('click',event=>{if(!moved)options.onDrawing(value.id,event);});}
  svg.append(group);
 }
 measurement.remove();const initial=bounds.length?bounds.reduce((area,rect)=>[Math.min(area[0],rect[0]-40),Math.min(area[1],rect[1]-40),Math.max(area[2],rect[2]+40),Math.max(area[3],rect[3]+40)],[Infinity,Infinity,-Infinity,-Infinity]):[0,0,400,240];fitView={x:initial[0],y:initial[1],width:Math.max(100,initial[2]-initial[0]),height:Math.max(100,initial[3]-initial[1])};view=options.view&&['x','y','width','height'].every(key=>Number.isFinite(options.view[key]))&&options.view.width>0&&options.view.height>0?{...options.view}:{...fitView};apply();
 let drag=null,moved=false;
 svg.addEventListener('pointerdown',event=>{moved=false;if(event.button!==1&&(event.button!==0||event.target.closest('[data-map-room]')&&!options.panMode||event.target.closest('[data-map-drawing]')&&options.onDrawing&&!options.panMode))return;drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,view:{...view}};svg.setPointerCapture(event.pointerId);event.preventDefault();});
 svg.addEventListener('pointermove',event=>{if(!drag||drag.pointer!==event.pointerId)return;const rect=svg.getBoundingClientRect(),scale=Math.min(rect.width/drag.view.width,rect.height/drag.view.height);if(!scale)return;const dx=(event.clientX-drag.x)/scale,dy=(event.clientY-drag.y)/scale;moved=Math.abs(dx)+Math.abs(dy)>2;view={...drag.view,x:drag.view.x-dx,y:drag.view.y-dy};apply();});
 const finish=event=>{if(drag?.pointer===event.pointerId){drag=null;if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);}};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
 function zoom(factor,x=.5,y=.5){const width=Math.max(fitView.width/40,Math.min(fitView.width*20,view.width*factor)),height=width*view.height/view.width;view={x:view.x+(view.width-width)*x,y:view.y+(view.height-height)*y,width,height};apply();}
 svg.addEventListener('wheel',event=>{event.preventDefault();const rect=svg.getBoundingClientRect();zoom(Math.exp(Math.max(-1,Math.min(1,event.deltaY/500))),(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);},{passive:false});
 return {svg,layerId,fit(){view={...fitView};apply();},zoom,center(id){const room=all.get(id);if(!room||layerOf(room)!==layerId)return false;view={...view,x:room.x-view.width/2,y:room.y-view.height/2};apply();return true;},destroy(){svg.remove();},getView:()=>({...view})};
}
root.BeipMapView={mount,wrapLabel,labelColor};if(typeof module==='object'&&module.exports)module.exports=root.BeipMapView;
})(typeof globalThis==='object'?globalThis:this);
