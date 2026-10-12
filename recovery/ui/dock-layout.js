/* Persisted, profile-scoped pane layout. MIT. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipDockLayout=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const TYPES=Object.freeze(['map','history','image','notes','split','spawn']);
 const EDGES=Object.freeze(['left','right','top','bottom']);
 const DEFAULT_EDGE=Object.freeze({map:'right',history:'bottom',image:'top',notes:'right',split:'right',spawn:'right'});
 const DEFAULT_SIZE=Object.freeze({left:280,right:320,top:170,bottom:150});
 const TYPE_SET=new Set(TYPES),EDGE_SET=new Set(EDGES);
 function ratio(value){return Number.isFinite(value)?Math.max(.1,Math.min(.9,value)):.5;}
 function paneTypes(node){return !node?[]:node.kind==='tabs'?node.tabs.slice():[...paneTypes(node.first),...paneTypes(node.second)];}
 function groupFor(node,type){if(!node)return null;if(node.kind==='tabs')return node.tabs.includes(type)?node:null;return groupFor(node.first,type)||groupFor(node.second,type);}
 // Trees are bounded by the supported pane identities. Discard duplicates and
 // malformed branches while retaining valid siblings and old four-edge layouts.
 function tree(raw,allowed,seen=new Set(),depth=0){
  if(!raw||typeof raw!=='object'||depth>16)return null;
  if(raw.kind==='split'){
   const first=tree(raw.first,allowed,seen,depth+1),second=tree(raw.second,allowed,seen,depth+1);
   if(!first)return second;if(!second)return first;
   return {kind:'split',axis:raw.axis==='x'?'x':'y',ratio:ratio(raw.ratio),first,second};
  }
  if(raw.kind!=='tabs'||!Array.isArray(raw.tabs))return null;
  const tabs=raw.tabs.filter(type=>{if(!allowed.has(type)||seen.has(type))return false;seen.add(type);return true;});
  return tabs.length?{kind:'tabs',tabs,active:tabs.includes(raw.active)?raw.active:tabs[0]}:null;
 }
 function prune(node,types){return tree(node,new Set(paneTypes(node).filter(type=>!types.includes(type))));}
 function appendTabs(node,types,active){if(!types.length)return node;if(!node)return {kind:'tabs',tabs:types.slice(),active:types.includes(active)?active:types[0]};if(node.kind==='tabs'){node.tabs.push(...types);if(types.includes(active))node.active=active;}else appendTabs(node.first,types,active);return node;}
 function dimension(value,edge){const number=value===null||value===undefined||value===''?NaN:Number(value),minimum=edge==='bottom'?50:edge==='top'?90:edge==='right'?220:180,maximum=edge==='bottom'?400:edge==='top'?500:700;return Number.isFinite(number)?Math.max(minimum,Math.min(maximum,Math.round(number))):DEFAULT_SIZE[edge];}
 function normalize(raw,{includeSpawn=false,rightWidth=320}={}){
  const source=Array.isArray(raw)?{order:raw}:raw&&typeof raw==='object'?raw:{};
  const order=[];for(const type of Array.isArray(source.order)?source.order:[]){if(TYPE_SET.has(type)&&(includeSpawn||type!=='spawn')&&!order.includes(type))order.push(type);if(order.length===TYPES.length)break;}
  const legacy=!source.edges&&order.length>0,edges={};for(const type of order)edges[type]=EDGE_SET.has(source.edges?.[type])?source.edges[type]:legacy?'right':DEFAULT_EDGE[type];
  const sizes={};for(const edge of EDGES)sizes[edge]=dimension(source.sizes?.[edge]??(edge==='right'?rightWidth:undefined),edge);
  const floating={};if(source.floating&&typeof source.floating==='object')for(const type of order){const rect=source.floating[type];if(!rect||typeof rect!=='object')continue;const {x,y,width,height}=rect;if([x,y,width,height].every(value=>Number.isFinite(value))){floating[type]={x:Math.max(-4000,Math.min(4000,Math.round(x))),y:Math.max(-4000,Math.min(4000,Math.round(y))),width:Math.max(240,Math.min(1400,Math.round(width))),height:Math.max(180,Math.min(1000,Math.round(height)))};}}
  const activeByEdge={};for(const edge of EDGES){const available=order.filter(type=>edges[type]===edge&&!floating[type]);const candidate=source.activeByEdge?.[edge]??(source.active&&edges[source.active]===edge?source.active:'');activeByEdge[edge]=available.includes(candidate)?candidate:available[0]||'';}
  const trees={};for(const edge of EDGES){const available=order.filter(type=>edges[type]===edge&&!floating[type]),seen=new Set();trees[edge]=tree(source.trees?.[edge],new Set(available),seen);trees[edge]=appendTabs(trees[edge],available.filter(type=>!seen.has(type)),activeByEdge[edge]);if(!source.trees?.[edge]&&trees[edge])trees[edge].active=activeByEdge[edge];}
  return {version:2,order,edges,sizes,activeByEdge,floating,trees};
 }
 function copyable(raw){return normalize(raw);}
 // Moving a group leaves native floating panes and their saved rectangles alone.
 function move(raw,type,edge,{group=false}={}){
  const result=normalize(raw,{includeSpawn:true});
  if(!TYPE_SET.has(type)||!EDGE_SET.has(edge)||!result.order.includes(type)||result.floating[type])return result;
  const previous=result.edges[type],moving=group?result.order.filter(item=>result.edges[item]===previous&&!result.floating[item]):[type];
  const active=group?result.activeByEdge[previous]||type:type;
  const movedTree=tree(result.trees[previous],new Set(moving));
  if(previous!==edge){result.trees[previous]=prune(result.trees[previous],moving);result.trees[edge]=group&&result.trees[edge]?{kind:'split',axis:edge==='top'||edge==='bottom'?'x':'y',ratio:.5,first:result.trees[edge],second:movedTree}:group?movedTree:appendTabs(result.trees[edge],moving,active);}
  for(const item of moving)result.edges[item]=edge;
  result.activeByEdge[edge]=active;
  return normalize(result,{includeSpawn:true});
 }
 function select(raw,type){const result=normalize(raw,{includeSpawn:true}),edge=result.edges[type],group=groupFor(result.trees[edge],type);if(group){group.active=type;result.activeByEdge[edge]=type;}return result;}
 // Dock beside a pane, or join its tab group. The source may be floating;
 // callers close its native window only after validating the destination.
 function place(raw,type,target,side='tabs'){
  const result=normalize(raw,{includeSpawn:true});if(type===target||!result.order.includes(type)||!result.order.includes(target)||result.floating[target]||!['tabs',...EDGES].includes(side))return result;
  const edge=result.edges[target];if(!groupFor(result.trees[edge],target))return result;
  for(const key of EDGES)result.trees[key]=prune(result.trees[key],[type]);delete result.floating[type];result.edges[type]=edge;
  const insert=node=>{if(node.kind==='tabs'){if(!node.tabs.includes(target))return node;if(side==='tabs')return appendTabs(node,[type],type);const leaf={kind:'tabs',tabs:[type],active:type},before=side==='left'||side==='top';return {kind:'split',axis:side==='left'||side==='right'?'x':'y',ratio:.5,first:before?leaf:node,second:before?node:leaf};}return {...node,first:insert(node.first),second:insert(node.second)};};
  result.trees[edge]=insert(result.trees[edge]);result.activeByEdge[edge]=type;return normalize(result,{includeSpawn:true});
 }
 function resize(raw,edge,path,value){const result=normalize(raw,{includeSpawn:true});if(!EDGE_SET.has(edge)||!Array.isArray(path)||path.length>16)return result;let node=result.trees[edge];for(const key of path){if(!['first','second'].includes(key)||node?.kind!=='split')return result;node=node[key];}if(node?.kind==='split')node.ratio=ratio(value);return result;}
 function fromOriginal(profile,skipped=()=>{}){
  const child=(node,name)=>(node?.children||[]).find(item=>item.name.toLowerCase()===name.toLowerCase());
  const docking=child(profile,'Docking');if(!docking)return null;
  const out={order:[],edges:{},sizes:{},trees:{},floating:{}},sides=['left','top','right','bottom'];
  const take=(entry,edge)=>{const type={3:'image',6:'notes',7:'map'}[entry.values?.Type];if(!type){skipped('Unsupported original docked window types');return null;}if(out.order.includes(type)){skipped('Repeated original docked window types');return null;}out.order.push(type);out.edges[type]=edge;if(/^(true|1)$/i.test(entry.values?.HideCaption||'')||/^(true|1)$/i.test(entry.values?.VerticalCaption||''))skipped('Original pane caption orientation or hiding');if(type==='map'&&child(entry,'MapWindow'))skipped('Original map window file and view settings');return {kind:'tabs',tabs:[type],active:type};};
  const weighted=(items,axis)=>{if(!items.length)return null;if(items.length===1)return items[0].node;const total=items.reduce((sum,item)=>sum+item.size,0);return {kind:'split',axis,ratio:items[0].size/total,first:items[0].node,second:weighted(items.slice(1),axis)};};
  for(const frame of (child(docking,'DockedPanes')?.children||[]).slice(0,128)){
   const edge=sides[Number(frame.values?.Side??0)];if(!edge){skipped('Invalid original docking sides');continue;}
   const items=[];for(const entry of (child(frame,'Windows')?.children||[]).slice(0,128)){const node=take(entry,edge);if(node)items.push({node,size:Math.max(1,Math.min(10000,Number(entry.values?.Size)||1))});}
   const node=weighted(items,edge==='top'||edge==='bottom'?'x':'y');if(!node)continue;
   out.sizes[edge]=dimension(Number(frame.values?.Size),edge);
   if(out.trees[edge]){skipped('Original repeated edge frame sizing adapted');out.trees[edge]={kind:'split',axis:edge==='top'||edge==='bottom'?'y':'x',ratio:.5,first:out.trees[edge],second:node};}else out.trees[edge]=node;
  }
  for(const entry of (child(docking,'FloatingWindows')?.children||[]).slice(0,128)){
   const node=take(entry,'right');if(!node)continue;const numbers=String(entry.values?.Rect||'').match(/-?\d+/g)?.map(Number);
   if(numbers?.length===4&&numbers[2]>numbers[0]&&numbers[3]>numbers[1])out.floating[node.active]={x:numbers[0],y:numbers[1],width:numbers[2]-numbers[0],height:numbers[3]-numbers[1]};else skipped('Invalid original floating window rectangles');
  }
  return normalize(out);
 }
 function dropEdge(x,y,rects){
  if(!Number.isFinite(x)||!Number.isFinite(y))return '';
  for(const edge of EDGES){const rect=rects?.[edge];if(rect&&[rect.left,rect.right,rect.top,rect.bottom].every(Number.isFinite)&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom)return edge;}
  return '';
 }
 return {TYPES,EDGES,DEFAULT_EDGE,DEFAULT_SIZE,dimension,normalize,copyable,move,dropEdge,paneTypes,groupFor,select,place,resize,fromOriginal};
});
