'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),view=require('../ui/image-view.js'),messages=[],events=[],alpha={id:'alpha'},beta={id:'beta'},sessions=new Map([['alpha',alpha],['beta',beta]]),app={sessions,current:beta,showStatus:(owner,text)=>{owner.status=text;}},window={BeipPreview:app,chrome:{webview:{postMessage:value=>messages.push(value)}},dispatchEvent:event=>events.push(event)};
vm.runInNewContext(fs.readFileSync(require.resolve('../ui/image-runtime.js'),'utf8'),{window,BeipImageView:view,TextEncoder,TextDecoder,Uint8Array,btoa:value=>Buffer.from(value,'binary').toString('base64'),atob:value=>Buffer.from(value,'base64').toString('binary'),CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}}});
const runtime=window.BeipImageRuntime;
assert.equal(runtime.request(alpha,'save','https://example.org/a.gif'),true);assert.equal(messages[0],'image:save|alpha|'+Buffer.from('https://example.org/a.gif').toString('base64'));
assert.equal(runtime.request({id:'alpha'},'copy','https://example.org/a.gif'),false);assert.equal(runtime.request(alpha,'copy','file:///secret'),false);assert.equal(messages.length,1);
runtime.handleNative(alpha,'imageaction:save:saved:'+Buffer.from('saved.gif').toString('base64'));assert.equal(alpha.imageActions[0].sessionId,'alpha');assert.equal(alpha.imageActions[0].detail,'saved.gif');assert.equal(beta.imageActions,undefined);assert.equal(events[0].detail.sessionId,'alpha');
sessions.delete('alpha');assert.equal(runtime.request(alpha,'copy','https://example.org/a.gif'),false);runtime.handleNative(alpha,'imageaction:copy:copied:');assert.equal(events.length,1);
console.log('PASS native image actions validate live ownership, URL scheme and scoped responses');
