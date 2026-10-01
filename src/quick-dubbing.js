import {RESIDENTS,SUPPORTING,LINE,CASES} from './content.js';
import {CASE_RECORDING_MANIFEST,QUICK_ROLES,roleManifest,requiredLines,estimateRecordingMinutes} from './dialogue-manifest.js';
import {QuickRecorder,microphoneMessage} from './recorder.js';
import {MicrophonePanel,microphonePanelMarkup} from './microphone-panel.js';
import {portrait as residentPortrait} from './render.js';
import {DubbingAccess} from './dubbing-access.js';
import {siteLinks} from './site-links.js';
import {mountAccountLogin} from './account-login.js';
const $=id=>document.getElementById(id);
const character=id=>[...RESIDENTS,...SUPPORTING].find(r=>r.id===id)||{id:'guide',name:'קריין משמרת השכונה'};
const portrait=r=>r.id==='guide'?'<span class="guide-portrait" role="img" aria-label="מדריך המשמרת">☾</span>':residentPortrait(r);
const rolePortrait=portrait;
const privacy='ההקלטות והטיוטות נשמרות במכשיר ובדפדפן הזה בלבד. הן אינן מועלות לרשת.';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const spoilerWarning='הקלטת תפקיד מלא עשויה לחשוף עדויות, סתירות ופתרון לתעלומה, גם במשפטים שלא תשמעו בכל משחק. האזהרה זהה לכל הדמויות ואינה רמז לזהות האחראי. אפשר לבחור במקום זאת בתפקיד הקצר, ללא ספוילרים, או לתת לחבר להקליט בנפרד ממי שפותר את התיק.';

export class QuickDubbing {
 constructor({store,audio,openDialog,onStart,getActive,access=new DubbingAccess()}){
  Object.assign(this,{store,audio,openDialog,onStart,getActive,access});this.view=0;this.attempt=0;this.micPanel=new MicrophonePanel();
  this.recorder=new QuickRecorder({
   onLevel:level=>{if($('input-level'))$('input-level').value=level;},
   onDiagnostic:diagnostic=>this.micPanel.update(diagnostic),onDevices:(...args)=>this.micPanel.setDevices(...args),
   onSignal:detected=>this.status(detected?'זוהה קול. מקליטים… כשתסיימו, לחצו עצירה.':microphoneMessage({name:'SilentInputError'})),
   onInterrupted:error=>{this.attempt++;this.requesting=false;this.finalizing=false;this.draft=null;this.status(microphoneMessage(error));this.controls();},
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.recorder.recording)this.recorder.interrupt({name:'PageHiddenError',stage:'recording'});});
  window.addEventListener('pagehide',()=>this.recorder.cancel());
 }
 disposeView(){this.view++;this.attempt++;this.requesting=false;this.finalizing=false;this.previewing=false;this.recorder.cancel();this.draft=null;}
 get caseId(){return CASES[this.caseIndex].id;}
 async open(caseIndex,options={}){
  this.caseIndex=caseIndex;this.options=options;this.lockedCharacter=options.resume?this.getActive():null;this.active=null;this.allMode=false;
  this.openDialog('קול אחד לכל דמות', '<p role="status">טוענים את ההקלטות השמורות…</p>');const view=this.view;
  await this.store.ready;if(view!==this.view)return;
  if(options.paidReturn){
   const intent=this.access.saved().intent;
   if(Number.isInteger(intent?.caseIndex)&&CASES[intent.caseIndex]&&Array.isArray(intent.characterIds)&&intent.characterIds.length&&intent.characterIds.every(id=>roleManifest(CASES[intent.caseIndex].id,id)?.eligible)){
    this.caseIndex=intent.caseIndex;this.allMode=intent.characterIds.length>1;this.active=intent.characterIds[0];
    await this.start(this.allMode?intent.characterIds:this.active);return;
   }
  }
  if(options.activate||options.paidReturn){if(await this.requireAccess(()=>this.entry()))this.entry();return;}
  if(options.repair&&this.lockedCharacter){if(Array.isArray(this.lockedCharacter))this.chooseAll();else this.selectRole(this.lockedCharacter,true);return;}
  this.entry();
 }
 entry(){
  this.allMode=false;
  const quick=roleManifest(this.caseId,QUICK_ROLES[this.caseId]);
  this.openDialog('מי מדבר בתיק הזה?',`<span class="eyebrow">תיק ${this.caseIndex+1} · ${CASES[this.caseIndex].title}</span><h3 class="dub-title">תפקיד שלם.<br>אותו קול בכל פעם.</h3><p>המשחק עם קולות היוצר חינמי. רוצים לדבב בעצמכם? קודם מקליטים ושומרים בחינם — תפקיד קצר, דמות שלמה או את כל הדמויות. רק כשמסיימים וניגשים לשחק בקול האישי, משלמים 9.90 ₪ פעם אחת. אחר כך אפשר לשחק, לתקן ולדבב שוב ללא הגבלה.</p>${this.options.resume?'<p class="inline-success">הליהוק של התיק הפעיל נשאר קבוע. אפשר לתקן הקלטות ולשמור טיוטות; בחירת קול אחר תתאפשר בתחילת תיק.</p>':''}<div class="profile quick-role-summary">${portrait(character(quick.characterId))}<div><strong>${quick.name}</strong><p>${quick.description}</p><p>${this.coverageText(quick.characterId)}</p><small>${this.estimate(quick.characterId)}</small></div></div><div class="dub-paths"><button class="primary" id="creator-start">${this.options.resume?'לחזור למשחק בליהוק הנוכחי':'לשחק עם קולות היוצר · חינם'}</button><button id="choose-quick">דיבוב קצר ומלא · ${quick.name} · ${quick.lineIds.length} משפטים</button><button id="choose-voice">דיבוב מלא של דמות אחרת</button><button id="choose-all">למשקיענים: כל הדמויות</button><button id="activate-dubbing" class="purchase-link">כבר קניתי · כניסה ושחזור רכישה</button></div><p class="microcopy">התפקיד הקצר בטוח להקלטה לפני החקירה. דיבוב מלא כולל אזהרת ספוילרים לפני הצגת התסריט.</p><p id="access-status" role="status"></p><p class="privacy">${privacy}</p>`);
  $('creator-start').onclick=()=>this.start(null);$('choose-quick').onclick=()=>this.selectRole(quick.characterId);$('choose-voice').onclick=()=>this.choose();$('choose-all').onclick=()=>this.chooseAll();$('activate-dubbing').onclick=()=>this.payment(()=>this.entry());
  if(this.access.unlocked){$('access-status').className='inline-success';$('access-status').textContent='✓ הדיבוב פתוח לכם. כל האפשרויות כלולות ברכישה שלכם, ללא תשלום נוסף.';}
 }
 async requireAccess(action){
  const view=this.view;if($('access-status'))$('access-status').textContent='בודקים את הגישה לדיבוב…';
  let allowed=await this.access.check();if(view!==this.view)return false;
  const saved=this.access.saved();
  if(!allowed&&!this.access.result?.accountBased&&saved.recoveryCode){allowed=await this.access.activate(saved.recoveryCode);if(view!==this.view)return false;}
  if(!allowed){this.payment(action);return false;}return true;
 }
 payment(afterUnlock){
  this.openDialog('התפקיד שלכם מוכן למשחק',`<div class="purchase-intro"><span class="eyebrow">זובלוף · דיבוב אישי</span><h3 class="dub-title">הקלטתם? עכשיו משחקים<br>בקולות שלכם.</h3><p>ההקלטה והשמירה בחינם. פתיחת המשחק עם הקולות האישיים עולה 9.90 ₪ פעם אחת. ההקלטות נשארות במכשיר גם אם לא משלמים. המשחק עם קולות היוצר תמיד חינמי.</p><p class="purchase-price"><bdi>9.90 ₪</bdi><span>מחיר סופי בשקלים · רכישה חד־פעמית · בלי מנוי</span></p></div><ul class="purchase-benefits"><li>תפקיד קצר, דמות שלמה או כל הדמויות — גם הקריין.</li><li>משחקים, מתקנים ומדבבים שוב ושוב ללא תשלום נוסף.</li><li>בהמשך יתווספו עוד תיקים ודמויות לפי בקשות הרוכשים הראשונים!</li></ul><section id="account-area" class="account-area"></section><button id="buy-dubbing" class="purchase-button" disabled>לתשלום של 9.90 ₪</button><a id="paid-checkout" class="purchase-button" hidden>להמשיך לתשלום מאובטח · 9.90 ₪</a><p class="microcopy">התשלום מתבצע בעברית ב־Paid / PayMe, בשקלים ובתשלום אחד. פרטי הכרטיס מוזנים רק בעמוד המאובטח של ספק התשלום. אחרי התשלום חוזרים אוטומטית למשחק.</p><button id="check-payment">כבר שילמתי · בדיקת התשלום</button><p id="checkout-status" role="status" aria-live="polite"></p><details class="activation-form"><summary>שחזור רכישה וקוד גיבוי</summary><p>מתחברים במייל כדי לשחזר רכישה. אם יש לכם קוד רכישה קודם, אפשר להזין אותו כאן לאחר הכניסה למייל שבו רכשתם. קוד הגיבוי נשמר גם בדפדפן; הוא אינו גיבוי להקלטות.</p><label for="recovery-code">קוד הגיבוי שלכם</label><textarea id="recovery-code" dir="ltr" readonly rows="3"></textarea><form id="activate-form"><label for="license-key">קוד רכישה שמור, או License key מרכישת Gumroad קודמת</label><input id="license-key" name="license-key" type="text" dir="ltr" autocomplete="off" spellcheck="false" maxlength="900" required><button id="activate-license" class="primary" type="submit">שחזור הגישה</button><p id="purchase-status" role="status" aria-live="polite">${esc(this.access.error||'אין צורך לרכוש שוב. התחברו למייל ששויך לרכישה.')}</p><a href="https://gumroad.com/license-key-lookup" target="_blank" rel="noopener noreferrer">שחזור קבלה מרכישת Gumroad קודמת</a></form></details><p class="privacy">${privacy} פרטי הרכישה נבדקים בשרת מול ספק התשלום; ההקלטות אינן נשלחות אליו.</p><div class="dialog-buttons"><button id="purchase-free">${this.options.resume?'לחזור למשחק':'לשחק בחינם עם קולות היוצר'}</button><button id="purchase-back">חזרה להקלטות</button></div>${siteLinks}`);
  const view=this.view;
  $('recovery-code').value=this.access.saved().recoveryCode||'הקוד יופיע לאחר הכנת התשלום.';
  $('checkout-status').textContent=this.access.error||'';
  const activate=async key=>{
   $('check-payment').disabled=true;$('activate-license').disabled=true;$('checkout-status').textContent='בודקים את אישור התשלום…';
   const ok=key?await this.access.activate(key):await this.access.request('access');if(view!==this.view)return;
   if(ok){$('license-key').value='';afterUnlock();}else{$('check-payment').disabled=false;$('activate-license').disabled=false;$('checkout-status').textContent=this.access.error||'התשלום עדיין לא אושר. בדקו שנכנסתם למייל הנכון. לרכישה קודמת אפשר להזין קוד תחת שחזור רכישה.';$('purchase-status').textContent=$('checkout-status').textContent;}
  };
  $('check-payment').onclick=()=>activate(this.access.account?.enabled?undefined:this.access.saved().recoveryCode);
  $('activate-form').onsubmit=event=>{event.preventDefault();const key=$('license-key').value.trim();if(key)activate(key);};
  $('buy-dubbing').onclick=async()=>{
   $('buy-dubbing').disabled=true;$('checkout-status').textContent='מכינים תשלום של 9.90 ₪…';
   const intent=this.active?{caseIndex:this.caseIndex,characterIds:this.allMode?this.allRoles().map(r=>r.characterId):[this.active]}:null;
   const result=await this.access.checkout(intent);if(view!==this.view)return;
   if(result?.unlocked){afterUnlock();return;}
   if(!result){$('buy-dubbing').disabled=false;$('checkout-status').textContent=this.access.error;return;}
   $('buy-dubbing').hidden=true;$('paid-checkout').href=result.checkoutUrl;$('paid-checkout').hidden=false;
   $('recovery-code').value=result.recoveryCode;$('checkout-status').textContent='התשלום מוכן. ההקלטות וקוד החזרה שמורים במכשיר. לחצו להמשיך לתשלום המאובטח.';$('paid-checkout').focus();
  };
  $('purchase-free').onclick=()=>this.start(null);$('purchase-back').onclick=()=>this.allMode?this.allDashboard():this.active?this.readyRole():this.entry();
  mountAccountLogin($('account-area'),this.access,{
   onStateChange:state=>{if(view!==this.view)return;const blocked=state.enabled&&!state.authenticated;$('buy-dubbing').disabled=blocked;$('check-payment').disabled=blocked;$('activate-license').disabled=blocked;if(blocked){$('paid-checkout').hidden=true;$('paid-checkout').removeAttribute('href');$('buy-dubbing').hidden=false;}},
   onSignedIn:async()=>{if(view!==this.view)return;const ok=await this.access.request('access');if(view!==this.view)return;if(ok)afterUnlock();else $('checkout-status').textContent=this.access.error||'המייל אומת. אפשר להמשיך לתשלום של 9.90 ₪; הרכישה תישמר במייל הזה.';},
  });
 }
 allRoles(){return Object.values(CASE_RECORDING_MANIFEST[this.caseId].characters).filter(r=>r.eligible);}
 async chooseAll(){
  this.allMode=true;this.allDashboard();
 }
 allDashboard(){
  const roles=this.allRoles(),complete=roles.every(r=>this.store.coverage(this.caseId,r.characterId).complete),total=roles.reduce((n,r)=>n+r.lineIds.length,0),approved=roles.reduce((n,r)=>n+this.store.coverage(this.caseId,r.characterId).approved,0);
  this.openDialog('למשקיענים: כל הדמויות',`<span class="eyebrow">תיק ${this.caseIndex+1} · ${CASES[this.caseIndex].title}</span><h3>כל השכונה בקולות שלכם</h3><p>מקליטים את כל ${roles.length} הדמויות בתיק, כולל מדריך המשמרת. אפשר לחלק תפקידים בין חברים באותו מכשיר, להקליט שוב ולעצור בכל שלב. בכל תיק אפשר לחזור למסך הזה; משפטים תואמים שכבר הקלטתם יישמרו.</p><p class="warning">תסריטים מלאים עשויים לחשוף את התעלומה. לפני פתיחת תפקיד תופיע אזהרה.</p><p class="all-cast-total">${approved} מתוך ${total} משפטים מאושרים</p><progress max="${total}" value="${approved}" aria-label="התקדמות כל הדמויות"></progress><div class="voice-cast">${roles.map(r=>`<article class="voice-card"><div class="profile">${rolePortrait(character(r.characterId))}<div><h3>${r.name}</h3><p>${r.description}</p></div></div><p>${this.coverageText(r.characterId)}</p><p class="microcopy">${this.estimate(r.characterId)}</p><button data-all-voice="${r.characterId}">${this.store.coverage(this.caseId,r.characterId).complete?'✓ מוכן · להאזין ולתקן':'להקליט את התפקיד'}</button></article>`).join('')}</div><p id="casting-status" role="status"></p><p class="microcopy">המשחק בקולות שלכם ייפתח כשכל התפקידים בתיק הושלמו ואושרו. הטיוטות נשמרות גם אם בוחרים לשחק בחינם בינתיים.</p><div class="dialog-buttons"><button id="use-all" class="primary" ${complete?'':'disabled'}>${this.options.resume?'לחזור למשחק בליהוק הנוכחי':'להתחיל עם כל הקולות שלנו'}</button><button id="all-back">חזרה לבחירה</button><button id="creator-start">${this.options.resume?'לחזור למשחק':'לשחק עם קולות היוצר · חינם'}</button></div><p class="privacy">${privacy}</p>`,true);
  document.querySelectorAll('[data-all-voice]').forEach(b=>b.onclick=()=>this.selectRole(b.dataset.allVoice,true));$('use-all').onclick=()=>this.start(roles.map(r=>r.characterId));$('all-back').onclick=()=>this.entry();$('creator-start').onclick=()=>this.start(null);
 }
 coverageText(id){const c=this.store.coverage(this.caseId,id);return `${c.total} משפטים בסך הכול · ${c.recorded} הקלטות תואמות · ${c.newCount-c.rerecordCount} חדשים להקלטה${c.rerecordCount?` · ${c.rerecordCount} דורשים הקלטה מחדש`:''}${c.reviewCount?` · ${c.reviewCount} להאזנה ואישור`:''}`;}
 estimate(id){const lines=requiredLines(this.caseId,id),remaining=lines.filter(l=>!this.store.draft(l)||this.store.draft(l).validity!=='valid'),review=lines.filter(l=>this.store.draft(l)?.validity==='valid'&&!this.store.get(l));return remaining.length||review.length?`כ־${estimateRecordingMinutes(remaining,review)} דקות להשלמה (הערכה, כולל האזנה)`:'התפקיד כבר שלם; נותר לאשר את הליהוק לתיק הזה.';}
 async choose(){
  this.allMode=false;
  const roles=Object.values(CASE_RECORDING_MANIFEST[this.caseId].characters).filter(r=>r.mode==='full');
  this.openDialog('תפקיד מלא לתיק הזה',`<p>בוחרים דמות אחת. כל שאר הדמויות נשארות בקול היוצר. התסריט כולל את כל ההסתעפויות בתיק הנוכחי בלבד.</p><p class="warning">כל התפקידים המלאים עשויים לכלול מידע מהחקירה ומהפתרון. לפני הצגת התסריט תופיע בקשת אישור.</p><div class="voice-cast">${roles.map(r=>`<article class="voice-card"><div class="profile">${portrait(character(r.characterId))}<div><h3>${r.name}</h3><p>${r.description}</p></div></div><p class="role-coverage">${this.coverageText(r.characterId)}</p><p class="microcopy">${this.estimate(r.characterId)}</p><button data-voice="${r.characterId}" class="primary">${this.store.coverage(this.caseId,r.characterId).complete?'לבחור קול שמור לתיק הזה':'לבחור ולהשלים את התפקיד'}</button></article>`).join('')}</div><div class="dub-footer"><button id="quick-instead">לתפקיד הקצר ללא ספוילרים</button><button id="play-now">${this.options.resume?'לחזור למשחק':'להתחיל עם קולות היוצר'}</button></div>`,true);
  document.querySelectorAll('[data-voice]').forEach(b=>b.onclick=()=>this.selectRole(b.dataset.voice));$('quick-instead').onclick=()=>this.selectRole(QUICK_ROLES[this.caseId]);$('play-now').onclick=()=>this.start(null);
 }
 async selectRole(id,edit=false){
  this.active=id;const role=roleManifest(this.caseId,id);if(!role?.eligible)return;
  if(this.store.coverage(this.caseId,id).complete&&!edit){this.readyRole();return;}
  if(role.mode!=='quick'){this.warning();return;}
  this.record(this.store.resumeIndex(this.caseId,id));
 }
 warning(){
  this.openDialog('לפני הצגת התסריט המלא',`<p class="warning">${spoilerWarning}</p><p>זהו התסריט של ${roleManifest(this.caseId,this.active).name} בתיק ${this.caseIndex+1} בלבד.</p><label class="enhancement"><input type="checkbox" id="spoiler-ack"> הבנתי שהתסריט עשוי לחשוף את התעלומה, ואני רוצה להקליט אותו.</label><div class="dialog-buttons"><button id="full-record" class="primary" disabled>לפתוח את התסריט</button><button id="quick-instead">לתפקיד הקצר ללא ספוילרים</button><button id="casting-back">חזרה לבחירה</button></div>`);
  $('spoiler-ack').onchange=e=>$('full-record').disabled=!e.target.checked;
  $('full-record').onclick=()=>{if($('spoiler-ack').checked)this.record(this.store.resumeIndex(this.caseId,this.active));};
  $('quick-instead').onclick=()=>this.selectRole(QUICK_ROLES[this.caseId]);$('casting-back').onclick=()=>this.allMode?this.allDashboard():this.choose();
 }
 readyRole(){
  if(this.allMode){this.allDashboard();return;}
  const r=roleManifest(this.caseId,this.active);
  this.openDialog('התפקיד מוכן',`<div class="profile">${portrait(character(this.active))}<div><h3>${r.name}</h3><p>${this.coverageText(this.active)}</p></div></div><p>כל ${r.lineIds.length} המשפטים אושרו. לפני ההתחלה נבדוק שוב שהקבצים ניתנים לפענוח. בכל משפט של הדמות יושמע רק הקול האישי; במקרה של תקלה תופיע כתובית.</p><p id="casting-status" role="status"></p><div class="dialog-buttons"><button id="use-complete" class="primary">${this.options.resume?'לחזור למשחק בליהוק הנוכחי':'להתחיל לשחק בקול שלי'}</button><button id="edit-complete">להאזין ולתקן</button><button id="creator-start">${this.options.resume?'לחזור למשחק':'לשחק עם קולות היוצר'}</button></div>`);
  $('use-complete').onclick=()=>this.start(this.active);$('edit-complete').onclick=()=>this.selectRole(this.active,true);$('creator-start').onclick=()=>this.start(null);
 }
 async start(active=null){
  const view=this.view;this.recorder.cancel();this.audio.stop();this.audio.unlock();
  if(this.options.resume){
   if(this.lockedCharacter&&!await this.requireAccess(()=>this.start(this.lockedCharacter)))return;
   this.onStart(this.caseIndex,this.lockedCharacter,this.options);return;
  }
  if(active){
   const status=$('casting-status')||$('record-status');if(status)status.textContent='בודקים את כל קובצי התפקיד…';
   if($('play-personal'))$('play-personal').disabled=true;if($('use-complete'))$('use-complete').disabled=true;
   const ids=Array.isArray(active)?active:[active];
   for(const id of ids){const valid=await this.store.verifyRole(this.caseId,id);if(view!==this.view)return;if(!valid){if(this.allMode)this.allDashboard();else this.incomplete(id);return;}}
   if(!await this.requireAccess(()=>this.start(active)))return;
  }
  this.onStart(this.caseIndex,active,this.options);
 }
 incomplete(active){
  const coverage=this.store.coverage(this.caseId,active);this.active=active;
  this.openDialog('הטיוטה נשמרה',`<p>${coverage.approved} מתוך ${coverage.total} משפטים מוכנים. כדי לשמור על קול אחד, הדמות תשתמש בקול האישי רק כשהתפקיד כולו שלם.</p><p>${this.options.resume?'אפשר להמשיך לתקן, או לחזור למשחק בליהוק הקיים. משפטים חסרים יופיעו בכתוביות עד לתיקון.':'אפשר להמשיך להקליט, או להתחיל כשהיוצר מדבב את הדמות לאורך כל התיק. לא נערבב בין הקולות.'}</p><div class="dialog-buttons"><button id="continue-draft" class="primary">להמשיך את הטיוטה</button><button id="creator-start">${this.options.resume?'להמשיך בכתוביות בליהוק הקיים':'להתחיל עם קולות היוצר'}</button></div>`);
  $('continue-draft').onclick=()=>this.selectRole(active,true);$('creator-start').onclick=()=>this.start(null);
 }
 status(text){if($('record-status'))$('record-status').textContent=text;}
 controls(){
  if(!$('record-take'))return;const recording=this.recorder.recording,pending=this.requesting||this.finalizing;
  $('record-take').hidden=recording;$('record-take').disabled=pending;$('record-take').textContent=this.requesting?'פותחים מיקרופון…':this.draft?'● הקלטה מחדש':'● הקלטה';
  $('stop-take').hidden=!recording;$('stop-take').disabled=!recording||pending;
  $('listen-take').disabled=!this.draft||recording||pending;$('listen-take').textContent=this.previewing?'■ עצירת ההאזנה':'▶ האזנה';
  $('accept-take').disabled=!this.draft?.validation?.hasSignal||this.draft.validity!=='valid'||recording||pending;
  $('accept-take').textContent=this.finalizing?'שומרים…':this.lastLine?'שמירה וסיום התפקיד ✓':'שמירה והמשך ←';
  $('enhance-voice').disabled=recording||pending;$('noise-reduction').disabled=recording||pending;
  $('exit-draft').textContent=recording?'יציאה וביטול ההקלטה הפעילה':'יציאה מההקלטה';
  for(const el of document.querySelectorAll('[data-line],#skip-take,#previous-take,#exit-draft,#change-voice,#delete-take,#play-now,#close-dialog,#microphone-choice'))el.disabled=!!this.finalizing;
  if($('play-personal')){const incomplete=!this.allMode&&!this.store.coverage(this.caseId,this.active).complete;$('play-personal').hidden=incomplete;$('play-personal').disabled=recording||pending||incomplete;}
 }
 updateCoverage(){
  if(!$('take-count'))return;const coverage=this.store.coverage(this.caseId,this.active);
  $('take-count').textContent=`${coverage.approved} מתוך ${coverage.total} משפטים נשמרו להקראה`;
  $('role-progress').value=coverage.approved;
  const lines=requiredLines(this.caseId,this.active);document.querySelectorAll('[data-line]').forEach(b=>{const line=lines[Number(b.dataset.line)],outdated=this.store.outdated(line);b.textContent=`${Number(b.dataset.line)+1}${this.store.get(line)?' ✓':this.store.draft(line)?' ◐':outdated?' ↻':''}`;b.setAttribute('aria-label',`משפט ${Number(b.dataset.line)+1}${outdated?' — נדרשת הקלטה מחדש':''}`);});
  $('role-completion').textContent=coverage.complete?'כל התפקיד מוכן. אפשר לאשר את הקול האישי לתיק הזה.':coverage.rerecordCount?`${coverage.rerecordCount} משפטים עודכנו ודורשים הקלטה מחדש. ההקלטות התואמות נשמרו.`:this.options.resume?'הקול האישי נשאר קבוע. משפטים חסרים יופיעו בכתוביות עד לתיקון.':'זו טיוטה. אם תתחילו עכשיו עם היוצר, הוא ידבב את כל הדמות בתיק הזה.';this.controls();
 }
 record(index){
  const r=character(this.active),role=roleManifest(this.caseId,this.active),lines=requiredLines(this.caseId,this.active);index=Math.max(0,Math.min(index,lines.length-1));const line=lines[index],saved=this.store.draft(line),coverage=this.store.coverage(this.caseId,this.active);
  this.openDialog(`התפקיד שלכם · ${r.name}`,`<div class="record-header">${portrait(r)}<div><span class="eyebrow">תיק ${this.caseIndex+1} · משפט ${index+1} מתוך ${lines.length}</span><p id="take-count"></p><progress id="role-progress" max="${lines.length}" value="${coverage.approved}" aria-label="משפטים שנשמרו"></progress></div></div>
   <div class="record-line" id="record-phrase" tabindex="-1">״${esc(line.text)}״</div><p class="performance-tip">${esc(line.hint)}</p>
   <div class="input-meter"><span>עוצמת מיקרופון</span><meter id="input-level" min="0" max="1" value="0" aria-label="עוצמת מיקרופון"></meter></div>
   <div class="record-actions"><button id="record-take">● הקלטה</button><button id="stop-take" hidden disabled>■ סיום ההקלטה</button><button id="listen-take" disabled>▶ האזנה</button></div>
   <p id="record-status" class="record-status" role="status" aria-live="polite">${saved?this.store.get(line)?'המשפט כבר שמור. אפשר להמשיך או להקליט מחדש.':'יש טיוטה שמורה. לחצו שמירה והמשך כדי להשתמש בה במשחק.':'הקליטו את המשפט, סיימו את ההקלטה ולחצו שמירה והמשך.'}</p>
   <div class="record-save"><button id="accept-take" class="primary" disabled>שמירה והמשך ←</button><p class="microcopy">שומר במכשיר ועובר למשפט הבא. אפשר להאזין לפני השמירה, אם רוצים.</p></div>
   <details class="record-settings"><summary>הגדרות מיקרופון וצליל</summary><label class="enhancement"><input type="checkbox" id="enhance-voice" ${this.enhance?'checked':''}> עיבוד עדין לקול</label><p class="microcopy">סינון תדרים נמוכים וריכוך הבדלי עוצמה.</p><label class="enhancement"><input type="checkbox" id="noise-reduction" ${this.noiseReduction?'checked':''}> צמצום רעשים בדפדפן</label>${microphonePanelMarkup}</details>
   <details class="record-navigation"><summary>מעבר בין משפטים ואפשרויות נוספות</summary><nav class="record-sections" aria-label="חלקי התפקיד">${role.sections.map(section=>`<div><span>${section.label}</span><div class="take-steps">${section.lineIds.map(id=>{const i=lines.findIndex(l=>l.id===id);return `<button data-line="${i}" aria-label="משפט ${i+1}" aria-current="${i===index?'step':'false'}">${i+1}</button>`;}).join('')}</div></div>`).join('')}</nav><div class="dialog-buttons"><button id="previous-take" ${index?'':'hidden'}>למשפט הקודם</button><button id="skip-take">${index===lines.length-1?'לסיכום בלי לשמור':'דילוג בלי לשמור'}</button>${saved?'<button id="delete-take">מחיקת ההקלטה למשפט הזה</button>':''}<button id="change-voice">בחירת תפקיד אחר</button><button id="play-now">${this.options.resume?'חזרה למשחק':'לשחק עם קולות היוצר · חינם'}</button></div></details>
   <p id="role-completion" class="microcopy"></p><div class="record-exit"><button id="exit-draft">יציאה מההקלטה</button><button id="play-personal" hidden>${this.allMode?'להתקדמות כל הדמויות':this.options.resume?'חזרה למשחק בליהוק הנוכחי':'להתחיל עם הקול האישי השלם'}</button></div><p class="privacy">${privacy}</p>`,true);
  if(!saved&&this.store.outdated(line))this.status('ההקלטה הקודמת אינה תואמת לנוסח הנוכחי. צריך להקליט את המשפט מחדש.');
  const view=this.view;this.draft=saved;this.previewing=false;this.lastLine=index===lines.length-1;
  this.store.checkpoint(this.caseId,this.active,line.id);
  const next=()=>index===lines.length-1?(this.store.coverage(this.caseId,this.active).complete?this.readyRole():this.incomplete(this.active)):this.record(index+1);
  document.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>this.record(Number(b.dataset.line)));
  $('enhance-voice').onchange=e=>this.enhance=e.target.checked;$('noise-reduction').onchange=e=>this.noiseReduction=e.target.checked;
  this.micPanel.mount(()=>{this.attempt++;this.recorder.cancel();this.audio.stop();this.requesting=false;this.finalizing=false;this.draft=this.store.draft(line);this.previewing=false;this.controls();this.status('המיקרופון הוחלף. לחצו הקלטה כדי להתחיל בכניסה שנבחרה.');});
  const beginRecording=async()=>{
   const attempt=++this.attempt;this.audio.stop();this.draft=null;this.previewing=false;this.requesting=true;this.finalizing=false;this.status('פותחים את המיקרופון…');this.controls();
   try{const ok=await this.recorder.start({enhance:!!this.enhance,noiseReduction:!!this.noiseReduction,deviceId:this.micPanel.deviceId});if(view!==this.view||attempt!==this.attempt)return;this.requesting=false;this.status(ok?'מקליטים… כשסיימתם, לחצו עצירה.':'ההקלטה בוטלה.');}
   catch(error){if(view===this.view&&attempt===this.attempt){this.requesting=false;this.status(microphoneMessage(error));}}
   if(view===this.view&&attempt===this.attempt){this.controls();if(this.recorder.recording)$('stop-take').focus();}
  };
  $('record-take').onclick=beginRecording;
  $('stop-take').onclick=async()=>{
   const attempt=this.attempt;this.finalizing=true;this.status('בודקים את הצליל ושומרים טיוטה…');
   try{const pending=this.recorder.stop();this.controls();const take=await pending;if(view!==this.view||attempt!==this.attempt)return;
    if(take){const persisted=await this.store.putDraft(line,take,{caseId:this.caseId});if(view!==this.view||attempt!==this.attempt)return;this.draft=this.store.draft(line);this.status(persisted?'הטיוטה נשמרה אוטומטית. לחצו שמירה והמשך.':'ההקלטה זמינה כרגע רק בדף הזה. השמירה במכשיר נכשלה; לחצו שמירה והמשך כדי לנסות שוב.');}
   }catch(error){if(view===this.view&&attempt===this.attempt){this.draft=null;this.status(microphoneMessage(error));}}
   if(view===this.view&&attempt===this.attempt){this.finalizing=false;this.updateCoverage();(this.draft?.validation?.hasSignal?$('accept-take'):$('record-take')).focus();}
  };
  $('listen-take').onclick=()=>{
   if(this.previewing){this.audio.stop();this.previewing=false;this.controls();this.status('ההאזנה נעצרה. אפשר לשמור ולהמשיך.');return;}
   this.audio.unlock();this.previewing=true;this.controls();this.audio.say(line.id,true,{take:this.draft,preview:true,onEnded:played=>{if(view===this.view){this.previewing=false;this.controls();this.status(played?'אפשר לשמור ולהמשיך, או להקליט מחדש.':'לא הצלחנו להשמיע את ההקלטה. אפשר לנסות שוב.');}}});this.status('מאזינים… אפשר לעצור בכל רגע.');
  };
  $('accept-take').onclick=async()=>{
   if(!this.draft?.validation?.hasSignal||this.finalizing||this.recorder.recording)return;
   this.audio.stop();this.previewing=false;this.finalizing=true;this.controls();this.status('שומרים את המשפט במכשיר…');
   try{
    const persisted=await this.store.approve(line,{caseId:this.caseId});if(view!==this.view)return;
    if(persisted){this.finalizing=false;next();if($('record-status'))this.status('✓ המשפט הקודם נשמר במכשיר. אפשר להקליט את המשפט הבא.');return;}
    this.status('לא הצלחנו לשמור במכשיר. ההקלטה עדיין כאן; לא עברנו למשפט הבא. פנו מקום במכשיר ולחצו שמירה והמשך כדי לנסות שוב.');
   }catch{if(view===this.view)this.status('ההקלטה לא עברה את בדיקת הצליל. היא נשארה כאן; נסו להאזין או להקליט מחדש.');}
   if(view===this.view){this.finalizing=false;this.updateCoverage();}
  };
  if($('delete-take'))$('delete-take').onclick=async()=>{this.audio.stop();await this.store.delete(line.id);if(view===this.view)this.record(index);};
  $('exit-draft').onclick=()=>this.allMode?this.allDashboard():this.entry();$('change-voice').onclick=()=>this.allMode?this.allDashboard():this.choose();$('skip-take').onclick=next;$('previous-take').onclick=()=>this.record(index-1);
  if(this.allMode)$('play-personal').textContent='להתקדמות כל הדמויות';
  $('play-personal').onclick=()=>this.allMode?this.allDashboard():this.start(this.active);$('play-now').onclick=()=>this.start(null);this.updateCoverage();
 }
}
