/* Owner-bound, promise-aware command dispatcher. Staged for recovery 0.12. MIT. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipCommandPipeline=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const DEFAULT_LIMITS=Object.freeze({depth:16,steps:256,sends:64,bytes:65536,queued:64,totalQueued:256,deadlineMs:10000});
function splitLines(text){const values=text.split('\r\n');if(values.length>1&&values[values.length-1]==='')values.pop();return values;}
function utf8Length(text){let n=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;}
function failure(code,message){return Object.assign(new Error(message),{code});}
function createPipeline(host,overrides={}){
 const limits={...DEFAULT_LIMITS};for(const name of Object.keys(limits))if(Number.isSafeInteger(overrides[name])&&overrides[name]>0)limits[name]=Math.min(limits[name],overrides[name]);
 const owners=new WeakMap(),tokens=new WeakMap();let totalQueued=0;
 const now=typeof host.now==='function'?()=>host.now():()=>Date.now();
 function valid(ctx){return !ctx.root.finished&&!ctx.root.error&&now()<ctx.root.deadline&&host.valid(ctx.owner,ctx.epoch)&&host.valid(ctx.root.owner,ctx.root.epoch);}
 function check(ctx){if(ctx.root.finished)throw failure('completed','Command execution has already completed.');if(ctx.root.error)throw ctx.root.error;if(now()>=ctx.root.deadline)throw abort(ctx.root,failure('deadline','Command execution timed out.'));if(!host.valid(ctx.owner,ctx.epoch)||!host.valid(ctx.root.owner,ctx.root.epoch))throw abort(ctx.root,failure('stale','Command owner changed.'));}
 function abort(root,error){if(!root.error){root.error=error;root.rejectAbort(error);}return root.error;}
 function charge(ctx,text=''){check(ctx);const budget=ctx.root.budget;if(ctx.depth>limits.depth||++budget.steps>limits.steps||(budget.bytes+=utf8Length(text))>limits.bytes)throw abort(ctx.root,failure('budget','Command execution limit exceeded.'));}
 function state(owner){let value=owners.get(owner);if(!value){value={tail:Promise.resolve(),last:null,pending:0,active:null};owners.set(owner,value);}return value;}
 function frame(parent,owner=parent.owner,epoch=parent.epoch,node=parent.node){return {root:parent.root,owner,epoch,node,depth:parent.depth+1,source:parent.source,flags:parent.flags,children:Promise.resolve()};}
 function context(ctx){
  const token=Object.freeze({owner:ctx.owner,epoch:ctx.epoch,source:ctx.source,flags:ctx.flags,
   isCurrent:()=>valid(ctx),
   run:(owner,text,options={})=>nested(ctx,owner,text,options)});
  tokens.set(token,ctx);return token;
 }
 async function invoke(ctx,name,...args){
  check(ctx);if(typeof host[name]!=='function')return undefined;
  const sub=frame(ctx);charge(sub);const value=await host[name](ctx.owner,...args,context(sub));
  await sub.children;check(ctx);return value;
 }
 function reaches(from,target,seen=new Set()){if(from===target)return true;if(!from||seen.has(from))return false;seen.add(from);for(const item of from.waits)if(reaches(item,target,seen))return true;return false;}
 function enqueue(ctx,work,parent){
  const queue=state(ctx.owner),node=ctx.node;
  if(queue.pending>=limits.queued||totalQueued>=limits.totalQueued)return Promise.reject(failure('queue','Command queue limit exceeded.'));
  if(queue.last)node.waits.add(queue.last);
  if(parent){if(reaches(node,parent.node))return Promise.reject(abort(ctx.root,failure('cycle','Cross-window command dependency cycle.')));parent.node.waits.add(node);}
  queue.pending++;totalQueued++;const before=queue.tail;
  const promise=before.catch(()=>{}).then(async()=>{
   node.waits.clear();check(ctx);queue.active=ctx.root;
   try{return await Promise.race([work(),ctx.root.aborted]);}finally{if(queue.active===ctx.root)queue.active=null;}
  }).finally(()=>{queue.pending--;totalQueued--;node.waits.clear();if(queue.last===node)queue.last=null;parent?.node.waits.delete(node);});
  queue.last=node;queue.tail=promise.catch(()=>{});return promise;
 }
 function nested(parent,owner,text,options){
  check(parent);if(!owner||typeof owner!=='object')return Promise.reject(failure('owner','Missing command owner.'));
  const epoch=owner===parent.owner?parent.epoch:host.epoch(owner),child=frame(parent,owner,epoch);
  child.source=options.source||parent.source;child.flags=parent.flags;
  const executeChild=()=>{check(parent);if(state(owner).active===parent.root)return execute(child,String(text),options.mode||'lines',options.prefix||'');child.node={waits:new Set()};return enqueue(child,()=>execute(child,String(text),options.mode||'lines',options.prefix||''),parent);};
  // Explicit children of one callback are sequential even if that callback uses Promise.all.
  const pending=parent.children.then(executeChild);parent.children=pending;return pending;
 }
 async function send(ctx,text,mode){
  charge(ctx,text);if(ctx.flags.replay)return;
  if(!host.connected(ctx.owner)){await invoke(ctx,'report','Not connected.');return;}
  const event=mode!=='transmit',isNop=mode==='nop';
  if(mode==='send'||isNop){await invoke(ctx,'sent',isNop?'\xff\xf1':text);if(await invoke(ctx,'onSend',isNop?'\xff\xf1':text))return;}
  check(ctx);if(!host.connected(ctx.owner))return;
  if(++ctx.root.budget.sends>limits.sends)throw abort(ctx.root,failure('budget','Command send limit exceeded.'));
  // Only this synchronous, guarded adapter may commit wire bytes. It must not redispatch.
  const accepted=host.transport(ctx.owner,{kind:isNop?'telnet-nop':'text',text:isNop?'':text,event},context(ctx));
  if(accepted&&typeof accepted.then==='function')throw abort(ctx.root,failure('adapter','Command transport must commit synchronously.'));
  check(ctx);
 }
 async function line(ctx,text,prefix){
  charge(ctx,text);await invoke(ctx,'logTyped',text);
  const settings=host.settings(ctx.owner)||{};
  const result=settings.active===false?{text,matched:false}:await invoke(ctx,'aliases',text);
  check(ctx);if(!result||typeof result.text!=='string'||typeof result.matched!=='boolean')throw abort(ctx.root,failure('aliases','Alias worker returned no usable result.'));
  if(!result.matched){await send(frame(ctx),prefix+result.text,'send');return;}
  if(settings.echo)await invoke(ctx,'aliasEcho',result.text);
  if(result.text==='')return;
  for(const expanded of splitLines(result.text)){
   check(ctx);if(settings.legacyVariableAliases&&!settings.processCommands&&await invoke(ctx,'legacyAliasCommand',expanded))continue;
   if(settings.processCommands&&expanded.length>=2&&expanded[0]==='/')await parse(frame(ctx),expanded);
   else await send(frame(ctx),prefix+expanded,'send');
  }
 }
 async function parse(ctx,text){
  charge(ctx,text);if(text.startsWith('//'))return line(frame(ctx),text.slice(1),'');
  if(await invoke(ctx,'onCommand',text.slice(1)))return;
  const silent=text.startsWith('/silent/'),command=silent?'/'+text.slice(8):text;
  if(await invoke(ctx,'internal',command,{silent}))return;
  if(host.settings(ctx.owner)?.sendUnknown)await line(frame(ctx),text,'');
  else if(!silent)await invoke(ctx,'report','Unknown command: '+command);
 }
 async function execute(ctx,text,mode,prefix){
  charge(ctx,text);if(ctx.flags.replay)return;
  if(['send','transmit','checked-send','nop'].includes(mode))return send(frame(ctx),text,mode);
  if(mode==='effects'){throw failure('mode','Use the effects entry for script actions.');}
  if(mode==='line')return line(frame(ctx),text,prefix);
  if(mode!=='lines')throw failure('mode','Unknown command entry mode.');
  if(text.startsWith('/@')){if(!ctx.flags.replay)await invoke(ctx,'evaluate',text.slice(2));return;}
  for(const value of splitLines(text)){check(ctx);if(value.length>=2&&value[0]==='/')await parse(frame(ctx),value);else await line(frame(ctx),value,prefix);}
 }
 function begin(owner,work,options={}){
  if(!owner||typeof owner!=='object')return Promise.reject(failure('owner','Missing command owner.'));
  const epoch=host.epoch(owner),root={owner,epoch,deadline:now()+limits.deadlineMs,budget:{steps:0,bytes:0,sends:0},error:null};
  root.aborted=new Promise((resolve,reject)=>{root.rejectAbort=reject;});root.aborted.catch(()=>{});
  const ctx={root,owner,epoch,node:{waits:new Set()},depth:0,source:options.source||'command',flags:Object.freeze({replay:options.replay===true,inSend:options.inSend===true}),children:Promise.resolve()};
  const timer=setTimeout(()=>abort(root,failure('deadline','Command execution timed out.')),limits.deadlineMs);
  return enqueue(ctx,()=>work(ctx)).then(()=>({completed:true,...root.budget})).finally(()=>{root.finished=true;clearTimeout(timer);});
 }
 async function drain(ctx,effects){
  if(!Array.isArray(effects)||effects.length>32)throw abort(ctx.root,failure('effects','Script action limit exceeded.'));
  for(const effect of effects){
   charge(ctx);if(ctx.flags.replay)return;if(!effect||typeof effect.type!=='string')continue;
   if(effect.type==='run'){if(!ctx.flags.replay)await execute(frame(ctx),effect.value,'lines','');}
   else if(effect.type==='send-event')await invoke(ctx,'sent',effect.value);
   else if(effect.type==='send'){if(effect.event!==true&&effect.event!==false)throw abort(ctx.root,failure('effects','Script send is missing hook provenance.'));await send(frame(ctx),effect.value,effect.event?'checked-send':'transmit');}
   else await invoke(ctx,'effect',effect);
  }
 }
 return Object.freeze({
  submit:(owner,text,options={})=>begin(owner,ctx=>execute(ctx,String(text),options.mode||'lines',options.prefix||''),options),
  effects:(owner,effects,options={})=>begin(owner,ctx=>drain(ctx,effects),options),
  drain:(token,effects)=>{const ctx=tokens.get(token);if(!ctx)return Promise.reject(failure('context','Unrecognized command execution context.'));return drain(frame(ctx),effects);},
  pending:owner=>state(owner).pending,
  limits:Object.freeze({...limits})
 });
}
return {createPipeline,splitLines,utf8Length,DEFAULT_LIMITS};
});
