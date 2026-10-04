import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {VoiceStore} from '../src/voice-store.js';
import {LINE} from '../src/content.js';
const line=LINE['goat.greet'],other=LINE['cat.greet'];
const take=text=>({blob:new Blob([text],{type:'audio/webm'}),validation:{hasSignal:true,duration:1,peak:.1}});
const validateBlob=async()=>({hasSignal:true,duration:1,peak:.1});
test('new drafts survive reload without replacing approved audio; cancel and atomic approve preserve the old take on failure',async()=>{
 const indexedDB=new IDBFactory(),a=new VoiceStore({indexedDB,validateBlob});await a.ready;await a.put(line,take('approved'));await a.putDraft(line,take('draft'));
 assert.equal(await a.get(line).blob.text(),'approved');a.db.close();const b=new VoiceStore({indexedDB,validateBlob});await b.ready;assert.equal(await b.get(line).blob.text(),'approved');assert.equal(await b.draft(line).blob.text(),'draft');
 const atomic=b.atomicTakes.bind(b);b.atomicTakes=async()=>{throw Error('Quota')};assert.equal(await b.approve(line),false);assert.equal(await b.get(line).blob.text(),'approved');b.atomicTakes=atomic;
 assert(await b.discardDraft(line.id));assert.equal(await b.draft(line).blob.text(),'approved');await b.putDraft(line,take('replacement'));assert(await b.approve(line));assert.equal(await b.get(line).blob.text(),'replacement');assert.equal(b.hasDraft(line),false);b.db.close();
});
test('failed deletion retains approved and draft after reopening; successful deletion removes only the selected line',async()=>{
 const indexedDB=new IDBFactory(),a=new VoiceStore({indexedDB,validateBlob});await a.ready;await a.put(line,take('approved'));await a.putDraft(line,take('draft'));await a.put(other,take('other'));
 const atomic=a.atomicTakes.bind(a);a.atomicTakes=async()=>{throw Error('I/O')};assert.equal(await a.delete(line.id),false);assert(a.get(line));assert(a.hasDraft(line));a.db.close();
 const b=new VoiceStore({indexedDB,validateBlob});await b.ready;assert.equal(await b.get(line).blob.text(),'approved');assert(b.hasDraft(line));assert(await b.delete(line.id));assert.equal(b.get(line),null);assert.equal(b.hasDraft(line),false);assert(b.get(other));b.db.close();
});
test('version 2 approved takes and pending drafts migrate without loss',async()=>{
 const indexedDB=new IDBFactory(),request=indexedDB.open('old',2);const old=await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>{request.result.createObjectStore('takes',{keyPath:'lineId'});request.result.createObjectStore('sets',{keyPath:'setId'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 await new Promise(resolve=>{const tx=old.transaction('takes','readwrite');for(const [l,reviewed]of [[line,true],[other,false]])tx.objectStore('takes').put({...take(reviewed?'approved':'draft'),lineId:l.id,characterId:l.resident,scriptVersion:l.scriptVersion,fingerprint:l.fingerprint,performanceKey:l.performanceKey,mimeType:'audio/webm',validity:'valid',reviewed});tx.oncomplete=resolve;});old.close();
 const s=new VoiceStore({name:'old',indexedDB,validateBlob});await s.ready;assert.equal(await s.get(line).blob.text(),'approved');assert.equal(await s.draft(other).blob.text(),'draft');assert.equal(s.get(other),null);assert(s.hasDraft(other));s.db.close();
});
