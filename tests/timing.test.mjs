import test from 'node:test';
import assert from 'node:assert/strict';
import {frameSteps} from '../src/timing.js';
import {createState,beginNight,update,startReconstruction,reconstructionStep} from '../src/simulation.js';
test('a throttled visible frame preserves incident duration and reconstruction completion',()=>{for(const fps of [1,15,60]){const s=createState(1,{tutorial:false});beginNight(s);for(let i=0;i<13*fps;i++)for(const dt of frameSteps(1/fps))update(s,dt);assert.equal(s.flow,'discovery');startReconstruction(s);for(let i=0;i<21*fps;i++)for(const dt of frameSteps(1/fps))reconstructionStep(s,dt);assert(s.reconTime>=20);}});
test('invalid and suspended deltas cannot run an unbounded catch-up',()=>{for(const n of [-1,NaN,Infinity])assert.deepEqual(frameSteps(n),[]);assert.equal(frameSteps(600).reduce((a,b)=>a+b,0).toFixed(3),'1.000');});
