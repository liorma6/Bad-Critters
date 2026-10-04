import {tutorialState,tutorialEvent,tutorialBlocking,canAdvanceNight} from './progression.js';
import {findRoute} from './scene-layout.js';
import {CASES,RESIDENTS,LOCATIONS} from './content.js';
import {INCIDENT_DURATION,AFTERMATH_SPOTS,aftermathTarget,RECON_STOPS,RECON_WITNESSES} from './incidents.js';
export const locationById=id=>LOCATIONS.find(l=>l.id===id);
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createState(index=0,{tutorial=index===0}={}){
 const c=CASES[index];if(!c)throw new Error('Unknown case');
 return {index,case:c,flow:'observe',nightElapsed:0,tutorial:tutorialState(tutorial),preliminary:[],unread:new Set(),lastFinding:null,time:0,phase:'day',crime:'waiting',crimeProgress:0,crimeDone:false,paused:false,speed:1,lens:{x:480,y:390,active:false,radius:83},residents:RESIDENTS.map((r,i)=>({...r,x:r.spawn[0],y:r.spawn[1],route:[],target:null,action:'idle',carry:null,routineIndex:i%r.routine.length,wait:3+i*2,watched:false,reactionCooldown:0,secretDone:false})),clues:new Set(),events:[],signals:[],bell:2,sprinkler:2,bellUntil:0,waterUntil:0,hints:0,attempts:0,solved:false,reconstructing:false,reconTime:0,notes:'',milestones:new Set(),serial:0};
}
export const timeLabel=s=>s.flow==='observe'?`17:${String(Math.min(39,Math.floor(s.time/85*40))).padStart(2,'0')}`:s.crimeDone?'18:20':s.nightElapsed<3?'17:40':'18:05';
export function beginNight(s){
 if(!canAdvanceNight(s))return false;
 s.flow='night';s.phase='night';s.nightElapsed=0;s.time=85;s.paused=false;s.lens.active=false;s.bellUntil=0;s.waterUntil=0;s.crime='approach';s.selection=null;s.hover=null;
 s.residents.forEach(r=>{r.route=[];r.watched=false;r.carry=null;});
 record(s,'התצפית הסתיימה. הערב יורד.','transition','17:40');return true;
}
export function acknowledgeCrime(s){if(s.flow!=='discovery')return false;s.flow='investigate';if(s.tutorial.enabled)s.tutorial.step='trace';return true;}
export function inspectPreliminary(s,id){
 if(s.flow!=='observe'||id!==s.case.preLocation)return false;
 if(s.preliminary.length){tutorialEvent(s,'prefact',id);return false;}
 const entry={id:`pre-${s.case.id}`,title:'הרישום שלפני האירוע',text:s.case.preFact,location:id,kind:'observation',time:timeLabel(s)};
 s.preliminary.push(entry);s.unread.add(entry.id);s.lastFinding={id:entry.id,title:entry.title};record(s,`תצפית נוספה למחברת: ${entry.title}`,'evidence');tutorialEvent(s,'prefact',id);return true;
}
export function record(s,text,kind='observation',time){s.events.unshift({text,kind,time:time||timeLabel(s),id:++s.serial});if(s.events.length>100)s.events.pop();}
export function discover(s,id){const clue=s.case.clues.find(c=>c.id===id);if(!clue||s.clues.has(id))return false;s.clues.add(id);s.unread.add(id);s.lastFinding={id,title:clue.title};record(s,`${clue.kind==='testimony'?'עדות נרשמה':'ממצא נרשם'}: ${clue.title}`,'evidence',clue.time);return true;}
export function inspect(s,id){if(!s.crimeDone||['night','discovery'].includes(s.flow))return [];const found=[];for(const c of s.case.clues)if(c.location===id&&c.kind!=='intervention'&&discover(s,c.id))found.push(c);return found;}
export function intervene(s,type){
 if(s.solved||s.reconstructing||['night','discovery'].includes(s.flow))return false;
 if(type==='bell'&&s.bell>0){s.bell--;s.bellUntil=s.time+14;record(s,'צלצלתם. השכנים מתאספים ברחוב, מחוץ לזירה.','intervention');s.residents.forEach((r,i)=>{navigate(r,{x:365+i*57,y:409+(i%2)*39});r.action='gather';});return true;}
 if(type==='sprinkler'&&s.sprinkler>0){s.sprinkler--;s.waterUntil=s.time+16;record(s,'הממטרה הופעלה מחוץ לזירה. התושבים עוקפים את המים. אין ממצא חדש.','intervention');return true;}return false;
}
export function evaluate(s,suspect,evidence){
 const ids=[...new Set(evidence)].filter(id=>s.clues.has(id));if(!s.crimeDone)return {ok:false,reason:'early'};
 if(!suspect||ids.length<4||ids.length>4)return {ok:false,reason:'incomplete'};
 const correct=suspect===s.case.culprit,coverage=s.case.proofGroups.filter(g=>g.some(id=>ids.includes(id))).length;
 return {ok:correct&&coverage===s.case.proofGroups.length,reason:!correct?'suspect':coverage<s.case.proofGroups.length?'evidence':'solved',coverage};
}
function navigate(r,target){r.target=target;r.route=findRoute(r,target);}
function move(r,dt,speed){while(r.route.length&&dist(r,r.route[0])<.001)r.route.shift();const p=r.route[0];if(!p)return true;const d=dist(r,p),step=Math.min(d,speed*dt);r.x+=(p.x-r.x)/d*step;r.y+=(p.y-r.y)/d*step;return false;}
export function updateTutorial(s,dt){
 if(s.paused||!s.tutorial.enabled||s.tutorial.step!=='watch')return;
 const r=s.residents.find(r=>r.id==='goat'),watched=s.lens.active&&dist(s.lens,r)<s.lens.radius;
 r.watched=watched;r.action=watched?'pretend':'idle';s.tutorial.watchSeconds=watched?s.tutorial.watchSeconds+Math.min(.1,Math.max(0,dt)):0;
 if(s.tutorial.watchSeconds>=2){
  s.observations??=[];const entry={id:s.tutorial.observationId,title:'תצפית על ירחמיאל',text:`${r.name} ${r.behavior}. זו תצפית, לא הוכחה לאשמה.`,kind:'observation',location:r.id,time:timeLabel(s)};
  if(!s.observations.some(o=>o.id===entry.id)){s.observations.push(entry);s.unread.add(entry.id);s.lastFinding={id:entry.id,title:entry.title};record(s,`${r.name} ${r.behavior}.`);}
  tutorialEvent(s,'watched');s.lens.active=false;
 }
}
export function update(s,dt){
 if(s.paused||s.solved||s.reconstructing||['discovery','accuse'].includes(s.flow))return;
 if(tutorialBlocking(s)){updateTutorial(s,dt);return;}
 const realDt=Math.min(Math.max(0,dt),.1);s.tutorial.activeSeconds+=realDt;
 if(s.flow==='night'){
  s.nightElapsed+=realDt;s.time+=realDt;s.lens.active=false;
  if(s.nightElapsed>=7&&!s.crimeDone){s.crimeDone=true;s.crime='done';record(s,s.case.consequence,'crime','18:05');s.residents.forEach((r,i)=>{[r.x,r.y]=AFTERMATH_SPOTS[s.case.id][i];r.action='react';r.wait=8+i*2;r.route=[];});}
  if(s.nightElapsed>=INCIDENT_DURATION){s.flow='discovery';s.phase='investigate';}return;
 }
 dt=realDt*s.speed;s.time+=dt;s.phase=s.flow==='observe'?'day':'investigate';
 for(const [i,r]of s.residents.entries()){
  const was=r.watched;r.watched=s.lens.active&&dist(s.lens,r)<s.lens.radius;r.reactionCooldown=Math.max(0,r.reactionCooldown-dt);
  if(r.watched&&!was&&r.reactionCooldown===0){r.reactionCooldown=18;record(s,`${r.name} ${r.behavior}.`);s.signals.push({x:r.x,y:r.y,text:'…',until:s.time+4,resident:r.id,event:'watched'});}
  if(s.bellUntil>s.time){r.action='gather';move(r,dt,54);continue;}
  if(r.watched){r.action='pretend';continue;}
  if(r.route.length){r.action='walk';const wet=s.waterUntil>s.time&&r.x<310&&r.y>565;const base={goat:25,pigeon:58,snake:32,cat:36,boar:45,turtle:21}[r.id];const rhythm=r.id==='pigeon'?(.8+.5*Math.max(0,Math.sin(s.time*4))):r.id==='goat'?(.6+.4*Math.abs(Math.sin(s.time*3))):1;move(r,dt,wet?18:base*rhythm);}
  else {r.wait-=dt;r.action=s.crimeDone?'unsettled':r.id==='goat'?'check-list':'idle';if(r.wait<=0){r.routineIndex=(r.routineIndex+1)%r.routine.length;let dest=locationById(r.routine[r.routineIndex]).door;
    if(s.crimeDone)dest=aftermathTarget(s,r,i);
    else if(s.index>0&&r.routine[r.routineIndex]==='home')dest={x:700,y:375};
    else if(s.index>1&&r.routine[r.routineIndex]==='garden')dest={x:350,y:510};
    else if(r.id==='snake'&&r.routine[r.routineIndex]==='garden')dest={x:136,y:591};
    else if(r.id==='cat'&&r.routine[r.routineIndex]==='center')dest={x:616,y:401};
    navigate(r,dest);r.wait=(r.id==='boar'?8:12)+i*2;r.carry=null;}}
 }
 if(s.bellUntil&&s.bellUntil<=s.time){s.bellUntil=0;for(const r of s.residents){r.route=[];r.wait=1;}}
 s.signals=s.signals.filter(x=>x.until>s.time);
}
export function startReconstruction(s){s.reconstructing=true;s.flow='reconstruct';s.lens.active=false;s.reconTime=0;s.reconOrigins=s.residents.map(r=>({id:r.id,x:r.x,y:r.y}));s.residents.forEach(r=>{r.route=[];r.carry=null;r.watched=false;const witness=RECON_WITNESSES[s.case.id][r.id];if(witness)[r.x,r.y]=witness;});const r=s.residents.find(r=>r.id===s.case.culprit);Object.assign(r,locationById(RECON_STOPS[s.case.id][0]).door);}
export function reconstructionStep(s,dt){
 s.reconTime+=Math.min(Math.max(dt,0),.1);const r=s.residents.find(r=>r.id===s.case.culprit),stops=RECON_STOPS[s.case.id],segment=Math.min(1,Math.floor(s.reconTime/6)),a=locationById(stops[segment]).door,b=locationById(stops[segment+1]).door;
 const points=[a,...findRoute(a,b)],lengths=points.slice(1).map((p,i)=>dist(points[i],p));let remaining=lengths.reduce((n,x)=>n+x,0)*Math.min(1,(s.reconTime-segment*6)/6),j=0;
 while(j<lengths.length-1&&remaining>lengths[j])remaining-=lengths[j++];const f=lengths[j]?Math.min(1,remaining/lengths[j]):1,from=points[j]||a,to=points[j+1]||b;
 r.x=from.x+(to.x-from.x)*f;r.y=from.y+(to.y-from.y)*f;r.carry=s.reconTime<12&&(s.case.id!=='courtyard'||s.reconTime>=6)?s.case.item:null;r.action=s.reconTime<12?'carry':'idle';if(s.reconTime>=20)for(const origin of s.reconOrigins||[])if(origin.id!==r.id)Object.assign(s.residents.find(person=>person.id===origin.id),origin);return s.reconTime>=20;
}
