const assert=require('node:assert/strict');
const {Parser,entity,webURL}=require('../ui/parser.js');let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function parse(input,{mxp=false,split=false}={}){const events=[],sent=[];const p=new Parser(e=>events.push(e),s=>sent.push(s));if(mxp)p.setMXP(true);for(const s of split?[...input]:[input])p.feed(s);p.finish();return {events,sent,p,text:events.filter(e=>e.type==='text').map(e=>e.text).join('')};}
const start='This world is Pueblo 1.10 enhanced.\r\n</xch_mudtext>';
check('Plain text preserves angle brackets',()=>assert.equal(parse('a <shrug> b').text,'a <shrug> b'));
check('Fragmented Pueblo handshake only once',()=>assert.deepEqual(parse(start+start,{split:true}).sent,['PUEBLOCLIENT 2.01']));
check('Fragmented image tag and entity',()=>{const r=parse(start+'<img src="https://example.org/render?id=1&amp;size=2" height="180">',{split:true});assert.equal(r.events.find(e=>e.type==='image').url,'https://example.org/render?id=1&size=2');});
check('Command wraps inline image',()=>{const r=parse(start+'<a xch_cmd="look hall"><img src="https://example.org/a.png"></a>');assert.equal(r.events.find(e=>e.type==='image').link.value,'look hall');});
check('Clickable website',()=>assert.equal(parse(start+'<a href="https://example.org">site</a>').events.find(e=>e.text==='site').link.kind,'url'));
check('Unsafe image URL rejected',()=>{const r=parse(start+'<img src="javascript:alert(1)">');assert.ok(!r.events.some(e=>e.type==='image'));});
check('Unsafe website URL rejected',()=>assert.equal(parse(start+'<a href="javascript:alert(1)">site</a>').events.find(e=>e.text==='site').link,null));
check('No raw HTML execution events',()=>assert.ok(parse(start+'<script>alert(1)</script>').events.every(e=>['text','protocol'].includes(e.type))));
check('Locked MXP preserves markup',()=>assert.equal(parse('\x1b[2z<send href="look">look</send>',{mxp:true}).text,'<send href="look">look</send>'));
check('Open MXP rejects commands',()=>assert.equal(parse('<send href="look">look</send>',{mxp:true}).events.find(e=>e.text==='look').link,null));
check('Secure MXP command',()=>assert.equal(parse('\x1b[1z<send href="look|inventory" hint="Actions|Look|Items">go</send>',{mxp:true,split:true}).events.find(e=>e.text==='g').link.value,'look|inventory'));
check('Secure MXP quoted bare command',()=>assert.equal(parse('\x1b[1z<send "look hall">go</send>',{mxp:true}).events.find(e=>e.text==='go').link.value,'look hall'));
check('MXP image URL plus filename',()=>assert.equal(parse('\x1b[1z<image fname="hall.png" url="https://example.org/rooms/">',{mxp:true}).events.find(e=>e.type==='image').url,'https://example.org/rooms/hall.png'));
check('MXP newline restores open security',()=>assert.equal(parse('\x1b[1z<send href="look">a\n<send href="bad">b',{mxp:true}).events.find(e=>e.text==='b').link,null));
check('Persistent secure MXP mode',()=>assert.ok(parse('\x1b[6zhi\n<img src="https://example.org/a.png">',{mxp:true}).events.some(e=>e.type==='image')));
check('Partial quoted tag includes greater-than',()=>assert.equal(parse(start+'<send href="say > hi">go</send>',{split:true}).events.find(e=>e.text==='g').link.value,'say > hi'));
check('ANSI true color across chunks',()=>assert.equal(parse('\x1b[38;2;10;20;30mred',{split:true}).events.find(e=>e.text==='r').style.color,'rgb(10,20,30)'));
check('CRLF across chunks has one newline',()=>assert.equal(parse('a\r\nb',{split:true}).text,'a\nb'));
check('Entities cannot inject tags',()=>assert.equal(parse(start+'&lt;img src=x&gt;').events.filter(e=>e.type==='image').length,0));
check('Incomplete tags flush on disconnect',()=>assert.ok(parse(start+'<img src="unfinished').text.endsWith('<img src="unfinished')));
check('Pueblo text region disables tags',()=>assert.ok(parse(start+'<xch_mudtext><img src="https://example.org/a.png">').text.includes('<img')));
check('MXP support only claims implemented subset',()=>assert.ok(parse('\x1b[1z<support SEND IMAGE SOUND>',{mxp:true}).sent[0].includes('+SEND +IMAGE -SOUND')));
check('MXP support does not claim unsupported attributes',()=>assert.ok(parse('\x1b[1z<support IMAGE.FNAME IMAGE.ISMAP>',{mxp:true}).sent[0].includes('+IMAGE.FNAME -IMAGE.ISMAP')));
check('Prompt sends to command box',()=>assert.equal(parse(start+'<send href="look" prompt>go</send>').events.find(e=>e.text==='go').link.prompt,true));
check('Numeric entities validate codepoints',()=>assert.equal(entity('&#x1f409; &#0;'),'🐉 \ufffd'));
check('URLs with embedded credentials rejected',()=>assert.equal(webURL('https://user:secret@example.org/a.png'),null));

for(const ending of ['\n','\r\n','\r']){
 const input='</xch_mudtext><pre>Name        On for<BR>'+ending+'Alice       01:00<BR>'+ending+'Bob         02:00<BR>'+ending+'</pre>';
 for(let split=0;split<=input.length;split++)check('WHO paired ending '+JSON.stringify(ending)+' split '+split,()=>{
  const events=[],p=new Parser(e=>events.push(e),()=>{});p.feed(input.slice(0,split));p.feed(input.slice(split));p.finish();
  assert.equal(events.filter(e=>e.type==='text').map(e=>e.text).join(''),'Name        On for\nAlice       01:00\nBob         02:00\n');
 });
}
for(const [input,expected] of [
 ['<pre>a<BR>\r\n\r\nb</pre>','a\n\nb'],
 ['<pre>a<BR><BR>\r\nb</pre>','a\n\nb'],
 ['<pre>a<BR>&#10;\nb</pre>','a\n\n\nb'],
 ['<pre>a<BR><b>\nb</b></pre>','a\n\nb'],
 ['a<BR>\nb','a\nb'],
 ['<pre>a<BR> \nb</pre>','a\n \nb'],
 ['<pre>a<BR></pre>\nb','a\nb'],
 ['<pre>a<BR><xch_mudtext>\nb','a\n\nb'],
 ['<pre>a\t  b<BR>\r\nc</pre>','a\t  b\nc']
])check('Preserve intentional spacing '+JSON.stringify(input),()=>assert.equal(parse('</xch_mudtext>'+input,{split:true}).text,expected));
for(const ending of ['\n','\r\n','\r']){
 const source='</xch_mudtext><img xch_mode=purehtml>'+ending+'<SAMP>Use <a xch_cmd="connect Guest Guest">connect Guest Guest</a> to connect.<br>'+ending+'Use \x1b[31mwho\x1b[0m to list players.<br>'+ending+'<br>'+ending+'  Keep\tcolumns  aligned.<br>'+ending+'</SAMP>';
 for(let split=0;split<=source.length;split++){
  const events=[],p=new Parser(e=>events.push(e),()=>{});p.feed(source.slice(0,split));p.feed(source.slice(split));p.finish();
  assert.equal(events.filter(e=>e.type==='text').map(e=>e.text).join(''),'Use connect Guest Guest to connect.\nUse who to list players.\n\n  Keep\tcolumns  aligned.\n');
  assert.ok(events.some(e=>e.link?.value==='connect Guest Guest'));
  assert.ok(!events.some(e=>e.type==='warning'));
 }
 check('Pueblo login source whitespace across every split '+JSON.stringify(ending),()=>{});
}
for(const [input,expected] of [
 ['a<BR><b>\r\nb</b>','a\nb'],
 ['a<BR>\x1b[31m\r\nb','a\nb'],
 ['a\r\nb','a b'],
 ['a  \r\n  b','a    b'],
 ['a<BR>\r\n<BR>\r\nb','a\n\nb'],
 ['a<BR>\n\n\nb','a\nb'],
 ['<pre>a\r\n\r\nb</pre>','a\n\nb'],
 ['<xch_mudtext>a\r\n\r\nb','a\n\nb']
])check('Pueblo HTML versus literal spacing '+JSON.stringify(input),()=>assert.equal(parse('</xch_mudtext>'+input,{split:true}).text,expected));
check('Reset clears paired newline state',()=>{let text='';const p=new Parser(e=>{if(e.type==='text')text+=e.text;},()=>{});p.feed('</xch_mudtext><pre>a<BR>');p.reset();p.feed('\nb');assert.equal(text,'a\n\nb');});
console.log(`${count} parser checks passed.`);
