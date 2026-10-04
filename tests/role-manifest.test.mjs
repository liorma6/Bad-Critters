import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {IDBFactory} from 'fake-indexeddb';
import {CASES,RESIDENTS,LINE,VOICES} from '../src/content.js';
import {CASE_RECORDING_MANIFEST,COMMON_DIALOGUE_EVENTS,QUICK_ROLES,requiredLines,roleManifest,dialogueLine,assertDialogueManifest,estimateRecordingMinutes} from '../src/dialogue-manifest.js';
import {VoiceStore,compatibleTake} from '../src/voice-store.js';
import {AudioManager} from '../src/audio.js';
const validation={hasSignal:true,duration:1,maxRms:.1,peak:.2};
const take=()=>({blob:new Blob(['unit-fixture'],{type:'audio/webm'}),validation});
const store=()=>new VoiceStore({indexedDB:new IDBFactory(),validateBlob:async()=>validation});

test('multi-character casting requires complete roles, includes narrator and never substitutes creator on personal failure',async()=>{
 const previousFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>[]});
 const s=store(),audio=new AudioManager(()=>{});audio.store=s;await s.ready;await audio.ready;
 try{
  const ids=Object.keys(CASE_RECORDING_MANIFEST.fire.characters);
  for(const id of ids)for(const line of requiredLines('fire',id))await s.put(line,take(),{caseId:'fire'});
  audio.configureCase('fire',ids);assert.equal(audio.personalCharacters.size,8);assert.equal(audio.casting.requirements.length,88);
  assert(audio.isPersonal('guide'));assert(audio.isPersonal('cat'));
  await s.delete('cat.greet');audio.say('cat.greet');await new Promise(r=>setImmediate(r));assert(audio.repairNeeded.has('cat.greet'));assert.equal(audio.voiceSourceKind,'personal-subtitles');
  assert.throws(()=>audio.configureCase('fire',ids),/Incomplete personal role/);
  audio.configureCase('balcony',null);assert.equal(audio.personalCharacters.size,0);assert.equal(audio.isPersonal('cat'),false);
 }finally{audio.stop();s.db.close();globalThis.fetch=previousFetch;}
});

test('every authored line has finite reachable coverage; every quick part is complete, safe and <= 6',()=>{
 assert(assertDialogueManifest());const union=new Set();
 for(const c of CASES){
  const quick=roleManifest(c.id,QUICK_ROLES[c.id]);assert.equal(quick.lineIds.length,5);assert.equal(quick.spoilers,false);
  for(const r of RESIDENTS){
   const role=roleManifest(c.id,r.id);assert.equal(role.lineIds.length,13);assert.equal(role.spoilers,true);
   for(const event of Object.keys(COMMON_DIALOGUE_EVENTS))assert(role.lineIds.includes(dialogueLine(c.id,r.id,event).id));
   for(const event of ['aftermath','alibi','detail','accusation'])assert(role.lineIds.includes(dialogueLine(c.id,r.id,event).id));
   if(c.culprit===r.id)assert.equal(dialogueLine(c.id,r.id,'reconstruction').id,`${r.id}.${c.id}.detail`);
   assert(!role.lineIds.some(id=>CASES.some(other=>other.id!==c.id&&id.includes(`.${other.id}.`))));
  }
  for(const role of Object.values(CASE_RECORDING_MANIFEST[c.id].characters))for(const id of role.lineIds)union.add(id);
 }
 assert.deepEqual(union,new Set(VOICES.map(l=>l.id)));assert.throws(()=>dialogueLine('fire','goat','unwritten-branch'));
});
test('gameplay speech goes through events, not dynamic strings or direct audio URLs',async()=>{
 const main=await readFile('src/main.js','utf8'),simulation=await readFile('src/simulation.js','utf8');
 assert(!/audio\.(say|ambient)\(/.test(main));assert(!/new Audio\s*\(|speechSynthesis|\.mp3|\.webm/.test(main));
 assert(!/line:\s*`/.test(simulation));
 for(const [whole,event] of main.matchAll(/data-flavor="([^"]+)"/g))assert(event in COMMON_DIALOGUE_EVENTS,whole);
 for(const [whole,event] of main.matchAll(/data-question="([^"]+)"/g))for(const c of CASES)for(const r of RESIDENTS)assert(roleManifest(c.id,r.id).events[event],whole);
});
test('incomplete/unchecked takes remain drafts and resume survives reopening storage',async()=>{
 const s=store();await s.ready;const lines=requiredLines('fire','badger');
 await s.putDraft(lines[0],take(),{caseId:'fire'});assert.equal(s.get(lines[0]),null);assert(s.draft(lines[0]));assert.equal(s.coverage('fire','badger').newCount,4);assert.equal(s.coverage('fire','badger').complete,false);
 await s.checkpoint('fire','badger',lines[2].id);const resumed=new VoiceStore({indexedDB:s.indexedDB,validateBlob:s.validateBlob});await resumed.ready;assert.equal(resumed.resumeIndex('fire','badger'),2);assert(resumed.draft(lines[0]));
 await resumed.approve(lines[0],{caseId:'fire'});for(const line of lines.slice(1))await resumed.put(line,take(),{caseId:'fire'});
 assert(await resumed.verifyRole('fire','badger'));assert.equal(resumed.sets.get('fire:badger').status,'complete');
 assert.equal(resumed.coverage('courtyard','badger').approved,3);assert.equal(resumed.coverage('courtyard','badger').newCount,2);assert.equal(resumed.coverage('courtyard','badger').complete,false);
 await resumed.markPlaybackFailure(lines[0]);assert.equal(resumed.sets.get('fire:badger').status,'draft');assert.equal(resumed.coverage('fire','badger').complete,false);
 const failedSet=await resumed.transaction('readonly',s=>s.get('fire:badger'),'sets');assert.equal(failedSet.status,'draft');
 s.db.close();resumed.db.close();
});
test('text, version, character and performance context invalidate reuse; corruption blocks activation',async()=>{
 const s=store();await s.ready;const line=LINE['goat.greet'];await s.put(line,take());const saved=s.get(line);
 for(const changed of [{scriptVersion:99},{fingerprint:'changed-text'},{performanceKey:'different-delivery'},{resident:'cat'}])assert(!compatibleTake(saved,{...line,...changed}));
 for(const required of requiredLines('fire','goat'))await s.put(required,take());s.validateBlob=async()=>{throw Error('Decode failed');};assert.equal(await s.verifyRole('fire','goat'),false);assert.equal(s.coverage('fire','goat').approved,0);s.db.close();
});
test('legacy signature migration verifies sound and preserves only explicitly unchanged scripts',async()=>{
 const indexedDB=new IDBFactory();await new Promise((resolve,reject)=>{const req=indexedDB.open('legacy',1);req.onupgradeneeded=()=>req.result.createObjectStore('takes',{keyPath:'lineId'});req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('takes','readwrite');for(const id of ['goat.greet','badger.intro'])tx.objectStore('takes').put({lineId:id,characterId:id.split('.')[0],scriptVersion:id==='goat.greet'?2:1,mimeType:'audio/webm',blob:take().blob,acceptedAt:'2026-01-01'});tx.oncomplete=()=>{db.close();resolve();};};});
 let decoded=0;const s=new VoiceStore({name:'legacy',indexedDB,validateBlob:async()=>{decoded++;return validation;}});await s.ready;assert(s.get(LINE['goat.greet']));assert(!s.get(LINE['badger.intro']));assert.equal(decoded,1);s.db.close();
});

test('an edited line is marked for rerecording after reload while unchanged personal takes survive',async()=>{
 const s=store();await s.ready;const lines=requiredLines('fire','goat');
 for(const line of lines)await s.put(line,take(),{caseId:'fire'});
 const line=LINE['goat.secret'],old={...s.get(line),scriptVersion:line.scriptVersion-1,fingerprint:'previous-text'};
 s.takes.set(line.id,old);await s.persist(old);
 const reopened=new VoiceStore({indexedDB:s.indexedDB,validateBlob:s.validateBlob});await reopened.ready;
 assert(reopened.outdated(line));assert.equal(reopened.get(line),null);assert.equal(reopened.draft(line),null);
 assert.equal(reopened.coverage('fire','goat').rerecordCount,1);assert.equal(reopened.coverage('fire','goat').approved,12);
 assert.equal(reopened.sets.get('fire:goat').status,'draft');assert(reopened.get(LINE['goat.greet']));
 assert.equal((await reopened.transaction('readonly',st=>st.get('fire:goat'),'sets')).status,'draft');
 await reopened.put(line,take(),{caseId:'fire'});assert.equal(reopened.coverage('fire','goat').rerecordCount,0);assert(reopened.coverage('fire','goat').complete);
 s.db.close();reopened.db.close();
});
test('personal failure never substitutes creator audio; creator casting is reset explicitly per case',async()=>{
 const previousFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({})});const s=store();await s.ready;for(const line of requiredLines('fire','goat'))await s.put(line,take());
 const audio=new AudioManager(()=>{});audio.store=s;await audio.ready;audio.configureCase('fire','goat');assert.equal(audio.casting.setId,'fire:goat');
 audio.available.add('goat.greet');audio.creatorFiles['goat.greet']={file:'creator.wav',scriptVersion:2};const paths=[];audio.playMedia=(url,line,generation,finish,fallback)=>{paths.push(url);fallback();};
 audio.speak('intro','goat');await new Promise(r=>setImmediate(r));assert(paths.every(p=>p.startsWith('blob:')));assert.equal(paths.length,1);assert(audio.repairNeeded.has('goat.greet'));
 assert.throws(()=>audio.configureCase('courtyard','goat'),/Incomplete/);audio.configureCase('courtyard',null);assert.equal(audio.personalCharacter,null);assert.equal(audio.casting.caseId,'courtyard');audio.stop();s.db.close();globalThis.fetch=previousFetch;
});
test('estimates account for script length, review and per-take overhead',()=>{const short=[{text:'שלום שכן'}],long=[{text:Array(120).fill('שלום').join(' ')}];assert(estimateRecordingMinutes(long)>estimateRecordingMinutes(short));assert(estimateRecordingMinutes([],long)>=1);});

test('explicit approval requires a committed recording and failed storage leaves a retriable draft',async()=>{
 const s=store();await s.ready;const line=requiredLines('fire','badger')[0];
 await s.putDraft(line,take(),{caseId:'fire'});const persist=s.atomicTakes.bind(s);s.atomicTakes=async()=>{throw Error('Storage failed');};
 assert.equal(await s.approve(line,{caseId:'fire'}),false);assert.equal(s.get(line),null);assert(s.draft(line));
 const stored=await s.transaction('readonly',st=>st.get(line.id),'drafts');assert.equal(stored.reviewed,false);
 s.atomicTakes=persist;assert.equal(await s.approve(line,{caseId:'fire'}),true);assert(s.get(line));
 const reopened=new VoiceStore({indexedDB:s.indexedDB,validateBlob:s.validateBlob});await reopened.ready;assert(reopened.get(line));
 s.db.close();reopened.db.close();
});
