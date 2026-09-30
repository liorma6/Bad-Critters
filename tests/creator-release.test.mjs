import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {releaseCreatorFiles} from '../tools/creator/release.mjs';
import {CreatorLibrary} from '../tools/creator/storage.mjs';
import {creatorCatalogue} from '../tools/creator/catalogue.mjs';
import {syntheticMicrophone} from './synthetic-microphone.mjs';

test('public release rebuilds approved voices without raw takes and rejects corrupt or stale clips',async()=>{
 await mkdir('.cache',{recursive:true});
 const root=await mkdtemp(resolve('.cache/release-test-')),clean=await mkdtemp(resolve('.cache/release-clean-'));
 const catalogue=creatorCatalogue(),line=catalogue.lines.find(l=>l.id==='goat.greet');
 const audio={type:'audio/wav',bytes:await readFile(syntheticMicrophone())};
 const library=new CreatorLibrary({voiceRoot:root,catalogue:async()=>catalogue});
 await library.save({lineId:line.id,takeId:randomUUID(),expectedTakeId:null,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,validation:{hasSignal:true,duration:8,peak:.2}},audio,audio);
 const mapping=await releaseCreatorFiles(root,catalogue.lines,{verify:true,exportSnapshot:true});
 await mkdir(join(clean,'creator'));await writeFile(join(clean,mapping[line.id].file.slice('assets/voices/'.length)),audio.bytes);
 const snapshot=await readFile(join(root,'published.json'));assert(!snapshot.includes('sourceFile'));assert(!snapshot.includes('.creator-studio'));
 await writeFile(join(clean,'published.json'),snapshot);
 assert.deepEqual(await releaseCreatorFiles(clean,catalogue.lines,{verify:true}),mapping);
 assert.deepEqual(await releaseCreatorFiles(clean,[{...line,fingerprint:'rewritten'}],{verify:true}),{});
 await writeFile(join(clean,mapping[line.id].file.slice('assets/voices/'.length)),Buffer.from('corrupt'));
 await assert.rejects(releaseCreatorFiles(clean,catalogue.lines,{verify:true}),/integrity/);
 // A local empty studio is authoritative and does not resurrect a released take.
 await mkdir(join(clean,'.creator-studio'));await writeFile(join(clean,'.creator-studio/library.json'),JSON.stringify({version:1,entries:{},history:[],progress:{}}));
 assert.deepEqual(await releaseCreatorFiles(clean,catalogue.lines,{verify:true}),{});
});
