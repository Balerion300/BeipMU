/* Logging preferences and character file choices; filenames are reviewed explicitly. */
(function(){
'use strict';
const byId=id=>document.getElementById(id),model=()=>window.BeipLogging;
let pendingChoice=null;
function choose(callback){const session=window.BeipPreview?.current;if(!session)return;pendingChoice={sessionId:session.id,callback};window.chrome?.webview?.postMessage('logchoose|'+session.id);}
function globalMessage(message){
 if(typeof message!=='string'||!message.startsWith('logchoice:'))return false;
 const split=message.indexOf(':',10);if(split<0)return true;const id=message.slice(10,split),pending=pendingChoice;if(!pending||pending.sessionId!==id)return true;pendingChoice=null;
 try{const path=new TextDecoder().decode(Uint8Array.from(atob(message.slice(split+1)),c=>c.charCodeAt(0)));pending.callback(path);}catch{pending.callback('');}return true;
}
function control(key,title,type='text',values){
 const label=document.createElement('label');label.textContent=title;const input=document.createElement(type==='select'?'select':'input');input.id='logging_'+key;input.setAttribute('aria-label',title);
 if(type==='select'){for(const [value,title] of values){const option=document.createElement('option');option.value=value;option.textContent=title;input.append(option);}}
 else{input.type=type;if(type==='text')input.maxLength=/FileName/.test(key)?1024:key==='dateFormat'?80:256;if(type==='number'){input.min=key==='wrapChars'?'2':'0';input.max=key==='wrapChars'?'1000':'100';}}
 if(type==='checkbox'){label.textContent='';label.append(input,document.createTextNode(title));}else label.append(input);
 return {label,input};
}
function createPreferencesPanel(parent){
 const fields={};const add=(wrapper,key,title,type,values)=>{const field=control(key,title,type,values);fields[key]=field.input;wrapper.append(field.label);};
 function group(title){const fieldset=document.createElement('fieldset');fieldset.className='classic-settings-group logging-preferences';const legend=document.createElement('legend');legend.textContent=title;fieldset.append(legend);parent.append(fieldset);return fieldset;}
 const naming=group('Default file');add(naming,'fileNameReviewed','Use a custom default filename','checkbox');add(naming,'defaultFileName','Filename');
 const browse=document.createElement('button');browse.type='button';browse.textContent='Browse...';browse.onclick=()=>choose(path=>{if(path){fields.defaultFileName.value=path;fields.fileNameReviewed.checked=true;}});naming.append(browse);
 add(naming,'dateFormat','Date format');const note=document.createElement('p');note.className='classic-settings-note';note.textContent='Use %server%, %character%, and %date%. Relative files go in the Logs folder. Existing files are appended. Use .html for styled output.';naming.append(note);
 const contents=group('Contents');add(contents,'timestamp','Timestamps','select',[['none','None'],['time','Time'],['date','Date'],['date-time','Date and time']]);add(contents,'hour24','24-hour time','checkbox');add(contents,'logTyped','Log typed commands','checkbox');add(contents,'typedPrefix','Typed prefix');add(contents,'logSent','Log sent commands','checkbox');add(contents,'sentPrefix','Sent prefix');
 const format=group('Plain text formatting');add(format,'wrap','Wrap lines','checkbox');add(format,'wrapChars','Wrap at characters','number');add(format,'wrapNearestWord','Wrap at nearest word','checkbox');add(format,'hangingIndent','Hanging indent','checkbox');add(format,'hangingIndentChars','Indent characters','number');add(format,'doubleSpace','Double space','checkbox');
 return {load(raw,disabled=false){const p=model().normalize(raw);for(const [key,input] of Object.entries(fields)){if(input.type==='checkbox')input.checked=p[key];else input.value=String(p[key]);input.disabled=disabled;}browse.disabled=disabled;},read(){const raw={};for(const [key,input] of Object.entries(fields))raw[key]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;return model().normalize(raw);}};
}
let character=null;
function mountCharacter(){
 const host=byId('characterFields');if(!host||character)return;
 const group=document.createElement('fieldset');group.className='logging-character';group.innerHTML='<legend>Automatic log</legend><label><input id="characterLogReviewed" type="checkbox"> Use this log filename</label><label>Filename<input id="characterLogFile" maxlength="1024"></label><div><button type="button" id="characterLogBrowse">Browse...</button></div><label><input type="checkbox" id="characterLogAppendDate"> Append the date to the filename</label><label><input type="checkbox" id="characterLogAuto"> Start logging when this character connects</label><p id="characterLogReview"></p>';host.append(group);
 byId('characterLogBrowse').onclick=()=>choose(path=>{if(path){byId('characterLogFile').value=path;byId('characterLogReviewed').checked=true;}});
 character={load(profile){const p=model().normalizeCharacter(profile?.logging);byId('characterLogReviewed').checked=p.reviewed;byId('characterLogFile').value=p.fileName;byId('characterLogAppendDate').checked=p.appendDate;byId('characterLogAuto').checked=p.autoLog;byId('characterLogReview').textContent=p.fileName&&!p.reviewed?'Imported filename: review the location before enabling it.':'Leave the filename blank to use the global default.';},read(){const p={fileName:byId('characterLogFile').value,reviewed:byId('characterLogReviewed').checked,appendDate:byId('characterLogAppendDate').checked,autoLog:byId('characterLogAuto').checked};if(p.autoLog&&!p.reviewed)throw Error('Review and enable the log filename before automatic logging.');return model().normalizeCharacter(p);}};
 character.load(null);
}
window.BeipLoggingUI={createPreferencesPanel,choose,globalMessage,mountCharacter,get character(){return character;}};
mountCharacter();
})();
