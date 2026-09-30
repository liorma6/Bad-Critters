import {RESIDENTS,SUPPORTING} from './residents.js';
import {SIGNATURE_LINES,SIGNATURE_TRIGGERS} from './signature-lines.js';
import {SMALL_ROLE_LINES} from './small-roles.js';
import {recordingFingerprint} from './recording-identity.js';
import {DIALOGUE_REVISIONS} from './dialogue-revisions.js';
const common={
 goat:['ירחמיאל. המדרכה שלי. העירייה רק משלמת עליה ארנונה בטעות.','יא פרחחים, עופו לי מהמרצפת לפני שאני תוקע פה גרעפס שיפנה את הרחוב.','מי מצלצל? יש פה אנשים שמנסים לשמוע את עצמם מתעצבנים.','הממטרה עברה את הגבול. גם לה אני פותח תיק.','יש לי רשימה של מי שלא אומר לי בוקר טוב. גם מי שאומר שמח מדי נכנס.','איימתי עליו בגרעפס. יש הבדל בין מפגע ריח לבין ראיה.'],
 pigeon:['נבו, חקירות. אל תסתכלו על התג, המדפסת חתכה לי את הסמכות.','אני לא מסתיר מחברת. אני מגן על מקורות. כרגע המקור זה אני.','כינוס חירום. ידעתי. כלומר, המקורות ידעו לפני שידעתי.','זהירות על התיק! הכול מודפס. גיבוי אין. הייתי צריך מקום לתמונות שלי.','כן, מכרתי כמה דוחות בלי לבדוק. אבל עם כריכה! אנשים מזלזלים בכריכה.','אתם ננעלים על חשוד מוקדם מדי. זה משפט שלי, אגב.'],
 snake:['זלמן. אני מביא לפה את כל הצ׳וצ׳ות. רגע, אמא מתקשרת. כן אמא, אכלתי.','תסתכלו, תלמדו. ככה אני קורץ לה. פעם אחת היא הביאה לי טיפות עיניים.','יש שם בנות? רגע, איך אני נראה? אל תענו, תגידו טוב.','תסגרו! שמתי בושם לדייט. היא עוד לא אישרה, אבל אני לא מחכה לרגע האחרון.','לדייט אני מגיע מוכן. שלושים נושאי שיחה, מודפסים. אם היא שותקת, אני נותן לה לבחור מספר.','חשוד? זה בגלל המבט? אני עושה אותו לכולן. תביאו ראיות, לא פרשנות.'],
 cat:['מרגלית. אל תישענו על הצינור. הוא באמצע משפט.','אני בודקת לחץ מים. אנשים מדברים כשהלחץ יורד.','התקהלות לא כלולה בשכירות. גם לא אם אתם עומדים.','סוף סוף מישהו שוטף פה. חבל שזה הראיות.','היה פנקס נוסף. הנהלת חשבונות זקוקה לפעמים לפרטיות.','כל דבר פה ״מרגלית, מרגלית״. מה אני, גם בעלת הבית וגם החשודה התורנית?'],
 boar:['בני. מה שנראה לכם סדק, לי נראה שיחה שעוד לא סיימנו.','אני לא מזיע. הגוף עושה ניקוז. תקין לגמרי.','כולם פה? מצוין. אז אישור בעל פה נחשב פרוטוקול?','מי פתח את המים? עכשיו גם ייבוש. זה לא היה בהצעת המחיר.','יש שני דוחות. הישן מפרט את הבעיות. בחדש חתמתי ״כשיר״. תתחילו בחדש.','אתם רואים תיק עבודה וישר קבלן. טוב, הפעם צדקתם בחצי.'],
 turtle:['צביקה. שליח. אם זה ״רק רגע״, אני רוצה לדעת כמה רגעים יש ברגע הזה.','תסתכלו. רק בלי ״תחייך״. גם לפנים שלי מגיעה הפסקה.','אני בא, אני בא. כל צלצול נוסף מוריד לי את החשק להגיע.','יופי. עכשיו גם רטוב. בני, שוב תגיד ״זה יתייבש לבד״? בפעם הקודמת חיכיתי.','אני שומר העתקים. אנשים משנים גרסה, ואז אני צריך לבוא שוב.','יופי, עכשיו חקירה. תגידו שעה, אני אראה לכם איפה הייתי ונגמור עם זה.']
};
const speech={
 fire:{
 goat:['הבית נשרף, אנשים איבדו בית. תביאו להם כיסאות! לפחות שלא יעמדו פה.','בחמש חמישים ושמונה מרגלית נכנסה לבד. בשש ושלוש יצאה. אני עמדתי מול הדלת.','בני היה איתי על הספסל כל הזמן. אני זוכר טוב מאוד. הוא לא סתם את הפה.'],
 pigeon:['זה מתוכנן. או מקרי באופן מתוכנן. תרשמו רק את החלק הראשון.','ראיתי את בני בבניין בצהריים. בערב כבר לא. אלה שתי שעות שונות, אני יודע.','המזוודות של מרגלית היו בחוץ לפני העשן. המקור שלי הוא העיניים, במקרה הזה.'],
 snake:['העץ ליד הדלת שרוף. את הריח הזה לא שוכחים. טוב שכולם יצאו.','שכבתי מתחת למעקה. מרגלית אמרה בטלפון: ״מחר לא יהיה להם מה לבדוק״. את זה שמעתי ברור.','היא דיברה על הפנקס. שמעתי ״שכירות״, לא ״צנרת״. לא ניחשתי. הקשבתי.'],
 cat:['כל הדיירים יצאו. עכשיו תפסיקו לשאול על הארון.','לא נכנסתי לבית אחרי חמש וחצי. נשארתי במתנ״ס.','הצתתי כדי שהפנקס ייעלם. ידעתי שהדיירים בחוץ. זה לא הופך את זה לפחות נורא.'],
 boar:['אוי ואבוי. מרגלית עוד תבקש לסדר לה את זה עד הצהריים.','הייתי עם ירחמיאל בספסל משש פחות רבע. עד שהתחיל העשן.','בדיקת החשמל שלי הסתיימה בצהריים. שמרתי דוח. הפעם אחד.'],
 turtle:['המזוודות יצאו בחמש ארבעים. העשן הגיע בשש וחמש. רשמתי. עכשיו גם להקריא לכם?','מרגלית חתמה על אחסון החפצים שלה לפני השרפה. המקור אצלי. כמובן אצלי. מה היה חסר לי? עוד נייר.','על ההזמנה כתוב ״עד אחרי הביקורת״. ביקורת השכירות נקבעה למחרת. הכול כתוב. רק אני צריך גם לדבר.']},
 courtyard:{
 goat:['עמוס מת. אני רבתי איתו על הכיסא. לא רציתי שהוא יישאר ריק.','בזמן הרצח הייתי במאפייה. צביקה היה איתי. כן, אמרתי לעמוס שאגמור איתו.','התכוונתי שאגמור את הוויכוח. הפתק שאחר כך השארתי לו היה התנצלות.'],
 pigeon:['רצח? רגע. כשאמרתי שאני מטפל בהכול, התכוונתי לבגידות ולאופניים.','בשש הייתי במחסן. לא נכנסתי לחצר. לא פגשתי את עמוס.','עמוס עמד לחשוף את הדוחות המזויפים שלי. רצחתי אותו ולקחתי את המחברת. אין לי מקור אחר להאשים.'],
 snake:['עמוס אף פעם לא גרר כיסא. היה מתחשב. מגיע לו שיבדקו פה הכול כמו שצריך.','אני הייתי מתחת לספסל וראיתי: בשש נבו ירד לחצר, ועמוס חיכה לו. אחרי שתי דקות שמעתי נפילה.','נבו יצא לבד. המחברת האדומה של עמוס הייתה אצלו. עמוס כבר לא זז. אני זוכר את זה. הלוואי שלא.'],
 cat:['הצינורות שקטים מאז. גם לי אין מה להגיד על זה.','שמעתי את עמוס אומר לנבו: ״מחר כולם יראו מה מכרת״.','יש העתק של התלונה במתנ״ס. עמוס לא סמך על עותק יחיד. אדם סביר.'],
 boar:['הכיסא הפוך. שאף אחד לא יזיז אותו! אחר כך יגידו שאני נגעתי.','הייתי במשלוחים. ראיתי את נבו חוזר מהחצר בלי המשקפיים ישר.','הוא שאל אם יש לי דבק לרצועה. אמרתי שאין. הפעם באמת לא היה.'],
 turtle:['בשש ודקה ירחמיאל ביקש ממני מפית. בשש ושלוש עוד התווכחנו כמה מפיות זה סביר. שתי דקות מהחיים. על מפיות.','הייתי עם ירחמיאל במאפייה מחמש חמישים עד שש ועשר. ברצף. הקבלה אצלי. לפחות היא לא מתווכחת.','עמוס מסר לי העתק מהתלונה על נבו. דוחות מומצאים, כסף אמיתי. אני שומר את ההעתק. שלא תשלחו אותי לחפש שוב.']},
 balcony:{
 goat:['רינה נפצעה בגלל מרפסת. אפילו אני לא רב עם כוח הכבידה.','ראיתי את בני מוריד את שלט הסגירה. הוא אמר שמותר לעלות.','לא שמעתי אף אחד מתעסק במעקה. שמעתי אותו מתעסק במילים.'],
 pigeon:['אולי חבלה. אולי לא. אני מנסה עכשיו את השיטה של לבדוק קודם.','זלמן היה על המעקה אתמול. ראיתי. זה כל מה שראיתי.','הוא היה שם הרבה אחרי שהדוח כבר נכתב. כן, בדקתי את התאריך.'],
 snake:['רינה ישבה, ואז המרפסת קרסה. כולם אחורה, תנו לה מקום.','בזמן הקריסה הייתי מתחת לספסל. מהמעקה ירדתי אתמול. לא אותו יום, לא אותו מקום.','הסדק היה שם לפני שבאתי. צביקה צילם אותו עם תאריך. תבדקו את הצילום.'],
 cat:['ביקשתי לפתוח את המרפסת. לא ביקשתי לפתוח אותה לרחוב.','בני אמר שהדוח החדש מבטל את הקודם. שמרתי את שניהם.','בדוח הישן כתוב לסגור מיד. בחדש הוא כתב ״כשיר״. בלי ביקור נוסף.'],
 boar:['רינה נפגעה. אני יודע. תנו לי רגע בלי מילים של עבודה.','לא ידעתי שיש סכנה. הדוח הדחוף לא הגיע אליי.','קיבלתי את האזהרה. חסכתי את התיקון ואישרתי לפתוח. זו לא חבלה של מישהו אחר. זו האחריות שלי.'],
 turtle:['ביום שני, בשתים עשרה ושבע, מסרתי לבני את הדוח. הוא חתם. עם כתם קפה. גם את זה הייתי צריך לשמור.','המקור בפינת המשלוחים. כתוב ״סכנה. להשאיר סגור״. לכו תבדקו. אני כבר עשיתי את הדרך.','הצילום בדוח נעשה לפני הביקור של זלמן. הסדק כבר היה שם. אל תגררו אותי שוב רק כדי להסתכל על התאריך.']}
};
const commonKeys=['greet','watched','bell','water','secret','wrong'];
export const VOICES=[];
for(const r of RESIDENTS){
 common[r.id].forEach((text,i)=>VOICES.push({id:`${r.id}.${commonKeys[i]}`,character:r.name,resident:r.id,text,direction:r.direction,context:['Introduction','Observed through the lens: abrupt public pose','Bell gathering reaction','Sprinkler reaction','Private secret, not itself proof','Unsupported accusation response'][i],essential:i===0,file:`assets/voices/${r.id}.${commonKeys[i]}.mp3`}));
 for(const caseId of ['fire','courtyard','balcony'])speech[caseId][r.id].forEach((text,i)=>VOICES.push({id:`${r.id}.${caseId}.${['comment','alibi','detail'][i]}`,character:r.name,resident:r.id,text,direction:r.direction,context:`${caseId}: ${['aftermath reaction','recoverable testimony / claimed alibi','follow-up; culprit confession plays only during reconstruction'][i]}`,essential:true,file:`assets/voices/${r.id}.${caseId}.${['comment','alibi','detail'][i]}.mp3`}));
}
const guideLines=[['role','אתם משמרת השכונה. הכירו את ירחמיאל, התיש שמפקח על המדרכה.'],['watch','כוונו את העדשה לירחמיאל. שימו לב איך ההתנהגות שלו משתנה.'],['observed','התנהגות אינה הוכחה. עכשיו בדקו את ההודעה בכניסה לבית.'],['night','התצפית הסתיימה. הערב יורד. צפו במה שמשתנה.'],['crime.fire','הבית נשרף. כולם פונו, אבל הנזק נשאר. בדקו את הכניסה.'],['crime.courtyard','עמוס נמצא מת בחצר. זו זירת רצח. בדקו את הממצאים ושאלו מי היה כאן.'],['crime.balcony','המרפסת קרסה ורינה נפצעה. בדקו מי ידע על הסכנה ומי אישר לפתוח.']];
for(const [key,text]of guideLines)VOICES.push({id:`guide.${key}`,character:'משמרת השכונה',resident:'guide',text,direction:'Clear factual adult Hebrew. Calm and concise; treat death and injury seriously. No ominous theatrics.',context:key.startsWith('crime')?'Incident discovery, before inspection':`Tutorial / transition: ${key}`,essential:true,file:`assets/voices/guide.${key}.mp3`});
for(const line of VOICES)line.scriptVersion=1;
for(const signature of SIGNATURE_LINES){
 const r=RESIDENTS.find(r=>r.id===signature.resident),existing=VOICES.find(v=>v.id===signature.id);
 const line={...signature,character:r.name,direction:r.direction+' '+({greet:'Introduce yourself to the patrol.',watched:'React to being watched.',complaint:'Complain to a neighbor, not to an audience.',boast:'Believe your own absurd claim.',question:'Respond to a routine question, without giving evidence.',arrival:'Greet the patrol in passing.'}[signature.key]),context:SIGNATURE_TRIGGERS[signature.key],essential:false,personal:true,file:`assets/voices/${signature.id}.mp3`};
 // Rewritten legacy greetings/watched lines deliberately invalidate old takes.
 if(existing)Object.assign(existing,line);else VOICES.push(line);
}
for(const [id,resident,text,hint,scriptVersion]of SMALL_ROLE_LINES){const r=SUPPORTING.find(r=>r.id===resident);VOICES.push({id,resident,character:r.name,text,hint,scriptVersion,direction:r.direction,context:'Complete supporting role; see case event manifest',essential:true,personal:true,file:`assets/voices/${id}.mp3`});}
for(const line of VOICES){
 const revision=DIALOGUE_REVISIONS[line.id];if(revision){line.scriptVersion=revision.version;line.hint=revision.hint;}
 line.performanceKey=`${line.resident}:${line.key?'signature:'+line.key:line.id.split('.').slice(1).join(':')}`;
 line.fingerprint=recordingFingerprint(line.text,line.performanceKey);
 line.personal=true;
 const solution=['cat.fire.detail','pigeon.courtyard.detail','boar.balcony.detail'].includes(line.id);
 line.spoilerSensitivity=solution?'solution':SMALL_ROLE_LINES.some(l=>l[0]===line.id)||line.key||/\.(bell|water|wrong)$/.test(line.id)?'safe':'investigation';
 line.hint??='לדבר אל השכן באופן טבעי. אפשר לקחת נשימה בין המשפטים.';
}
export const LINE=Object.fromEntries(VOICES.map(v=>[v.id,v]));
