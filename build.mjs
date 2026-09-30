import {mkdir,cp,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {ART_IDS} from './src/art-assets.js';
import {VOICES,RESIDENTS,SUPPORTING,CASES} from './src/content.js';
import {CASE_RECORDING_MANIFEST,assertDialogueManifest,requiredLines} from './src/dialogue-manifest.js';
import {releaseCreatorFiles} from './tools/creator/release.mjs';
assertDialogueManifest();
const files=await readdir('assets/voices'),available={};
for(const line of VOICES)for(const extension of ['mp3','m4a','ogg','webm','wav']){
 const file=`${line.id}.v${line.scriptVersion}.${extension}`;
 if(files.includes(file)){if(!(await stat(`assets/voices/${file}`)).size)throw Error(`Empty creator recording: ${file}`);available[line.id]={file:`assets/voices/${file}`,scriptVersion:line.scriptVersion};break;}
}
Object.assign(available,await releaseCreatorFiles(resolve('assets/voices'),VOICES,{verify:true,exportSnapshot:true}));
const manifest={version:4,language:'he-IL',lines:VOICES.map(v=>({...v,file:`assets/voices/${v.id}.v${v.scriptVersion}.mp3`,installed:available[v.id]?.file||null}))};
await writeFile('assets/voices/available.json',JSON.stringify(available,null,2));
await writeFile('assets/voices/manifest.json',JSON.stringify(manifest,null,2));
await writeFile('assets/voices/recording-cases.json',JSON.stringify({version:1,cases:CASE_RECORDING_MANIFEST,requirements:Object.values(CASE_RECORDING_MANIFEST).flatMap(c=>Object.values(c.characters).map(r=>({caseId:c.caseId,characterId:r.characterId,lines:requiredLines(c.caseId,r.characterId).map(l=>({lineId:l.id,scriptVersion:l.scriptVersion,fingerprint:l.fingerprint,performanceKey:l.performanceKey,spoilerSensitivity:l.spoilerSensitivity}))})))},null,2));
const speakers=[...RESIDENTS,...SUPPORTING,{id:'guide',name:'משמרת השכונה',direction:'Clear, calm, factual adult Hebrew. Treat death and injury seriously.'}];
let script=`# זובלוף — complete creator recording script\n\n${VOICES.length} lines across all three cases. One mono recording per line. Includes complete per-case personal roles. **Creator document: contains case solutions. Do not show this document in the player recording flow.**\n\nSpeak the Hebrew exactly; do not read IDs or directions. Versioned filenames prevent rewritten lines from using stale audio. MP3 is recommended; M4A, Ogg, WebM and WAV are also indexed. See AUDIO.md.\n\n`;
for(const r of speakers){script+=`## ${r.name} (${r.id})\n\nVoice direction: ${r.direction}\n\n`;for(const v of manifest.lines.filter(v=>v.resident===r.id))script+=`### ${v.id}\n\n**Spoken Hebrew:** ${v.text}\n\n- Character: ${r.name} / ${r.id}\n- Script version: ${v.scriptVersion}\n- English direction: ${v.direction}\n- Gameplay trigger: ${v.context}\n- Performance note: ${v.hint}\n- Suggested filename: \`${v.file}\`\n- ${v.personal?'Personal role line — requires the complete current-case script':v.essential?'Case / tutorial dialogue':'Other optional reaction'}\n\n`;}
await writeFile('docs/RECORDING_SCRIPT.md',script);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
await writeFile('docs/recording-script.html',`<!doctype html><html lang="he"><meta charset="utf-8"><title>תסריט היוצר — כולל פתרונות</title><style>body{max-width:900px;margin:40px auto;font-family:Arial;line-height:1.6;padding:20px}article{border-bottom:1px solid #ccc;padding:15px 0;break-inside:avoid}.spoken{font-size:23px;text-align:right}small{color:#555}@media print{h2{break-before:page}}</style><h1>Creator recording script — contains spoilers</h1><p>${VOICES.length} lines. One file per line. English directions are not spoken.</p>${speakers.map(r=>`<h2>${r.name} / ${r.id}</h2><p>${r.direction}</p>${manifest.lines.filter(v=>v.resident===r.id).map(v=>`<article><b>${v.id} · v${v.scriptVersion}</b><p class="spoken" dir="rtl">${esc(v.text)}</p><p>${v.direction}</p><p>${v.context}</p><p dir="rtl">ביצוע: ${esc(v.hint)}</p><small>${v.file}</small></article>`).join('')}`).join('')}</html>`);
let personal='# תסריטי דיבוב מלאים לפי תיק\n\nאזהרה: התפקידים המלאים כוללים מידע מהחקירה ומהפתרון. רק התפקיד הקצר בכל תיק בטוח להקלטה מראש. הוראות המשחק אינן מציגות תסריט מלא לפני אישור אזהרה.\n\n';
for(const c of Object.values(CASE_RECORDING_MANIFEST)){
 personal+='## '+CASES.find(item=>item.id===c.caseId).title+' ('+c.caseId+')\n\n';
 for(const role of Object.values(c.characters).filter(r=>r.eligible)){
  personal+='### '+role.name+' · '+role.lineIds.length+' משפטים · '+(role.mode==='quick'?'תפקיד קצר ללא ספוילרים':'תפקיד מלא — מכיל ספוילרים')+'\n\n';
  for(const l of requiredLines(c.caseId,role.characterId))personal+='- **'+l.id+'** (גרסה '+l.scriptVersion+'): '+l.text+'\n  - משחק: '+l.hint+'\n';
  personal+='\n';
 }
}
await writeFile('docs/PERSONAL_LINES.md',personal);
// Hash exact production inputs, including actual installed audio bytes.
const sources=['index.html',...(await readdir('src')).filter(f=>/\.(js|css)$/.test(f)).sort().map(f=>`src/${f}`),'assets/icon.svg','assets/voices/available.json','assets/voices/manifest.json','assets/voices/recording-cases.json',...ART_IDS.map(id=>`assets/art/${id}.webp`),...Object.values(available).map(v=>v.file)];
const hash=createHash('sha256');for(const path of sources){hash.update(path);hash.update(await readFile(path));}
const version=hash.digest('hex').slice(0,16),out=resolve('dist');
if(out!==resolve(process.cwd(),'dist')||!out.startsWith(resolve(process.cwd())+sep))throw Error('Unsafe build target');
// dist is entirely generated; no source or browser recordings live here.
// Keep the output directory itself: Wrangler watches it on Windows.
await mkdir(out,{recursive:true});
for(const entry of await readdir(out)){const target=resolve(out,entry);if(!target.startsWith(out+sep))throw Error('Unsafe generated asset path');await rm(target,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
const release=`dist/releases/${version}`;await mkdir(release,{recursive:true});
for(const path of sources.filter(p=>p!=='index.html')){await mkdir(resolve(release,path,'..'),{recursive:true});await cp(path,`${release}/${path}`);}
const html=(await readFile('index.html','utf8')).replace('<head>','<head><base href="/releases/'+version+'/">');
await writeFile('dist/index.html',html);await cp('_headers','dist/_headers');
// Discovery files stay at stable root URLs, outside the fingerprinted game release.
for(const file of ['robots.txt','sitemap.xml'])await cp(file,`dist/${file}`);
await cp('assets/icon.svg','dist/favicon.svg');
const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?walk(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat();
const assets=await walk('dist');let bytes=0,maxBytes=0,largest='';
for(const file of assets){const size=(await stat(file)).size;bytes+=size;if(size>maxBytes){maxBytes=size;largest=file;}if(size>25*1024*1024)throw Error(`Cloudflare 25 MiB per-file limit exceeded: ${file}`);}
if(assets.length>20000)throw Error('Cloudflare Free 20,000-file limit exceeded');
const report={version,files:assets.length,bytes,largest,largestBytes:maxBytes,creatorRecordings:Object.keys(available).length,scriptLines:VOICES.length};
await writeFile('docs/build-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
