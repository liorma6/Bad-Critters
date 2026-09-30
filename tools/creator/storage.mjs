import {readFile,mkdir,open,rename,unlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const PRIVATE_DIR='.creator-studio';
const safeId=/^[a-z]+(?:\.[a-z]+)+$/;
const safeTake=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const publicFile=/^creator\/[a-z]+(?:\.[a-z]+)+\.v\d+\.[a-f0-9-]{36}\.(webm|ogg|m4a|wav)$/;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const compatible=(entry,line)=>!!(entry&&line&&entry.scriptVersion===line.scriptVersion&&entry.fingerprint===line.fingerprint&&entry.performanceKey===line.performanceKey);
export class StudioError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new StudioError(status,message);};
export async function readLibrary(voiceRoot){try{const state=JSON.parse(await readFile(path.join(voiceRoot,PRIVATE_DIR,'library.json'),'utf8'));if(state.version!==1||!state.entries)throw Error('Invalid creator library');return state;}catch(e){if(e.code==='ENOENT')return {version:1,entries:{},history:[],progress:{}};throw e;}}

// A fresh file and a single atomic manifest rename make a take visible together.
// Failed writes never remove or overwrite the current take. Old takes stay private.
async function atomicWrite(file,bytes){
 const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{handle=await open(temp,'wx');await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;await rename(temp,file);}
 finally{await handle?.close().catch(()=>{});await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function safeDirectory(base,directory){
 await mkdir(directory,{recursive:true});
 const realBase=await realpath(base),realDirectory=await realpath(directory);
 if(realDirectory!==realBase&&!realDirectory.startsWith(realBase+path.sep))fail(500,'תיקיית השמירה אינה נמצאת בתוך תיקיית הקולות.');
}
export function audioExtension(mime,bytes){
 const type=String(mime).toLowerCase().split(';')[0].trim();
 if(!Buffer.isBuffer(bytes)||bytes.length<64||bytes.length>16*1024*1024)fail(400,'קובץ ההקלטה ריק או גדול מדי. הקליטו עד שלוש דקות למשפט.');
 if(type==='audio/webm'&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'webm';
 if(type==='audio/ogg'&&bytes.toString('ascii',0,4)==='OggS')return 'ogg';
 if(['audio/mp4','audio/x-m4a'].includes(type)&&bytes.toString('ascii',4,8)==='ftyp')return 'm4a';
 if(['audio/wav','audio/wave','audio/x-wav'].includes(type)&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')return 'wav';
 fail(400,'סוג קובץ ההקלטה אינו תואם לתוכן. הקליטו מחדש בדפדפן נתמך.');
}
function trimMetadata(value,duration){
 if(value==null)return undefined;
 const {start,end,sourceDuration}=value;
 if(![start,end,sourceDuration].every(Number.isFinite)||start<0||end<0||sourceDuration>180||sourceDuration-start-end<.08||Math.abs(sourceDuration-start-end-duration)>.02)fail(400,'פרטי החיתוך אינם תואמים לאורך הטייק. החילו את החיתוך מחדש.');
 return {start,end,sourceDuration,fadeSeconds:.005};
}
export function publicMapping(state,lines){
 const mapping={};
 for(const line of lines){const e=state.entries[line.id];if(!compatible(e,line))continue;if(!publicFile.test(e.file))throw Error('Unsafe creator audio path');mapping[line.id]={file:'assets/voices/'+e.file,scriptVersion:e.scriptVersion,fingerprint:e.fingerprint,performanceKey:e.performanceKey,duration:e.duration,sha256:e.sha256};}
 return mapping;
}
export async function creatorPublicFiles(voiceRoot,lines,{verify=false}={}){
 const result=publicMapping(await readLibrary(voiceRoot),lines);
 if(verify)for(const e of Object.values(result)){const file=path.join(voiceRoot,e.file.slice('assets/voices/'.length));const bytes=await readFile(file);if(sha256(bytes)!==e.sha256)throw Error('Creator audio integrity check failed: '+e.file);}
 return result;
}
export class CreatorLibrary{
 constructor({voiceRoot,catalogue,beforeCommit}){this.voiceRoot=path.resolve(voiceRoot);this.catalogue=catalogue;this.beforeCommit=beforeCommit;this.queue=Promise.resolve();}
 serial(work){const result=this.queue.then(work);this.queue=result.catch(()=>{});return result;}
 async state(){return readLibrary(this.voiceRoot);}
 async prepare(){await mkdir(this.voiceRoot,{recursive:true});await safeDirectory(this.voiceRoot,path.join(this.voiceRoot,PRIVATE_DIR));await safeDirectory(this.voiceRoot,path.join(this.voiceRoot,PRIVATE_DIR,'takes'));await safeDirectory(this.voiceRoot,path.join(this.voiceRoot,'creator'));}
 progress(value,catalogue){
  if(!value||!catalogue.lines.some(l=>l.id===value.lineId&&l.characterId===value.characterId))fail(400,'משפט ההמשך אינו קיים.');
  return {lineId:value.lineId,characterId:value.characterId,group:['all',...catalogue.groups.map(g=>g.id)].includes(value.group)?value.group:'all',filter:['all','missing','recorded','stale'].includes(value.filter)?value.filter:'all',enhance:!!value.enhance,noiseReduction:!!value.noiseReduction};
 }
 async saveProgress(value){return this.serial(async()=>{const catalogue=await this.catalogue();const progress=this.progress(value,catalogue);await this.prepare();const state=await this.state();state.progress=progress;await atomicWrite(path.join(this.voiceRoot,PRIVATE_DIR,'library.json'),JSON.stringify(state,null,2));return progress;});}
 async save(metadata,playback,source){return this.serial(async()=>{
  const catalogue=await this.catalogue(),line=catalogue.lines.find(l=>l.id===metadata.lineId);
  if(!line||!safeId.test(metadata.lineId))fail(400,'מזהה המשפט אינו קיים.');
  if(!compatible(metadata,line))fail(409,'נוסח המשפט השתנה. רעננו את הכלי והקליטו את הנוסח המעודכן.');
  if(!safeTake.test(metadata.takeId)||!Object.hasOwn(metadata,'expectedTakeId')||(metadata.expectedTakeId!==null&&!safeTake.test(metadata.expectedTakeId)))fail(400,'פרטי הטייק אינם תקינים.');
  const validation=metadata.validation;
  if(validation?.hasSignal!==true||!Number.isFinite(validation.duration)||validation.duration<.08||validation.duration>180||!Number.isFinite(validation.peak)||validation.peak<=1e-5)fail(400,'ההקלטה לא עברה בדיקת קול. האזינו לטייק תקין לפני השמירה.');
  const trim=trimMetadata(metadata.processing?.trim,validation.duration);
  const extension=audioExtension(playback.type,playback.bytes),sourceExtension=audioExtension(source.type,source.bytes);
  const digest=sha256(playback.bytes),sourceDigest=sha256(source.bytes);
  await this.prepare();const state=await this.state(),current=state.entries[line.id];
  if(current?.takeId===metadata.takeId){if(current.sha256!==digest||current.sourceSha256!==sourceDigest)fail(409,'מזהה הטייק כבר משמש הקלטה אחרת.');return current;}
  if((current?.takeId||null)!==metadata.expectedTakeId)fail(409,'טייק חדש נשמר בחלון אחר. רעננו את הרשימה והאזינו לו לפני החלפה. הטייק שלכם נשאר כטיוטה.');
  const takeDir=path.join(this.voiceRoot,PRIVATE_DIR,'takes',metadata.takeId);
  await safeDirectory(this.voiceRoot,takeDir);
  const file=`creator/${line.id}.v${line.scriptVersion}.${metadata.takeId}.${extension}`;
  const entry={takeId:metadata.takeId,lineId:line.id,characterId:line.characterId,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,recordedText:line.text,file,mimeType:playback.type,sourceMimeType:source.type,sourceFile:`${PRIVATE_DIR}/takes/${metadata.takeId}/source.${sourceExtension}`,archiveFile:`${PRIVATE_DIR}/takes/${metadata.takeId}/playback.${extension}`,sha256:digest,sourceSha256:sourceDigest,duration:validation.duration,processing:{enhance:!!metadata.processing?.enhance,highpassHz:metadata.processing?.enhance?85:0,compressorRatio:metadata.processing?.enhance?2:1,echoCancellation:!!metadata.processing?.echoCancellation,noiseSuppression:!!metadata.processing?.noiseSuppression,autoGainControl:!!metadata.processing?.autoGainControl,trim},savedAt:new Date().toISOString()};
  // Retried requests can reuse uncommitted immutable files, never change them.
  for(const [relative,bytes]of [[entry.sourceFile,source.bytes],[entry.archiveFile,playback.bytes],[entry.file,playback.bytes]]){
   const target=path.join(this.voiceRoot,relative);
   try{const previous=await readFile(target);if(sha256(previous)!==sha256(bytes))fail(409,'מזהה הטייק כבר קיים עם תוכן אחר. התחילו טייק חדש.');}
   catch(e){if(e.code==='ENOENT')await atomicWrite(target,bytes);else throw e;}
  }
  if(current)state.history.push(current);state.entries[line.id]=entry;
  if(metadata.progress)state.progress=this.progress(metadata.progress,catalogue);
  await this.beforeCommit?.(entry); // Fault injection is constructor-only, never an HTTP capability.
  await atomicWrite(path.join(this.voiceRoot,PRIVATE_DIR,'library.json'),JSON.stringify(state,null,2));
  return entry;
 });}
 async playback(lineId){const state=await this.state(),entry=state.entries[lineId];if(!entry||!publicFile.test(entry.file))fail(404,'אין הקלטה שמורה למשפט הזה.');return {entry,bytes:await readFile(path.join(this.voiceRoot,entry.file))};}
 async source(lineId,takeId){
  const entry=(await this.state()).entries[lineId];if(!entry)fail(404,'אין הקלטה שמורה למשפט הזה.');
  if(entry.takeId!==takeId)fail(409,'הטייק השמור השתנה. רעננו את הרשימה ונסו שוב.');
  const prefix=`${PRIVATE_DIR}/takes/${entry.takeId}/source.`;
  if(!safeTake.test(entry.takeId)||!entry.sourceFile?.startsWith(prefix)||!['webm','ogg','m4a','wav'].includes(entry.sourceFile.slice(prefix.length)))fail(500,'קובץ המקור אינו זמין לעריכה.');
  return {entry,bytes:await readFile(path.join(this.voiceRoot,entry.sourceFile))};
 }
}
