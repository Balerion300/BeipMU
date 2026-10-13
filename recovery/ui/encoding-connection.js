/* Pure connect2 bridge builder. No connection is opened by this module. MIT. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./encoding-model.js'):root.BeipEncoding);if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipEncodingConnection=api;})(globalThis,function(model){
'use strict';
function connectMessage(session,world){const prefs=model.normalizeWorld(world);if(prefs.encodingNeedsReview)throw Error('Choose a supported encoding in the world editor before connecting.');if(!/^[A-Za-z0-9_-]{1,64}$/.test(session.id)||session.characterId&&!/^[A-Za-z0-9_-]{1,64}$/.test(session.characterId))throw Error('Invalid connection identity.');if(!session.host||session.host.length>253||/[\s\x00-\x1f\x7f|/\\]/.test(session.host)||!/^\d{1,5}$/.test(String(session.port))||Number(session.port)<1||Number(session.port)>65535)throw Error('Invalid connection address.');return ['connect2',session.id,session.host,String(session.port),session.tls?'tls':'plain',session.characterId||'',prefs.encoding,prefs.limitTelnetCharset?'1':'0'].join('|');}
function bind(session,world){const message=connectMessage(session,world);session.encoding=(model.normalizeWorld(world)).encoding;return message;}
function resetDecoder(session,encoding=session.encoding||model.RECOVERY_DEFAULT){session.encoding=encoding;session.decoder=model.createDecoder(encoding);return session.decoder;}
return {connectMessage,bind,resetDecoder};
});
