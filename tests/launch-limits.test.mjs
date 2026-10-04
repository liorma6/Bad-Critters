import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICES} from '../src/voices.js';
import {recordingSeconds,MAX_RECORDING_SECONDS,MAX_RECORDING_BYTES} from '../src/recorder.js';
import {DubbingAccess} from '../src/dubbing-access.js';
test('every authored line fits a conservative two-times slow delivery allowance',()=>{
 for(const line of VOICES){const words=line.text.trim().split(/\s+/).length;assert(recordingSeconds(line.text)>=words/1.3*2+15, line.id);assert(recordingSeconds(line.text)<=MAX_RECORDING_SECONDS);}
 assert.equal(MAX_RECORDING_SECONDS,180);assert.equal(MAX_RECORDING_BYTES,16*1024*1024);
});
test('a 16 second server response succeeds within the revised client deadline',async()=>{
 const a=new DubbingAccess({fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(Response.json({unlocked:true})),16000);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});})});
 assert.equal(await a.request('checkout',{method:'POST'}),true);
});
