/* Packaged real-WebView checks for searching and everyday controls. */
(function(){'use strict';
async function run(app){
 if(!window.BeipCoreTesting)throw Error('Test mode only.');
 const selected=app.current.id,session=app.createSession('everyday-fixture',{label:'Everyday fixture'}),$=id=>document.getElementById(id),result={};
 const check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Everyday check failed: '+key);};
 try{
  app.selectSession(session.id);session.suppressAutomation=true;app.appendText(session,'Cat cat scatter\nA second CAT\n');session.suppressAutomation=false;
  const link=document.createElement('a');link.href='#';link.textContent='cat';session.view.querySelector('.line').append(document.createTextNode(' '),link);
  BeipSearch.open();$('findText').value='cat';$('findWord').checked=true;$('findCase').checked=false;$('findRegex').checked=false;
  await BeipSearch.find(1);check('searchWords',BeipSearch.matches.length===4);const first=BeipSearch.index;await BeipSearch.find(-1);check('searchPrevious',first===0&&BeipSearch.index===3);check('searchPreservesLinks',session.view.contains(link));
  $('findCase').checked=true;await BeipSearch.find(1);check('searchCase',BeipSearch.matches.length===2);
  $('findRegex').checked=true;$('findText').value='C[A-Za-z]+';$('findCase').checked=false;await BeipSearch.find(1);check('searchRegex',BeipSearch.matches.length===4);
  session.history=['look','say Amber','say amber'];BeipSearch.open('history');$('findRegex').checked=false;$('findText').value='amber';await BeipSearch.find(1);check('historyRecall',$('input').value==='say Amber'&&$('input').selectionStart===4&&$('input').selectionEnd===9);
  BeipSearch.open('input');$('input').value='one TWO one';$('findText').value='one';$('findReplacement').value='three';await BeipSearch.find(1);await BeipSearch.replace(true);check('inputReplace',$('input').value==='three TWO three');
  BeipSearch.open();$('findRegex').checked=true;$('findText').value='[';await BeipSearch.find(1);check('searchError',/regular expression|unterminated|invalid/i.test($('findCount').textContent));$('findClose').click();
  BeipClientCommands.smartPaste();check('pasteZeroDelay',$('smartPasteDelay').min==='0'&&!!$('smartPasteClipboard'));BeipClientCommands.globalMessage('clipboard:text:'+btoa('one\ntwo'));check('pasteClipboardPreview',$('smartPasteText').value==='one\ntwo');$('smartPasteClose').click();
  app.selectSession(selected);check('searchSessionReset',BeipSearch.matches.length===0);
  const alpha=app.sessions.get('alpha'),character=app.state.characters.find(c=>c.id===alpha.characterId),post=text=>window.chrome.webview.postMessage(text);
  const custom={...character,loginName:'SampleUser',connectTemplate:'template-check %NAME% %PASSWORD%\n/delay 0.1s "template-delayed %NAME%"',connectTemplateEnabled:true,connectTemplateReviewed:true,allowPlainLogin:true};
  check('templateNativeQueued',BeipConnectTemplates.start(alpha,custom,post));await new Promise(resolve=>setTimeout(resolve,160));BeipConnectTemplates.cancel(alpha);
  BeipConnectTemplates.start(alpha,{...custom,connectTemplate:'/delay 0.1s "template-canceled %PASSWORD%"'},post);BeipConnectTemplates.cancel(alpha);await new Promise(resolve=>setTimeout(resolve,140));check('templateCancel',true);
 }finally{BeipSearch.reset();$('findBar').hidden=true;document.getElementById('smartPasteDialog')?.close();if(app.sessions.has(session.id))app.closeSession(session.id);if(app.sessions.has(selected))app.selectSession(selected);}
 return result;
}
window.BeipEverydayFixture={run};})();
