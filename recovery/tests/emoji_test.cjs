const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),emoji=require('../ui/emoji-model.js'),profiles=require('../ui/profile-model.js'),imports=require('../ui/classic-import-core.js');
let count=0;function check(name,test){test();count++;console.log('PASS '+name);}
const defaults=emoji.compile(emoji.defaultSource);
check('Original UTF-8 table is bundled without losing any phrase or Unicode text',()=>{
 assert.ok(new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(__dirname,'../ui/Emoji.txt')))===emoji.defaultSource);assert.equal(defaults.rules.length,1189);
 assert.equal(emoji.transform('This is a dog, this is a dog face. End of line Zebra',defaults),'This is a dog🐕, this is a dog face🐶. End of line Zebra🦓');
 assert.equal(emoji.transform('FOX 🦊 DOG',defaults),'FOX🦊 🦊 DOG🐕');
});
check('Original smiley tests preserve times, identifiers and web addresses',()=>{
 const text='12:30 sun_name http://www.sample.com/dog www.example.org/dog';assert.equal(emoji.transform(text,defaults),text);
 assert.equal(emoji.transform(':) :-) :3',defaults),'🙂 🙂 🐱');
 assert.equal(emoji.transform('dog-dog,dog: (dog)',defaults),'dog🐕-dog🐕,dog🐕: (dog🐕)');
 assert.equal(emoji.transform('hotdog dogs dog_name αdog dogα',defaults),'hotdog dogs dog_name αdog dogα');
});
check('Ignore sections, replacement, synonyms and longest phrase are literal and nonrecursive',()=>{
 const table=emoji.compile('# comment\nIGNORE_BEGIN\ninvalid ignored row\nIGNORE_BEGIN\n! ignored\nIGNORE_END\nIGNORE_END\n🐶 dog face\n🐕 dog, hound\nREPLACE_BEGIN\nfox :)\n🦊 fox\nREPLACE_END\n🌞 sun');
 assert.equal(emoji.transform('DOG FACE hound :) fox sun',table),'DOG FACE🐶 hound🐕 fox 🦊 sun🌞');assert.equal(table.rules.length,6);
 const literal=emoji.compile('⭐ [star], a+b\n💠 Étoile');assert.equal(emoji.transform('[STAR] a+b ÉTOILE',literal),'[STAR]⭐ a+b⭐ ÉTOILE💠');
});
check('Invalid or excessive sources are rejected before replacing the active table',()=>{
 for(const source of ['IGNORE_END','IGNORE_BEGIN\n🐕 dog','badline','🐕 '+ 'x'.repeat(257),'🐕 dog\0'])assert.throws(()=>emoji.compile(source));
 assert.throws(()=>emoji.compile('#'+'🙂'.repeat(40000)),/128 KiB/);assert.equal(emoji.matches('dog'.repeat(30000),defaults).length,0);
});
check('Enable state is global, defaults off and imports original ParseEmoticons',()=>{
 assert.equal(profiles.normalizeSettings({}).preferences.emojiEnabled,false);const saved=profiles.normalizeSettings({preferences:{emojiEnabled:true}});assert.equal(profiles.normalizeSettings(JSON.parse(JSON.stringify(saved))).preferences.emojiEnabled,true);
 const plan=imports.parseConfig('Version=400\nParseEmoticons=true\nConnections.Shortcuts.World\n{\nHost="example.org:4000"\n}');assert.equal(plan.preferences.emojiEnabled,true);
});
console.log(count+' emoji checks passed.');
