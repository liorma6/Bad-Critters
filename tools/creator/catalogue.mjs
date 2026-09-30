import {VOICES,RESIDENTS,SUPPORTING,CASES} from '../../src/content.js';
import {roleManifest,ROLE_DESCRIPTIONS,assertDialogueManifest} from '../../src/dialogue-manifest.js';

const labels={arrival:'מפגש בתחילת המשמרת',greet:'פתיחת שיחה',watched:'תגובה לתצפית בעדשה',bell:'תגובה לפעמון ולהתאספות',water:'תגובה להפעלת הממטרה',secret:'שיחה על הסיפור האישי',wrong:'תגובה להאשמה שלא הוכחה',complaint:'שיחה על החיים בשכונה',boast:'שיחה על מה שהדמות גאה בו',question:'תגובה לבקשה לשאול שאלה',intro:'היכרות עם השכן',copies:'הפניה להשוואת עותק למקור',receipt:'עצה לבדיקת קבלה',notice:'הפניה להודעה לפני האירוע',care:'עזרה לשכנים אחרי השרפה',chair:'ישיבה בחצר לפני האירוע',queue:'שיחה על התור בוועד',pause:'מנוחה לפני האירוע',space:'בקשת מרחב ועזרה אחרי האירוע',role:'פתיחת ההדרכה',watch:'הנחיה לתצפית בעדשה',observed:'אחרי התצפית הראשונה',night:'מעבר מתצפית ללילה'};
const order=['arrival','greet','watched','bell','water','secret','complaint','boast','question','wrong','intro','copies','receipt','notice','care','chair','queue','pause','space'];
export function creatorCatalogue(){
 assertDialogueManifest();
 const characters=[...RESIDENTS,...SUPPORTING,{id:'guide',name:'משמרת השכונה',direction:'קריינות עניינית וברורה. שעות ושמות מדויקים.'}].map(r=>({id:r.id,name:r.name,narrator:r.id==='guide',description:ROLE_DESCRIPTIONS[r.id]||'קריינות ההדרכה והאירועים',direction:r.direction}));
 const lines=VOICES.map(line=>{
  const cases=CASES.filter(c=>roleManifest(c.id,line.resident)?.lineIds.includes(line.id));
  const key=line.id.split('.').at(-1),c=cases.length===1?cases[0]:null;
  const context=line.id.startsWith('guide.crime.')?'גילוי האירוע, לפני בדיקת הזירה':key==='comment'?'פתיחת שיחה אחרי האירוע':key==='alibi'?'חקירה: איפה היית בזמן האירוע?':key==='detail'?c?.culprit===line.resident?'שחזור הפתרון — הודאה בסיום התיק':'חקירה: מה עוד ראית או שמעת?':labels[key]||line.context;
  return {id:line.id,characterId:line.resident,text:line.text,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,hint:line.hint,context,group:cases.length>1?'shared':cases[0]?.id||'shared',cases:cases.map(c=>c.id),order:order.indexOf(key)<0?100+['comment','alibi','detail'].indexOf(key):order.indexOf(key)};
 }).sort((a,b)=>characters.findIndex(c=>c.id===a.characterId)-characters.findIndex(c=>c.id===b.characterId)||(['shared',...CASES.map(c=>c.id)].indexOf(a.group)-['shared',...CASES.map(c=>c.id)].indexOf(b.group))||a.order-b.order);
 return {characters,groups:[{id:'shared',title:'משפטים משותפים'},...CASES.map((c,i)=>({id:c.id,title:`תיק ${i+1} · ${c.title}`}))],lines};
}
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(creatorCatalogue()));
