/* Untrusted regular expressions never run on the UI thread. MIT. */
'use strict';
importScripts('search-core.js');
self.onmessage=event=>{try{self.postMessage({matches:BeipSearchCore.search(event.data.lines,event.data.query,event.data.options)});}catch(error){self.postMessage({error:error.message});}};
