// Build with test recordings in an isolated COPY, never the official voice folder.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,cp,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {creatorCatalogue} from '../tools/creator/catalogue.mjs';
import {readLibrary,publicMapping,sha256} from '../tools/creator/storage.mjs';
const root=process.cwd(),fixture=JSON.parse(await readFile('.cache/creator-isolated-storage.json','utf8'));
assert(resolve(fixture.voiceRoot).startsWith(resolve('.cache')+'\\'));
const output=await mkdtemp(resolve('.cache/creator-build-'));
for(const file of ['src','assets','tools','build.mjs','package.json','_headers','index.html'])await cp(join(root,file),join(output,file),{recursive:true});
await mkdir(join(output,'docs'),{recursive:true});await cp(fixture.voiceRoot,join(output,'assets/voices'),{recursive:true});
const run=promisify(execFile);await run(process.execPath,['build.mjs'],{cwd:output,windowsHide:true});
const report=JSON.parse(await readFile(join(output,'docs/build-report.json'),'utf8')),release=join(output,'dist/releases',report.version),state=await readLibrary(fixture.voiceRoot);
const mapping=publicMapping(state,creatorCatalogue().lines),installed=JSON.parse(await readFile(join(release,'assets/voices/available.json'),'utf8'));
assert.deepEqual(installed,mapping);assert.equal(report.creatorRecordings,3);
for(const entry of Object.values(mapping))assert.equal(sha256(await readFile(join(release,entry.file))),entry.sha256);
const walk=async directory=>(await Promise.all((await readdir(directory,{withFileTypes:true})).map(async entry=>entry.isDirectory()?walk(join(directory,entry.name)):join(directory,entry.name)))).flat();
const published=await walk(join(output,'dist'));assert(!published.some(p=>p.includes('.creator-studio')||p.includes('tools')||p.endsWith('server.mjs')||p.endsWith('studio.js')||p.endsWith('drafts.js')));
const audio=published.filter(p=>/\.(wav|webm|m4a|ogg|mp3)$/.test(p));assert.equal(audio.length,3);assert(!audio.some(p=>p.includes(state.history[0].takeId)));
const baseline=JSON.parse(await readFile('.cache/pre-creator-dialogue-baseline.json','utf8')),edits=JSON.parse(await readFile('docs/final-dialogue-edits.json','utf8'));
const {VOICES}=await import('../src/content.js');let unchanged=0;
for(const before of baseline){const after=VOICES.find(l=>l.id===before.id);if(edits[before.id]){assert.equal(after.text,edits[before.id].text);assert.equal(after.hint,edits[before.id].hint);assert.equal(after.scriptVersion,before.scriptVersion+1);assert.notEqual(after.fingerprint,before.fingerprint);}else{assert.deepEqual(after,before);unchanged++;}}
assert.equal(unchanged,128);assert.equal(Object.keys((await readLibrary(resolve('assets/voices'))).entries).length,0);
const result={isolatedBuild:output,packagedSyntheticTakes:3,privateAndHistoricalFilesPublished:0,officialCreatorRecordings:0,changedDialogueLines:5,unchangedDialogueLines:128};
await writeFile('test-results/creator-build-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
