import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha256,readLibrary,compatible} from '../tools/creator/storage.mjs';
import {readPcm16} from './voice-onset-tools.mjs';

// Install only the exact reviewed files, through the running studio's serialized
// save API. Its compare-and-swap preserves concurrent recordings and progress.
const config=JSON.parse(await readFile('.cache/voice-onset-review.json','utf8'));
const review=JSON.parse(await readFile(join(config.directory,'review.json'),'utf8'));
const voiceRoot=resolve('assets/voices'),origin='http://127.0.0.1:4175';
const catalogue=await(await fetch(origin+'/creator/api/catalogue')).json();
assert(catalogue.token,'Studio must be running');
const initial=await readLibrary(voiceRoot),planPath=join(config.directory,'installation-plan.json');
let plan;
try{plan=JSON.parse(await readFile(planPath,'utf8'));}
catch(error){
 if(error.code!=='ENOENT')throw error;
 plan={createdAt:new Date().toISOString(),before:initial,entries:review.entries.filter(e=>e.cutSamples>0).map(e=>({lineId:e.lineId,takeId:randomUUID(),previous:initial.entries[e.lineId],copySha256:e.copySha256}))};
}
const prepared=[];
for(const item of review.entries){
 const current=initial.entries[item.lineId],planned=plan.entries.find(e=>e.lineId===item.lineId);
 const original=planned?.previous||current,line=catalogue.lines.find(e=>e.id===item.lineId);
 assert(compatible(original,line),'Script changed: '+item.lineId);
 assert.equal(original.sha256,item.originalSha256,'Original changed: '+item.lineId);
 assert(current.takeId===original.takeId||(current.takeId===planned?.takeId&&current.sha256===item.copySha256),'Newer recording exists: '+item.lineId);
 const bytes=await readFile(join(config.directory,item.copy));
 assert.equal(sha256(bytes),item.copySha256);
 const saved=await readFile(join(voiceRoot,original.file));
 assert.equal(sha256(saved),item.originalSha256);
 assert.equal(sha256(await readFile(join(config.directory,item.original))),item.originalSha256);
 const source=await readFile(join(voiceRoot,original.sourceFile));
 assert.equal(sha256(source),original.sourceSha256);
 assert.equal(sha256(await readFile(join(config.backup,original.sourceFile))),original.sourceSha256);
 assert.equal(sha256(await readFile(join(voiceRoot,original.archiveFile))),item.originalSha256);
 const pcm=readPcm16(bytes),before=readPcm16(saved);
 assert.deepEqual(pcm.data,before.data.subarray(item.cutSamples*before.blockAlign));
 if(!planned)continue;
 assert.equal(planned.copySha256,item.copySha256);
 let peak=0;for(let i=0;i<pcm.data.length;i+=2)peak=Math.max(peak,Math.abs(pcm.data.readInt16LE(i)/32768));
 const oldTrim=original.processing.trim||{start:0,end:0,sourceDuration:before.duration};
 const metadata={...line,lineId:item.lineId,takeId:planned.takeId,expectedTakeId:original.takeId,validation:{hasSignal:peak>1e-5,duration:pcm.duration,peak},processing:{...original.processing,trim:{...oldTrim,start:oldTrim.start+item.cutSeconds}}};
 // Progress is intentionally omitted; the studio keeps the user's current line.
 delete metadata.entry;delete metadata.status;
 assert(Math.abs(metadata.processing.trim.sourceDuration-metadata.processing.trim.start-metadata.processing.trim.end-pcm.duration)<.02);
 prepared.push({item,planned,original,metadata,bytes,source});
}
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({verifiedCopies:review.entries.length,toReplace:prepared.length,unchanged:review.entries.length-prepared.length,originalsAndBackupsVerified:true}));
}else{
 try{await writeFile(planPath,JSON.stringify(plan,null,2),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
 const installed=[];
 for(const row of prepared){
  const form=new FormData();form.set('metadata',JSON.stringify(row.metadata));
  form.set('playback',new Blob([row.bytes],{type:'audio/wav'}),'playback.wav');
  form.set('source',new Blob([row.source],{type:row.original.sourceMimeType}),'source.webm');
  const response=await fetch(origin+'/creator/api/takes',{method:'POST',headers:{Origin:origin,'X-Creator-Token':catalogue.token},body:form});
  const result=await response.json();assert(response.ok,`${row.item.lineId}: ${result.error}`);
  assert.equal(result.entry.sha256,row.item.copySha256);assert.equal(result.entry.sourceSha256,row.original.sourceSha256);
  installed.push({lineId:row.item.lineId,takeId:result.entry.takeId,file:result.entry.file,sha256:result.entry.sha256,previousTakeId:row.original.takeId});
 }
 const final=await readLibrary(voiceRoot);
 for(const row of prepared){
  const e=final.entries[row.item.lineId];assert.equal(e.takeId,row.planned.takeId);
  for(const path of [e.file,e.archiveFile])assert.equal(sha256(await readFile(join(voiceRoot,path))),row.item.copySha256);
  assert.equal(sha256(await readFile(join(voiceRoot,e.sourceFile))),row.original.sourceSha256);
  assert(final.history.some(e=>e.takeId===row.original.takeId&&e.sha256===row.original.sha256));
  for(const [path,digest] of [[row.original.file,row.original.sha256],[row.original.archiveFile,row.original.sha256],[row.original.sourceFile,row.original.sourceSha256]])assert.equal(sha256(await readFile(join(voiceRoot,path))),digest);
 }
 const result={installedAt:new Date().toISOString(),installed,unchanged:review.entries.filter(e=>!e.cutSamples).map(e=>e.lineId),originalsPreserved:true,backup:config.backup,liveEntries:Object.keys(final.entries).length};
 await writeFile(join(config.directory,'installation-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({installed:installed.length,unchanged:result.unchanged.length,originalsPreserved:true,liveEntries:result.liveEntries,progress:final.progress}));
}
