import test from 'node:test';
import assert from 'node:assert/strict';
import {ENTRANCES,FOOTPRINTS,findRoute,routeSegmentClear,contains} from '../src/scene-layout.js';
import {CASES} from '../src/content.js';
import {createState,update,intervene,startReconstruction,reconstructionStep,beginNight} from '../src/simulation.js';
import {hitTest,hitCandidates} from '../src/render.js';

test('resident hit areas respect foreground buildings and remain generous on phones',()=>{
 const s={residents:[{id:'pigeon',x:500,y:580}]};
 assert.equal(hitTest(s,{x:500,y:530},390),null); // Building artwork is not a giant hit target.
 s.residents[0].y=684;
 assert.deepEqual(hitTest(s,{x:500,y:635},390),{type:'resident',id:'pigeon'});
 assert.deepEqual(hitTest(s,{x:550,y:674},390),{type:'resident',id:'pigeon'});
});
test('all overlapping residents and entrance targets are returned without fixed priority',()=>{
 const s=createState(0,{tutorial:false});for(const id of ['goat','pigeon'])Object.assign(s.residents.find(r=>r.id===id),{x:830,y:355});
 const hits=hitCandidates(s,{x:830,y:335},1000);for(const id of ['goat','pigeon','cat','home'])assert(hits.some(h=>h.id===id),id);
 assert.equal(new Set(hits.map(h=>h.type+':'+h.id)).size,hits.length);
});

test('the burned entrance is directly inspectable after the first incident',()=>{
 const s={case:{id:'fire'},crimeDone:true,residents:[]};
 assert.deepEqual(hitTest(s,{x:830,y:340},390),{type:'location',id:'home'});
});

test('every entrance is reachable without crossing an illustrated building footprint',()=>{
 for(const [from,a] of Object.entries(ENTRANCES))for(const [to,b] of Object.entries(ENTRANCES)){
  const route=findRoute(a,b);assert.ok(route.length,`${from} to ${to} is unreachable`);
  assert.deepEqual(route.at(-1),b);
  let last=a;for(const p of route){assert.ok(routeSegmentClear(last,p),`${from} to ${to} crosses a building`);last=p;}
 }
});

test('ordinary routines and each manual night keep residents outside buildings',()=>{
 for(let index=0;index<CASES.length;index++){
  const s=createState(index,{tutorial:false});s.lens.active=false;let rang=false;
  for(let frame=0;frame<3600;frame++){
   if(frame===300)beginNight(s);
   if(s.flow==='night'&&!rang){intervene(s,'bell');rang=true;}
   const before=s.residents.map(r=>({x:r.x,y:r.y}));update(s,.1);
   for(const [i,r] of s.residents.entries()){
    assert.ok(FOOTPRINTS.every(f=>!contains(f,r)),`${s.case.id}: ${r.id} inside a building`);
    if(s.flow!=='night')assert.ok(routeSegmentClear(before[i],r),`${s.case.id}: ${r.id} cuts through a corner`);
   }
  }
  assert.ok(rang&&s.crimeDone,`${s.case.id} should finish despite an attempted bell during night`);
 }
});

test('reconstruction follows the same obstacle-free route',()=>{
 for(let index=0;index<CASES.length;index++){
  const s=createState(index);startReconstruction(s);
  let last=null;
  for(let frame=0;frame<180;frame++){
   reconstructionStep(s,.1);const r=s.residents.find(r=>r.id===s.case.culprit);
   if(last)assert.ok(routeSegmentClear(last,r),`${s.case.id} reconstruction intersects a building`);
   last={x:r.x,y:r.y};
  }
 }
});
