import {QuickRecorder,microphoneMessage,recordingSeconds} from '/src/recorder.js';
import {MicrophonePanel,microphonePanelMarkup} from '/src/microphone-panel.js';
import {AudioManager} from '/src/audio.js';
import {portrait,renderPortraits} from '/src/render.js';
import {loadArt} from '/src/art-assets.js';
import {prepareTake,editableSource,trimTake} from './processing.js';
import {drafts} from './drafts.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const labels={missing:'טרם הוקלט',recorded:'הוקלט',stale:'נדרשת הקלטה מחדש'};
let data,line,draft,characterId,group='all',filter='all',busy=false,recordEnhance=true,selection=0,recordTimer,preview=null;
const audio=new AudioManager(()=>{}),microphone=new MicrophonePanel();
$('microphone-panel').innerHTML=microphonePanelMarkup;
const status=(message,error=false)=>{$('record-status').textContent=message;$('record-status').classList.toggle('error',error);};
const recorder=new QuickRecorder({onLimit:()=>stop(),onLevel:value=>$('input-level').value=value,onDevices:(...args)=>microphone.setDevices(...args),onDiagnostic:d=>microphone.update(d),onInterrupted:error=>{clearTimeout(recordTimer);busy=false;status(microphoneMessage(error),true);controls();},onSignal:signal=>{if(!signal)status('המיקרופון פתוח, אבל לא זוהה קול. בדקו את הכניסה או נסו שוב.',true);}});
microphone.mount(()=>{if(recorder.recording||recorder.busy){clearTimeout(recordTimer);recorder.cancel();busy=false;status('הכניסה השתנתה. לחצו על הקלטה כדי להתחיל מחדש.');controls();}});
function controls(){
 const capture=recorder.recording;document.body.classList.toggle('busy',busy);
 $('record').disabled=!line||busy||!!draft;$('stop').disabled=!capture;$('retake').disabled=!line||busy||!draft;
 const pending=trimPending();
 $('listen').disabled=busy||!draft||pending;$('listen-saved').disabled=busy||!line?.entry;$('save-next').disabled=busy||!draft?.reviewed||!line||pending;
 $('stop-listening').disabled=!preview;$('edit-saved').disabled=busy||!!draft||line?.status!=='recorded';
 $('trim-editor').hidden=!draft;
 for(const id of ['trim-start','trim-end','trim-tail','reset-trim'])$(id).disabled=busy||!draft;
 $('apply-trim').disabled=busy||!draft||!pending;
 if(draft){const duration=fullDuration(),start=$('trim-start').valueAsNumber,end=$('trim-end').valueAsNumber,left=duration-start-end;$('trim-duration').textContent=Number.isFinite(left)&&start>=0&&end>=0&&left>=.08?`משך מלא: ${duration.toFixed(2)} שנ׳ · אחרי החיתוך: ${left.toFixed(2)} שנ׳${pending?' · לחצו על החלת חיתוך':''}`:'הזינו חיתוך תקין שמשאיר לפחות 0.08 שניות.';}
 for(const id of ['skip','refresh','group','filter','enhance','noise-reduction','microphone-choice'])$(id).disabled=busy||(!line&&id==='skip');
}
const fullDuration=()=>draft?.untrimmedDuration||draft?.processing?.trim?.sourceDuration||draft?.duration||0;
function trimPending(){return !!draft&&($('trim-start').valueAsNumber!==(draft.processing?.trim?.start||0)||$('trim-end').valueAsNumber!==(draft.processing?.trim?.end||0));}
function syncTrim(){
 $('trim-start').value=draft?.processing?.trim?.start||0;$('trim-end').value=draft?.processing?.trim?.end||0;
 for(const id of ['trim-start','trim-end'])$(id).max=Math.max(0,fullDuration()-.08).toFixed(3);
}
async function api(url,options={}){
 const response=await fetch('/creator/api/'+url,{cache:'no-store',...options,headers:{...(options.method?{'X-Creator-Token':data.token}:{}),...options.headers}});
 const result=await response.json();if(!response.ok){if(response.status===403)$('connection').textContent='נדרש רענון הרשימה לחידוש החיבור. הטייק החדש נשאר זמין.';throw Error(result.error||'השירות אינו זמין.');}return result;
}
const progress=()=>({lineId:line.id,characterId,group,filter,enhance:$('enhance').checked,noiseReduction:$('noise-reduction').checked});
async function remember(){if(!line)return;try{await api('progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(progress())});}catch(error){$('connection').textContent='מיקום ההמשך לא נשמר: '+error.message;}}
function visible(){return data.lines.filter(l=>l.characterId===characterId&&(group==='all'||l.group===group)&&(filter==='all'||l.status===filter));}
function characterImage(c){return c.narrator?'<img src="assets/icon.svg" alt="קריינות">':portrait(c);}
function render(){
 const count=data.lines.filter(l=>l.status==='recorded').length,stale=data.lines.filter(l=>l.status==='stale').length;
 $('total-count').textContent=`${count} מתוך ${data.lines.length} משפטים נשמרו`;$('total-progress').max=data.lines.length;$('total-progress').value=count;$('remaining-count').textContent=`${data.lines.length-count} להשלמה${stale?' · '+stale+' דורשים הקלטה מחדש':''}`;
 $('characters').innerHTML=data.characters.map(c=>{const all=data.lines.filter(l=>l.characterId===c.id);return `<button data-character="${c.id}" class="${characterId===c.id?'active':''}" aria-pressed="${characterId===c.id}">${characterImage(c)}<strong>${esc(c.narrator?'קריינות':c.name)}</strong><small><bdi dir="ltr">${all.filter(l=>l.status==='recorded').length} / ${all.length}</bdi></small></button>`;}).join('');
 $('characters').querySelectorAll('button').forEach(button=>button.onclick=()=>navigate({character:button.dataset.character}));
 const character=data.characters.find(c=>c.id===characterId);$('character-title').textContent=character.narrator?'קריינות':character.name;$('description').textContent=character.description;
 $('group').innerHTML='<option value="all">כל החלקים</option>'+data.groups.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join('');$('group').value=group;$('filter').value=filter;
 const list=visible();$('lines').innerHTML=list.length?list.map((l,i)=>`<button data-line="${l.id}" class="${l.id===line?.id?'active':''}" aria-current="${l.id===line?.id}">${i+1}. ${esc(l.text.slice(0,50))}${l.text.length>50?'…':''}<small>${labels[l.status]} · ${esc(data.groups.find(g=>g.id===l.group)?.title)}</small></button>`).join(''):'<p>אין משפטים בסינון הזה.</p>';
 $('lines').querySelectorAll('button').forEach(button=>button.onclick=()=>navigate({id:button.dataset.line}));
 $('current-portrait').innerHTML=characterImage(character);$('line-counter').textContent=line?`משפט ${list.findIndex(l=>l.id===line.id)+1} מתוך ${list.length} בסינון הנוכחי`:'';
 $('line-context').textContent=line?.context||'בחרו חלק או סינון אחר';$('line-text').textContent=line?.text||'כל המשפטים בסינון הזה טופלו.';
 $('line-hint').textContent=line?.hint?'ביצוע: '+line.hint:'';$('line-hint').hidden=!line?.hint;
 $('line-status').textContent=line?labels[line.status]+(line.entry?` · טייק שמור ${line.entry.duration.toFixed(1)} שניות`:''):'';
 $('line-id').textContent=line?`${line.id} · v${line.scriptVersion}`:'';$('line-cases').textContent=line?'משמש ב־'+line.cases.map(id=>data.groups.find(g=>g.id===id)?.title).join(' · '):'';
 renderPortraits();controls();
}
async function choose(id,{persist=true}={}){
 const ticket=++selection;audio.stop();line=data.lines.find(l=>l.id===id)||null;draft=null;render();
 if(line){try{const candidate=await drafts.get(line.id);if(ticket!==selection)return;if(candidate&&candidate.fingerprint===line.fingerprint&&candidate.performanceKey===line.performanceKey&&candidate.scriptVersion===line.scriptVersion){draft=candidate;status('טייק חדש ממתין לשמירה. אפשר להאזין לו או להקליט מחדש.');}else status(candidate?'נוסח המשפט השתנה מאז הטיוטה. הקליטו את הנוסח המעודכן.':`לחצו על הקלטה כשתהיו מוכנים. עד ${recordingSeconds(line.text)} שניות למשפט.`);}catch{status('גיבוי הדפדפן אינו זמין. אפשר להקליט ולשמור ישירות בפרויקט.');}}
 else status('אפשר לעבור לדמות, לתיק או לסינון אחר.');syncTrim();controls();if(persist)await remember();
}
async function navigate({character,id,newGroup,newFilter}={}){
 if(busy)return;if(character)characterId=character;if(newGroup)group=newGroup;if(newFilter)filter=newFilter;
 await choose(id||visible()[0]?.id);
}
async function refresh(initial=false){
 const previous=line?.id;data=await api('catalogue');$('connection').textContent='מחובר · הקבצים נשמרים בתיקיית המשחק במחשב הזה';
 if(initial){const p=data.progress;characterId=p.characterId||data.characters[0].id;group=p.group||'all';filter=p.filter||'all';$('enhance').checked=p.enhance??true;$('noise-reduction').checked=p.noiseReduction??false;await choose(visible().find(l=>l.id===p.lineId)?.id||visible()[0]?.id,{persist:false});}
 else {line=data.lines.find(l=>l.id===previous)||null;render();}
}
async function backup(){try{await drafts.put(draft);return true;}catch{return false;}}
async function record(){
 if(busy||!line)return;busy=true;audio.stop();recordEnhance=$('enhance').checked;controls();status('פותח מיקרופון…');
 try{if(await recorder.start({enhance:false,noiseReduction:$('noise-reduction').checked,autoGainControl:false,deviceId:microphone.deviceId,maxSeconds:recordingSeconds(line.text)})){status('מקליט… קראו את המשפט ואז לחצו עצירה.');recordTimer=setTimeout(stop,175000);}else busy=false;}
 catch(error){busy=false;status(microphoneMessage(error),true);}controls();
}
async function stop(){
 if(!recorder.recording)return;clearTimeout(recordTimer);status('בודק ומכין את הטייק…');
 const stopped=recorder.stop();controls();
 try{const raw=await stopped;if(raw){const take=await prepareTake(raw,recordEnhance);draft={...take,lineId:line.id,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,takeId:crypto.randomUUID(),expectedTakeId:line.entry?.takeId||null,reviewed:false};syncTrim();const backedUp=await backup();status(`הטייק תקין · ${take.duration.toFixed(1)} שניות. אפשר לחתוך קצוות ולהאזין לפני שמירה.${backedUp?'':' גיבוי הדפדפן אינו זמין — שמרו לפני סגירה.'}`);}}
 catch(error){status(error.name==='Error'?error.message:microphoneMessage(error),true);}finally{busy=false;controls();}
}
function play(blob,onReviewed){
 busy=true;const session=preview={onReviewed};controls();audio.unlock();audio.say(line.id,true,{preview:true,take:{blob},onEnded:played=>{if(preview!==session)return;preview=null;busy=false;if(played)onReviewed(false);else status('ההאזנה נכשלה. נסו שוב או הקליטו טייק חדש.',true);controls();}});
}
function stopListening(){
 if(!preview)return;const heard=(audio.current?.currentTime||0)>0,session=preview;
 preview=null;audio.stop();busy=false;
 if(heard)session.onReviewed(true);else status('ההאזנה נעצרה לפני שהקול התחיל. אפשר להפעיל אותה שוב.');controls();
}
async function listen(){
 if(!draft||busy||trimPending())return;status('משמיע את הטייק החדש כפי שיישמע במשחק… אפשר לעצור בכל רגע.');
 play(draft.blob,stopped=>{draft.reviewed=true;backup();status((stopped?'ההאזנה נעצרה.':'ההאזנה הסתיימה.')+' הטייק מוכן לשמירה.');});
}
async function editSaved(){
 if(busy||draft||line?.status!=='recorded')return;busy=true;controls();status('טוען את מקור הטייק לעריכה…');
 try{
  const entry=line.entry,response=await fetch(`/creator/api/source/${line.id}?take=${encodeURIComponent(entry.takeId)}`,{cache:'no-store'});
  if(!response.ok){const result=await response.json();throw Error(result.error||'לא ניתן לטעון את קובץ המקור.');}
  let take=await editableSource(await response.blob(),entry.processing);
  if(entry.processing?.trim)take=await trimTake(take,entry.processing.trim.start,entry.processing.trim.end);
  draft={...take,lineId:line.id,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,takeId:crypto.randomUUID(),expectedTakeId:entry.takeId,reviewed:false};syncTrim();
  const backedUp=await backup();status('הטייק מוכן לחיתוך. הטייק השמור יוחלף רק לאחר שמירה.'+(backedUp?'':' גיבוי הדפדפן אינו זמין — שמרו לפני סגירה.'));
 }catch(error){status(error.message,true);}finally{busy=false;controls();}
}
async function applyTrim(reset=false){
 if(busy||!draft)return;busy=true;controls();status(reset?'משחזר את הטייק המלא…':'מכין את החיתוך…');
 try{
  const start=reset?0:$('trim-start').valueAsNumber,end=reset?0:$('trim-end').valueAsNumber;
  const edited=await trimTake(draft,start,end);
  // A changed file needs a new immutable take ID, even after an uncertain save.
  draft={...edited,takeId:crypto.randomUUID(),reviewed:false};syncTrim();const backedUp=await backup();
  status((reset?'החיתוך בוטל.':'החיתוך הוחל.')+' האזינו לתוצאה לפני שמירה; אפשר לעצור באמצע.'+(backedUp?'':' גיבוי הדפדפן אינו זמין — שמרו לפני סגירה.'));
 }catch(error){status(error.message,true);}finally{busy=false;controls();}
}
async function listenSaved(){
 if(busy||!line?.entry)return;busy=true;controls();audio.unlock();
 try{const response=await fetch('/creator/api/audio/'+line.id,{cache:'no-store'});if(!response.ok)throw Error('לא ניתן לטעון את הטייק השמור.');const blob=await response.blob();status(line.status==='stale'?'משמיע טייק ישן. הוא דורש הקלטה מחדש לנוסח המוצג.':'משמיע את הטייק השמור בפרויקט…');play(blob,()=>{if(draft){draft.expectedTakeId=line.entry.takeId;backup();}status('הטייק השמור נשאר זמין עד לשמירה של החלפה.');});}
 catch(error){busy=false;status(error.message,true);controls();}
}
function nextId(){const list=data.lines.filter(l=>(group==='all'||l.group===group)&&(filter==='all'||l.status===filter)),index=list.findIndex(l=>l.id===line?.id);return list[index+1]?.id;}
async function advance(id){
 if(id){characterId=data.lines.find(l=>l.id===id).characterId;await choose(id);}
 else {const remaining=visible();await choose(remaining.find(l=>l.id===line?.id)?.id||remaining[0]?.id);status('הגעתם לסוף הרשימה הזאת. אפשר לבחור דמות או סינון כדי לחזור למשפטים שדילגתם עליהם.');}
}
async function save(){
 if(busy||!draft?.reviewed||trimPending())return;const id=line.id,next=nextId();busy=true;controls();status('שומר את הקבצים והמיפוי בפרויקט…');
 try{
  const form=new FormData(),{blob,source,untrimmedBlob,untrimmedValidation,untrimmedDuration,...metadata}=draft;form.set('metadata',JSON.stringify({...metadata,progress:progress()}));form.set('playback',blob,'playback');form.set('source',source,'source');
  const {entry}=await api('takes',{method:'POST',body:form});
  // Once the server confirms the atomic commit, an unrelated refresh failure
  // must not misreport a successfully saved take as lost or still pending.
  const saved=data.lines.find(l=>l.id===id);saved.entry=entry;saved.status='recorded';
  draft=null;await drafts.remove(id).catch(()=>{});busy=false;await advance(next);status('נשמר בפרויקט. '+(next?'המשפט הבא מוכן — לחצו הקלטה כשתהיו מוכנים.':'סוף הרשימה הזאת. אפשר לחזור למשפטים שדילגתם עליהם.'));
 }catch(error){status(error.message+' הטייק החדש נשאר זמין לניסיון נוסף.',true);}finally{busy=false;controls();}
}
$('record').onclick=record;$('retake').onclick=record;$('stop').onclick=stop;$('listen').onclick=listen;$('listen-saved').onclick=listenSaved;$('save-next').onclick=save;
$('stop-listening').onclick=stopListening;$('edit-saved').onclick=editSaved;
$('trim-start').oninput=$('trim-end').oninput=controls;$('apply-trim').onclick=()=>applyTrim();$('reset-trim').onclick=()=>applyTrim(true);
$('trim-tail').onclick=()=>{if(busy||!draft)return;$('trim-end').value=.2;controls();applyTrim();};
$('skip').onclick=()=>{if(!busy)advance(nextId());};$('refresh').onclick=()=>refresh().then(()=>status('הרשימה עודכנה.')).catch(error=>status(error.message,true));
$('group').onchange=event=>navigate({newGroup:event.target.value});$('filter').onchange=event=>navigate({newFilter:event.target.value});$('enhance').onchange=$('noise-reduction').onchange=remember;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder.recording)recorder.interrupt({name:'PageHiddenError',stage:'recording'});});
window.addEventListener('beforeunload',event=>{if(busy||draft){event.preventDefault();event.returnValue='';}});
loadArt().then(renderPortraits);function animate(){renderPortraits();requestAnimationFrame(animate);}requestAnimationFrame(animate);
refresh(true).catch(error=>{status('לא ניתן לפתוח את האולפן: '+error.message,true);$('connection').textContent='השירות המקומי אינו זמין. הפעילו את Start-Creator-Studio.cmd בתיקיית המשחק.';controls();});
