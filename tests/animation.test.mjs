import test from 'node:test';
import assert from 'node:assert/strict';
import {Animator,GAITS} from '../src/animation.js';
import {createState,update,intervene} from '../src/simulation.js';

test('animation never changes authored simulation state',()=>{
 const s=createState(),a=new Animator();s.lens.active=false;
 for(let i=0;i<600;i++){update(s,1/60);const before=structuredClone(s);a.update(s,1/60);assert.deepEqual(s,before);}
});
test('pause freezes rigs, particles, atmosphere and presentation time',()=>{
 const s=createState(),a=new Animator();a.update(s,.1);const before=JSON.stringify(a);
 a.update(s,.1,false);assert.equal(JSON.stringify(a),before);
});
test('walk phase is driven by distance, with a distinct stride per species',()=>{
 const s=createState(),a=new Animator();a.update(s,0);const phases=new Map([...a.rigs].map(([id,r])=>[id,r.gait]));
 for(const r of s.residents)r.x+=20;a.update(s,.1);
 for(const r of s.residents)assert(Math.abs(a.rigs.get(r.id).gait-phases.get(r.id)-20/GAITS[r.id].stride*Math.PI*2)<1e-9);
});
test('walking stops when an actor stays still even if its action still says gather',()=>{
 const s=createState(),a=new Animator(),r=s.residents[0];a.update(s,.1);r.action='gather';r.x+=5;a.update(s,.1);
 assert(a.rigs.get(r.id).walk>.5);for(let i=0;i<20;i++)a.update(s,.1);assert(a.rigs.get(r.id).walk<.001);
});
test('being watched triggers one startle and blends into the watched pose',()=>{
 const s=createState(),a=new Animator(),r=s.residents[0];a.update(s,.1);r.watched=true;a.update(s,.1);
 assert(a.rigs.get(r.id).startle>0);assert.equal(a.particles.filter(p=>p.kind==='surprise').length,3);
 for(let i=0;i<10;i++)a.update(s,.1);assert.equal(a.rigs.get(r.id).startle,0);assert(a.rigs.get(r.id).watch>.99);
});
test('case changes reset animation and reconstruction teleports do not slide across the map',()=>{
 const s=createState(),a=new Animator();a.update(s,.1);s.residents[0].x+=300;a.update(s,.1);
 assert.equal(a.rigs.get(s.residents[0].id).x,s.residents[0].x);
 const fresh=createState(2);a.update(fresh,0);assert.equal(a.clock,0);assert.equal(a.particles.length,0);assert.equal(a.rigs.get(fresh.residents[0].id).x,fresh.residents[0].x);
});
test('presentation effects follow actual intervention budgets and stay bounded',()=>{
 const s=createState(),a=new Animator();a.update(s,.1);intervene(s,'bell');intervene(s,'sprinkler');a.update(s,.1);
 assert.equal(a.bellAge,0);assert.equal(a.waterAge,0);
 for(let i=0;i<200;i++)a.emit({x:0,y:0,vx:0,vy:0,kind:'dust',life:.2,size:2});assert.equal(a.particles.length,100);
 for(let i=0;i<5;i++)a.update(s,.1);assert.equal(a.particles.length,0);
});
test('turning and animation values stay finite through changes of direction and bad frame deltas',()=>{
 const s=createState(),a=new Animator();a.update(s,.1);
 for(let i=0;i<100;i++){s.residents[0].x+=i%2?2:-2;a.update(s,1/60);}
 a.update(s,NaN);a.update(s,Infinity);a.update(s,-1);
 for(const rig of a.rigs.values())for(const value of Object.values(rig))if(typeof value==='number')assert(Number.isFinite(value));
});
