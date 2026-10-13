'use strict';
const assert=require('node:assert/strict'),prefs=require('../ui/profile-preferences.js'),importer=require('../ui/classic-import-core.js');
const base=prefs.normalizeGlobal({});assert.deepEqual(Object.fromEntries(prefs.IMAGE_KEYS.map(key=>[key,base[key]])),{inlineImageHeight:150,avatarWidth:50,avatarHeight:30,animatedImagesStartPaused:false,autoImageViewer:false});
const customized=prefs.normalizeGlobal({inlineImageHeight:125,avatarWidth:80,avatarHeight:40,animatedImagesStartPaused:true,autoImageViewer:true});
assert.equal(prefs.resolve(customized,null,{preferences:{output:{useParent:false,values:{avatarWidth:999}}}}).avatarWidth,80);
assert.equal(prefs.normalizeGlobal({avatarWidth:Infinity}).avatarWidth,50);assert.equal(prefs.normalizeGlobal({inlineImageHeight:99999}).inlineImageHeight,4096);assert.equal(prefs.normalizeGlobal({autoImageViewer:'true'}).autoImageViewer,false);
const plan=importer.parseConfig('Version=400\nInlineImageHeight=-125\nAvatarWidth=80\nAvatarHeight=40\nAnimatedImagesStartPaused=true\nAutoImageViewer=true\nConnections\n{\n Shortcuts\n {\n Test\n {\n Host="example.org:4201"\n }\n }\n}\n');
assert.deepEqual(Object.fromEntries(prefs.IMAGE_KEYS.map(key=>[key,prefs.normalizeGlobal(plan.preferences)[key]])),Object.fromEntries(prefs.IMAGE_KEYS.map(key=>[key,customized[key]])));
console.log('PASS image defaults, strict global scope, bounds and original Config import');
