import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {VoiceStore,compatibleTake} from '../src/voice-store.js';
import {SIGNATURE_SETS,CASE_CAST,SIGNATURE_TRIGGERS} from '../src/signature-lines.js';
import {VOICES,LINE,CASES,RESIDENTS} from '../src/content.js';
import {recordingType,microphoneMessage} from '../src/recorder.js';
import {mouthState,speech,resetSpeech} from '../src/speech-animation.js';
const take=(text='test')=>({blob:new Blob([text],{type:'audio/webm;codecs=opus'}),duration:3,validation:{hasSignal:true,duration:3,maxRms:.1,peak:.2},processing:{enhance:false,noiseSuppression:true}});
test('six distinct reusable signature subsets remain within the full principal roles',()=>{
 for(const r of RESIDENTS){const set=SIGNATURE_SETS[r.id];assert.equal(set.length,6);assert.deepEqual(set.map(l=>l.key),['greet','watched','complaint','boast','question','arrival']);for(const s of set){const l=LINE[s.id];assert(l.personal);assert(l.hint);assert(l.direction);assert.equal(l.scriptVersion,s.scriptVersion);assert.equal(l.context,SIGNATURE_TRIGGERS[l.key]);assert(!/\.secret|\.detail|\.alibi/.test(l.id));}for(const c of CASES){assert(CASE_CAST[c.id].includes(r.id));for(const key of ['comment','alibi','detail'])assert(LINE[`${r.id}.${c.id}.${key}`]?.essential,`${r.id} must have substantive dialogue in ${c.id}`);}}
 assert.equal(VOICES.filter(l=>l.personal).length,126);assert.match(LINE['goat.boast'].text,/כלבת, צהבת וזהבת/);assert.match(LINE['cat.complaint'].text,/אפשר\.\.\./);
});
test('accepted takes survive reload, replace and delete; incompatible versions never play',async()=>{
 const indexedDB=new IDBFactory(),name='test-takes',a=new VoiceStore({name,indexedDB});await a.ready;const line=LINE['goat.greet'];assert(await a.put(line,take()));assert.equal(a.count('goat'),1);
 const b=new VoiceStore({name,indexedDB});await b.ready;assert.equal(await b.get(line).blob.text(),'test');assert(!b.get({...line,scriptVersion:99}));assert(!compatibleTake(b.get(line),{...line,resident:'cat'}));
 assert(await b.put(line,take('replacement')));const c=new VoiceStore({name,indexedDB});await c.ready;assert.equal(await c.get(line).blob.text(),'replacement');await c.delete(line.id);const d=new VoiceStore({name,indexedDB});await d.ready;assert.equal(d.count('goat'),0);
 for(const s of [a,b,c,d])s.db.close();
});
test('storage failure retains a usable session take and never prevents play',async()=>{
 const warnings=[],s=new VoiceStore({indexedDB:null,onWarning:m=>warnings.push(m)});await s.ready;assert.equal(await s.put(LINE['cat.greet'],take()),false);assert(s.get(LINE['cat.greet']));assert(warnings.length);await s.delete('cat.greet');assert.equal(s.count('cat'),0);
});
test('delete character leaves other saved sets reusable',async()=>{const s=new VoiceStore({indexedDB:new IDBFactory()});await s.ready;await s.put(LINE['cat.greet'],take());await s.put(LINE['goat.greet'],take());await s.deleteCharacter('cat');assert.equal(s.count('cat'),0);assert.equal(s.count('goat'),1);s.db.close();});
test('runtime format detection handles Chromium, Safari, Firefox and browser default',()=>{
 for(const type of ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'])assert.equal(recordingType({isTypeSupported:t=>t===type}),type);
 assert.equal(recordingType({isTypeSupported:()=>false}),'');assert.equal(recordingType(undefined),'');assert.match(microphoneMessage({name:'NotAllowedError'}),/נדחתה/);
});
test('voice RMS has four states, exact silence closes the mouth, scene reset clears speaker',()=>{assert.deepEqual([0,.02,.06,.15].map(mouthState),[0,1,2,3]);speech.resident='goat';speech.mouth=3;resetSpeech();assert.deepEqual(speech,{resident:null,mouth:0,level:0});});
