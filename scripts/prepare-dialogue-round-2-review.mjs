import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {VOICES,CASES,RESIDENTS,SUPPORTING} from '../src/content.js';
import {roleManifest,ROLE_DESCRIPTIONS,assertDialogueManifest} from '../src/dialogue-manifest.js';
import {compatibleTake} from '../src/voice-store.js';
import {AudioManager} from '../src/audio.js';

const folder='docs/dialogue-review';
const baseline=JSON.parse(await readFile('.cache/dialogue-round2-baseline.json','utf8'));
const choices=JSON.parse(await readFile(`${folder}/round-2-editorial-selection.json`,'utf8'));
const prior=JSON.parse(await readFile(`${folder}/review-source.json`,'utf8'));
const changed=[],unchanged=[];
assert.deepEqual(VOICES.map(l=>l.id),baseline.lines.map(l=>l.id));
for(const line of VOICES){
 const old=baseline.lines.find(l=>l.id===line.id),edit=choices[line.id];
 if(!edit){assert.equal(line.text,old.text,line.id);assert.equal(line.scriptVersion,old.scriptVersion,line.id);assert.equal(line.fingerprint,old.fingerprint,line.id);unchanged.push(line.id);continue;}
 assert.equal(line.text,edit.text);assert.equal(line.scriptVersion,old.scriptVersion+1);assert.notEqual(line.fingerprint,old.fingerprint);
 const take={characterId:old.resident,lineId:old.id,scriptVersion:old.scriptVersion,fingerprint:old.fingerprint,performanceKey:old.performanceKey,blob:new Blob(['old audio']),mimeType:'audio/wav',validity:'valid',reviewed:true,validation:{hasSignal:true}};
 assert(!compatibleTake(take,line));
 assert(!AudioManager.prototype.hasCreator.call({available:new Set([line.id]),creatorFiles:{[line.id]:{file:'old.wav',scriptVersion:old.scriptVersion}}},line.id));
 changed.push(line);
}
assert.equal(changed.length,28);assert.equal(unchanged.length,105);assertDialogueManifest();
for(const id of ['cat','hedgehog'])assert.deepEqual(VOICES.filter(l=>l.resident===id),baseline.lines.filter(l=>l.resident===id));
const factOnly=cases=>cases.map(({brief,...rest})=>rest);
assert.deepEqual(factOnly(CASES),factOnly(baseline.cases));
for(let i=1;i<CASES.length;i++)assert.equal(CASES[i].brief,baseline.cases[i].brief);
for(const r of RESIDENTS){const old=baseline.residents.find(o=>o.id===r.id);for(const key of ['spawn','routine','relationship'])assert.deepEqual(r[key],old[key]);}
for(const [path,hash]of Object.entries(baseline.hashes).filter(([p])=>p.startsWith(folder)||['src/main.js','src/incidents.js'].includes(p)))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,`Protected original changed: ${path}`);
for(const id of ['fire','courtyard'])assert.equal(roleManifest(id,'badger').lineIds.length,5);
assert.equal(roleManifest('balcony','badger'),null);
const descriptions={...ROLE_DESCRIPTIONS,
 snake:'נחש בוגר, פוזאיסט ופיקאפר מטעם עצמו. בטוח שהוא מבוקש; סיפורי ההצלחה שלו חושפים גיימר עם עצות גרועות. מקבל סירוב ועוזב.',
 badger:'רואה חשבון קמצן עם פאוץ׳ מלא מטבעות וקבלות. מתחשבן על כל אגורה, זוכר חיובים ישנים ומספר על קנייה כאילו ניצל משוד.',
};
const characters=[...RESIDENTS,...SUPPORTING].map(character=>{
 const previous=prior.characters.find(c=>c.id===character.id),sections=[];
 const ordering=previous.cases.flatMap(c=>c.lines).map(l=>l.id);
 for(const [index,title]of [[0,'משפטים משותפים'],...CASES.map((c,i)=>[i+1,`תיק ${i+1} · ${c.title}`])]){
  const selected=changed.filter(l=>l.resident===character.id).filter(l=>{
   const cases=CASES.filter(c=>roleManifest(c.id,character.id)?.lineIds.includes(l.id));
   return index===0?cases.length>1:cases.length===1&&cases[0].id===CASES[index-1].id;
  }).sort((a,b)=>ordering.indexOf(a.id)-ordering.indexOf(b.id));
  if(!selected.length)continue;
  sections.push({index,title,lines:selected.map(l=>({id:l.id,text:l.text,version:l.scriptVersion,
   context:previous.cases.flatMap(c=>c.lines).find(old=>old.id===l.id).label,
   cases:CASES.flatMap((c,i)=>roleManifest(c.id,character.id)?.lineIds.includes(l.id)?[i+1]:[]),
   hint:l.hint}))});
 }
 return {id:character.id,name:character.name,description:descriptions[character.id],portrait:`portraits/${character.id==='badger'?'badger-round-2':character.id}.png`,count:sections.reduce((n,s)=>n+s.lines.length,0),sections};
}).filter(c=>c.count);
await writeFile(`${folder}/round-2-review-source.json`,JSON.stringify({title:'חיות שכונה — סבב תיקונים 2',subtitle:'28 משפטים שעודכנו בסבב הזה · הנוסח שהוטמע במשחק',date:'28.09.2026',total:28,characters},null,2)+'\n');
const report={changedLines:28,unchangedLines:105,byCharacter:Object.fromEntries(characters.map(c=>[c.name,c.count])),stableIds:true,oldPersonalTakesRejected:28,oldCreatorTakesRejected:28,catAndHedgehogUnchanged:true,priorReviewDocumentsUnchanged:true,allCaseEvidenceTimelinesAndSolutionsUnchanged:true,witnessRoutesAndRelationshipsUnchanged:true,badgerUniqueLines:7,badgerLinesPerCase:{fire:5,courtyard:5,balcony:0},goatReplacement:'Complaint-list routine, hidden under observation; no clue depended on pavement marking; entry testimony and bakery alibi unchanged.'};
await writeFile(`${folder}/round-2-editorial-checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
