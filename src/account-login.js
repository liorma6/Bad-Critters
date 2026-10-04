import {mountHumanCheck} from './human-check.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountAccountLogin(container,access,{onSignedIn,onStateChange,manage=false}={}){
 const view=container;
 const show=async()=>{
  const state=await access.accountRequest('session');if(!view.isConnected)return;
  if(!state||state.error){view.innerHTML='<p role="status">לא הצלחנו להתחבר. אפשר לנסות שוב.</p><button id="retry-account">ניסיון נוסף</button>';view.querySelector('#retry-account').onclick=()=>show();onStateChange?.({enabled:true,authenticated:false});return;}
  onStateChange?.(state);
  if(!state.enabled){view.hidden=true;return;}
  if(state.authenticated){
    view.innerHTML=`<p class="inline-success">הרכישה נשמרת למייל<br><bdi>${esc(state.email)}</bdi></p><button id="account-logout" class="purchase-text-button">${manage?'התנתקות':'החלפת מייל'}</button>${manage?'<button id="account-switch" class="purchase-text-button">החלפת חשבון</button>':''}<p class="microcopy" role="status"></p>`;
    view.querySelector('#account-logout').onclick=async event=>{const button=event.currentTarget;button.disabled=true;const result=await access.accountRequest('logout',{});if(!view.isConnected)return;if(result?.error){button.disabled=false;view.querySelector('.microcopy').textContent=result.error;return;}access.unlocked=false;access.checkedAt=0;await show();};
    if(manage)view.querySelector('#account-switch').onclick=()=>view.querySelector('#account-logout').click();
   return;
  }
  view.innerHTML=`<h3>המייל שלכם, והרכישה שמורה</h3><p class="microcopy">כך תוכלו לחזור לשחק גם ממכשיר אחר.</p><form id="account-email-form"><label for="account-email">כתובת המייל שלכם</label><input id="account-email" type="email" dir="ltr" autocomplete="email" placeholder="you@example.com" maxlength="254" required><div id="human-check"></div><button id="send-login-code" class="primary" type="submit">להמשיך עם המייל הזה</button></form><form id="account-code-form" hidden><label for="account-code">קוד האימות שקיבלתם במייל</label><input id="account-code" type="text" dir="ltr" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button id="verify-login-code" class="primary" type="submit">אימות והמשך</button><button id="change-email" class="purchase-text-button" type="button">שינוי מייל / שליחה מחדש</button></form><p id="account-status" role="status" aria-live="polite"></p>`;
  let challengeId,humanToken='',human,inFlight=false,requestId=crypto.randomUUID();
  const status=view.querySelector('#account-status'),send=view.querySelector('#send-login-code'),verify=view.querySelector('#verify-login-code'),email=view.querySelector('#account-email'),code=view.querySelector('#account-code'),codeForm=view.querySelector('#account-code-form');
  const updateSend=()=>{send.disabled=inFlight||state.botProtectionRequired&&!humanToken;send.textContent=inFlight?'שולחים קוד כניסה…':state.botProtectionRequired&&!humanToken?'ממתינים לבדיקת האבטחה…':'להמשיך עם המייל הזה';};
  const busy=value=>{inFlight=value;updateSend();verify.disabled=value;email.disabled=value;code.disabled=value;view.querySelector('#change-email').disabled=value;};
  if(state.botProtectionRequired){
   const box=view.querySelector('#human-check');box.className='human-check-widget';
   const message=document.createElement('p');message.id='human-check-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
   const retry=document.createElement('button');retry.id='retry-human-check';retry.type='button';retry.textContent='לטעון מחדש את בדיקת האבטחה';retry.hidden=true;box.after(message,retry);
   const humanState=value=>{if(!view.isConnected)return;retry.hidden=!['error','expired','unsupported'].includes(value);message.textContent=({loading:'טוענים בדיקת אבטחה קצרה. היא תופיע כאן לפני שליחת הקוד.',ready:'✓ בדיקת האבטחה הושלמה. אפשר להמשיך.',error:'בדיקת האבטחה לא נטענה. לחצו על טעינה מחדש. אם זה חוזר, פתחו את הקישור ב־Chrome או ב־Safari.',expired:'תוקף בדיקת האבטחה פג. לחצו על טעינה מחדש.',unsupported:'בדיקת האבטחה אינה נתמכת בדפדפן הזה. פתחו את הקישור ב־Chrome או ב־Safari.'})[value];updateSend();};
   if(!state.turnstileSiteKey)message.textContent='אימות האבטחה אינו זמין כרגע. נסו שוב מאוחר יותר.';
   else human=mountHumanCheck(box,state.turnstileSiteKey,token=>{humanToken=token;updateSend();},{onState:humanState});
   retry.onclick=()=>human?.reset();updateSend();
  }
  email.oninput=()=>{requestId=crypto.randomUUID();challengeId=null;code.value='';codeForm.hidden=true;updateSend();status.textContent='';};
  view.querySelector('#change-email').onclick=()=>{email.oninput();view.querySelector('#account-email-form').hidden=false;email.focus();};
  view.querySelector('#account-email-form').onsubmit=async event=>{
   event.preventDefault();if(state.botProtectionRequired&&!humanToken){status.textContent='השלימו את בדיקת האבטחה לפני שליחת הקוד.';return;}busy(true);status.textContent='שולחים קוד כניסה…';
   const result=await access.accountRequest('request',{email:email.value,requestId,turnstileToken:humanToken});human?.reset();if(!view.isConnected)return;
   busy(false);
   if(!result?.sent){status.textContent=result?.error||'לא הצלחנו לשלוח קוד. נסו שוב.';return;}
   challengeId=result.challengeId;view.querySelector('#account-email-form').hidden=true;codeForm.hidden=false;code.value='';status.textContent='הקוד תקף ל־10 דקות. לא הגיע? בדקו גם בספאם.';code.focus();
  };
  view.querySelector('#account-code-form').onsubmit=async event=>{
   event.preventDefault();if(!challengeId)return;busy(true);status.textContent='מאמתים את הקוד…';
   const result=await access.accountRequest('verify',{challengeId,code:code.value.trim()});if(!view.isConnected)return;
   if(!result?.authenticated){busy(false);status.textContent=result?.error||'לא הצלחנו לאמת את הקוד.';return;}
   access.unlocked=false;access.checkedAt=0;await show();if(view.isConnected)await onSignedIn?.();
  };
 };
 view.innerHTML='<p role="status">בודקים התחברות…</p>';await show();
}
