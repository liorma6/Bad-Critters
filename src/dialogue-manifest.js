import {CASES} from './cases.js';
import {RESIDENTS,SUPPORTING} from './residents.js';
import {LINE,VOICES} from './voices.js';

export const QUICK_ROLES={fire:'badger',courtyard:'badger',balcony:'hedgehog'};
export const ROLE_DESCRIPTIONS={
 goat:'מפקח מדרכה מטעם עצמו. מנהל פנקס תלונות על מי שלא אומר בוקר טוב.',
 pigeon:'חוקר שהדפיס לעצמו סמכות. לכל הנהון יש מקור חסוי.',
 snake:'פיקאפר מטעם עצמו וגיימר בוגר. מספר על הצלחות עם נשים; הפרטים מספרים סיפור אחר.',
 cat:'בעלת הבית. גם השקט עומד אצלה בתור לתשלום.',
 boar:'קבלן תחזוקה שמתקן ניסוחים באותה מסירות כמו קירות.',
 turtle:'שליח שחוק שרוצה שיניחו לו. זוכר כל שעה ומוסר כל פרט, תוך תלונות.',
 badger:'רואה חשבון קמצן עם פאוץ׳ מטבעות וקבלות. מוכן לחכות שעות בשביל עשר אגורות.',
 hedgehog:'שכנה מעשית שרוצה רגע של שקט. יודעת איפה כדאי לעצור ולקרוא.',
};
export const COMMON_DIALOGUE_EVENTS={intro:'greet',watched:'watched',bell:'bell',water:'water',secret:'secret',accusation:'wrong',complaint:'complaint',boast:'boast',question:'question',encounter:'arrival'};
const compactEvents={
 fire:{intro:'badger.intro',receipt:'badger.receipt',copies:'badger.copies',notice:'badger.fire.notice',care:'badger.fire.care',aftermath:'badger.fire.care',encounter:'badger.intro'},
 courtyard:{intro:'badger.intro',receipt:'badger.receipt',copies:'badger.copies',notice:'badger.courtyard.notice',chair:'badger.courtyard.chair',encounter:'badger.intro'},
 balcony:{intro:'hedgehog.intro',queue:'hedgehog.queue',notice:'hedgehog.notice',pause:'hedgehog.balcony.pause',space:'hedgehog.balcony.space',aftermath:'hedgehog.balcony.pause',encounter:'hedgehog.intro'},
};
function role(caseId,characterId,events,mode){
 const character=[...RESIDENTS,...SUPPORTING].find(r=>r.id===characterId)||{id:'guide',name:'משמרת השכונה'};
 const lineIds=[...new Set(Object.values(events))];
 return {caseId,characterId,name:character.name,mode,eligible:mode!=='creator',description:ROLE_DESCRIPTIONS[characterId]||'',events,lineIds,
  // Every full role gets the same public warning. This internal classification is never a casting clue.
  spoilers:lineIds.some(id=>LINE[id]?.spoilerSensitivity!=='safe'),
  sections:Array.from({length:Math.ceil(lineIds.length/4)},(_,i)=>({label:`חלק ${i+1}`,lineIds:lineIds.slice(i*4,i*4+4)}))};
}
export const CASE_RECORDING_MANIFEST=Object.fromEntries(CASES.map(c=>{
 const characters={};
 for(const r of RESIDENTS){
  const events=Object.fromEntries(Object.entries(COMMON_DIALOGUE_EVENTS).map(([event,key])=>[event,`${r.id}.${key}`]));
  Object.assign(events,{aftermath:`${r.id}.${c.id}.comment`,alibi:`${r.id}.${c.id}.alibi`,detail:r.id===c.culprit?`${r.id}.secret`:`${r.id}.${c.id}.detail`});
  if(r.id===c.culprit)events.reconstruction=`${r.id}.${c.id}.detail`;
  characters[r.id]=role(c.id,r.id,events,'full');
 }
 const quick=QUICK_ROLES[c.id];characters[quick]=role(c.id,quick,compactEvents[c.id],'quick');
 const guide={night:'guide.night',discovery:`guide.crime.${c.id}`};
 if(c.id==='fire')Object.assign(guide,{role:'guide.role',watch:'guide.watch',observed:'guide.observed'});
 characters.guide=role(c.id,'guide',guide,'creator');
 return [c.id,{caseId:c.id,quickRole:quick,characters}];
}));
export const roleManifest=(caseId,characterId)=>CASE_RECORDING_MANIFEST[caseId]?.characters[characterId]||null;
export function dialogueLine(caseId,characterId,event){
 const id=roleManifest(caseId,characterId)?.events[event];
 if(!id||!LINE[id])throw Error(`Unmapped dialogue event: ${caseId}/${characterId}/${event}`);
 return LINE[id];
}
export const requiredLines=(caseId,characterId)=>(roleManifest(caseId,characterId)?.lineIds||[]).map(id=>LINE[id]);
export function estimateRecordingMinutes(lines,reviewOnly=[]){
 const spokenSeconds=line=>line.text.trim().split(/\s+/).length/2.2;
 return Math.max(1,Math.ceil((lines.reduce((n,l)=>n+spokenSeconds(l)*2+8,0)+reviewOnly.reduce((n,l)=>n+spokenSeconds(l)+3,0))/60));
}
export function assertDialogueManifest(){
 const used=new Set();
 for(const c of CASES){
  const manifest=CASE_RECORDING_MANIFEST[c.id];
  for(const r of Object.values(manifest.characters)){
   if(!r.lineIds.length)throw Error('Empty dialogue role');
   if(r.mode==='quick'&&(r.lineIds.length>6||r.spoilers))throw Error('Quick role must be complete, safe and at most six lines');
   for(const id of r.lineIds){const line=LINE[id];if(!line||line.resident!==r.characterId||!line.fingerprint||!line.performanceKey)throw Error(`Invalid recording requirement: ${id}`);used.add(id);}
  }
 }
 for(const line of VOICES)if(!used.has(line.id))throw Error(`Unreachable spoken script: ${line.id}`);
 return true;
}
