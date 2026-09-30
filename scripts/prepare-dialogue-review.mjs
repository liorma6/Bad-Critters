import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CASES,RESIDENTS,SUPPORTING,VOICES,LINE} from '../src/content.js';
import {roleManifest,ROLE_DESCRIPTIONS,assertDialogueManifest} from '../src/dialogue-manifest.js';
import {DARK_FRAMES} from '../src/dark-frames.js';

assertDialogueManifest();
const folder='docs/dialogue-review';
await mkdir(folder,{recursive:true});
const shared=['goat','pigeon','snake','cat','boar','turtle'];
const eventLabels={
 encounter:'מפגש מוקדם / ״שלום לשכן״ — לפי הבחירה',intro:'פתיחת שיחה לפני האירוע',watched:'תגובה לעדשה — לפי הפעולה',bell:'תגובה לפעמון — לפי הפעולה',water:'תגובה לממטרה — לפי הפעולה',
 secret:'שיחה: ״מה הסיפור שלך בשכונה?״',complaint:'שיחה נוספת: ״איך החיים בשכונה?״',boast:'שיחה נוספת: ״במה אתם גאים?״',question:'שיחה נוספת: ״אפשר לשאול משהו?״',
 aftermath:'פתיחת שיחה אחרי האירוע',alibi:'חקירה: ״איפה היית בזמן שזה קרה?״',detail:'חקירה: ״מה עוד ראית או שמעת?״',accusation:'תגובה להאשמה שלא הוכחה — אם מנסים',reconstruction:'שחזור לאחר פתרון התיק',
 notice:'לפני האירוע: ״מה כדאי לבדוק בשכונה?״',copies:'שיחה: ״איך בודקים רישום?״',receipt:'שיחה: ״ומה עם קבלה מקומטת?״',chair:'לפני האירוע: ״אפשר לשבת לידך?״',care:'אחרי האירוע: ״איך אפשר לעזור לשכנים?״',
 queue:'לפני האירוע: ״איך הלך בוועד?״',pause:'״רוצה רגע של שקט?״ / פתיחת שיחה אחרי האירוע',space:'אחרי האירוע: ״איך אפשר לעזור?״',
 role:'תחילת ההדרכה — אם משחקים עם הדרכה',watch:'ההדרכה: כיוון העדשה',observed:'ההדרכה: אחרי התצפית',night:'מעבר ללילה',discovery:'גילוי האירוע',
};
const principalOrder=['encounter','intro','watched','bell','water','secret','complaint','boast','question','aftermath','alibi','detail','accusation','reconstruction'];
const quickOrder={fire:['intro','notice','copies','receipt','care'],courtyard:['intro','notice','copies','receipt','chair'],balcony:['intro','notice','queue','pause','space']};
const speakers=[...RESIDENTS,...SUPPORTING,{id:'guide',name:'משמרת השכונה'}];
const unique=new Set();let total=0;
const characters=speakers.map(s=>{
 const cases=CASES.map((c,index)=>{
  const role=roleManifest(c.id,s.id);if(!role)return {id:c.id,title:c.title,number:index+1,lines:[],note:'אין לדמות משפטים מדובבים בתיק הזה.'};
  const order=s.id==='guide'?['role','watch','observed','night','discovery']:shared.includes(s.id)?principalOrder:quickOrder[c.id];
  const seen=new Set(),lines=[];
  for(const event of order){const id=role.events[event];if(!id||seen.has(id))continue;seen.add(id);const l=LINE[id];unique.add(id);total++;
   const usedIn=CASES.filter(other=>roleManifest(other.id,s.id)?.lineIds.includes(id)).map(other=>CASES.indexOf(other)+1);
   lines.push({number:lines.length+1,id,event,label:(event==='intro'&&!shared.includes(s.id)?'מפגש מוקדם / פתיחת שיחה לפני האירוע':eventLabels[event]),text:l.text,version:l.scriptVersion,fingerprint:l.fingerprint,sharedCases:usedIn});
  }
  assert.deepEqual(new Set(lines.map(l=>l.id)),new Set(role.lineIds),`${c.id}/${s.id}`);
  let note='';
  if(shared.includes(s.id))note='שיחות ותגובות לפעולות יכולות לחזור גם בהמשך; הסדר בתוך ההסתעפויות תלוי בשחקן.';
  if(role.events.detail&&role.events.detail===role.events.secret){const repeated=lines.find(l=>l.id===role.events.secret);note+=` בשאלת ההמשך בחקירה חוזר משפט ${repeated.number}; משפט השחזור נאמר רק לאחר פתרון התיק.`;}
  if(s.id==='badger'&&c.id==='fire')note='ההיכרות נאמרת גם במפגש המוקדם. שאלות הקבלה והרישום זמינות לפני האירוע וגם אחריו; משפט העזרה לשכנים נאמר אחרי האירוע.';
  if(s.id==='badger'&&c.id==='courtyard')note='כל חמשת המשפטים נאמרים לפני האירוע; לאחר מותו אין לעמוס משפטים נוספים.';
  if(s.id==='hedgehog')note='משפט ההיכרות נאמר גם במפגש המוקדם. משפט ההפסקה זמין לפני האירוע וגם פותח שיחה אחריו; בקשת המים נאמרת אחריו.';
  if(s.id==='guide')note=index===0?'שלושת משפטי ההדרכה נשמעים רק אם ההדרכה מופעלת.':'אין משפטי הדרכה בתיק הזה.';
  return {id:c.id,title:c.title,number:index+1,lines,note};
 });
 const description=s.id==='guide'?'קול ההדרכה: רגוע, ברור וענייני. אינו דמות שמופיעה בשכונה.':s.id==='badger'?'עמוס, גירית ורואה חשבון יבש ומצחיק, בודק כל חותמת.':s.id==='hedgehog'?'רינה, קיפודה מעשית, רוצה קצת שקט ופחות טפסים.':ROLE_DESCRIPTIONS[s.id];
 return {id:s.id,name:s.name,description,art:s.id==='guide'?'assets/icon.svg':`assets/art/${s.id}-${shared.includes(s.id)?'dark':'alive'}.webp`,frame:DARK_FRAMES[s.id]?.[0]?.slice(0,4)||null,cases};
});
assert.equal(unique.size,VOICES.length);assert.equal(total,258);
const data={title:'חיות שכונה — כל הדמויות וכל המשפטים',subtitle:'עותק לעריכה לפני ההקלטות',date:'28.09.2026',source:'הנוסח הקיים במשחק',uniqueLines:unique.size,caseRequirements:total,characters};
await writeFile(`${folder}/review-source.json`,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({file:`${folder}/review-source.json`,characters:characters.length,uniqueLines:unique.size,perCaseEntries:total}));
