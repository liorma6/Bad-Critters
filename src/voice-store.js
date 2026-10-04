import {SIGNATURE_LINES} from './signature-lines.js';
import {LINE,VOICES} from './voices.js';
import {requiredLines,roleManifest} from './dialogue-manifest.js';
import {signalStats} from './recorder.js';

export function compatibleIdentity(take,line){
 return !!(take&&line&&take.characterId===line.resident&&take.lineId===line.id&&take.scriptVersion===line.scriptVersion&&take.fingerprint===line.fingerprint&&take.performanceKey===line.performanceKey&&take.blob?.size>0&&take.mimeType);
}
export function compatibleTake(take,line){return compatibleIdentity(take,line)&&take.validity==='valid'&&take.validation?.hasSignal===true&&take.reviewed===true;}
export async function validateRecording(blob){
 const Context=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
 if(!Context)throw Error('Audio decoding is unavailable');
 const context=new Context(1,1,48000);
 const buffer=await context.decodeAudioData(await blob.arrayBuffer());
 const validation={...signalStats(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate),duration:buffer.duration};
 if(!validation.hasSignal)throw Error('Recording contains no signal');return validation;
}
export class VoiceStore {
 constructor({name='neighborhood-personal-voices-v1',indexedDB=globalThis.indexedDB,onWarning=()=>{},validateBlob=validateRecording}={}){
  Object.assign(this,{name,indexedDB,onWarning,validateBlob});this.takes=new Map();this.drafts=new Map();this.sets=new Map();this.db=null;this.ready=this.load();
 }
 warn(){this.onWarning('שמירת ההקלטות אינה זמינה. הטיוטה זמינה עד סגירת הדף בלבד.');}
 async load(){
  try{
   if(!this.indexedDB)throw Error('IndexedDB unavailable');
   this.db=await new Promise((resolve,reject)=>{
    const request=this.indexedDB.open(this.name,3);let expired=false;
    const timeout=setTimeout(()=>{expired=true;reject(Error('Storage open timed out'));},3000);
    request.onupgradeneeded=()=>{
     if(!request.result.objectStoreNames.contains('takes'))request.result.createObjectStore('takes',{keyPath:'lineId'});
     if(!request.result.objectStoreNames.contains('sets'))request.result.createObjectStore('sets',{keyPath:'setId'});
     if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts',{keyPath:'lineId'});
     const cursor=request.transaction.objectStore('takes').openCursor();
     cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;
      // Moving existing unapproved takes is part of the same upgrade transaction.
      if(row.value.reviewed===false){request.transaction.objectStore('drafts').put(row.value);row.delete();}row.continue();
     };
    };
    request.onsuccess=()=>{clearTimeout(timeout);if(expired){request.result.close();return;}resolve(request.result);};
    request.onerror=()=>{clearTimeout(timeout);reject(request.error);};request.onblocked=()=>{clearTimeout(timeout);expired=true;reject(Error('Storage blocked'));};
   });
   this.db.onversionchange=()=>{this.db.close();this.db=null;};
   for(const row of await this.transaction('readonly',s=>s.getAll())){
    // Only the explicitly unchanged legacy signature scripts have a safe migration.
    // An old version number alone is not evidence that arbitrary text/context matches.
    if(!row.fingerprint){
     const line=LINE[row.lineId],legacy=SIGNATURE_LINES.find(l=>l.id===row.lineId);
     if(line&&legacy&&row.characterId===line.resident&&row.scriptVersion===line.scriptVersion&&row.blob?.size){
      try{row.validation=await this.validateBlob(row.blob);Object.assign(row,{fingerprint:line.fingerprint,performanceKey:line.performanceKey,validity:'valid',reviewed:!!row.acceptedAt});await this.transaction('readwrite',s=>s.put(row));}catch{row.validity='invalid';}
     }
    }
    this.takes.set(row.lineId,row);
   }
   for(const row of await this.transaction('readonly',s=>s.getAll(),'drafts'))this.drafts.set(row.lineId,row);
   for(const set of await this.transaction('readonly',s=>s.getAll(),'sets')){
    if(set.status==='complete'&&!this.coverage(set.caseId,set.characterId).complete){set.status='draft';await this.transaction('readwrite',s=>s.put(set),'sets');}
    this.sets.set(set.setId,set);
   }
  }catch{this.warn();}
 }
 transaction(mode,operation,store='takes'){return new Promise((resolve,reject)=>{
  const tx=this.db.transaction(store,mode),request=operation(tx.objectStore(store));
  tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));
 });}
 get(line){const take=this.takes.get(line?.id);return compatibleTake(take,line)?take:null;}
 draft(line){const take=this.drafts.get(line?.id)||this.takes.get(line?.id);return compatibleIdentity(take,line)?take:null;}
 hasDraft(line){return compatibleIdentity(this.drafts.get(line?.id),line);}
 outdated(line){const take=this.takes.get(line?.id);return !!take&&!compatibleIdentity(take,line);}
 count(characterId,caseId){return (caseId?requiredLines(caseId,characterId):VOICES.filter(l=>l.resident===characterId)).filter(line=>this.get(line)).length;}
 coverage(caseId,characterId){
  const lines=requiredLines(caseId,characterId),recorded=lines.filter(l=>{const t=this.draft(l);return t?.validity==='valid'&&t.validation?.hasSignal;}),approved=lines.filter(l=>this.get(l));
  return {total:lines.length,recorded:recorded.length,approved:approved.length,newCount:lines.length-recorded.length,rerecordCount:lines.filter(l=>this.outdated(l)).length,reviewCount:recorded.filter(l=>this.hasDraft(l)||!this.get(l)).length,complete:lines.length>0&&approved.length===lines.length,missing:lines.filter(l=>!this.get(l)).map(l=>l.id)};
 }
 async persist(record){try{if(!this.db)throw Error('No database');await this.transaction('readwrite',s=>s.put(record));return true;}catch{this.warn();return false;}}
 async writeTake(line,take,reviewed,{caseId,requirePersistence=false}={}){
  await this.ready;
  const validation=take.validation?.hasSignal?take.validation:await this.validateBlob(take.blob);
  const record={characterId:line.resident,lineId:line.id,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,mimeType:take.blob.type||take.mimeType,processing:take.processing,validation,duration:validation.duration||take.duration,blob:take.blob,validity:'valid',reviewed,updatedAt:new Date().toISOString(),acceptedAt:reviewed?new Date().toISOString():null};
  if(!compatibleIdentity(record,line))throw Error('Invalid recording');
  let persisted=false;
  try{await this.atomicTakes((takes,drafts)=>{if(reviewed){takes.put(record);drafts.delete(line.id);}else drafts.put(record);});persisted=true;}catch{this.warn();}
  // An explicit Save must not approve an in-memory-only take or report success.
  if(requirePersistence&&!persisted)return false;
  (reviewed?this.takes:this.drafts).set(line.id,record);if(reviewed)this.drafts.delete(line.id);
  if(caseId)await this.checkpoint(caseId,line.resident);
  for(const set of this.sets.values())if(set.characterId===line.resident&&set.caseId!==caseId)await this.checkpoint(set.caseId,line.resident,set.lastLineId);
  return persisted;
 }
 put(line,take,options){return this.writeTake(line,take,true,options);}
 putDraft(line,take,options){return this.writeTake(line,take,false,options);}
 async approve(line,{caseId}={}){
  const take=this.draft(line);if(!take)throw Error('No compatible draft');
  const validation=await this.validateBlob(take.blob);return this.writeTake(line,{...take,validation},true,{caseId,requirePersistence:true});
 }
 async checkpoint(caseId,characterId,lastLineId){
  await this.ready;const role=roleManifest(caseId,characterId);if(!role?.eligible)return;
  const coverage=this.coverage(caseId,characterId),setId=`${caseId}:${characterId}`;
  const set={setId,caseId,characterId,requirements:requiredLines(caseId,characterId).map(l=>({lineId:l.id,scriptVersion:l.scriptVersion,fingerprint:l.fingerprint,performanceKey:l.performanceKey})),status:coverage.complete?'complete':'draft',lastLineId:lastLineId||this.sets.get(setId)?.lastLineId||role.lineIds[0],updatedAt:new Date().toISOString()};
  this.sets.set(setId,set);try{if(!this.db)throw Error('No database');await this.transaction('readwrite',s=>s.put(set),'sets');}catch{this.warn();}return set;
 }
 resumeIndex(caseId,characterId){
  const lines=requiredLines(caseId,characterId),last=this.sets.get(`${caseId}:${characterId}`)?.lastLineId,index=Math.max(0,lines.findIndex(l=>l.id===last));
  // A saved final line must not trap an incomplete role in an endless summary loop.
  const missing=lines.findIndex(line=>!this.get(line));
  return missing>=0&&this.get(lines[index])?missing:index;
 }
 async verifyRole(caseId,characterId){
  await this.ready;if(!roleManifest(caseId,characterId)?.eligible)return false;
  for(const line of requiredLines(caseId,characterId)){
   const take=this.get(line);if(!take)continue;
   try{take.validation=await this.validateBlob(take.blob);}catch{take.validity='invalid';take.reviewed=false;await this.persist(take);}
  }
  await this.checkpoint(caseId,characterId);return this.coverage(caseId,characterId).complete;
 }
 async markPlaybackFailure(line){
  const take=this.get(line);if(!take)return;take.validity='playback-failed';take.reviewed=false;await this.persist(take);
  for(const set of this.sets.values())if(set.requirements.some(l=>l.lineId===line.id))await this.checkpoint(set.caseId,set.characterId);
 }
 atomicTakes(operation){return new Promise((resolve,reject)=>{
  if(!this.db){reject(Error('No database'));return;}
  const tx=this.db.transaction(['takes','drafts'],'readwrite');
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));
  try{operation(tx.objectStore('takes'),tx.objectStore('drafts'));}catch(error){tx.abort();reject(error);}
 });}
 async discardDraft(lineId){await this.ready;try{await this.atomicTakes((takes,drafts)=>drafts.delete(lineId));}catch{return false;}this.drafts.delete(lineId);return true;}
 async delete(lineId){
  await this.ready;try{await this.atomicTakes((takes,drafts)=>{takes.delete(lineId);drafts.delete(lineId);});}catch{return false;}
  this.takes.delete(lineId);this.drafts.delete(lineId);
  for(const set of this.sets.values())if(set.requirements.some(l=>l.lineId===lineId))await this.checkpoint(set.caseId,set.characterId);return true;
 }
 async deleteCharacter(characterId){
  await this.ready;const ids=[...new Set([...this.takes,...this.drafts].filter(([,take])=>take.characterId===characterId).map(([id])=>id))];
  try{await this.atomicTakes((takes,drafts)=>{for(const id of ids){takes.delete(id);drafts.delete(id);}});}catch{return false;}
  for(const id of ids){this.takes.delete(id);this.drafts.delete(id);}for(const set of this.sets.values())if(set.characterId===characterId)await this.checkpoint(set.caseId,characterId);return true;
 }
}
