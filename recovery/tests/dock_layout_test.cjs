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
const grouped={order:['map','notes','history','spawn'],edges:{map:'right',notes:'right',history:'bottom',spawn:'right'},activeByEdge:{right:'notes',bottom:'history'},floating:{map:{x:12,y:24,width:320,height:400}}};
const movedGroup=layout.move(grouped,'notes','left',{group:true});
assert.equal(movedGroup.edges.notes,'left');
assert.equal(movedGroup.edges.spawn,'left');
assert.equal(movedGroup.edges.map,'right');
assert.equal(movedGroup.edges.history,'bottom');
assert.equal(movedGroup.activeByEdge.left,'notes');
assert.equal(movedGroup.activeByEdge.right,'');
assert.deepEqual(movedGroup.floating.map,grouped.floating.map);
assert.equal(grouped.edges.notes,'right');
const movedPane=layout.move(movedGroup,'spawn','bottom');
assert.equal(movedPane.activeByEdge.bottom,'spawn');
assert.equal(movedPane.activeByEdge.left,'notes');
assert.deepEqual(layout.move(grouped,'map','top'),layout.normalize(grouped,{includeSpawn:true}));
assert.deepEqual(layout.move(grouped,'notes','invalid',{group:true}),layout.normalize(grouped,{includeSpawn:true}));
assert.deepEqual(layout.move(grouped,'image','top'),layout.normalize(grouped,{includeSpawn:true}));
const rects={left:{left:0,right:80,top:100,bottom:200},bottom:{left:100,right:200,top:210,bottom:260}};
assert.equal(layout.dropEdge(20,150,rects),'left');
assert.equal(layout.dropEdge(120,230,rects),'bottom');
assert.equal(layout.dropEdge(120,150,rects),'');
assert.equal(layout.dropEdge(NaN,150,rects),'');
assert.equal(layout.dropEdge(20,150,{left:{left:0,right:Infinity,top:100,bottom:200}}),'');
console.log('dock layout checks passed.');

// Nested layouts retain every unique identity, active tab and independent ratio.
let nested=layout.normalize({order:['map','notes','history','image'],edges:{map:'right',notes:'right',history:'right',image:'right'}});
nested=layout.place(nested,'notes','map','bottom');
nested=layout.place(nested,'history','notes','right');
assert.equal(nested.trees.right.kind,'split');
assert.equal(nested.trees.right.axis,'y');
assert.equal(nested.trees.right.second.axis,'x');
assert.deepEqual(layout.paneTypes(nested.trees.right),['map','image','notes','history']);
nested=layout.resize(nested,'right',['second'],.72);
assert.equal(nested.trees.right.second.ratio,.72);
assert.deepEqual(layout.copyable(JSON.parse(JSON.stringify(nested))),nested);
assert.equal(layout.resize(nested,'right',['second'],99).trees.right.second.ratio,.9);
assert.equal(layout.resize(nested,'right',['second'],-1).trees.right.second.ratio,.1);
assert.equal(layout.select(nested,'image').trees.right.first.active,'image');
const tabbed=layout.place(nested,'history','map','tabs');
assert.deepEqual(tabbed.trees.right.first.tabs,['map','image','history']);
assert.equal(tabbed.trees.right.second.kind,'tabs');
assert.equal(tabbed.trees.right.first.active,'history');
const gone=layout.normalize({...nested,order:nested.order.filter(type=>type!=='notes')});
assert.equal(gone.trees.right.second.kind,'tabs');
assert.deepEqual(gone.trees.right.second.tabs,['history']);
const floated=layout.normalize({...nested,floating:{notes:{x:30,y:40,width:360,height:240}}});
const returned=layout.place(floated,'notes','history','top');
assert.equal(Object.hasOwn(returned.floating,'notes'),false);
assert.equal(returned.trees.right.second.axis,'y');
const groupTree=layout.move(nested,'map','left',{group:true});
assert.deepEqual(groupTree.trees.left,nested.trees.right);
assert.equal(groupTree.trees.right,null);
const malformed=layout.normalize({...nested,trees:{right:{kind:'split',axis:'x',ratio:NaN,first:{kind:'tabs',tabs:['map','map','unknown'],active:'unknown'},second:{kind:'tabs',tabs:['map','notes'],active:'notes'}}}});
assert.deepEqual(layout.paneTypes(malformed.trees.right),['map','history','image','notes']);
assert.equal(malformed.trees.right.ratio,.5);
const cycle={kind:'split',axis:'x'};cycle.first=cycle;cycle.second={kind:'tabs',tabs:['map']};
assert.deepEqual(layout.paneTypes(layout.normalize({order:['map'],trees:{right:cycle}}).trees.right),['map']);
assert.deepEqual(layout.place(nested,'map','map'),nested);
assert.deepEqual(layout.place(nested,'map','invalid'),nested);

const config=require('../ui/classic-import-core.js');
const plan=config.parseConfig(`Version=400
Connections.Servers.Example
{
 Host="example.invalid:4201"
 Characters.Alice.Docking
 {
  ClientSize={1000,800}
  DockedPanes
  {
   {
    Side=2
    Size=300
    Windows
    {
     {
      Type=7
      Size=200
     }
     {
      Type=6
      Size=600
     }
     {
      Type=0
     }
    }
   }
  }
  FloatingWindows
  {
   {
    Type=3
    Rect=(10,20,410,320)
   }
  }
 }
}`);
assert.deepEqual(plan.characters[0].dockLayout.order,['map','notes','image']);
assert.equal(plan.characters[0].dockLayout.trees.right.ratio,.25);
assert.deepEqual(plan.characters[0].dockLayout.floating.image,{x:10,y:20,width:400,height:300});
assert.equal(plan.report.skipped['Unsupported original docked window types'],1);
console.log('nested layout, migration, original import and floating identity checks passed.');
