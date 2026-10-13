/* Error reporting must load before app.js, including its parse-time failures. */
(function(){
 'use strict';
 window.addEventListener('error',event=>{
  // Report location only; error messages can contain user script/input text.
  let file='unknown';try{file=new URL(event.filename).pathname.split('/').pop()||file;}catch{}
  if(!/^[A-Za-z0-9_.-]{1,80}$/.test(file))file='unknown';
  window.chrome?.webview?.postMessage('startup-error|'+file+'|'+(Number(event.lineno)||0));
 });
})();
