import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,update,beginNight,acknowledgeCrime,inspectPreliminary,inspect,evaluate,startReconstruction,reconstructionStep} from '../src/simulation.js';
import {tutorialEvent,skipTutorial,canAdvanceNight,guidance,phaseIndex,accusationRequirements} from '../src/progression.js';
import {characterPose} from '../src/characters.js';
import {DARK_FRAMES} from '../src/dark-frames.js';
const run=(s,n)=>{for(let i=0;i<n*10;i++)update(s,.1);};
const night=s=>{assert(beginNight(s));run(s,30);assert.equal(s.flow,'discovery');assert(acknowledgeCrime(s));};

test('tutorial freezes case time, requires real lens placement and observation, then journal actions and investigation',()=>{
 const s=createState();assert.equal(s.tutorial.step,'lens');assert.equal(beginNight(s),false);run(s,30);assert.equal(s.time,0);
 tutorialEvent(s,'lens-enabled');assert.equal(s.tutorial.step,'lens');s.lens.active=true;tutorialEvent(s,'lens-enabled');assert.equal(s.tutorial.step,'place-lens');tutorialEvent(s,'lens-placed','cat');assert.equal(s.tutorial.step,'place-lens');
 const goat=s.residents.find(r=>r.id==='goat');Object.assign(s.lens,{x:goat.x,y:goat.y,active:true});run(s,2.1);
 assert.equal(s.tutorial.step,'place-lens');tutorialEvent(s,'lens-placed','goat');run(s,2.1);assert.equal(goat.watched,true);assert.equal(s.time,0);assert.equal(s.observations.length,1);assert.equal(s.clues.size,0);assert.equal(guidance(s).action,'notebook');
 tutorialEvent(s,'notebook');assert(!canAdvanceNight(s));tutorialEvent(s,'entry-opened','wrong');assert.equal(s.tutorial.step,'notebook-entry');tutorialEvent(s,'entry-opened','watch-goat');tutorialEvent(s,'notebook-closed');
 assert.equal(s.tutorial.step,'prefact');assert.equal(s.lens.active,false);assert.equal(guidance(s).action,'prefact');assert.equal(beginNight(s),false);
 inspectPreliminary(s,'center');tutorialEvent(s,'prefact','home');assert.equal(s.tutorial.step,'prefact');assert.equal(s.preliminary.length,0);
 assert(inspectPreliminary(s,'home'));assert.equal(s.tutorial.step,'prefact-return');assert.equal(beginNight(s),false);
 tutorialEvent(s,'dialog-closed');assert(canAdvanceNight(s));night(s);assert.equal(guidance(s).action,'trace');
 inspect(s,'home');tutorialEvent(s,'evidence','home');assert.equal(s.tutorial.step,'trace-return');tutorialEvent(s,'dialog-closed');assert.equal(guidance(s).action,'witness');
 tutorialEvent(s,'resident','goat');inspect(s,'goat');tutorialEvent(s,'testimony','goat');tutorialEvent(s,'dialog-closed');assert.equal(s.tutorial.step,'done');assert.equal(phaseIndex(s),2);
});
test('preliminary facts collected out of tutorial order recover on revisit without duplication',()=>{
 const s=createState();inspectPreliminary(s,'home');
 assert.equal(inspectPreliminary(s,'home'),false);assert.equal(s.tutorial.step,'lens');assert.equal(s.preliminary.length,1);
 s.tutorial.step='notebook-return';tutorialEvent(s,'notebook-closed');assert.equal(s.tutorial.step,'prefact');assert.equal(canAdvanceNight(s),false);
 assert.equal(inspectPreliminary(s,'home'),false);assert.equal(s.tutorial.step,'prefact-return');assert.equal(s.preliminary.length,1);tutorialEvent(s,'dialog-closed');assert(canAdvanceNight(s));
});
test('skip at every tutorial step preserves setup and allows a complete case',()=>{
 for(const step of ['lens','place-lens','watch','notebook-before','notebook-entry','notebook-return','prefact','prefact-return','advance','trace','trace-return','witness','ask-witness','witness-return']){
  const s=createState();s.tutorial.step=step;skipTutorial(s);night(s);
  for(const c of s.case.clues)inspect(s,c.location);
  assert(evaluate(s,s.case.culprit,s.case.proofGroups.map(g=>g.find(id=>s.clues.has(id)))).ok);
 }
});
test('night ignores a continuously moved lens and double advance cannot duplicate the crime',()=>{
 for(let i=0;i<3;i++){
  const s=createState(i,{tutorial:false});assert(beginNight(s));assert.equal(beginNight(s),false);
  for(let j=0;j<300;j++){const r=s.residents.find(r=>r.id===s.case.culprit);Object.assign(s.lens,{active:true,x:r.x,y:r.y});update(s,.1);}
  assert.equal(s.flow,'discovery');assert.equal(s.events.filter(e=>e.kind==='crime').length,1);assert.equal(beginNight(s),false);
  acknowledgeCrime(s);run(s,100);assert.equal(s.events.filter(e=>e.kind==='crime').length,1);
 }
});
test('pause freezes night and tutorial clocks; resume has a visible next action',()=>{
 const s=createState(0,{tutorial:false});beginNight(s);run(s,1);s.paused=true;
 const before=structuredClone(s);run(s,20);assert.deepEqual(s,before);assert.equal(guidance(s).action,'resume');
 s.paused=false;run(s,30);assert.equal(s.flow,'discovery');
});
test('restart and next-case setup reset every phase without stale clues, night or tutorial state',()=>{
 for(const phase of ['observe','night','discovery','investigate','accuse','reconstruct','result']){
  const s=createState();s.flow=phase;s.paused=true;s.clues.add('pipe');s.unread.add('pipe');s.nightElapsed=12;
  for(const index of [0,1,2]){const fresh=createState(index);assert.equal(fresh.flow,'observe');assert.equal(fresh.paused,false);assert.equal(fresh.crimeDone,false);assert.equal(fresh.nightElapsed,0);assert.equal(fresh.clues.size,0);assert.equal(fresh.unread.size,0);assert.equal(fresh.tutorial.enabled,index===0);}
 }
});
test('minimum accusation requirements and phase indicator reflect actual game conditions',()=>{
 const s=createState(1);assert(accusationRequirements(s));assert.equal(phaseIndex(s),0);beginNight(s);assert.equal(phaseIndex(s),1);run(s,30);acknowledgeCrime(s);
 assert(accusationRequirements(s));for(const c of s.case.clues.slice(0,3))inspect(s,c.location);assert.equal(accusationRequirements(s),'');
 s.flow='accuse';assert.equal(phaseIndex(s),3);startReconstruction(s);assert.equal(phaseIndex(s),4);for(let i=0;i<210;i++)reconstructionStep(s,.1);assert(s.reconTime>=20);
});
test('every painted resident has distinct walk, watched, carry and caught poses',()=>{
 for(const id of Object.keys(DARK_FRAMES)){
  const r={id},a={walk:1,gait:Math.PI*.6,watch:0,seed:0};assert.equal(characterPose(r,a,0),1);a.gait=Math.PI*1.6;assert.equal(characterPose(r,a,0),2);
  assert.equal(characterPose({...r,watched:true},a,0),3);assert.equal(characterPose({...r,carry:'bread'},a,0),4);assert.equal(characterPose({...r,caught:true},a,0),5);
  assert.equal(DARK_FRAMES[id].length,6);for(const [x,y,w,h,foot]of DARK_FRAMES[id]){assert(x>=0&&y>=0&&x+w<=1536&&y+h<=1024);assert(foot>0&&foot<w);}
 }
});
