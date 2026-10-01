import {accountSession,normalizeEmail} from './accounts.js';
import {encrypt,decrypt,keyedDigest} from './account-crypto.js';
import {inspectPaid,recoverPaid,readPaidTicket,createPaidCheckout,paidCheckoutUrl} from './paid.js';
const RECHECK_MS=6*60*60*1000;
const json=(body,status=200)=>new Response(JSON.stringify({accountBased:true,...body}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function legacyPurchase(credential,env,fetcher){
 const response=await fetcher('https://api.gumroad.com/v2/licenses/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({product_id:env.GUMROAD_PRODUCT_ID,license_key:credential,increment_uses_count:'false'}),signal:AbortSignal.timeout(10000)});
 if(response.status===429||response.status>=500)throw Error('Provider unavailable');
 const result=await response.json(),p=result.purchase;
 if(!response.ok||result.success!==true||p?.product_id!==env.GUMROAD_PRODUCT_ID||p.refunded!==false||p.disputed!==false||p.chargebacked||p.chargedback||p.license_disabled||p.access_revoked||p.test||p.is_test_purchase||p.subscription_ended_at||p.subscription_failed_at||!(Number(p.price)>0))return null;
 return {id:`gumroad:${await keyedDigest(credential,env)}`,email:p.email||''};
}
const inspect=(credential,env,fetcher)=>credential.startsWith('ZB1.')?inspectPaid(credential,env,fetcher):legacyPurchase(credential,env,fetcher);
const credentialPurpose=(id,accountId)=>`purchase:${id}:${accountId}`;
async function saveEntitlement(account,purchase,credential,env,now){
 const existing=await env.ACCOUNTS_DB.prepare('SELECT account_id FROM purchase_orders WHERE purchase_id=? UNION SELECT account_id FROM purchase_entitlements WHERE purchase_id=?').bind(purchase.id,purchase.id).all();
 if(existing.results.some(row=>row.account_id!==account.id))return false;
 // A server-created order belongs to the authenticated account even if another person pays for it.
 if(!existing.results.length&&normalizeEmail(purchase.email)!==account.email)return false;
 const encrypted=await encrypt(credential,credentialPurpose(purchase.id,account.id),env);
 const result=await env.ACCOUNTS_DB.prepare(`INSERT INTO purchase_entitlements(purchase_id,account_id,credential_cipher,checked_at,active) VALUES(?,?,?,?,1)
 ON CONFLICT(purchase_id) DO UPDATE SET credential_cipher=excluded.credential_cipher,checked_at=excluded.checked_at,active=1 WHERE account_id=excluded.account_id RETURNING purchase_id`).bind(purchase.id,account.id,encrypted,now).first();
 return !!result;
}
async function accountAccess(account,env,fetcher,now){
 const entitlements=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_entitlements WHERE account_id=? AND active=1 ORDER BY checked_at DESC LIMIT 10').bind(account.id).all();
 for(const row of entitlements.results){
  if(row.checked_at<=now&&now-row.checked_at<RECHECK_MS)return true;
  const credential=await decrypt(row.credential_cipher,credentialPurpose(row.purchase_id,account.id),env),purchase=await inspect(credential,env,fetcher);
  const active=purchase?.id===row.purchase_id;
  await env.ACCOUNTS_DB.prepare('UPDATE purchase_entitlements SET active=?,checked_at=? WHERE purchase_id=? AND account_id=?').bind(active?1:0,now,row.purchase_id,account.id).run();
  if(active)return true;
  await env.ACCOUNTS_DB.prepare('DELETE FROM purchase_orders WHERE purchase_id=? AND account_id=?').bind(row.purchase_id,account.id).run();
 }
 const pending=await env.ACCOUNTS_DB.prepare('SELECT o.* FROM purchase_orders o WHERE o.account_id=? AND NOT EXISTS(SELECT 1 FROM purchase_entitlements e WHERE e.purchase_id=o.purchase_id) ORDER BY created_at DESC LIMIT 5').bind(account.id).all();
 for(const row of pending.results){
  const credential=await decrypt(row.credential_cipher,credentialPurpose(row.purchase_id,account.id),env),purchase=await inspect(credential,env,fetcher);
  if(purchase&&await saveEntitlement(account,purchase,credential,env,now))return true;
 }
 // This also restores Paid purchases made before account storage was introduced.
 const recovered=await recoverPaid(account.email,env,fetcher);
 return !!recovered&&await saveEntitlement(account,recovered,recovered.credential,env,now);
}
export async function handleAccountPurchase(request,env,{fetcher=fetch,now=Date.now()}={}){
 try{
  const account=await accountSession(request,env,now),action=new URL(request.url).pathname.split('/').pop();
  if(!account)return json({unlocked:false,loginRequired:true,...(action==='access'?{}:{error:'התחברו במייל כדי לשמור את הרכישה ולשחזר אותה בהמשך.'})},action==='access'?200:401);
  if(env.DUBBING_RATE_LIMITER&&!((await env.DUBBING_RATE_LIMITER.limit({key:`purchase:${request.headers.get('CF-Connecting-IP')||'unknown'}`})).success))return json({unlocked:false,error:'יותר מדי בדיקות רכישה. נסו שוב בעוד דקה.'},429);
  if(action==='access')return json({unlocked:await accountAccess(account,env,fetcher,now)});
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'בקשה לא תקינה'},400);
  let credential;try{const raw=await request.text();if(raw.length>1200)throw Error();credential=JSON.parse(raw).licenseKey??'';if(typeof credential!=='string'||credential.length>900)throw Error();credential=credential.trim();}catch{return json({error:'בקשה לא תקינה'},400);}
  if(action==='activate'){
   if(!credential)return json({error:'הזינו קוד רכישה קיים.'},400);
   const purchase=await inspect(credential,env,fetcher);
   if(!purchase||!await saveEntitlement(account,purchase,credential,env,now))return json({unlocked:false,error:'לא נמצאה רכישה מאושרת ששייכת למייל המחובר. בדקו את המייל שבו רכשתם; אין צורך לשלם שוב.'},403);
   return json({unlocked:true});
  }
  if(await accountAccess(account,env,fetcher,now))return json({unlocked:true});
  if(credential){
   const purchase=await inspect(credential,env,fetcher);
   if(purchase){if(await saveEntitlement(account,purchase,credential,env,now))return json({unlocked:true});return json({error:'קוד הרכישה אינו שייך למייל המחובר. התחברו למייל שבו בוצעה הרכישה.'},403);}
   // Ignore a stale browser's pending order. Only server-owned orders can be reused.
  }
  const previous=await env.ACCOUNTS_DB.prepare('SELECT o.* FROM purchase_orders o WHERE account_id=? AND NOT EXISTS(SELECT 1 FROM purchase_entitlements e WHERE e.purchase_id=o.purchase_id) ORDER BY created_at DESC LIMIT 1').bind(account.id).first();
  if(previous){
   const recoveryCode=await decrypt(previous.credential_cipher,credentialPurpose(previous.purchase_id,account.id),env),order=await readPaidTicket(recoveryCode,env);
   if(!order)throw Error('Invalid stored order');
   return json({unlocked:false,recoveryCode,checkoutUrl:paidCheckoutUrl(order.saleId),price:990,currency:'ILS'});
  }
  const checkout=await createPaidCheckout('',env,fetcher,new URL(request.url).origin),order=await readPaidTicket(checkout.recoveryCode,env),id=`paid:${order.saleId}`;
  const inserted=await env.ACCOUNTS_DB.prepare('INSERT INTO purchase_orders(purchase_id,account_id,credential_cipher,created_at) VALUES(?,?,?,?) ON CONFLICT(account_id) DO NOTHING RETURNING purchase_id').bind(id,account.id,await encrypt(checkout.recoveryCode,credentialPurpose(id,account.id),env),now).first();
  if(!inserted){
   const winner=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_orders WHERE account_id=?').bind(account.id).first();
   const recoveryCode=await decrypt(winner.credential_cipher,credentialPurpose(winner.purchase_id,account.id),env),savedOrder=await readPaidTicket(recoveryCode,env);
   return json({unlocked:false,recoveryCode,checkoutUrl:paidCheckoutUrl(savedOrder.saleId),price:990,currency:'ILS'});
  }
  return json({unlocked:false,...checkout});
 }catch{return json({unlocked:false,error:'לא הצלחנו לבדוק את הרכישה כרגע. נסו שוב; אין צורך לשלם שוב.'},503);}
}
