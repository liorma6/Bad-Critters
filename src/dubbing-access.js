const SAVED_PURCHASE='zoobluff-paid-purchase-v1';
export class DubbingAccess {
 constructor({fetcher=(...args)=>globalThis.fetch(...args)}={}){this.fetcher=fetcher;this.unlocked=false;this.checkedAt=0;}
 async request(path,options={}){
  try{
   const response=await this.fetcher(`/api/dubbing/${path}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
   const result=await response.json();
   this.unlocked=response.ok&&result.unlocked===true;this.checkedAt=Date.now();
   this.result=result;
   this.error=result.error||(response.ok?'':'לא הצלחנו לבדוק את הרכישה. נסו שוב; אין צורך לשלם שוב.');
   return this.unlocked;
  }catch{this.unlocked=false;this.checkedAt=0;this.error='לא הצלחנו להתחבר לבדיקת הרכישה. בדקו את החיבור ונסו שוב. ההקלטות השמורות נשארות במכשיר.';return false;}
 }
 check(){if(this.unlocked&&Date.now()-this.checkedAt<5*60*1000)return Promise.resolve(true);return this.request('access');}
 activate(licenseKey){return this.request('activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey})});}
 saved(){try{return JSON.parse(localStorage.getItem(SAVED_PURCHASE))||{};}catch{return {};}}
 async checkout(intent){
  const saved=this.saved();
  await this.request('checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey:saved.recoveryCode||''})});
  if(this.unlocked)return {unlocked:true};
  if(this.error)return null;
  const result=this.result;
  if(result?.price!==990||result.currency!=='ILS'||!/^https:\/\/live\.payme\.io\/sale\/generate\/SALE[A-Z0-9-]{20,60}$/.test(result.checkoutUrl)||!result.recoveryCode?.startsWith('ZB1.')){this.error='לא הצלחנו להכין תשלום תקין של 9.90 ₪. נסו שוב.';return null;}
  try{
   const value=JSON.stringify({recoveryCode:result.recoveryCode,checkoutUrl:result.checkoutUrl,intent});
   localStorage.setItem(SAVED_PURCHASE,value);
   if(localStorage.getItem(SAVED_PURCHASE)!==value)throw Error('Storage unavailable');
  }catch{this.error='לא הצלחנו לשמור את פרטי החזרה מהרכישה במכשיר. אפשרו אחסון לאתר ונסו שוב לפני התשלום.';return null;}
  return result;
 }
}
