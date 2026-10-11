/* Allowlisted, remappable application shortcuts. MIT. */
(function(root,factory){
 const macros=typeof module==='object'&&module.exports?require('./macros.js'):root.BeipMacros;
 const api=factory(macros);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BeipShortcuts=api;
})(typeof globalThis==='object'?globalThis:this,function(macros){
 'use strict';
 const ACTIONS=Object.freeze([
  {id:'newTab',label:'Open a New Tab',default:'Ctrl+T',group:'Windows'},
  {id:'nextTab',label:'Activate Next Window',default:'Ctrl+Tab',group:'Windows'},
  {id:'previousTab',label:'Activate Previous Window',default:'Ctrl+Shift+Tab',group:'Windows'},
  {id:'closeTab',label:'Close Current Window',default:'Ctrl+F4',group:'Windows'},
  {id:'connect',label:'Connection - Connect',default:'Ctrl+BracketLeft',group:'Connection'},
  {id:'disconnect',label:'Connection - Disconnect',default:'Ctrl+BracketRight',group:'Connection'},
  {id:'reconnect',label:'Connection - Reconnect',default:'',group:'Connection'},
  {id:'sendInput',label:'Send the Current Input Text',default:'Enter',group:'Input'},
  {id:'saveHistory',label:'Input Window - Push to History',default:'Ctrl+ArrowDown',group:'Input'},
  {id:'historyUp',label:'Input History - Move Selection Up',default:'Ctrl+ArrowUp',group:'Input'},
  {id:'historyDown',label:'Input History - Move Selection Down',default:'',group:'Input'},
  {id:'clearInput',label:'Input Window - Clear',default:'Ctrl+U',group:'Input'},
  {id:'historyWindow',label:'History Window - Find',default:'Ctrl+H',group:'Input'},
  {id:'sendLastHistory',label:'Send the Last History Line',default:'Alt+Z',group:'Input'},
  {id:'findOutput',label:'Output Window - Find',default:'Ctrl+F',group:'Output'},
  {id:'pauseOutput',label:'Output Window - Pause',default:'Pause',group:'Output'},
  {id:'outputTop',label:'Output Window - Top',default:'Ctrl+Home',group:'Output'},
  {id:'outputBottom',label:'Output Window - Bottom',default:'Ctrl+End',group:'Output'},
  {id:'outputLineUp',label:'Output Window - Line Up',default:'Ctrl+PageUp',group:'Output'},
  {id:'outputLineDown',label:'Output Window - Line Down',default:'Ctrl+PageDown',group:'Output'},
  {id:'outputPageUp',label:'Output Window - Page Up',default:'PageUp',group:'Output'},
  {id:'outputPageDown',label:'Output Window - Page Down',default:'PageDown',group:'Output'},
  {id:'selectOutput',label:'Output Window - Select All',default:'Ctrl+A',group:'Output'},
  {id:'smartPaste',label:'Smart Paste',default:'Ctrl+Shift+V',group:'Input'},
  {id:'convertReturns',label:'Convert Returns to %R',default:'F1',group:'Input'},
  {id:'convertTabs',label:'Convert Tabs to %T',default:'Shift+F1',group:'Input'},
  {id:'logging',label:'Logging',default:'Ctrl+L',group:'Tools'},
  {id:'triggers',label:'Triggers',default:'Ctrl+Shift+T',group:'Tools'},
  {id:'aliases',label:'Aliases',default:'Ctrl+Shift+A',group:'Tools'},
  {id:'macros',label:'Macros',default:'Ctrl+Shift+M',group:'Tools'},
  {id:'settings',label:'Settings',default:'',group:'Tools'},
  {id:'mapWindow',label:'Map Window - Toggle',default:'',group:'Windows'},
  {id:'imageWindow',label:'Imaging Window - Toggle',default:'',group:'Windows'},
  {id:'notesWindow',label:'Character Notes - Toggle',default:'',group:'Windows'}
 ]);
 const IDS=new Set(ACTIONS.map(x=>x.id));
 const DEFAULTS=Object.freeze(Object.fromEntries(ACTIONS.map(x=>[x.id,x.default])));
 function safeChord(value){const chord=macros.normalizeCombo(value);if(!chord)return null;const key=chord.split('+').at(-1),mod=chord.includes('+');if(!mod&&!(/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)||['Enter','Pause','Escape','PageUp','PageDown','ArrowUp','ArrowDown','Home','End','Tab'].includes(key)))return null;return chord;}
 function normalizeOverrides(raw){const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;for(const action of ACTIONS){if(!Object.hasOwn(raw,action.id))continue;const value=raw[action.id];if(value===''){out[action.id]='';continue;}const chord=safeChord(value);if(chord&&chord!==action.default)out[action.id]=chord;}const seen=new Set();for(const action of ACTIONS){const chord=Object.hasOwn(out,action.id)?out[action.id]:action.default;if(!chord)continue;if(seen.has(chord))out[action.id]='';else seen.add(chord);}return out;}
 function bindings(overrides){const normalized=normalizeOverrides(overrides);return Object.fromEntries(ACTIONS.map(action=>[action.id,Object.hasOwn(normalized,action.id)?normalized[action.id]:action.default]));}
 function boundCombos(overrides){return new Set(Object.values(bindings(overrides)).filter(Boolean));}
 function lookup(event,overrides){if(!event||event.defaultPrevented||event.isComposing||event.keyCode===229||event.repeat)return null;const chord=macros.normalizeCombo(event);if(!chord)return null;const map=bindings(overrides);return ACTIONS.find(action=>map[action.id]===chord)?.id||null;}
 function assign(overrides,id,value){if(!IDS.has(id))throw new TypeError('Unknown shortcut action.');const chord=value===''?'':safeChord(value);if(chord===null)throw new TypeError('Invalid key combination.');const next={...normalizeOverrides(overrides)};for(const action of ACTIONS)if(action.id!==id&&chord&&bindings(next)[action.id]===chord)next[action.id]='';next[id]=chord;return normalizeOverrides(next);}
 return {ACTIONS,DEFAULTS,normalizeOverrides,bindings,boundCombos,lookup,assign,safeChord};
});
