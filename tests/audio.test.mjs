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
