/* Packaged ANSI action acceptance; synthetic output and native silent bell acknowledgement. MIT. */
(function(root){root.BeipAnsiActionsFixture={async run(app=root.BeipPreview){
 if(!root.BeipCoreTesting)throw Error('ANSI actions fixture requires isolated test mode.');
 const result={},original=app.state.preferences,scriptEnabled=app.state.scriptEnabled,selected=app.current?.id,input=document.getElementById('input'),inputValue=input.value,inputStart=input.selectionStart,inputEnd=input.selectionEnd;let session;
 const check=(name,value)=>{result[name]=!!value;if(!value)throw Error('ANSI actions fixture failed: '+name);};
 const wait=async(fn,name)=>{const deadline=Date.now()+3000;while(!fn()){if(Date.now()>deadline)throw Error('Timed out: '+name);await new Promise(resolve=>setTimeout(resolve,20));}};
 const osc=(target,label)=>'\x1b]8;;'+target+'\x07'+label+'\x1b]8;;\x07';
 try{
  app.state.preferences=JSON.parse(JSON.stringify(original));app.state.preferences.ansi=root.BeipAnsi.normalize({beep:true,beepSystem:true});app.state.scriptEnabled=false;
  session=app.createSession('ansi-actions-test',{label:'ANSI actions test'});session.suppressAutomation=true;app.selectSession(session.id);session.view.style.color='#c0c0c0';session.view.style.backgroundColor='#000000';
  session.parser.feed('\x1b[31;44;7mREVERSE COLORS\x1b[27m NORMAL COLORS\x1b[0;8m DEFAULT REVERSE\x1b[28m NORMAL DEFAULT\n');
  session.parser.feed('\x1b[0;38;2;0;0;0;7mVISIBLE REVERSE\x1b[0m\n'+osc('send:%2Fset%20ansiLiteral%3DA%7CB%0A%2Fset%20ansiSecond%3Dtwo','Run literal command')+' '+osc('prompt:look%20A%7CB%0Anext','Fill command input')+'\n');await session.pendingLineWork;
  const span=text=>[...session.view.querySelectorAll('span')].find(node=>node.textContent===text),style=text=>getComputedStyle(span(text));
  check('reverseExplicit',style('REVERSE COLORS').color==='rgb(0, 0, 238)'&&style('REVERSE COLORS').backgroundColor==='rgb(205, 0, 0)');
  check('reverseOff',style(' NORMAL COLORS').color==='rgb(205, 0, 0)'&&style(' NORMAL COLORS').backgroundColor==='rgb(0, 0, 238)');
  check('reverseDefaults',style(' DEFAULT REVERSE').color==='rgb(0, 0, 0)'&&style(' DEFAULT REVERSE').backgroundColor==='rgb(192, 192, 192)');
  check('defaultReset',!span(' NORMAL DEFAULT').style.color&&!span(' NORMAL DEFAULT').style.backgroundColor);
  check('resolvedInvisiblePolicy',style('VISIBLE REVERSE').color==='rgb(255, 255, 255)'&&style('VISIBLE REVERSE').backgroundColor==='rgb(0, 0, 0)');
  const links=[...session.view.querySelectorAll('a[data-literal="true"]')],variables=app.variablesForSession(session);check('literalLinksVisible',links.length===2&&links.every(node=>node.getBoundingClientRect().width>20));check('noAutomaticCommand',variables.ansiLiteral===undefined);
  // Manual snapshots of owned fixture clones test serialization without enabling live triggers or automatic capture.
  const records=[...session.view.querySelectorAll('.line')].filter(line=>line.querySelector('a')).map(line=>{const snapshot=line.cloneNode(true);delete snapshot.dataset.logSynthetic;return root.BeipRestoreRuntime.fromLine(snapshot);});check('literalStored',records.length===1&&records[0].parts.filter(part=>part.link).every(part=>part.link.literal===true));
  app.replayRestoreRecords(session,records);check('restoreDoesNotActivate',variables.ansiLiteral===undefined);
  const restored=session.view.querySelector('.line[data-restore-replay="true"] a[data-literal="true"]');check('literalRestoredTarget',restored&&restored.dataset.value===links[0].dataset.value);
  links[0].click();await wait(()=>variables.ansiSecond==='two','literal command');check('literalPipeAndNewline',variables.ansiLiteral==='A|B'&&variables.ansiSecond==='two');
  links[1].click();check('promptSelectsWholeTarget',input.value==='look A|B\nnext'&&input.selectionStart===0&&input.selectionEnd===input.value.length);
  delete variables.ansiLiteral;restored.click();await wait(()=>variables.ansiLiteral==='A|B','restored literal click');check('restoredClick',variables.ansiLiteral==='A|B');
  root.chrome.webview.postMessage('testcapture:ansi-actions');await wait(()=>root.BeipTestScreenshots?.has('ansi-actions'),'ANSI actions screenshot');check('renderedCaptured',true);
  session.suppressAutomation=false;session.parser.feed('\x07');await wait(()=>session.ansiBellCount===1,'native bell acknowledgement');check('nativeBellAcknowledged',true);
  app.state.preferences.ansi.beep=false;session.parser.feed('\x07');app.state.preferences.ansi.beep=true;
  session.restoreReplay=true;session.parser.feed('\x07');session.restoreReplay=false;session.suppressAutomation=true;session.parser.feed('\x07');session.suppressAutomation=false;
  app.state.preferences.ansi.beepSystem=false;session.parser.feed('\x07');app.state.preferences.ansi.beepSystem=true;
  session.parser.setAnsiPreferences({...app.state.preferences.ansi,parse:false});session.parser.feed('\x07');await wait(()=>session.ansiBellCount>=2,'parse-disabled bell');check('bellSuppressionAndParseDisabled',session.ansiBellCount===2);
  session.parser.setAnsiPreferences(app.state.preferences.ansi);session.parser.feed(osc('https://example.org','')+'\x07');await wait(()=>session.ansiBellCount>=3,'OSC terminator fence');check('oscTerminatorNotBell',session.ansiBellCount===3);
  const host=document.createElement('div');host.hidden=true;document.body.append(host);try{const panel=root.BeipAnsiUI.createPanel(host);host.querySelector('[data-ansi="beep"]').checked=false;host.querySelector('[data-ansi="beepSystem"]').checked=false;const saved=panel.read();panel.load(saved);check('bellSettingsRoundTrip',!panel.read().beep&&!panel.read().beepSystem);}finally{host.remove();}
 }catch(error){result.error=String(error.message||error).slice(0,400);}
 finally{if(session)app.closeSession(session.id);app.state.preferences=original;app.state.scriptEnabled=scriptEnabled;if(selected&&app.sessions.has(selected))app.selectSession(selected);app.applyPreferences();input.value=inputValue;input.setSelectionRange(inputStart,inputEnd);app.resizeInput();}
 return result;
}};})(globalThis);
