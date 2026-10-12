'use strict';
const assert=require('node:assert/strict'),{createController}=require('../ui/input-owner-controller.js');
const owner={history:[]},callbacks=new Map(),packets=[],preferences={global:{sticky:true,localEcho:true,appearance:{localEchoColor:''}},owner:{sticky:false,localEcho:false,appearance:{localEchoColor:'#abcdef'}}};
const original=global.BeipInputPaneView;
global.BeipInputPaneView={mount(container,item,model,id,ports){callbacks.set(id,ports);return {form:{},refresh(){},destroy(){}};}};
try{
 const controller=createController({valid:item=>item===owner,history:item=>item.history,defaults:(item,source='owner')=>preferences[source],submit:(item,packet)=>packets.push(packet)}),model=controller.model(owner,{panes:[{id:'input:global',inherit:true,inheritSource:'global'},{id:'input:owner',inherit:true},{id:'input:copied',inherit:false,sticky:true,localEcho:true,appearance:{localEchoColor:'#123456'}}]});
 for(const pane of model.panes.values())controller.mount({},owner,pane.id);
 function send(id,text){model.set(id,text);const ports=callbacks.get(id);ports.beforeSubmit(owner,id);ports.submit(owner,model.submit(id));}
 send('input:global','first');assert.equal(model.get('input:global').text,'first');assert.equal(packets.at(-1).echo,true);assert.equal(packets.at(-1).echoColor,'');
 send('input:owner','second');assert.equal(model.get('input:owner').text,'');assert.equal(packets.at(-1).echo,false);assert.equal(packets.at(-1).echoColor,'#abcdef');
 send('input:copied','third');assert.equal(model.get('input:copied').text,'third');assert.equal(packets.at(-1).echoColor,'#123456');
 preferences.global.sticky=false;preferences.global.localEcho=false;send('input:global','changed');assert.equal(model.get('input:global').text,'');assert.equal(packets.at(-1).echo,false);assert.equal(model.serialize().panes[0].inheritSource,'global');
 console.log('PASS global/owner/copied input inheritance, live sticky/echo and empty global echo color');
}finally{global.BeipInputPaneView=original;}
