'use strict';
// Compile every shipped classic script, including app.js (not a Node module).
// This catches parse failures before the app can install its error listener.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ui=path.resolve(__dirname,'../ui'),html=fs.readFileSync(path.join(ui,'index.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);
assert(files.includes('app.js'));
for(const file of files)new vm.Script(fs.readFileSync(path.join(ui,file),'utf8'),{filename:file});
// Together they also share lexical scope: duplicate const/let names are invalid.
new vm.Script(files.map(file=>fs.readFileSync(path.join(ui,file),'utf8')).join('\n'),{filename:'shipped-classic-scripts'});
console.log('PASS '+files.length+' shipped classic scripts parse, with shared lexical scope');
