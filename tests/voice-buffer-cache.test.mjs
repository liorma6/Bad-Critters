import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceBufferCache} from '../src/voice-buffer-cache.js';
const context={decodeAudioData:async data=>({length:new Uint8Array(data)[0],numberOfChannels:1})};
const response=n=>({ok:true,arrayBuffer:async()=>new Uint8Array([n]).buffer});
test('voice buffers coalesce downloads, prioritize clicked lines, and bound concurrent network work',async()=>{
 const calls=[],pending=[];const c=new VoiceBufferCache({fetcher:async key=>{calls.push(key);return new Promise(resolve=>pending.push(resolve));}});
 const first=c.load('one',context),second=c.load('two',context),third=c.load('three',context),fourth=c.load('four',context);
 assert.equal(c.load('one',context),first);c.load('four',context,{priority:true});assert.deepEqual(calls,['one','two']);
 pending.shift()(response(4));await first;await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['one','two','four']);
 pending.shift()(response(4));await second;await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['one','two','four','three']);
 pending.shift()(response(4));pending.shift()(response(4));await Promise.all([third,fourth]);assert.equal(c.active,0);c.clear();
});
test('decoded voice memory stays bounded and recently used lines survive eviction',async()=>{
 const c=new VoiceBufferCache({maxBytes:32,fetcher:async()=>response(4)});await c.load('one',context);await c.load('two',context);c.get('one');await c.load('three',context);
 assert(c.get('one'));assert.equal(c.get('two'),null);assert(c.get('three'));assert.equal(c.bytes,32);
 const old=new Blob([new Uint8Array([4])]),replacement=new Blob([new Uint8Array([4])]);await c.load(old,context);assert.equal(c.get(replacement),null);c.clear();assert.equal(c.bytes,0);
});
test('case change cancels queued work and late responses cannot refill an obsolete cache',async()=>{
 let release;const c=new VoiceBufferCache({concurrency:1,fetcher:async()=>new Promise(r=>release=r)}),old=c.load('old',context),queued=c.load('queued',context);
 c.clear();assert.equal(await old,null);assert.equal(await queued,null);release(response(4));await new Promise(r=>setImmediate(r));assert.equal(c.entries.size,0);assert.equal(c.active,0);
});
