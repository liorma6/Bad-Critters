import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioManager} from '../src/audio.js';
import {LINE} from '../src/content.js';
test('missing recording uses exact Hebrew fallback without attempting audio playback',async()=>{
 const fetchBefore=globalThis.fetch,audioBefore=globalThis.Audio;globalThis.fetch=async()=>({ok:true,json:async()=>[]});globalThis.Audio=class{constructor(){throw new Error('Missing audio must not be requested');}};
 const seen=[];const a=new AudioManager(x=>seen.push(x));try{await new Promise(resolve=>setImmediate(resolve));const line=a.say('goat.fire.alibi');assert.equal(line.text,LINE['goat.fire.alibi'].text);assert.equal(seen.at(-1).text,line.text);assert.equal(a.current,null);}finally{a.stop();globalThis.fetch=fetchBefore;globalThis.Audio=audioBefore;}
});
test('a recording rejected by the browser retains the exact subtitle and can be stopped',async()=>{
 const fetchBefore=globalThis.fetch,audioBefore=globalThis.Audio;globalThis.fetch=async()=>({ok:true,json:async()=>['badger.intro']});let paused=false;globalThis.Audio=class{addEventListener(){}play(){return Promise.reject(new Error('blocked'));}pause(){paused=true;}};
 const seen=[],a=new AudioManager(x=>seen.push(x));try{await new Promise(resolve=>setImmediate(resolve));a.say('badger.intro',true);await new Promise(resolve=>setImmediate(resolve));assert.equal(seen.at(-1).text,LINE['badger.intro'].text);a.stop();assert(paused);assert.equal(seen.at(-1),null);}finally{a.stop();globalThis.fetch=fetchBefore;globalThis.Audio=audioBefore;}
});
test('a slow catalogue refresh cannot hold up an already known creator line',async()=>{
 const original=globalThis.fetch;let requests=0,played=false,release;
 globalThis.fetch=()=>++requests===1?Promise.resolve({ok:true,json:async()=>['goat.greet']}):new Promise(resolve=>release=resolve);
 const a=new AudioManager(()=>{});try{await a.ready;a.refreshedAt=0;a.playMedia=()=>played=true;a.say('goat.greet');await new Promise(r=>setTimeout(r,30));assert.equal(played,true);}
 finally{a.stop();release?.({ok:true,json:async()=>[]});globalThis.fetch=original;}
});
test('personal playback does not wait for the creator catalogue at all',async()=>{
 const original=globalThis.fetch;let release,played=false;
 globalThis.fetch=()=>new Promise(resolve=>release=resolve);const a=new AudioManager(()=>{});
 try{a.personalCharacter='goat';a.store={ready:Promise.resolve(),get:()=>({blob:new Blob(['local take'])})};a.playMedia=()=>played=true;a.say('goat.greet');await new Promise(r=>setTimeout(r,30));assert.equal(played,true);}
 finally{a.stop();release?.({ok:true,json:async()=>[]});await a.ready;globalThis.fetch=original;}
});
test('mobile interrupted audio context resumes synchronously from the speech gesture',async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;let resumed=0;globalThis.fetch=async()=>({ok:true,json:async()=>[]});
 globalThis.window={AudioContext:class{constructor(options){assert.equal(options.latencyHint,'interactive');this.state='interrupted';}resume(){resumed++;this.state='running';return Promise.resolve();}}};
 const a=new AudioManager(()=>{});try{a.say('goat.greet');assert.equal(resumed,1);assert.equal(a.context.state,'running');await a.ready;}
 finally{a.stop();globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
