// Scene consequences are derived, not temporary effects. Solving never repairs them.
export const INCIDENT_DURATION=12;
export function sceneState(s){
 const replay=s.reconstructing,clock=replay?s.reconTime:s.nightElapsed;
 const happened=replay?clock>=(s.case.id==='courtyard'?6:12):s.crimeDone||(s.flow==='night'&&clock>=7);
 return {burned:s.index>0||(s.case.id==='fire'&&happened),collapsed:s.case.id==='balcony'&&happened,body:s.case.id==='courtyard'&&happened,memorial:s.index>1,badgerAlive:s.case.id==='fire'||s.case.id==='courtyard'&&!happened,hedgehog:s.case.id==='balcony'?(happened?(s.solved?'gone':'injured'):'balcony'):null,fireActive:s.case.id==='fire'&&((s.flow==='night'&&clock>=3&&clock<9)||(replay&&clock>=12&&clock<17)),collapseActive:s.case.id==='balcony'&&((s.flow==='night'&&clock>=6&&clock<9)||(replay&&clock>=12&&clock<15)),smoke:s.case.id==='fire'&&happened};
}
export function incidentCaption(s){
 if(s.nightElapsed<2.5)return 'הערב יורד. התושבים ממשיכים בדרכם.';
 const t=s.nightElapsed;
 return s.case.id==='fire'?(t<5?'18:05 · עשן עולה מבית המגורים':t<9?'אש בחלונות. הדיירים בחוץ; הכבאים בדרך.':'האש כובתה. הנזק נשאר.'):s.case.id==='courtyard'?(t<5?'18:02 · קול נפילה מתוך החצר':t<8?'עמוס אינו מגיב. מוזעקת עזרה.':'הרופא קובע: עמוס נרצח. החצר נסגרת.'):t<6?'18:05 · סדק ורעש מהמרפסת':t<9?'המרפסת קורסת. רינה נפגעה.':'הצוות מטפל ברינה. אין להתקרב להריסות.';
}
export const AFTERMATH_SPOTS={fire:[[671,373],[370,460],[315,600],[850,451],[665,681],[469,688]],courtyard:[[350,415],[651,449],[324,592],[815,440],[682,689],[480,681]],balcony:[[650,373],[360,438],[328,600],[650,515],[679,688],[470,687]]};
export function aftermathTarget(s,r,i){const spots=AFTERMATH_SPOTS[s.case.id];const base=spots[i];return {x:base[0]+(r.routineIndex%2?22:-15),y:base[1]+(r.routineIndex%2?8:-8)};}
export const RECON_STOPS={fire:['delivery','home','center'],courtyard:['garden','garden','shed'],balcony:['delivery','home','shed']};
export const RECON_WITNESSES={fire:{goat:[328,420],boar:[350,460]},courtyard:{snake:[136,591],goat:[219,345],turtle:[298,354]},balcony:{goat:[706,385],cat:[923,370],turtle:[445,690]}};
