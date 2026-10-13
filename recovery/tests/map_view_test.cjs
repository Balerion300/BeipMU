'use strict';
const assert=require('node:assert/strict'),view=require('../ui/map-view.js'),measure=text=>text.length*7;
assert.deepEqual(view.wrapLabel('Map Fixture Hall',72,3,measure),['Map','Fixture','Hall']);
assert.deepEqual(view.wrapLabel('Very long room title',70,1,measure),['Very long…']);
assert.deepEqual(view.wrapLabel('abcdefghijk',28,3,measure),['abcd','efgh','ijk']);
assert.deepEqual(view.wrapLabel('Top\nBottom',100,2,measure),['Top','Bottom']);
assert.equal(view.labelColor('#000000'),'#ffffff');assert.equal(view.labelColor('#ffffff'),'#000000');assert.equal(view.labelColor('#ff0000'),'#000000');
console.log('PASS map label wrapping, truncation, explicit lines and color contrast');
