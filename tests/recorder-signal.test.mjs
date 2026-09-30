import test from 'node:test';
import assert from 'node:assert/strict';
import {signalStats,meterLevel} from '../src/recorder.js';
test('silence, DC, and invalid samples are not usable audio',()=>{
 for(const value of [0,.15,NaN])assert.equal(signalStats([new Float32Array(4800).fill(value)],48000).hasSignal,false);
});
test('quiet speech-sized signal survives surrounding silence and has a visible meter',()=>{
 const samples=new Float32Array(48000*3);
 for(let i=48000;i<57600;i++)samples[i]=.00003*Math.sin(2*Math.PI*220*i/48000);
 const signal=signalStats([samples],48000);assert.equal(signal.hasSignal,true);assert(signal.maxRms<.00003);assert(meterLevel(signal.maxRms)>.05);
});
