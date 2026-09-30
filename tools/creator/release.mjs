import {readFile,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compatible,creatorPublicFiles,sha256} from './storage.mjs';

// GitHub contains approved playback files only. The local studio remains the
// authority when present; a clean checkout uses its public release snapshot.
export async function releaseCreatorFiles(voiceRoot,lines,{verify=false,exportSnapshot=false}={}){
 let local=false;
 try{await stat(join(voiceRoot,'.creator-studio/library.json'));local=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 if(local){
  const mapping=await creatorPublicFiles(voiceRoot,lines,{verify});
  if(exportSnapshot)await writeFile(join(voiceRoot,'published.json'),JSON.stringify(mapping,null,2));
  return mapping;
 }
 let snapshot;
 try{snapshot=JSON.parse(await readFile(join(voiceRoot,'published.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw error;}
 const mapping={};
 for(const line of lines){
  const entry=snapshot[line.id];if(!compatible(entry,line))continue;
  if(!/^assets\/voices\/creator\/[a-z]+(?:\.[a-z]+)+\.v\d+\.[a-f0-9-]{36}\.(webm|ogg|m4a|wav)$/.test(entry.file)||!Number.isFinite(entry.duration)||entry.duration<=0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid published recording: '+line.id);
  if(verify&&sha256(await readFile(join(voiceRoot,entry.file.slice('assets/voices/'.length))))!==entry.sha256)throw Error('Published recording integrity check failed: '+line.id);
  mapping[line.id]={file:entry.file,scriptVersion:entry.scriptVersion,fingerprint:entry.fingerprint,performanceKey:entry.performanceKey,duration:entry.duration,sha256:entry.sha256};
 }
 return mapping;
}
