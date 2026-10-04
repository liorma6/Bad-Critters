import {createState} from './simulation.js';
import {CASES,RESIDENTS} from './content.js';
import {roleManifest} from './dialogue-manifest.js';

export const INVESTIGATION_VERSION=1;
const sets=['clues','unread','milestones','conversations'];
const fields=['flow','nightElapsed','tutorial','preliminary','lastFinding','time','phase','crime','crimeProgress','crimeDone','paused','speed','lens','events','signals','bell','sprinkler','bellUntil','waterUntil','hints','attempts','solved','reconstructing','reconTime','reconOrigins','notes','observations','serial','selection'];
const residentFields=['id','x','y','route','target','action','carry','routineIndex','wait','watched','reactionCooldown','secretDone'];
const flows=['observe','night','discovery','investigate','accuse','reconstruct','result'];
const steps=['lens','place-lens','watch','notebook-before','notebook-entry','notebook-return','prefact','prefact-return','advance','trace','trace-return','witness','ask-witness','witness-return','done'];
const copy=value=>JSON.parse(JSON.stringify(value));
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER;
function validTree(value,depth=0){
 if(depth>12)return false;if(value===null||typeof value==='boolean')return true;
 if(typeof value==='number')return finite(value);if(typeof value==='string')return value.length<=100000;
 if(Array.isArray(value))return value.length<=1000&&value.every(v=>validTree(v,depth+1));
 return !!value&&typeof value==='object'&&Object.keys(value).length<100&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&validTree(v,depth+1));
}
export function snapshotInvestigation(state,ui={}){
 return copy({version:INVESTIGATION_VERSION,caseId:state.case.id,savedAt:Date.now(),state:{...pick(state,fields),residents:state.residents.map(r=>pick(r,residentFields)),...Object.fromEntries(sets.map(k=>[k,[...(state[k]||[])]]))},ui});
}
export function restoreInvestigation(snapshot){
 if(!snapshot||snapshot.version!==INVESTIGATION_VERSION||!validTree(snapshot))throw Error('Unsupported or damaged save');
 const index=CASES.findIndex(c=>c.id===snapshot.caseId),d=snapshot.state;
 if(index<0||!d||!flows.includes(d.flow)||!steps.includes(d.tutorial?.step)||typeof d.tutorial.enabled!=='boolean')throw Error('Unknown investigation');
 if(!['time','nightElapsed','crimeProgress','reconTime','bellUntil','waterUntil','hints','attempts','serial'].every(k=>finite(d[k])&&d[k]>=0)||![1,2,4].includes(d.speed))throw Error('Invalid clock');
 if(!['bell','sprinkler'].every(k=>Number.isInteger(d[k])&&d[k]>=0&&d[k]<=2)||typeof d.notes!=='string')throw Error('Invalid progress');
 if(!['crimeDone','paused','solved','reconstructing'].every(k=>typeof d[k]==='boolean')||!d.lens||!finite(d.lens.x)||!finite(d.lens.y))throw Error('Invalid state');
 if(!sets.every(k=>Array.isArray(d[k]))||!['events','signals','preliminary'].every(k=>Array.isArray(d[k])))throw Error('Invalid collections');
 if(d.events.some(e=>!finite(e.id)||typeof e.text!=='string'||typeof e.time!=='string')||d.clues.some(id=>!CASES[index].clues.some(c=>c.id===id)))throw Error('Invalid evidence');
 if(!Array.isArray(d.residents)||d.residents.length!==RESIDENTS.length||new Set(d.residents.map(r=>r.id)).size!==RESIDENTS.length||d.residents.some(r=>!RESIDENTS.some(x=>x.id===r.id)||!finite(r.x)||!finite(r.y)||!Array.isArray(r.route)||r.route.some(p=>!finite(p.x)||!finite(p.y))))throw Error('Invalid residents');
 if((['discovery','investigate','accuse','reconstruct','result'].includes(d.flow)&&!d.crimeDone)||(d.flow==='observe'&&d.crimeDone)||(d.reconstructing!== (d.flow==='reconstruct')))throw Error('Inconsistent phase');
 const state=createState(index,{tutorial:d.tutorial.enabled});Object.assign(state,copy(pick(d,fields)));
 // Older saves could reach the night invitation before the narrated notice step.
 if(state.flow==='observe'&&state.tutorial.enabled&&state.tutorial.step==='advance'&&!state.preliminary.some(entry=>entry.location===state.case.preLocation))state.tutorial.step='prefact';
 state.residents=state.residents.map(r=>({...r,...copy(pick(d.residents.find(x=>x.id===r.id),residentFields))}));
 for(const key of sets)state[key]=new Set(d[key]);
 // A restored signal was already presented. Never replay a sentence on load.
 state.signals.forEach(s=>s.spoken=true);state.hover=null;
 const ui=snapshot.ui||{},selected=RESIDENTS.some(r=>r.id===ui.selected)?ui.selected:null;
 const chosen=Array.isArray(ui.chosen)?[...new Set(ui.chosen)].filter(id=>state.clues.has(id)).slice(0,4):[];
 const casting=Array.isArray(ui.casting)?[...new Set(ui.casting)].filter(id=>roleManifest(state.case.id,id)?.eligible):[];
 return {state,ui:{selected,chosen,casting,notebookSection:['case','evidence','people','timeline','accusation'].includes(ui.notebookSection)?ui.notebookSection:'case'}};
}
export class InvestigationSave {
 constructor(storage,key,onError=()=>{}){Object.assign(this,{storage,key,onError});this.writable=false;}
 read(){try{const raw=this.storage.getItem(this.key);if(!raw)return {status:'empty'};if(raw.length>1500000)throw Error('Save too large');const snapshot=JSON.parse(raw);return {status:'ready',...restoreInvestigation(snapshot),savedAt:snapshot.savedAt};}catch(error){return {status:'damaged',error};}}
 resume(){const saved=this.read();this.writable=saved.status==='ready';return saved;}
 begin(){
  // Preserve the preceding investigation (including unrecognised future versions)
  // before explicitly starting another one. Failed archiving prevents overwriting.
  try{const raw=this.storage.getItem(this.key);if(raw)this.storage.setItem(`${this.key}:previous:${Date.now()}`,raw);this.writable=true;return true;}
  catch{this.writable=false;this.onError();return false;}
 }
 write(state,ui){if(!this.writable)return false;try{const value=snapshotInvestigation(state,ui);restoreInvestigation(value);this.storage.setItem(this.key,JSON.stringify(value));return true;}catch{this.onError();return false;}}
}
