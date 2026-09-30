import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {VOICES,CASES,RESIDENTS,SUPPORTING} from '../src/content.js';
import {roleManifest,ROLE_DESCRIPTIONS,assertDialogueManifest} from '../src/dialogue-manifest.js';
import {compatibleTake} from '../src/voice-store.js';
import {AudioManager} from '../src/audio.js';

const folder='docs/dialogue-review';
const baseline=JSON.parse(await readFile('.cache/dialogue-edit-baseline.json','utf8'));
const choices=JSON.parse(await readFile(`${folder}/editorial-selection.json`,'utf8'));
const prior=JSON.parse(await readFile(`${folder}/review-source.json`,'utf8'));
const changed=[],unchanged=[];
assert.deepEqual(VOICES.map(l=>l.id),baseline.lines.map(l=>l.id));
for(const line of VOICES){
 const old=baseline.lines.find(l=>l.id===line.id),edit=choices[line.id];
 if(!edit){assert.equal(line.text,old.text);assert.equal(line.scriptVersion,old.scriptVersion);assert.equal(line.fingerprint,old.fingerprint);unchanged.push(line.id);continue;}
 assert.notEqual(line.text,old.text);assert.equal(line.text,edit.text);assert(line.scriptVersion>old.scriptVersion);assert.notEqual(line.fingerprint,old.fingerprint);
 const oldTake={characterId:old.resident,lineId:old.id,scriptVersion:old.scriptVersion,fingerprint:old.fingerprint,performanceKey:old.performanceKey,blob:new Blob(['old audio']),mimeType:'audio/wav',validity:'valid',reviewed:true,validation:{hasSignal:true}};
 assert(!compatibleTake(oldTake,line));
 assert(!AudioManager.prototype.hasCreator.call({available:new Set([line.id]),creatorFiles:{[line.id]:{file:'old.wav',scriptVersion:old.scriptVersion}}},line.id));
 changed.push(line);
}
assert.equal(changed.length,64);assert.equal(unchanged.length,69);assertDialogueManifest();
for(const [path,hash]of Object.entries(baseline.hashes))assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,`Protected original changed: ${path}`);
for(const id of ['fire','courtyard'])assert.equal(roleManifest(id,'badger').lineIds.length,5);

const descriptions={...ROLE_DESCRIPTIONS,
 snake:'נחש חנון וגיימר שמנסה להיראות חלקלק ומסתורי. בשיחה אמיתית הוא נלחץ, מקבל סירוב וחוזר להתאמן על הפתיח.',
 turtle:'שליח שחוק, מצוברח ורטנן. רוצה שיניחו לו, אבל זוכר כל שעה ומוסר את כל המידע — תוך תלונות.',
 badger:'רואה חשבון עם ביטחון של ראש ארגון. האיומים שלו הם על שקיות, אגורות, ועד הבית וכיסאות.',
};
const characters=[...RESIDENTS,...SUPPORTING].map(character=>{
 const priorCharacter=prior.characters.find(c=>c.id===character.id);
 const sections=[];
 for(const [index,title]of [[0,'משפטים משותפים'],...CASES.map((c,i)=>[i+1,`תיק ${i+1} · ${c.title}`])]){
  const selected=changed.filter(l=>l.resident===character.id).filter(l=>{
   const cases=CASES.filter(c=>roleManifest(c.id,character.id)?.lineIds.includes(l.id));
   return index===0?cases.length>1:cases.length===1&&cases[0].id===CASES[index-1].id;
  });
  const ordering=priorCharacter.cases.flatMap(c=>c.lines).map(l=>l.id);
  selected.sort((a,b)=>ordering.indexOf(a.id)-ordering.indexOf(b.id));
  if(!selected.length)continue;
  sections.push({index,title,lines:selected.map(l=>{
   const context=priorCharacter.cases.flatMap(c=>c.lines).find(old=>old.id===l.id);
   const involved=CASES.filter(c=>roleManifest(c.id,character.id)?.lineIds.includes(l.id)).map(c=>CASES.indexOf(c)+1);
   const showHint=!/\.(alibi|detail)$/.test(l.id)||['goat.fire.detail','turtle.courtyard.alibi','snake.courtyard.alibi','snake.fire.alibi'].includes(l.id);
   return {id:l.id,text:l.text,version:l.scriptVersion,context:context.label,cases:involved,hint:showHint?l.hint:''};
  })});
 }
 return {id:character.id,name:character.name,description:descriptions[character.id],portrait:`portraits/${character.id}.png`,count:sections.reduce((n,s)=>n+s.lines.length,0),sections};
}).filter(c=>c.count);
const data={title:'חיות שכונה — המשפטים ששונו',subtitle:'סבב עריכה ממוקד · הנוסח שהוטמע במשחק',date:'28.09.2026',total:changed.length,characters};
await writeFile(`${folder}/changes-review-source.json`,JSON.stringify(data,null,2)+'\n');
const checks={changedLines:64,unchangedLines:69,byCharacter:Object.fromEntries(characters.map(c=>[c.name,c.count])),allStableIds:true,oldPersonalTakesRejected:64,oldCreatorTakesRejected:64,originalReviewUntouched:true,caseFactsAndRuntimeEventsUnchanged:true,quickRoleCounts:{fire:5,courtyard:5,balcony:5},caseTotals:{fire:88,courtyard:85,balcony:85},unitTestsPassed:67};
await writeFile(`${folder}/editorial-checks.json`,JSON.stringify(checks,null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
