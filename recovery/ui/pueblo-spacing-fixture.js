/* Public BoD login wording captured without authentication on 2026-10-12.
 * The six Use rows and explicit empty rows below match bod-public-login.raw.
 * Usage rows deliberately omit PRE/SAMP wrappers to exercise HTML whitespace.
 * Additional styled links and PRE WHO rows are synthetic regression probes. */
(function(){
'use strict';
const usage=[
 'Use create &lt;name&gt; &lt;password&gt; to create a visitor account.',
 'Use connect Guest Guest to connect to a guest account.',
 'Use connect &lt;name&gt; &lt;password&gt; to connect to your existing account.',
 '',
 'Use who to find out who is online currently.',
 'Use +n &lt;message&gt; to speak on the Newbie channel.',
 'Use +g &lt;message&gt; to speak on the Guest channel.',
 ''
];
const heading='WELCOME TO BLOOD OF DRAGONS MUSH!',who=['Name             On For  Idle  Doing','Guest               1m    0s  In the lobby','Visitor            12m    2m  Reading help','','WHO END'];
const source='</xch_mudtext><img xch_mode=purehtml><b>'+heading+'</b><br>\n<br>\n'+usage.map(line=>line+'<br>\n').join('')+'<b>Columns and links</b><br>\nStatus: <font color="#00ff00">ready</font>   Route: <a xch_cmd="who">WHO</a><br>\n<PRE>'+who.join('<br>\r\n')+'</PRE><br>\n<a href="https://www.westeros.org/BoD/">Website</a><br>\nSPACING FIXTURE COMPLETE';
const expected=[heading,'',...usage.map(line=>line.replace(/&lt;/g,'<').replace(/&gt;/g,'>')),'Columns and links','Status: ready   Route: WHO',...who,'Website','SPACING FIXTURE COMPLETE'];
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Pueblo spacing fixture is available only in test mode.');
 const result={fragmentedParser:false,exactRows:false,consecutiveUsage:false,intentionalEmptyRows:false,columns:false,stylesAndLinks:false,preWho:false,screenshot:false,closed:false,error:''},prior=app.current;let session;
 const wait=async(fn,label)=>{const end=Date.now()+10000;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(resolve=>setTimeout(resolve,25));}},check=(key,value)=>{result[key]=!!value;if(!value)throw Error('Pueblo spacing check failed: '+key);};
 try{
  session=app.createSession('pueblo-spacing-fixture',{label:'Pueblo spacing'});session.suppressAutomation=true;app.selectSession(session.id);BeipWindowPreferences.applyOutput(session.view,{...app.preferencesForSession(session),fontFamily:'monospace',outputFontFace:'Courier New',fontSize:13,paragraphSpacing:0,outputForeground:'#c0c0c0',outputBackground:'#000000',fixedWidth:false});
  const bytes=new TextEncoder().encode(source),sizes=[1,2,7,3,11,5,17];let chunks=0;for(let at=0;at<bytes.length;){const size=sizes[chunks%sizes.length],chunk=bytes.subarray(at,at+size);app.incoming('session:'+session.id+':data:'+btoa(String.fromCharCode(...chunk)));at+=chunk.length;chunks++;}
  await wait(()=>session.view.textContent.includes('SPACING FIXTURE COMPLETE'),'parsed login rows');await session.pendingLineWork;
  const rows=[...session.view.querySelectorAll('.line')],texts=rows.map(row=>row.textContent);result.rows=texts;check('fragmentedParser',chunks>100&&session.parser.pueblo&&session.protocol==='Pueblo');check('exactRows',JSON.stringify(texts)===JSON.stringify(expected));
  const use=rows.filter(row=>row.textContent.startsWith('Use '));check('consecutiveUsage',use.length===6&&[[0,1],[1,2],[3,4],[4,5]].every(([a,b])=>use[a].nextElementSibling===use[b]&&use[a].getBoundingClientRect().height>0&&Math.abs(use[b].getBoundingClientRect().top-use[a].getBoundingClientRect().bottom)<1));
  check('intentionalEmptyRows',texts.map((text,index)=>text===''?index:-1).filter(index=>index>=0).join(',')===expected.map((text,index)=>text===''?index:-1).filter(index=>index>=0).join(','));
  const status=rows.find(row=>row.textContent.startsWith('Status:')),command=status.querySelector('a[data-kind="command"]'),website=rows.find(row=>row.textContent==='Website').querySelector('a[data-kind="url"]');
  check('columns',status.textContent==='Status: ready   Route: WHO'&&getComputedStyle(session.view).fontFamily.includes('Courier New')&&['pre','pre-wrap','break-spaces'].includes(getComputedStyle(status).whiteSpace));
  check('stylesAndLinks',Number(getComputedStyle(rows[0].querySelector('span')).fontWeight)>=600&&[...status.querySelectorAll('span')].some(span=>span.textContent==='ready'&&getComputedStyle(span).color==='rgb(0, 255, 0)')&&command?.dataset.value==='who'&&command.textContent==='WHO'&&website?.dataset.value==='https://www.westeros.org/BoD/');
  const firstWho=texts.indexOf(who[0]);check('preWho',firstWho>=0&&JSON.stringify(texts.slice(firstWho,firstWho+who.length))===JSON.stringify(who));
  document.getElementById('output').scrollTop=0;window.BeipTestScreenshots?.delete('pueblo-spacing');window.chrome.webview.postMessage('testcapture:pueblo-spacing');await wait(()=>window.BeipTestScreenshots?.has('pueblo-spacing'),'Pueblo spacing screenshot');check('screenshot',true);
 }catch(error){result.error=String(error.stack||error);}
 finally{if(session)app.closeSession(session.id);if(prior&&app.sessions.has(prior.id))app.selectSession(prior.id);result.closed=!app.sessions.has('pueblo-spacing-fixture');}
 return result;
}
window.BeipPuebloSpacingFixture={run,source,expected};
})();
