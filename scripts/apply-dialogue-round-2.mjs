// Apply the reviewed selections to the existing authored slots, preserving IDs.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {DIALOGUE_REVISIONS} from '../src/dialogue-revisions.js';
const baseline=JSON.parse(await readFile('.cache/dialogue-round2-baseline.json','utf8'));
const edits=JSON.parse(await readFile('docs/dialogue-review/round-2-editorial-selection.json','utf8'));
const paths=['src/voices.js','src/signature-lines.js','src/small-roles.js'];
const files=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await readFile(p,'utf8')])));
for(const [id,edit]of Object.entries(edits)){
 const old=baseline.lines.find(l=>l.id===id);assert(old,id);assert.notEqual(old.text,edit.text,id);
 let found=false;
 for(const path of paths){
  if(files[path].includes(old.text)){files[path]=files[path].replaceAll(old.text,edit.text);found=true;}
  else if(files[path].includes(edit.text))found=true;
  if(files[path].includes(old.hint))files[path]=files[path].replaceAll(old.hint,edit.hint);
 }
 assert(found,`Missing authored slot ${id}`);
 DIALOGUE_REVISIONS[id]={version:old.scriptVersion+1,hint:edit.hint};
}
for(const [path,content]of Object.entries(files))await writeFile(path,content);
await writeFile('src/dialogue-revisions.js','// Explicit recording revisions for the editorial passes of 2026-09-28.\n// Stable IDs; changed text invalidates personal and creator takes.\nexport const DIALOGUE_REVISIONS='+JSON.stringify(DIALOGUE_REVISIONS,null,2)+';\n');
console.log({applied:Object.keys(edits).length});
