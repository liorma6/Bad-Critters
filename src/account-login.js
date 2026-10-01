const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountAccountLogin(container,access,{onSignedIn,onStateChange}={}){
 const view=container;
 const show=async()=>{
  const state=await access.accountRequest('session');if(!view.isConnected)return;
  if(!state||state.error){view.innerHTML='<p role="status">לא הצלחנו לבדוק את ההתחברות. נסו לפתוח את המסך שוב.</p>';onStateChange?.({enabled:true,authenticated:false});return;}
  onStateChange?.(state);
  if(!state.enabled){view.hidden=true;return;}
  if(state.authenticated){
   view.innerHTML=`<p class="inline-success">מחוברים כ־<bdi>${esc(state.email)}</bdi></p><button id="account-logout">החלפת חשבון</button><p class="microcopy">הרכישה משויכת למייל הזה ונשמרת בשרת. אחרי מחיקת עוגיות אפשר להתחבר שוב. ההקלטות עצמן נשארות במכשיר.</p>`;
   view.querySelector('#account-logout').onclick=async event=>{const button=event.currentTarget;button.disabled=true;const result=await access.accountRequest('logout',{});if(!view.isConnected)return;if(result?.error){button.disabled=false;view.querySelector('.microcopy').textContent=result.error;return;}access.unlocked=false;access.checkedAt=0;await show();};
   return;
  }
  view.innerHTML=`<h3>כניסה במייל ושמירת הרכישה</h3><p>כדי לזהות את הרכישה גם במכשיר חדש או אחרי מחיקת עוגיות, נכנסים עם קוד חד־פעמי במייל. אין צורך בסיסמה.</p><form id="account-email-form"><label for="account-email">כתובת המייל שלכם</label><input id="account-email" type="email" dir="ltr" autocomplete="email" maxlength="254" required><button id="send-login-code" type="submit">שליחת קוד כניסה</button></form><form id="account-code-form" hidden><label for="account-code">הקוד שקיבלתם במייל</label><input id="account-code" type="text" dir="ltr" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button id="verify-login-code" type="submit">אימות וכניסה</button></form><p id="account-status" role="status" aria-live="polite"></p>`;
  let challengeId;
  const status=view.querySelector('#account-status'),send=view.querySelector('#send-login-code'),verify=view.querySelector('#verify-login-code'),email=view.querySelector('#account-email'),code=view.querySelector('#account-code'),codeForm=view.querySelector('#account-code-form');
  const busy=value=>{send.disabled=value;verify.disabled=value;email.disabled=value;code.disabled=value;};
  email.oninput=()=>{challengeId=null;code.value='';codeForm.hidden=true;send.textContent='שליחת קוד כניסה';status.textContent='';};
  view.querySelector('#account-email-form').onsubmit=async event=>{
   event.preventDefault();busy(true);status.textContent='שולחים קוד כניסה…';
   const result=await access.accountRequest('request',{email:email.value});if(!view.isConnected)return;
   busy(false);
   if(!result?.sent){status.textContent=result?.error||'לא הצלחנו לשלוח קוד. נסו שוב.';return;}
   challengeId=result.challengeId;codeForm.hidden=false;code.value='';send.textContent='שליחת קוד חדש';status.textContent='הקוד נשלח למייל. הוא תקף לעשר דקות. בדקו גם את תיקיית הספאם.';code.focus();
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
