import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {CreatorLibrary,publicMapping,audioExtension,sha256} from '../tools/creator/storage.mjs';
import {creatorCatalogue} from '../tools/creator/catalogue.mjs';
import {startCreatorServer} from '../tools/creator/server.mjs';
import {VOICES} from '../src/content.js';
import {syntheticMicrophone} from './synthetic-microphone.mjs';
const catalogue=creatorCatalogue();
const fixture=async()=>{await mkdir('.cache',{recursive:true});return mkdtemp(resolve('.cache/creator-storage-'));};
const line=catalogue.lines.find(l=>l.id==='snake.greet');
const metadata=(overrides={})=>({lineId:line.id,takeId:randomUUID(),expectedTakeId:null,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,validation:{duration:8,peak:.2,hasSignal:true},...overrides});
const clip=async()=>({bytes:await readFile(syntheticMicrophone()),type:'audio/wav'});
test('creator catalogue covers every live ID once, eight characters plus narrator, branches and shared reuse',()=>{
 assert.equal(catalogue.characters.length,9);assert.equal(catalogue.characters.filter(c=>c.narrator).length,1);assert.equal(catalogue.lines.length,133);assert.equal(new Set(catalogue.lines.map(l=>l.id)).size,133);
 assert.deepEqual(catalogue.lines.map(l=>l.id).sort(),VOICES.map(l=>l.id).sort());assert(catalogue.lines.every(l=>l.cases.length&&l.text&&l.context));
 assert.equal(line.group,'shared');assert.equal(line.cases.length,3);
 for(const id of ['fire','courtyard','balcony'])assert(catalogue.lines.some(l=>l.id==='guide.crime.'+id));
});
test('atomic creator commit, retained source, failed replacement, idempotent retry, concurrency and restart',async()=>{
 const root=await fixture(),audio=await clip();let fail=false;
 const library=new CreatorLibrary({voiceRoot:root,catalogue:async()=>catalogue,beforeCommit:()=>{if(fail)throw Error('Simulated disk failure');}});
 const first=metadata(),entry=await library.save(first,audio,audio),before=await readFile(join(root,'.creator-studio/library.json'));
 assert.equal(sha256(await readFile(join(root,entry.file))),entry.sha256);assert.equal(sha256(await readFile(join(root,entry.sourceFile))),entry.sourceSha256);
 const second=metadata({expectedTakeId:first.takeId});fail=true;await assert.rejects(library.save(second,audio,audio),/Simulated disk failure/);
 assert.deepEqual(await readFile(join(root,'.creator-studio/library.json')),before);assert.equal((await library.playback(line.id)).entry.takeId,first.takeId);
 fail=false;const replacement=await library.save(second,audio,audio);assert.notEqual(replacement.file,entry.file);assert.equal((await library.save(second,audio,audio)).takeId,second.takeId);
 assert.equal((await library.state()).history.length,1);await assert.rejects(library.save(metadata(),audio,audio),error=>error.status===409);
 const reopened=new CreatorLibrary({voiceRoot:root,catalogue:async()=>catalogue});assert.equal((await reopened.playback(line.id)).entry.takeId,second.takeId);
 const state=await reopened.state();assert.equal(publicMapping(state,catalogue.lines)[line.id].sha256,replacement.sha256);
 assert.deepEqual(publicMapping(state,[{...line,fingerprint:'changed'}]),{});
 await assert.rejects(reopened.save(metadata({fingerprint:'old'}),audio,audio),error=>error.status===409);
});
test('creator write boundary rejects paths, mismatched media, silent and stale takes without official changes',async()=>{
 const root=await fixture(),audio=await clip(),library=new CreatorLibrary({voiceRoot:root,catalogue:async()=>catalogue});
 for(const invalid of [metadata({lineId:'../../outside'}),metadata({takeId:'../take'}),metadata({validation:{duration:1,peak:0,hasSignal:false}})])await assert.rejects(library.save(invalid,audio,audio));
 assert.throws(()=>audioExtension('audio/webm',audio.bytes));assert.throws(()=>audioExtension('audio/wav',Buffer.from('RIFF')));assert.deepEqual((await library.state()).entries,{});
});
test('HTTP service binds loopback; Origin/token/Host enforced; private files and write routes unavailable in preview',async()=>{
 const root=await fixture(),audio=await clip();let app=await startCreatorServer({voiceRoot:root,port:0,catalogue:async()=>catalogue});
 try{
  assert.equal(app.server.address().address,'127.0.0.1');const c=await fetch(app.origin+'/creator/api/catalogue').then(r=>r.json());
  const progress={lineId:line.id,characterId:line.characterId,group:'shared',filter:'missing',enhance:true};
  const url=app.origin+'/creator/api/progress';
  for(const headers of [{},{Origin:'https://untrusted.example','X-Creator-Token':c.token},{Origin:app.origin}])assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(progress)})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{const request=http.request(url,{method:'POST',headers:{Origin:app.origin,'X-Creator-Token':c.token,Host:'attacker.example'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);request.end(JSON.stringify(progress));});assert.equal(wrongHost,403);
  assert.equal((await fetch(url,{method:'POST',headers:{Origin:app.origin,'X-Creator-Token':c.token,'Content-Type':'application/json'},body:JSON.stringify(progress)})).status,200);
  const form=new FormData();form.set('metadata',JSON.stringify(metadata()));form.set('playback',new Blob([audio.bytes],{type:audio.type}),'../../outside.wav');form.set('source',new Blob([audio.bytes],{type:audio.type}),'../../outside.wav');
  const saved=await fetch(app.origin+'/creator/api/takes',{method:'POST',headers:{Origin:app.origin,'X-Creator-Token':c.token},body:form});assert.equal(saved.status,200);const entry=(await saved.json()).entry;
  const mapping=await fetch(app.origin+'/assets/voices/available.json').then(r=>r.json());assert.equal(mapping[line.id].file,'assets/voices/'+entry.file);
  const sourceUrl=app.origin+'/creator/api/source/'+line.id+'?take='+entry.takeId;
  const source=await fetch(sourceUrl);assert.equal(source.status,200);assert.equal(sha256(Buffer.from(await source.arrayBuffer())),entry.sourceSha256);
  assert.equal((await fetch(sourceUrl,{headers:{Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(app.origin+'/creator/api/source/'+line.id+'?take='+randomUUID())).status,409);
  assert.equal(sha256(Buffer.from(await (await fetch(app.origin+'/'+mapping[line.id].file)).arrayBuffer())),entry.sha256);
  for(const route of ['/assets/voices/'+entry.sourceFile,'/assets/voices/.creator-studio/library.json','/tools/creator/server.mjs','/.git/config','/creator/api/anything'])assert.equal((await fetch(app.origin+route)).status,404);
  await app.close();app=await startCreatorServer({voiceRoot:root,port:0,catalogue:async()=>catalogue});
  const after=await fetch(app.origin+'/creator/api/catalogue').then(r=>r.json());assert.notEqual(after.token,c.token);assert.equal(after.lines.find(l=>l.id===line.id).status,'recorded');assert.equal(after.progress.lineId,line.id);
 }finally{await app.close();}
});
