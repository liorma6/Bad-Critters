import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sha256} from '../tools/creator/storage.mjs';
const {directory}=JSON.parse(await readFile('.cache/voice-onset-review.json','utf8'));
const review=JSON.parse(await readFile(join(directory,'review.json'),'utf8'));
const plan=JSON.parse(await readFile(join(directory,'installation-plan.json'),'utf8'));
const live=JSON.parse(await readFile('assets/voices/.creator-studio/library.json','utf8'));
const game='http://127.0.0.1:4174',html=await(await fetch(game)).text();
const release=html.match(/<base href="([^"]+)"/)[1],productionBase=game+release;
let audioFilesChecked=0;
for(const base of ['http://127.0.0.1:4175/',productionBase]){
 const mapping=await(await fetch(base+'assets/voices/available.json')).json();
 for(const row of review.entries){
  const installed=mapping[row.lineId];assert.equal(installed.sha256,row.copySha256,row.lineId);
  assert(Math.abs(installed.duration-row.copyDuration)<.0001);
  const response=await fetch(base+installed.file);assert(response.ok);
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())),row.copySha256);audioFilesChecked++;
 }
}
for(const row of plan.entries){
 assert(live.history.some(e=>e.takeId===row.previous.takeId));
 for(const [path,digest] of [[row.previous.file,row.previous.sha256],[row.previous.archiveFile,row.previous.sha256],[row.previous.sourceFile,row.previous.sourceSha256]])assert.equal(sha256(await readFile(join('assets/voices',path))),digest);
 assert.equal(live.entries[row.lineId].sourceSha256,row.previous.sourceSha256);
}
for(const person of review.characters){
 const id=person.id+'.greet',e=live.entries[id],source=await fetch('http://127.0.0.1:4175/creator/api/source/'+id+'?take='+e.takeId);assert(source.ok);
 assert.equal(sha256(Buffer.from(await source.arrayBuffer())),e.sourceSha256);
}
const reviewPage=await(await fetch('http://127.0.0.1:4177/')).text();assert(reviewPage.includes('הגרסאות המקוצרות הוכנסו למשחק'));
const result={verifiedAt:new Date().toISOString(),release,audioFilesChecked,installedCopies:plan.entries.length,unchanged:review.entries.length-plan.entries.length,originalPlaybackAndSourcePreserved:true,sourceEditingAvailable:true,liveRecordings:Object.keys(live.entries).length};
await writeFile(join(directory,'installation-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
