'use strict';
const assert=require('node:assert/strict');
const layout=require('../ui/dock-layout.js');

const legacy=layout.normalize({order:['history','map','history'],active:'map',floating:{}},{rightWidth:410});
assert.deepEqual(legacy.order,['history','map']);
assert.equal(legacy.edges.history,'right');
assert.equal(legacy.edges.map,'right');
assert.equal(legacy.activeByEdge.bottom,'');
assert.equal(legacy.activeByEdge.right,'map');
assert.equal(legacy.sizes.right,410);
assert.equal(layout.DEFAULT_EDGE.history,'bottom');
assert.equal(layout.DEFAULT_SIZE.bottom,150);

const source={order:['map','notes','image','spawn'],edges:{map:'left',notes:'bottom',image:'top',spawn:'right'},sizes:{left:385,right:390,top:210,bottom:230},activeByEdge:{left:'map',bottom:'notes',top:'image'},floating:{map:{x:22,y:31,width:1040,height:730}},irrelevant:'secret'};
const copied=layout.copyable(source);
assert.deepEqual(copied.order,['map','notes','image']);
assert.equal(copied.edges.map,'left');
assert.equal(copied.floating.map.width,1040);
assert.equal(copied.sizes.bottom,230);
assert.equal(copied.activeByEdge.left,'');
assert.equal(copied.activeByEdge.bottom,'notes');
assert.equal(Object.hasOwn(copied,'irrelevant'),false);
assert.equal(Object.hasOwn(copied.edges,'spawn'),false);

const hostile=layout.normalize({order:['bogus','map','notes','split'],edges:{map:'outside',notes:'left'},sizes:{right:999999,bottom:-12},floating:{split:{x:99999,y:-99999,width:99999,height:1},map:{x:'4',y:0,width:400,height:300}}});
assert.deepEqual(hostile.order,['map','notes','split']);
assert.equal(hostile.edges.map,'right');
assert.equal(hostile.edges.notes,'left');
assert.equal(hostile.sizes.right,700);
assert.equal(hostile.sizes.bottom,50);
assert.deepEqual(hostile.floating.split,{x:4000,y:-4000,width:1400,height:180});
assert.equal(Object.hasOwn(hostile.floating,'map'),false);
console.log('dock layout checks passed.');
