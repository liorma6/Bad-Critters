import {validCheckoutUrl} from './paid-environment.js';
import {validGumroadCheckoutUrl} from './gumroad-checkout.js';
const SAVED_PURCHASE='zoobluff-paid-purchase-v1';
const ACCOUNT_CHANGE='zoobluff-account-change-v1';
export const PURCHASE_TIMEOUT_MS=35000;
export class DubbingAccess {
 constructor({fetcher=(...args)=>globalThis.fetch(...args)}={}){this.fetcher=fetcher;this.unlocked=false;this.checkedAt=0;this.generation=0;globalThis.window?.addEventListener('storage',event=>{if(event.key===ACCOUNT_CHANGE)this.clearAccount(false);});}
 clearAccount(broadcast=true){this.generation++;this.unlocked=false;this.checkedAt=0;this.result=null;this.account=null;try{localStorage.removeItem(SAVED_PURCHASE);if(broadcast)localStorage.setItem(ACCOUNT_CHANGE,crypto.randomUUID());}catch{}globalThis.window?.dispatchEvent(new CustomEvent('zoobluff-account-changed'));}
 async request(path,options={}){
  const generation=this.generation;
  try{
   const response=await this.fetcher(`/api/dubbing/${path}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(PURCHASE_TIMEOUT_MS),...options});
   const result=await response.json();
   if(generation!==this.generation)return false;
   this.unlocked=response.ok&&result.unlocked===true;this.checkedAt=Date.now();
   this.result=result;
   this.error=result.error||(response.ok?'':'לא הצלחנו לבדוק את הרכישה. נסו שוב; אין צורך לשלם שוב.');
   return this.unlocked;
  }catch{if(generation!==this.generation)return false;this.unlocked=false;this.checkedAt=0;this.result={pending:path==='checkout'};this.error=path==='checkout'?'התשובה מהתשלום עדיין אינה ידועה. אפשר לבדוק את המצב או לנסות שוב בבטחה; לא ניצור הזמנה נוספת בזמן שהבדיקה נמשכת.':'לא הצלחנו להתחבר לבדיקת הרכישה. בדקו את החיבור ונסו שוב. ההקלטות השמורות נשארות במכשיר.';return false;}
 }
 check(){return this.request('access');}
 activate(licenseKey){return this.request('activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey})});}
 async accountRequest(action,body){
  try{const response=await this.fetcher(`/api/dubbing/auth/${action}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const result=await response.json();if(response.ok&&['session','verify','logout'].includes(action)){if(action==='logout'||action==='verify'||this.account?.email&&this.account.email!==result.email)this.clearAccount();this.account=result;}return response.ok?result:{error:result.error||'לא הצלחנו להשלים את ההתחברות.',retryAfter:result.retryAfter};}
  catch{return {error:'לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב.'};}
 }
 saved(){try{return JSON.parse(localStorage.getItem(SAVED_PURCHASE))||{};}catch{return {};}}
 async checkout(intent){
  if(this.checkoutPending)return this.checkoutPending;
  const operation=this.createCheckout(intent);this.checkoutPending=operation;try{return await operation;}finally{if(this.checkoutPending===operation)this.checkoutPending=null;}
 }
 async createCheckout(intent){
  const saved=this.saved();
  const matchingAccount=!saved.accountEmail||saved.accountEmail===this.account?.email;
  await this.request('checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey:matchingAccount?saved.recoveryCode||'':''})});
  if(this.unlocked)return {unlocked:true};
  if(this.error)return null;
  const result=this.result;
  if(result?.pending){this.error=result.message||'הזמנה כבר נוצרת או נבדקת. המתינו מעט ולחצו בדיקת התשלום שלי.';return null;}
  const validDestination=result?.provider==='gumroad'?validGumroadCheckoutUrl(result.checkoutUrl):validCheckoutUrl(result?.checkoutUrl,globalThis.location?.origin)&&result?.recoveryCode?.startsWith('ZB1.');
  if(result?.price!==990||result.currency!=='ILS'||!validDestination){this.error='לא הצלחנו להכין תשלום תקין של 9.90 ₪. נסו שוב.';return null;}
  try{
   const value=JSON.stringify({provider:result.provider||'paid',recoveryCode:result.recoveryCode,checkoutUrl:result.checkoutUrl,intent,accountEmail:this.account?.email||null});
   localStorage.setItem(SAVED_PURCHASE,value);
   if(localStorage.getItem(SAVED_PURCHASE)!==value)throw Error('Storage unavailable');
  }catch{this.error='לא הצלחנו לשמור את פרטי החזרה מהרכישה במכשיר. אפשרו אחסון לאתר ונסו שוב לפני התשלום.';return null;}
  return result;
 }
}
