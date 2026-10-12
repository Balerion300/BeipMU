/* Additional input-pane state, owned drafts and persisted window settings. MIT. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./profile-preferences.js'):root.BeipProfilePreferences);if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipInputPanes=api;})(typeof globalThis==='object'?globalThis:this,function(preferences){
'use strict';
const MAX_PANES=16,MAX_DRAFT=65536,MAX_HISTORY=500;
function bounded(value,max,label){if(typeof value!=='string'||value.length>max||value.includes('\0'))throw Error('Invalid '+label+'.');return value;}
function single(value,max,label){bounded(value,max,label);if(/[\r\n]/.test(value))throw Error(label+' must be one line.');return value;}
// Commands.cpp WordList: spaces only; three quote delimiters; no escape language.
function words(value){bounded(value,8192,'input command');const result=[];for(let i=0;i<value.length;i++){let c=value[i];if(c===' ')continue;let delimiter=' ';if(c==='\''||c==='"'||c==='`'){delimiter=c;if(++i===value.length)break;}let end=value.indexOf(delimiter,i);if(end<0)end=value.length;result.push(value.slice(i,end));i=end;}return result;}
function parseNewInput(parameters){const tokens=words(parameters);let unique=false;for(const token of tokens){if(!token.startsWith('/'))continue;if(token.toLowerCase()==='/unique')unique=true;else throw Error('Unknown option: '+token);}const last=tokens.at(-1)||'';return {unique,prefix:last.startsWith('/')?'':single(last,2048,'Input prefix')};}
function properties(value={}){const appearance=preferences.normalizeOverrides({input:{values:value.appearance}}).input.values;return {title:single(value.title??'',160,'Input title'),prefix:single(value.prefix??'',2048,'Input prefix'),sticky:value.sticky===true,localEcho:value.localEcho===true,inherit:value.inherit!==false,inheritSource:value.inheritSource==='global'?'global':'owner',...(Object.keys(appearance).length?{appearance}:{})};}
function id(value){if(typeof value!=='string'||!/^input:[a-z0-9_-]{1,48}$/.test(value))throw Error('Invalid input pane identity.');return value;}
function normalize(raw){const panes=[],seen=new Set();for(const item of Array.isArray(raw?.panes)?raw.panes:[]){if(panes.length===MAX_PANES)break;try{const key=id(item.id);if(seen.has(key))continue;panes.push({id:key,...properties(item)});seen.add(key);}catch{}}return {version:1,panes};}
function caption(pane){return (pane.title||'Input')+(pane.prefix?' - '+pane.prefix:'');}
function inputText(value){return bounded(value,MAX_DRAFT,'input text').replace(/\r\n?|\n/g,'\n');}
function createModel({saved,history=[],defaults={}}={}){
 if(!Array.isArray(history))throw Error('Input history must be an array.');
 const initial=normalize(saved),panes=new Map(initial.panes.map(pane=>[pane.id,{...pane,text:'',start:0,end:0}]));let serial=1,active='primary',historyPosition=null,historyDraft='';
 function get(key){const pane=panes.get(key);if(!pane)throw Error('Input pane is closed.');return pane;}
 function select(key,start,end){const pane=get(key);if(!Number.isInteger(start)||!Number.isInteger(end))throw Error('Invalid input selection.');pane.start=Math.max(0,Math.min(pane.text.length,start));pane.end=Math.max(pane.start,Math.min(pane.text.length,end));return pane;}
 function set(key,value,{stripPrefix=true}={}){const pane=get(key);value=inputText(value);if(stripPrefix&&pane.prefix&&value.startsWith(pane.prefix))value=value.slice(pane.prefix.length);pane.text=value;pane.start=pane.end=value.length;return pane;}
 function addHistory(text,prefix=''){text=String(text);if(!text||text.length>MAX_DRAFT)return false;const previous=history[historyPosition===null?history.length-1:historyPosition];if(typeof previous==='string'&&(previous===text||previous.length>prefix.length&&previous.slice(prefix.length)===text))return false;history.push(prefix+text);if(history.length>MAX_HISTORY){history.shift();if(historyPosition!==null)historyPosition=Math.max(0,historyPosition-1);}return true;}
 function saveModified(key){const pane=get(key);if(!pane.text||historyPosition===history.length)return false;const changed=addHistory(pane.text,pane.prefix);set(key,'');return changed;}
 function recall(key,direction){get(key);if(direction!==-1&&direction!==1)throw Error('Invalid history direction.');if(direction===-1){if(!history.length)return get(key);if(historyPosition===null){if(!historyDraft)historyDraft=get(key).text;historyPosition=history.length;}if(historyPosition>0){historyPosition=Math.min(historyPosition,history.length);saveModified(key);historyPosition--;set(key,history[historyPosition]);}}
  else if(historyPosition===null)saveModified(key);else{historyPosition=Math.min(historyPosition,history.length);if(historyPosition<history.length){saveModified(key);historyPosition++;if(historyPosition===history.length){historyPosition=null;set(key,historyDraft);historyDraft='';}else set(key,history[historyPosition]);}}return get(key);}
 function submit(key){const pane=get(key),text=pane.text;historyPosition=null;historyDraft='';const historyAdded=addHistory(text,pane.prefix),packet={text:text.replace(/\n/g,'\r\n'),prefix:pane.prefix,historyAdded,historyText:pane.prefix+text,echo:pane.localEcho,echoText:text,echoColor:pane.inherit?undefined:pane.appearance?.localEchoColor,paneId:key};if(pane.sticky){pane.start=0;pane.end=pane.text.length;}else set(key,'');return packet;}
 function add({prefix='',unique=false,...options}={}){single(prefix,2048,'Input prefix');if(unique)for(const pane of panes.values())if(pane.prefix===prefix)return {pane,created:false};if(panes.size>=MAX_PANES)throw Error('At most '+MAX_PANES+' additional input windows are supported.');let key;do{key='input:'+serial++;}while(panes.has(key));const pane={id:key,...properties({...defaults,...options,prefix,inherit:prefix?false:options.inherit??defaults.inherit}),text:'',start:0,end:0};panes.set(key,pane);return {pane,created:true};}
 return {get,panes,history,add,set,select,submit,recall,addHistory,caption,
  find:title=>[...panes.values()].find(pane=>pane.title===title)||null,
  configure:(key,values)=>Object.assign(get(key),properties({...get(key),...values})),
  activate:key=>{if(key!=='primary')get(key);active=key;return key;},
  next:()=>{const keys=['primary',...panes.keys()];active=keys[(keys.indexOf(active)+1)%keys.length];return active;},
  close:key=>{if(active===key)active='primary';return panes.delete(key);},
  serialize:()=>({version:1,panes:[...panes.values()].map(pane=>({id:pane.id,...properties(pane)}))}),
  get active(){return active;},get historyPosition(){return historyPosition;}
 };
}
return Object.freeze({MAX_PANES,MAX_DRAFT,MAX_HISTORY,words,parseNewInput,normalize,caption,createModel});
});
