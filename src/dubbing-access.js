export const DUBBING_PRODUCT_URL='https://liorma.gumroad.com/l/zoobluff-dubbing';
export class DubbingAccess {
 constructor({fetcher=(...args)=>globalThis.fetch(...args)}={}){this.fetcher=fetcher;this.unlocked=false;this.checkedAt=0;}
 async request(path,options={}){
  try{
   const response=await this.fetcher(`/api/dubbing/${path}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
   const result=await response.json();
   this.unlocked=response.ok&&result.unlocked===true;this.checkedAt=Date.now();
   this.error=response.ok?'':result.error||'לא הצלחנו לבדוק את הרכישה. נסו שוב; אין צורך לשלם שוב.';
   return this.unlocked;
  }catch{this.unlocked=false;this.checkedAt=0;this.error='לא הצלחנו להתחבר לבדיקת הרכישה. בדקו את החיבור ונסו שוב. ההקלטות השמורות נשארות במכשיר.';return false;}
 }
 check(){if(this.unlocked&&Date.now()-this.checkedAt<5*60*1000)return Promise.resolve(true);return this.request('access');}
 activate(licenseKey){return this.request('activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey})});}
}
