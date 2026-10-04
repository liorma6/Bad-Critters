import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,update,beginNight,acknowledgeCrime,inspect,inspectPreliminary,intervene,evaluate} from '../src/simulation.js';
import {snapshotInvestigation,restoreInvestigation,InvestigationSave} from '../src/investigation-save.js';
const roundtrip=(s,ui)=>restoreInvestigation(JSON.parse(JSON.stringify(snapshotInvestigation(s,ui))));
test('entrance notice steps resume and old observation saves recover the missing tutorial step without losing progress',()=>{
 const old=createState();old.tutorial.step='advance';old.notes='הערה קיימת';old.observations=[{id:'watch-goat',text:'תצפית קיימת'}];
 const recovered=roundtrip(old).state;assert.equal(recovered.tutorial.step,'prefact');assert.equal(recovered.notes,old.notes);assert.deepEqual(recovered.observations,old.observations);assert.equal(old.tutorial.step,'advance');
 assert.equal(roundtrip(recovered).state.tutorial.step,'prefact');inspectPreliminary(recovered,'home');
 const reading=roundtrip(recovered).state;assert.equal(reading.tutorial.step,'prefact-return');assert.equal(reading.preliminary.length,1);assert.equal(inspectPreliminary(reading,'home'),false);assert.equal(reading.preliminary.length,1);
 reading.tutorial.step='advance';assert.equal(roundtrip(reading).state.tutorial.step,'advance');assert(beginNight(reading));assert.equal(roundtrip(reading).state.flow,'night');
 old.flow='night';assert.equal(roundtrip(old).state.flow,'night');assert.equal(roundtrip(old).state.tutorial.step,'advance');
});
test('active investigation restores observation clocks, resident routes, interventions and tutorial exactly',()=>{
 const s=createState(0,{tutorial:false});for(let i=0;i<300;i++)update(s,.1);intervene(s,'bell');s.notes='הערה שצריך לזכור';s.conversations=new Set(['goat:intro']);
 const r=roundtrip(s).state;assert.equal(r.time,s.time);assert.equal(r.bell,1);assert.equal(r.notes,s.notes);assert.deepEqual(r.residents,s.residents);assert.deepEqual(r.events,s.events);assert.deepEqual(r.conversations,s.conversations);
 update(r,.1);assert.equal(r.bell,1);assert(r.time<s.time+.11);
 const training=createState();training.tutorial.step='watch';training.tutorial.watchSeconds=1.3;assert.equal(roundtrip(training).state.tutorial.watchSeconds,1.3);
});
test('night resumes without duplicating the crime and all three investigations preserve evidence and accusation',()=>{
 for(let index=0;index<3;index++){
  let s=createState(index,{tutorial:false});beginNight(s);for(let i=0;i<75;i++)update(s,.1);s=roundtrip(s).state;
  for(let i=0;i<180;i++)update(s,.1);assert.equal(s.events.filter(e=>e.kind==='crime').length,1);acknowledgeCrime(s);
  for(const c of s.case.clues)inspect(s,c.location);s.notes='השערה אישית';s.flow='accuse';const chosen=s.case.proofGroups.map(g=>g.find(id=>s.clues.has(id)));
  const r=roundtrip(s,{chosen,selected:s.case.culprit,casting:['goat']});assert.equal(r.state.flow,'accuse');assert.equal(r.state.notes,s.notes);assert.deepEqual(r.state.clues,s.clues);assert.deepEqual(r.ui.chosen,chosen);assert.equal(evaluate(r.state,r.ui.selected,r.ui.chosen).ok,true);assert.deepEqual(r.ui.casting,['goat']);
 }
});
test('corrupt and future saves are retained; failed writes leave the previous save and legacy summary intact',()=>{
 const values=new Map([['summary','{"completed":{"fire":{}}}'],['active','{broken']]);let fail=false;
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('Quota');values.set(k,v);}};
 const saved=new InvestigationSave(storage,'active');assert.equal(saved.read().status,'damaged');assert.equal(saved.write(createState(),{}),false);assert.equal(values.get('active'),'{broken');
 assert(saved.begin());assert([...values.values()].includes('{broken'));assert(saved.write(createState(),{}));const previous=values.get('active');fail=true;assert.equal(saved.write(createState(1),{}),false);assert.equal(values.get('active'),previous);assert.equal(values.get('summary'),'{"completed":{"fire":{}}}');
 assert.throws(()=>restoreInvestigation({...snapshotInvestigation(createState()),version:99}));
});
