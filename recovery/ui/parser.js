/* MIT. Stream parser for the BeipMU recovery display; no server HTML executes. */
(function(root){
const ansiModule=typeof module==='object'&&module.exports?require('./ansi-state.js'):root.BeipAnsiState;
function entity(s){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(full,v)=>{
 const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
 if(v[0]!=='#')return map[v.toLowerCase()]??full;
 const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10);
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
});}
function webURL(s){try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function attributes(s){const a={},pos=[];let m;const re=/(?:"([^"]*)"|'([^']*)'|([^\s=]+))(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g;
 while((m=re.exec(s))){const key=m[1]??m[2]??m[3];if(m[4]!==undefined||m[5]!==undefined||m[6]!==undefined)a[key.toLowerCase()]=entity(m[4]??m[5]??m[6]);else pos.push(entity(key));}
 return {a,pos};}
class Parser{
 constructor(emit,send,ansiPreferences){this.emit=emit;this.send=send;this.ansiState=new ansiModule.State(ansiPreferences);this.reset();}
 setAnsiPreferences(value){this.ansiState.configure(value);this.ansi=this.ansiState.style();}
 beginReceivedLine(){if(this.ansiState.preferences.resetOnNewLine)this.ansi=this.ansiState.reset().style();}
 reset(){this.pending='';this.announcement='';this.pueblo=false;this.handshake=false;this.mxp=false;this.mode=0;this.defaultMode=0;this.stack=[];this.style={};this.ansi=this.ansiState.reset().style();this.link=null;this.pendingCR=false;this.pre=0;this.brNewline=false;this.htmlSpace=false;this.lastText='';}
 setMXP(enabled){this.brNewline=false;this.htmlSpace=false;this.pre=0;this.mxp=enabled;if(!enabled){this.stack=[];this.link=null;this.style={};}this.emit({type:'protocol',pueblo:this.pueblo,mxp:this.mxp});}
 text(s){if(!s)return;if(this.htmlSpace){if(this.pueblo&&!this.pre&&this.lastText&&!/[\s]/.test(this.lastText)&&!/^\s/.test(s))s=' '+s;this.htmlSpace=false;}this.lastText=s.at(-1);this.emit({type:'text',text:s,style:{...this.ansi,...this.style},link:this.link?{...this.link}:null});}
 modeChange(n){this.brNewline=false;this.htmlSpace=false;this.pre=0;if(n===3){this.stack=[];this.style={};this.link=null;return;}if([5,6,7].includes(n)){this.defaultMode=n-5;this.mode=n-5;}else if([0,1,2].includes(n))this.mode=n;this.stack=[];this.style={};this.link=null;}
 feed(s){
  this.announcement=(this.announcement+s).slice(-4096);
  if(!this.handshake && /This world is Pueblo\s*\d/i.test(this.announcement)){this.handshake=true;this.send('PUEBLOCLIENT 2.01');}
  // PennMUSH's closing marker enables Pueblo; mere announcement is not enough.
  this.pending+=s;
  let run='';const flush=()=>{this.text(run);run='';};
  while(this.pending.length){
   let c=this.pending[0];
   if(this.pendingCR){this.pendingCR=false;if(c==='\n'){if(this.ansiState.preferences.resetOnNewLine)this.ansi=this.ansiState.reset().style();this.pending=this.pending.slice(1);continue;}}
   if(c!=='\r'&&c!=='\n')this.brNewline=false;
   if(c==='\x1b'){
    flush();if(this.pending.length<2)break;
    if(!this.ansiState.preferences.parse&&(!this.mxp||this.pending[1]!=='[')){this.pending=this.pending.slice(1);continue;}
    if(this.pending[1]==='['){const m=/^\x1b\[([0-9;?]*)([ -/]*)([@-~])/.exec(this.pending);if(!m){if(this.pending.length<128)break;this.pending=this.pending.slice(1);continue;}
     if(!this.ansiState.preferences.parse&&!(m[3]==='z'&&this.mxp)){this.pending=this.pending.slice(1);continue;}
     this.pending=this.pending.slice(m[0].length);if(m[3]==='z'&&this.mxp)this.modeChange(Number(m[1]||0));else if(m[3]==='m')this.sgr(m[1]);continue;
    }
    if(this.pending[1]===']'){if(!this.ansiState.preferences.parse){this.pending=this.pending.slice(1);continue;}const end=this.pending.search(/\x07|\x1b\\/);if(end<0){if(this.pending.length>8192)this.pending='';break;}
     const seq=this.pending.slice(2,end);this.pending=this.pending.slice(end+(this.pending[end]==='\x07'?1:2));
     if(seq.startsWith('8;')){const uri=seq.slice(seq.indexOf(';',2)+1);const url=webURL(uri);this.link=url?{kind:'url',value:url}:null;}continue;
    }
    this.pending=this.pending.slice(2);continue;
   }
   if(c==='\r'||c==='\n'){flush();this.pending=this.pending.slice(1);this.pendingCR=c==='\r';/* Pueblo HTML source newlines are whitespace; BR owns its display break. Preserve literal spaces/tabs for MUSH columns. PRE and MXP retain their existing line semantics. */if(this.pueblo&&!this.pre)this.htmlSpace=true;else if(!this.brNewline)this.text('\n');this.brNewline=false;if(c==='\n'&&this.ansiState.preferences.resetOnNewLine)this.ansi=this.ansiState.reset().style();if(this.mxp&&!this.pueblo){this.mode=this.defaultMode;this.stack=[];this.style={};this.link=null;}continue;}
   if(c==='<'){
    const markup=this.pueblo || (this.mxp&&this.mode!==2) || /^<\/?xch_mudtext/i.test(this.pending);
    if(markup){let quote=null,end=-1;for(let i=1;i<this.pending.length;i++){const t=this.pending[i];if(quote){if(t===quote)quote=null;}else if(t==='"'||t==="'")quote=t;else if(t==='>'){end=i;break;}}
     if(end<0){if(this.pending.length<16384)break;run+='<';this.pending=this.pending.slice(1);continue;}
     flush();const token=this.pending.slice(1,end);this.pending=this.pending.slice(end+1);this.tag(token);continue;
    }
    // Keep partial Pueblo activation marker until it can be recognized.
    if(!this.pueblo&&!this.mxp && '</xch_mudtext>'.startsWith(this.pending.toLowerCase()))break;
   }
   if(c==='&'&&(this.pueblo||(this.mxp&&this.mode!==2))){const end=this.pending.indexOf(';');if(end<0&&this.pending.length<32)break;if(end>=0&&end<32){run+=entity(this.pending.slice(0,end+1));this.pending=this.pending.slice(end+1);continue;}}
   this.pending=this.pending.slice(1);if(c==='\t'||c>=' ')run+=c;
  }flush();
 }
 finish(){this.brNewline=false;this.pre=0;if(this.pending)this.text(this.pending);this.pending='';this.stack=[];this.link=null;this.style={};}
 sgr(s){this.ansi=this.ansiState.apply(s);}
 tag(token){this.brNewline=false;const m=/^\s*(\/?)\s*([\w!_-]+)([\s\S]*)$/.exec(token);if(!m)return;const close=!!m[1],name=m[2].toLowerCase(),{a,pos}=attributes(m[3].replace(/\/$/,''));
  if(name==='xch_mudtext'){this.pre=0;this.htmlSpace=false;this.pueblo=close;this.emit({type:'protocol',pueblo:this.pueblo,mxp:this.mxp});return;}
  const openTags=['b','strong','i','em','u','s','strike','color','c','font','br','p'];
  if(!this.pueblo&&this.mxp&&this.mode!==1&&!openTags.includes(name))return;
  if(name==='pre'){this.htmlSpace=false;this.pre=close?Math.max(0,this.pre-1):Math.min(64,this.pre+1);return;}
  if(close){const index=this.stack.map(x=>x.name).lastIndexOf(name);if(index>=0){const saved=this.stack[index];this.style=saved.style;this.link=saved.link;this.stack.length=index;}return;}
  if(name==='br'||name==='p'){this.text('\n');/* PennMUSH pairs BR with a transport newline inside PRE. */this.brNewline=name==='br'&&this.pre>0;return;}
  if(name==='support'){const supported=['b','i','u','color','font','a','send','img','image','br','p','version','support'];const attrs={a:['href','hint'],send:['href','hint','prompt'],img:['src','height','alt'],image:['url','fname','height','alt'],color:['fore'],font:['color']};const queries=pos.length?pos:supported;this.send('\x1b[1z<SUPPORTS '+queries.map(q=>{const [tag,attr]=q.toLowerCase().split('.');return (supported.includes(tag)&&(!attr||attrs[tag]?.includes(attr))?'+':'-')+q;}).join(' ')+'>');return;}
  if(name==='version'){this.send('\x1b[1z<VERSION MXP="1.0" CLIENT="BeipMU-Recovery" VERSION="0.15">');return;}
  if(name==='img'||name==='image'){
   if(a.xch_mode!==undefined&&!a.src&&!a.fname&&!a.url&&!pos.length)return;
   let src=a.src;if(!src){const fname=a.fname||pos[0]||'';try{src=a.url?new URL(fname,a.url).href:fname;}catch{src='';}}
   const url=webURL(src||'');if(url)this.emit({type:'image',url,alt:a.alt||'Image',height:Math.max(48,Math.min(600,Number(a.height)||220)),heightSpecified:a.height!==undefined&&Number.isFinite(Number(a.height)),link:this.link?{...this.link}:null});else this.emit({type:'warning',text:'Image has an unsupported or incomplete URL.'});return;
  }
  if(['xch_page','pre','html','body'].includes(name))return;
  if(!openTags.includes(name)&&name!=='a'&&name!=='send')return;
  this.stack.push({name,style:{...this.style},link:this.link});if(this.stack.length>64){this.stack.shift();}
  if(['b','strong'].includes(name))this.style.bold=true;
  if(['i','em'].includes(name))this.style.italic=true;
  if(name==='u')this.style.underline=true;
  if(['s','strike'].includes(name))this.style.strike=true;
  if(['color','c','font'].includes(name)){const value=a.fore||a.color||pos[0];if(value&&/^(#[0-9a-f]{3,8}|[a-z]{1,24})$/i.test(value))this.style.color=value;}
  if(name==='send'||(name==='a'&&a.xch_cmd!==undefined)){this.link={kind:'command',value:a.xch_cmd??a.href??pos.find(x=>!['prompt','noprompt'].includes(x.toLowerCase()))??'',hint:a.xch_hint||a.hint||'',prompt:a.prompt!==undefined||pos.some(x=>x.toLowerCase()==='prompt')};}
  else if(name==='a'){const url=webURL(a.href||pos[0]||'');this.link=url?{kind:'url',value:url,hint:a.hint||''}:null;}
 }
}
const api={Parser,entity,webURL};if(typeof module!=='undefined')module.exports=api;else root.BeipProtocol=api;
})(typeof globalThis!=='undefined'?globalThis:this);
