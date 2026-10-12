/* Packaged source-observed dice behavior through the real owner command queue. */
(function(){
'use strict';
async function run(app=window.BeipPreview){
 if(!window.BeipCoreTesting)throw Error('Dice fixture requires test mode.');const a=app.sessions.get('alpha'),b=app.sessions.get('beta');if(!a||!b)throw Error('Two loopback owners are required.');
 const result={error:''},check=(name,value)=>{result[name]=!!value;if(!value)throw Error('Dice check failed: '+name);},dice=s=>[...s.view.querySelectorAll('.line:not([data-restore-replay])')].map(n=>window.BeipLineEdits.text(n)).filter(t=>t.startsWith('🎲'));
 const selected=app.current.id,wasEnabled=!!a.scripts?.enabled,oldVariable=app.variablesForSession(a).rollFixtureIntercept,beforeBeta=dice(b).length;
 try{
  BeipFeatures.initialize(a);a.scripts.stop();app.selectSession(b.id);let before=dice(a).length;
  await app.command('/roll 2d1+3',false,a);let output=dice(a).slice(before);check('ownerAndBonus',output.length===3&&output[0]==='🎲 Rolling 2 1-sided dice with a +3 bonus  Min: 5 Max: 5 Ave: 5.00'&&output[1]==='🎲 Rolled 1 1'&&output[2]==='🎲 Average roll: 1.00  Roll Total +3: 5'&&dice(b).length===beforeBeta);
  before=dice(a).length;await app.command('/silent/roll 1d1+4294967295',false,a);output=dice(a).slice(before);check('silentUnsignedWrap',output.length===3&&output[0].endsWith('Min: 0 Max: 0 Ave: 4.29e+9')&&output[2]==='🎲 Average roll: 1.00  Roll Total +4294967295: 0');
  before=dice(a).length;await app.command('/roll 1d1tail',false,a);await app.command('/roll 1d1+bad',false,a);output=dice(a).slice(before);check('originalNumericPrefix',output.length===6&&output[2]==='🎲 Average roll: 1.00  Roll Total: 1'&&output[5]===output[2]);
  before=dice(a).length;await app.command('/roll',false,a);await app.command('/roll 2D6',false,a);output=dice(a).slice(before);check('originalErrors',output.length===2&&output[0]===BeipRollCommand.MISSING&&output[1]===BeipRollCommand.BAD);
  await a.scripts.start('window.SetOnCommand(function(name){if(name!=="roll")return false;window.SetVariable("rollFixtureIntercept","handled");return true;});',BeipFeatures.context(a));before=dice(a).length;await app.command('/roll 1d1',false,a);check('scriptIntercept',dice(a).length===before&&app.variablesForSession(a).rollFixtureIntercept==='handled');
 }catch(error){result.error=String(error.stack||error);}finally{
  a.scripts?.stop();if(oldVariable===undefined)delete app.variablesForSession(a).rollFixtureIntercept;else app.variablesForSession(a).rollFixtureIntercept=oldVariable;if(app.sessions.has(selected))app.selectSession(selected);if(wasEnabled){const restored=await a.scripts.start(app.state.scriptSource||'',BeipFeatures.context(a),{captureEffects:true});if(restored.effects.length)await app.commandPipeline.effects(a,restored.effects,{source:'roll-fixture-restore'});}app.saveSettings();
 }return result;
}
window.BeipRollFixture={run};
})();
