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
 function dimension(value,edge){const number=value===null||value===undefined||value===''?NaN:Number(value),minimum=edge==='bottom'?50:edge==='top'?90:edge==='right'?220:180,maximum=edge==='bottom'?400:edge==='top'?500:700;return Number.isFinite(number)?Math.max(minimum,Math.min(maximum,Math.round(number))):DEFAULT_SIZE[edge];}
 function normalize(raw,{includeSpawn=false,rightWidth=320}={}){
  const source=Array.isArray(raw)?{order:raw}:raw&&typeof raw==='object'?raw:{};
  const order=[];for(const type of Array.isArray(source.order)?source.order:[]){if(TYPE_SET.has(type)&&(includeSpawn||type!=='spawn')&&!order.includes(type))order.push(type);if(order.length===TYPES.length)break;}
  const legacy=!source.edges&&order.length>0,edges={};for(const type of order)edges[type]=EDGE_SET.has(source.edges?.[type])?source.edges[type]:legacy?'right':DEFAULT_EDGE[type];
  const sizes={};for(const edge of EDGES)sizes[edge]=dimension(source.sizes?.[edge]??(edge==='right'?rightWidth:undefined),edge);
  const floating={};if(source.floating&&typeof source.floating==='object')for(const type of order){const rect=source.floating[type];if(!rect||typeof rect!=='object')continue;const {x,y,width,height}=rect;if([x,y,width,height].every(value=>Number.isFinite(value))){floating[type]={x:Math.max(-4000,Math.min(4000,Math.round(x))),y:Math.max(-4000,Math.min(4000,Math.round(y))),width:Math.max(240,Math.min(1400,Math.round(width))),height:Math.max(180,Math.min(1000,Math.round(height)))};}}
  const activeByEdge={};for(const edge of EDGES){const available=order.filter(type=>edges[type]===edge&&!floating[type]);const candidate=source.activeByEdge?.[edge]??(source.active&&edges[source.active]===edge?source.active:'');activeByEdge[edge]=available.includes(candidate)?candidate:available[0]||'';}
  return {order,edges,sizes,activeByEdge,floating};
 }
 function copyable(raw){return normalize(raw);}
 return {TYPES,EDGES,DEFAULT_EDGE,DEFAULT_SIZE,dimension,normalize,copyable};
});
