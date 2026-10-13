/* Character editor extension. app.js owns validation/save and calls load/read. */
(function(){
'use strict';
const byId=id=>document.getElementById(id),host=byId('characterFields');if(!host)return;
const group=document.createElement('fieldset');group.className='connect-template-editor';
group.innerHTML='<legend>Connect string</legend><label><input type="checkbox" id="profileTemplateEnabled"> Use a custom connect string</label><textarea id="profileConnectTemplate" rows="3" maxlength="4096" spellcheck="false" aria-label="Connect string"></textarea><p>Use %NAME% for the login name and %PASSWORD% for the saved password. Never type a password here. Multiple commands and /delay 3s "command" are supported.</p><p id="profileTemplateReview"></p>';
host.append(group);
const enabled=byId('profileTemplateEnabled'),text=byId('profileConnectTemplate'),review=byId('profileTemplateReview');
function update(){text.disabled=!enabled.checked;}
enabled.onchange=update;
function load(profile){const fields=BeipConnectTemplate.normalize(profile);enabled.checked=fields.connectTemplateEnabled;text.value=fields.connectTemplate||'connect %NAME% %PASSWORD%';review.textContent=fields.connectTemplate&&!fields.connectTemplateReviewed?'Imported connect string: review it before enabling automatic use.':'';update();}
function read(){
 const raw=text.value.trim();if(!raw)return {connectTemplate:'',connectTemplateEnabled:false,connectTemplateReviewed:false};
 let recipe;try{recipe=BeipConnectTemplate.compile(raw);}catch(error){if(enabled.checked)throw error;return {connectTemplate:'',connectTemplateEnabled:false,connectTemplateReviewed:false};}
 const password=byId('profilePassword').value;if(password&&recipe.text.includes(password))throw Error('Replace the typed password with %PASSWORD% in the connect string.');
 return {connectTemplate:recipe.text,connectTemplateEnabled:enabled.checked,connectTemplateReviewed:enabled.checked};
}
window.BeipConnectTemplateEditor={load,read};load(null);
})();
