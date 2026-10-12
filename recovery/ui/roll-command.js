/* Original Commands.cpp dice command, checked against BeipMU 4.335. MIT. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./daily-commands.js'):root.BeipDailyCommands,root);if(typeof module==='object'&&module.exports)module.exports=api;else root.BeipRollCommand=api;})(typeof globalThis==='object'?globalThis:this,function(daily,root){
'use strict';
const UINT_MAX=0xffffffff,u32=value=>value>>>0,f32=Math.fround;
const MISSING='🎲 Roll: Missing parameter',BAD='🎲 Bad roll format, should be in the form of [count]d[sides](+bonus). The count must be <= 1000. For example, to roll a 6 sided die 10 times: /roll 10d6';
// ConstString::To(unsigned) behavior verified offline: initial ASCII digits,
// trailing text allowed, no sign/leading space, overflow fails without wrapping.
function parseUnsigned(value){const match=/^[0-9]+/.exec(value);if(!match)return null;const number=Number(match[0]);return Number.isSafeInteger(number)&&number<=UINT_MAX?number:null;}
function parseToken(value){const plus=value.indexOf('+'),split=value.indexOf('d'),bonus=plus<0?0:parseUnsigned(value.slice(plus+1))||0;if(split<0)return {error:BAD};const count=parseUnsigned(value.slice(0,split)),sides=parseUnsigned(value.slice(split+1));return count>=1&&count<=1000&&sides>=1?{count,sides,bonus}:{error:BAD};}
function parse(parameters){const words=daily.words(parameters);return words.length===1?parseToken(words[0]):{error:MISSING};}
function formatFloat(value){if(value===0)return '0';return value>=1e9?value.toExponential(2):value.toFixed(2);}
function randomInclusive(max){const size=max+1,limit=Math.floor(0x100000000/size)*size,buffer=new Uint32Array(1);for(let i=0;i<128;i++){root.crypto.getRandomValues(buffer);if(buffer[0]<limit)return buffer[0]%size;}throw Error('Dice random source did not produce a bounded value.');}
function unsigned(value){return Number.isSafeInteger(value)&&value>=0&&value<=UINT_MAX;}
function rollRecords(count,sides,bonus,randomInclusive){
 if(!unsigned(count)||count<1||count>1000||!unsigned(sides)||sides<1||!unsigned(bonus)||typeof randomInclusive!=='function')throw Error('Invalid dice parameters.');
 const minimum=u32(count+bonus),maximum=u32(sides*count+bonus);
 // Commands.cpp adds/multiplies unsigned before converting to float.
 const expectedMean=f32(f32(f32(u32(count+u32(sides*count)))/2)+f32(bonus));
 const rolls=[];let subtotal=0;
 for(let i=0;i<count;i++){const zeroBased=randomInclusive(sides-1);if(!unsigned(zeroBased)||zeroBased>=sides)throw Error('Random result outside die range.');const value=zeroBased+1;rolls.push(value);subtotal=u32(subtotal+value);}
 return {count,sides,bonus,minimum,maximum,expectedMean,rolls,subtotal,average:f32(f32(subtotal)/f32(count)),total:u32(subtotal+bonus)};
}
function lines(record){const r=record;return ['🎲 Rolling '+r.count+' '+r.sides+'-sided dice'+(r.bonus?' with a +'+r.bonus+' bonus':'')+'  Min: '+r.minimum+' Max: '+r.maximum+' Ave: '+formatFloat(r.expectedMean),'🎲 Rolled '+r.rolls.join(' '),'🎲 Average roll: '+formatFloat(r.average)+'  Roll Total'+(r.bonus?' +'+r.bonus:'')+': '+r.total];}
function createCommand(ports){return function handle(value,owner,execution){if(typeof value!=='string'||!value.startsWith('/'))return false;const tokens=daily.words(value.slice(1));if((tokens[0]||'').toLowerCase()!=='roll')return false;if(!ports.valid(owner)||execution?.owner!==owner||!execution.isCurrent())throw Error('Dice command owner is no longer current.');const parsed=tokens.length===2?parseToken(tokens[1]):{error:MISSING};const output=parsed.error?[parsed.error]:lines(rollRecords(parsed.count,parsed.sides,parsed.bonus,ports.randomInclusive||randomInclusive));for(const line of output){if(!execution.isCurrent()||!ports.valid(owner))throw Error('Dice command owner is no longer current.');ports.write(owner,line);}return true;};}
return {parseUnsigned,parse,rollRecords,formatFloat,lines,randomInclusive,createCommand,MISSING,BAD};
});
