import {ENTRANCES} from './scene-layout.js';
export {RESIDENTS,SUPPORTING} from './residents.js';
export {VOICES,LINE} from './voices.js';
export {CASES} from './cases.js';
export const LOCATIONS=[
 ['bakery','מאפיית פירורים','ריח של לחם טרי עולה מהמאפייה. ליד הדלפק יש שולחנות ולוח הודעות לשכנים.'],
 ['center','המתנ״ס','כאן מתקיימות אספות השכונה. ליד הכניסה תלוי לוח הודעות, ובפנים נשמרים מסמכים של הוועד.'],
 ['home','בית משותף בע״מ','מרפסות, תיבות דואר ומרגלית שמשוכנעת שהכול שלה.'],
 ['garden','חצר הספסלים','הגינה ציבורית. ספסל מתוקן ועציצים מספרים על מי שעבר כאן.'],
 ['delivery','פינת משלוחים','כל עגלה ומעטפה נרשמות כאן. אחרי האירוע תוכלו לבדוק את הרישומים.'],
 ['shed','מחסן ״זמני״','הדלת פתוחה מעט. בפנים יש מקום ליותר סודות מכפי שנראה.']
].map(([id,name,description])=>({id,name,description,door:ENTRANCES[id]}));
