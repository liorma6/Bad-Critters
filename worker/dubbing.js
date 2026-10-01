import {createPaidCheckout,verifyPaid} from './paid.js';
import {accountsEnabled,handleAccount} from './accounts.js';
import {handleAccountPurchase} from './account-purchases.js';
const COOKIE='zoobluff_dubbing';
const MAX_AGE=60*60*24*90;
const RECHECK_MS=6*60*60*1000;
const encoder=new TextEncoder();
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function encryptionKey(secret){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
function cookie(request,value,maxAge=MAX_AGE){return `${COOKIE}=${value}; Path=/api/dubbing; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function seal(payload,env,origin){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(`${origin}|${env.GUMROAD_PRODUCT_ID}`)},await encryptionKey(env.DUBBING_SESSION_SECRET),encoder.encode(JSON.stringify(payload)));
 return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
async function unseal(value,env,origin){
 try{const [iv,data,...extra]=value.split('.');if(extra.length||value.length>2048)return null;
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode(`${origin}|${env.GUMROAD_PRODUCT_ID}`)},await encryptionKey(env.DUBBING_SESSION_SECRET),decode(data));
  const payload=JSON.parse(new TextDecoder().decode(plain));
  return typeof payload.key==='string'&&Number.isFinite(payload.checkedAt)&&payload.checkedAt<=Date.now()&&payload.expiresAt>Date.now()?payload:null;
 }catch{return null;}
}
export function validPurchase(result,productId){
 const p=result?.purchase;
 return result?.success===true&&p?.product_id===productId&&p.refunded===false&&p.disputed===false&&!p.chargebacked&&!p.chargedback&&!p.license_disabled&&!p.access_revoked&&!p.test&&!p.is_test_purchase&&!p.subscription_ended_at&&!p.subscription_failed_at&&Number(p.price)>0;
}
async function verify(key,env,fetcher){
 if(key.startsWith('ZB1.'))return verifyPaid(key,env,fetcher);
 const response=await fetcher('https://api.gumroad.com/v2/licenses/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({product_id:env.GUMROAD_PRODUCT_ID,license_key:key,increment_uses_count:'false'}),signal:AbortSignal.timeout(10000)});
 if(response.status===429||response.status>=500)throw Error('Provider unavailable');
 const result=await response.json();
 if(!response.ok&&response.status!==404&&response.status!==400)throw Error('Provider unavailable');
 return response.ok&&validPurchase(result,env.GUMROAD_PRODUCT_ID);
}
export async function handleDubbing(request,env,{fetcher=fetch,now=Date.now()}={}){
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/api/dubbing/auth/'))return handleAccount(request,env,{fetcher,now});
 if(!['/api/dubbing/access','/api/dubbing/activate','/api/dubbing/checkout'].includes(path))return json({error:'לא נמצא'},404);
 const checkout=path.endsWith('/checkout'),activate=path.endsWith('/activate')||checkout;
 if(request.method!==(activate?'POST':'GET'))return json({error:'בקשה לא נתמכת'},405,{Allow:activate?'POST':'GET'});
 if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)||(activate&&request.headers.get('Origin')!==url.origin))return json({error:'הפעילו את הדיבוב מתוך המשחק.'},403);
 if(!env.GUMROAD_PRODUCT_ID||!env.DUBBING_SESSION_SECRET||env.DUBBING_SESSION_SECRET.length<32)return json({unlocked:false,error:'הפעלת הדיבוב אינה זמינה כרגע. המשחק החינמי זמין כרגיל.'},503);
 if(accountsEnabled(env))return handleAccountPurchase(request,env,{fetcher,now});
 let payload,key;
 if(activate){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'בקשה לא תקינה'},400);
  if(Number(request.headers.get('Content-Length'))>1200)return json({error:'קוד ההפעלה ארוך מדי'},400);
  try{const raw=await request.text();if(raw.length>1200)throw Error();key=JSON.parse(raw).licenseKey?.trim()??'';}catch{return json({error:'בקשה לא תקינה'},400);}
  if(typeof key!=='string'||(!key&&!checkout)||key.length>(key.startsWith('ZB1.')?900:160))return json({error:'הזינו את קוד שחזור הרכישה.'},400);
 }else{
  const value=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if(!value)return json({unlocked:false});
  payload=await unseal(value,env,url.origin);
  if(!payload)return json({unlocked:false},200,{'Set-Cookie':cookie(request,'',0)});
  if(now-payload.checkedAt<RECHECK_MS)return json({unlocked:true});
  key=payload.key;
 }
 if(env.DUBBING_RATE_LIMITER){const {success}=await env.DUBBING_RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!success)return json({unlocked:false,error:'יותר מדי ניסיונות. חכו דקה ונסו שוב.'},429,{'Retry-After':'60'});}
 try{
  if(checkout){
   // An existing entitlement or completed pending order must never create a second charge.
   const current=await handleDubbing(new Request(`${url.origin}/api/dubbing/access`,{headers:{Cookie:request.headers.get('Cookie')||''}}),env,{fetcher,now});
   const access=await current.json();
   if(current.status!==200)return json(access,current.status);
   if(access.unlocked)return json({unlocked:true},200,current.headers.has('Set-Cookie')?{'Set-Cookie':current.headers.get('Set-Cookie')}:{});
   if(!key||!await verify(key,env,fetcher))return json({unlocked:false,...await createPaidCheckout(key,env,fetcher,url.origin)});
  }
  if(!checkout&&!await verify(key,env,fetcher))return json({unlocked:false,error:key.startsWith('ZB1.')?'התשלום עדיין לא אושר. אם כבר שילמתם, המתינו רגע ולחצו בדיקת התשלום. אין צורך לשלם שוב.':'לא נמצאה רכישה פעילה לקוד הזה. בדקו שהעתקתם את קוד ההפעלה של זובלוף מהקבלה.'},activate?403:200,{'Set-Cookie':cookie(request,'',0)});
  const value=await seal({key,checkedAt:now,expiresAt:now+MAX_AGE*1000},env,url.origin);
  return json({unlocked:true},200,{'Set-Cookie':cookie(request,value)});
 }catch{return json({unlocked:false,error:'לא הצלחנו לבדוק את הרכישה כרגע. נסו שוב בעוד רגע; אין צורך לשלם שוב.'},503);}
}
