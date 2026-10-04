import {incidentCaption} from './incidents.js';
import {LOCATIONS} from './content.js';

export const PHASES=[['observe','תצפית'],['night','הלילה יורד'],['investigate','חקירה'],['accuse','האשמה'],['resolve','שחזור ותוצאה']];
export const tutorialState=enabled=>({enabled,step:enabled?'lens':'done',watchSeconds:0,activeSeconds:0,observationId:'watch-goat'});
export const tutorialBlocking=s=>s.tutorial.enabled&&!['advance','done'].includes(s.tutorial.step)&&s.flow!=='night'&&s.flow!=='discovery';
export function tutorialEvent(s,event,id){
 const t=s.tutorial;if(!t.enabled)return;
 if(t.step==='lens'&&event==='lens-enabled'&&s.lens.active)t.step='place-lens';
 else if(t.step==='place-lens'&&event==='lens-placed'&&id==='goat')t.step='watch';
 else if(t.step==='watch'&&event==='watched'&&s.observations?.some(o=>o.id===t.observationId))t.step='notebook-before';
 else if(t.step==='notebook-before'&&event==='notebook')t.step='notebook-entry';
 else if(t.step==='notebook-entry'&&event==='entry-opened'&&id===t.observationId)t.step='notebook-return';
 else if(t.step==='notebook-return'&&event==='notebook-closed'){t.step='prefact';s.lens.active=false;}
 else if(t.step==='prefact'&&event==='prefact'&&id===s.case.preLocation&&s.preliminary.some(entry=>entry.location===id))t.step='prefact-return';
 else if(t.step==='prefact-return'&&event==='dialog-closed')t.step='advance';
 else if(t.step==='trace'&&event==='evidence'&&id===s.case.source)t.step='trace-return';
 else if(t.step==='trace-return'&&event==='dialog-closed')t.step='witness';
 else if(t.step==='witness'&&event==='resident'&&id==='goat')t.step='ask-witness';
 else if(t.step==='ask-witness'&&event==='testimony'&&id==='goat')t.step='witness-return';
 else if(t.step==='witness-return'&&event==='dialog-closed')t.step='done';
}
export function skipTutorial(s){s.tutorial.enabled=false;s.tutorial.step='done';s.lens.active=false;for(const r of s.residents)r.watched=false;}
export const canAdvanceNight=s=>s.flow==='observe'&&(!s.tutorial.enabled||s.tutorial.step==='done'||s.tutorial.step==='advance'&&s.preliminary.some(entry=>entry.location===s.case.preLocation));
export const accusationRequirements=s=>s.reconstructing?'השחזור פועל. בסיומו יוצגו התוצאה והתיק הבא.':s.solved?'התיק כבר פוענח. אפשר לבחור תיק נוסף או לשחק שוב.':!s.crimeDone?'קודם עוברים ללילה ומגלים מה קרה.':s.clues.size<4?`נדרשות ארבע ראיות. כרגע אספתם ${s.clues.size}; בדקו עוד מקום או שאלו שכן.`:'';
export function phaseIndex(s){return s.solved||s.reconstructing?4:s.flow==='accuse'?3:['discovery','investigate'].includes(s.flow)?2:s.flow==='night'?1:0;}
export function guidance(s){
 if(s.paused)return {text:'המשחק מושהה. לחצו על המשך כדי לחזור לשכונה.',action:'resume',label:'המשך משחק',detail:'אפשר לפתוח את המחברת גם בזמן השהיה.'};
 if(s.reconstructing)return {text:'צפו בשחזור: הפעולות, הזמנים והעדויות מתחברים.',action:'none',label:'השחזור פועל',detail:s.case.reconstruction[Math.min(2,Math.floor(s.reconTime/6))]};
 if(s.solved)return {text:'התיק פוענח. מוכנים לתעלומה הבאה?',action:'next',label:s.index<2?'לתיק הבא':'בחירת תיק',detail:'אפשר גם לשחק שוב דרך העזרה.'};
 if(s.flow==='night')return {text:incidentCaption(s),action:'none',label:'ממתינים לגילוי',detail:'הזמן מתקדם אוטומטית כעת. העדשה מונחת בצד.'};
 if(s.flow==='discovery')return {text:s.case.consequence,action:'discover',label:'לבדוק מה קרה',target:{type:'location',id:s.case.source},detail:'האירוע התרחש. עכשיו אוספים ממצאים ושומעים את השכנים.'};
 if(s.flow==='accuse')return {text:'בחרו חשוד וארבע ראיות שמסבירות את המעשה.',action:'accuse',label:'בחירת חשוד וראיות',detail:'לא צריך לאסוף את כל הממצאים. אפשר לטעות ולנסות שוב.'};
 if(s.tutorial.enabled&&s.tutorial.step!=='done'){
  const steps={
   lens:{text:'לחצו על העדשה כדי להתחיל לצפות בשכנים.',action:'none',label:'בחרו את כלי העדשה',detail:'הכלי נמצא מתחת לשכונה.'},
   'place-lens':{text:'גררו את העדשה אל ירחמיאל, או הקישו עליו.',action:'none',label:'הציבו את העדשה',target:{type:'resident',id:'goat'},detail:'אפשר לגרור דרך הרקע המוחשך. התיש נשאר במקומו בזמן ההדרכה.'},
   watch:{text:'השאירו את העדשה על ירחמיאל ושימו לב לתגובה שלו.',action:'none',label:'התצפית מתבצעת',target:{type:'resident',id:'goat'},detail:'התצפית תירשם אחרי שתי שניות. התנהגות לבדה אינה הוכחה לאשמה.'},
   'notebook-before':{text:'ירחמיאל הסתיר את הפנקס. פתחו את מחברת החקירה.',action:'notebook',label:'לפתוח את המחברת',detail:'התצפית מתעדת את מה שראיתם; היא אינה קובעת מי אשם.'},
   'notebook-entry':{text:'פתחו את הרשומה החדשה כדי לקרוא מה נצפה.',action:'none',label:'התצפית במחברת',detail:'כאן נשמרים פרטים שמצאתם בשכונה.'},
   'notebook-return':{text:'לחצו על חזרה לשכונה כדי להמשיך לצפות.',action:'none',label:'חזרה לשכונה',detail:'אפשר לחזור למחברת בכל רגע.'},
   prefact:{text:'בדקו את ההודעה בכניסה לבית. לחצו על סמל ההודעה המודגש.',action:'prefact',label:'לבדוק את ההודעה בכניסה',target:{type:'location',id:s.case.preLocation},detail:'קודם קוראים את ההודעה. אחר כך תוכלו לבחור מתי לסיים את התצפית.'},
   'prefact-return':{text:'קראו את ההודעה, ואז לחצו על ״חזרה לשכונה״.',action:'none',label:'קריאת ההודעה בכניסה',detail:'ההודעה נשמרה במחברת. בחזרה לשכונה תוכלו להמשיך לצפות או לעבור ללילה.'},
   advance:{text:'אפשר להמשיך לצפות בשכנים. כשתהיו מוכנים להתקדם, לחצו כאן כדי לעבור ללילה.',action:'night',label:'סיום התצפית · מעבר ללילה',detail:'אתם עדיין בשלב התצפית. המעבר ללילה הוא לבחירתכם.'},
   trace:{text:'בדקו את הכניסה המפויחת — הנצנוץ מסמן ממצא.',action:'trace',label:'לבדוק את הבית שנשרף',target:{type:'location',id:'home'},detail:'ממצאים נשארים זמינים גם אם לא ראיתם את האירוע.'},
   witness:{text:'ירחמיאל היה ברחוב. שאלו אותו מה ראה בזמן האירוע.',action:'witness',label:'לשאול את ירחמיאל',target:{type:'resident',id:'goat'},detail:'עדות היא גרסה של שכן. כדאי להשוות אותה לממצאים.'},
   'trace-return':{text:'הממצא נשמר. חזרו לשכונה כדי לשאול שכן.',action:'none',label:'חזרה לשכונה',detail:'הזירה נשארת זמינה לבדיקה.'},
   'ask-witness':{text:'שאלו את ירחמיאל איפה היה בזמן האירוע.',action:'none',label:'לשמוע עדות',detail:'השאלה מופיעה בשיחה עם השכן.'},
   'witness-return':{text:'העדות נרשמה. חזרו לשכונה והמשיכו בחקירה.',action:'none',label:'חזרה לשכונה',detail:'אפשר להשוות את דבריו לממצאים במחברת. מכאן אתם מובילים.'}
  };return steps[s.tutorial.step]||steps.advance;
 }
 if(s.flow==='observe')return {text:'בחרו שכן או מקום להיכרות. כשתהיו מוכנים, עברו ללילה.',action:'night',label:'סיום התצפית · מעבר ללילה',detail:'הזמן לא יתקדם ללילה בלי הלחיצה שלכם. אפשר להמשיך לצפות ככל שרוצים.'};
 if(s.clues.size>=4)return {text:`אספתם ${s.clues.size} ראיות. השוו אותן במחברת ובחרו חשוד.`,action:'accuse',label:'לבנות האשמה',detail:'נדרשות ארבע ראיות תומכות, ולא כל הממצאים בשכונה.'};
 const next=s.case.clues.find(c=>!s.clues.has(c.id)&&['trace','document'].includes(c.kind)&&LOCATIONS.some(l=>l.id===c.location));
 const place=LOCATIONS.find(l=>l.id===next?.location);
 return {text:place?`בדקו את ${place.name} ואספו ממצא נוסף.`:'שאלו את השכנים מה ראו ופתחו את המחברת.',action:place?'inspect':'notebook',label:place?`בדיקה: ${place.name}`:'מחברת החקירה',target:place?{type:'location',id:place.id}:null,detail:`${s.clues.size===1?'ראיה אחת נאספה':s.clues.size+' ראיות נאספו'}. לפני האשמה צריך ארבע.`};
}
