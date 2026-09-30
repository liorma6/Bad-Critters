import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,update} from '../src/simulation.js';
import {characterPose} from '../src/characters.js';

test('goat checks a complaint list; lens hides it and records the matching observation without a clue',()=>{
 const s=createState(0,{tutorial:false}),goat=s.residents.find(r=>r.id==='goat');goat.wait=20;
 update(s,.1);assert.equal(goat.action,'check-list');
 assert.equal(characterPose(goat,{walk:0,watch:0,seed:0},7),4);
 s.lens={x:goat.x,y:goat.y,radius:83,active:true};update(s,.1);
 assert.equal(goat.action,'pretend');assert.equal(characterPose(goat,{walk:0,watch:1,seed:0},7),3);
 assert(s.events.some(e=>e.text.includes('מסתיר פנקס תלונות')));assert.equal(s.clues.size,0);
 s.lens.active=false;update(s,.1);assert.equal(goat.action,'check-list');assert.equal(s.clues.size,0);
});
