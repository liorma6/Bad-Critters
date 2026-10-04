import {accountSession,normalizeEmail} from './accounts.js';
import {encrypt,decrypt,keyedDigest} from './account-crypto.js';
import {inspectPaid,inspectPaidOrder,recoverAttempt,recoverPaid,readPaidTicket,createPaidCheckout,paidCheckoutUrl} from './paid.js';
import {paidConfig} from './paid-config.js';
import {readJson} from './request-body.js';
const RECHECK_MS=6*60*60*1000;
const json=(body,status=200)=>new Response(JSON.stringify({accountBased:true,...body}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function legacyPurchase(credential,env,fetcher){
 if(paidConfig(env).sandbox)return null;
 const response=await fetcher('https://api.gumroad.com/v2/licenses/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({product_id:env.GUMROAD_PRODUCT_ID,license_key:credential,increment_uses_count:'false'}),signal:AbortSignal.timeout(10000)});
 if(response.status===429||response.status>=500)throw Error('Provider unavailable');
 const result=await response.json(),p=result.purchase;
 if(!response.ok||result.success!==true||p?.product_id!==env.GUMROAD_PRODUCT_ID||p.refunded!==false||p.disputed!==false||p.chargebacked||p.chargedback||p.license_disabled||p.access_revoked||p.test||p.is_test_purchase||p.subscription_ended_at||p.subscription_failed_at||!(Number(p.price)>0))return null;
 return {id:`gumroad:${await keyedDigest(credential,env)}`,email:p.email||''};
}
const inspect=(credential,env,fetcher)=>credential.startsWith('ZB1.')?inspectPaid(credential,env,fetcher):legacyPurchase(credential,env,fetcher);
const credentialPurpose=(id,accountId)=>`purchase:${id}:${accountId}`;
async function saveEntitlement(account,purchase,credential,env,now){
 const existing=await env.ACCOUNTS_DB.prepare('SELECT account_id FROM purchase_orders WHERE purchase_id=? UNION SELECT account_id FROM purchase_entitlements WHERE purchase_id=? UNION SELECT account_id FROM purchase_history WHERE purchase_id=?').bind(purchase.id,purchase.id,purchase.id).all();
 if(existing.results.some(row=>row.account_id!==account.id))return false;
 // A server-created order belongs to the authenticated account even if another person pays for it.
 if(!existing.results.length&&normalizeEmail(purchase.email)!==account.email)return false;
 const encrypted=await encrypt(credential,credentialPurpose(purchase.id,account.id),env);
 const result=await env.ACCOUNTS_DB.prepare(`INSERT INTO purchase_entitlements(purchase_id,account_id,credential_cipher,checked_at,active) VALUES(?,?,?,?,1)
 ON CONFLICT(purchase_id) DO UPDATE SET credential_cipher=excluded.credential_cipher,checked_at=excluded.checked_at,active=1 WHERE account_id=excluded.account_id RETURNING purchase_id`).bind(purchase.id,account.id,encrypted,now).first();
 return !!result;
}
async function accountAccess(account,env,fetcher,now,states=new Map()){
 const entitlements=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_entitlements WHERE account_id=? AND active=1 ORDER BY checked_at DESC LIMIT 10').bind(account.id).all();
 for(const row of entitlements.results){
  if(row.checked_at<=now&&now-row.checked_at<RECHECK_MS)return true;
  const credential=await decrypt(row.credential_cipher,credentialPurpose(row.purchase_id,account.id),env),checked=credential.startsWith('ZB1.')?await inspectPaidOrder(credential,env,fetcher):null,purchase=checked?checked.purchase:await inspect(credential,env,fetcher);
  const active=purchase?.id===row.purchase_id;
  if(!active&&checked&&!['refunded','chargeback'].includes(checked.status))throw Error('Unknown entitlement status');
  await env.ACCOUNTS_DB.prepare('UPDATE purchase_entitlements SET active=?,checked_at=? WHERE purchase_id=? AND account_id=?').bind(active?1:0,now,row.purchase_id,account.id).run();
  if(active)return true;
  await env.ACCOUNTS_DB.batch([
   env.ACCOUNTS_DB.prepare("INSERT OR IGNORE INTO purchase_history(purchase_id,account_id,credential_cipher,created_at,closed_status) SELECT purchase_id,account_id,credential_cipher,created_at,? FROM purchase_orders WHERE purchase_id=? AND account_id=?").bind(checked?.status||'revoked',row.purchase_id,account.id),
   env.ACCOUNTS_DB.prepare('DELETE FROM purchase_orders WHERE purchase_id=? AND account_id=?').bind(row.purchase_id,account.id),
   env.ACCOUNTS_DB.prepare('DELETE FROM purchase_attempts WHERE account_id=? AND purchase_id=?').bind(account.id,row.purchase_id),
  ]);
 }
 const pending=await env.ACCOUNTS_DB.prepare('SELECT o.* FROM purchase_orders o WHERE o.account_id=? AND NOT EXISTS(SELECT 1 FROM purchase_entitlements e WHERE e.purchase_id=o.purchase_id) ORDER BY created_at DESC LIMIT 5').bind(account.id).all();
 for(const row of pending.results){
  const credential=await decrypt(row.credential_cipher,credentialPurpose(row.purchase_id,account.id),env),checked=await inspectPaidOrder(credential,env,fetcher),purchase=checked.purchase;states.set(row.purchase_id,checked);
  if(purchase&&await saveEntitlement(account,purchase,credential,env,now))return true;
 }
 if(pending.results.length)return false;
 // This also restores Paid purchases made before account storage was introduced.
 const recovered=await recoverPaid(account.email,env,fetcher);
 return !!recovered&&await saveEntitlement(account,recovered,recovered.credential,env,now);
}
export async function handleAccountPurchase(request,env,{fetcher=fetch,now=Date.now()}={}){
 const deadline=AbortSignal.timeout(28000),upstream=fetcher;fetcher=(url,options={})=>upstream(url,{...options,signal:AbortSignal.any([deadline,...(options.signal?[options.signal]:[])])});
 try{
  const account=await accountSession(request,env,now),action=new URL(request.url).pathname.split('/').pop();
  if(!account)return json({unlocked:false,loginRequired:true,...(action==='access'?{}:{error:'התחברו במייל כדי לשמור את הרכישה ולשחזר אותה בהמשך.'})},action==='access'?200:401);
  if(env.DUBBING_RATE_LIMITER&&!((await env.DUBBING_RATE_LIMITER.limit({key:`purchase:${request.headers.get('CF-Connecting-IP')||'unknown'}`})).success))return json({unlocked:false,error:'יותר מדי בדיקות רכישה. נסו שוב בעוד דקה.'},429);
  if(action==='access'){
   if(await accountAccess(account,env,fetcher,now))return json({unlocked:true});
   const pending=await env.ACCOUNTS_DB.prepare('SELECT account_id FROM purchase_attempts WHERE account_id=? UNION SELECT account_id FROM purchase_orders WHERE account_id=?').bind(account.id,account.id).first();
   return json({unlocked:false,...(pending?{pending:true,message:'יש הזמנה שעדיין לא אושר בה תשלום. לחצו לתשלום כדי לבדוק אותה ולהמשיך בבטחה.'}:{})});
  }
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'בקשה לא תקינה'},400);
  let credential;try{credential=(await readJson(request,1200)).licenseKey??'';if(typeof credential!=='string'||credential.length>900)throw Error();credential=credential.trim();}catch{return json({error:'בקשה לא תקינה'},400);}
  if(action==='activate'){
   if(!credential)return json({error:'הזינו קוד רכישה קיים.'},400);
   const purchase=await inspect(credential,env,fetcher);
   if(!purchase||!await saveEntitlement(account,purchase,credential,env,now))return json({unlocked:false,error:'לא נמצאה רכישה מאושרת ששייכת למייל המחובר. בדקו את המייל שבו רכשתם; אין צורך לשלם שוב.'},403);
   return json({unlocked:true});
  }
  const states=new Map();if(await accountAccess(account,env,fetcher,now,states))return json({unlocked:true});
  const browserOrder=credential.startsWith('ZB1.')?await readPaidTicket(credential,env):null;
  if(credential&&!states.has(`paid:${browserOrder?.saleId}`)){
   const purchase=await inspect(credential,env,fetcher);
   if(purchase){if(await saveEntitlement(account,purchase,credential,env,now))return json({unlocked:true});return json({error:'קוד הרכישה אינו שייך למייל המחובר. התחברו למייל שבו בוצעה הרכישה.'},403);}
   // Ignore a stale browser's pending order. Only server-owned orders can be reused.
  }
  const previous=await env.ACCOUNTS_DB.prepare('SELECT o.* FROM purchase_orders o WHERE account_id=? AND NOT EXISTS(SELECT 1 FROM purchase_entitlements e WHERE e.purchase_id=o.purchase_id) ORDER BY created_at DESC LIMIT 1').bind(account.id).first();
  if(previous){
   const recoveryCode=await decrypt(previous.credential_cipher,credentialPurpose(previous.purchase_id,account.id),env),order=await readPaidTicket(recoveryCode,env);
   if(!order)throw Error('Invalid stored order');
   const status=states.get(previous.purchase_id)||await inspectPaidOrder(recoveryCode,env,fetcher);
   if(!status.payable)return json({pending:true,unlocked:false,message:'ההזמנה הקודמת אינה מוכנה לתשלום. לא נפתח הזמנה נוספת לפני בירור מצבה. בדקו שוב או פנו לעזרה.'},202);
   return json({unlocked:false,recoveryCode,checkoutUrl:paidCheckoutUrl(order.saleId,env),price:990,currency:'ILS'});
  }
  const reference=`ZB-${crypto.randomUUID()}`;
  const claim=await env.ACCOUNTS_DB.prepare("INSERT INTO purchase_attempts(account_id,reference,status,created_at) VALUES(?,?,'creating',?) ON CONFLICT(account_id) DO NOTHING RETURNING reference").bind(account.id,reference,now).first();
  let checkout,recoveredAttempt=false;
  if(!claim){
   const attempt=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_attempts WHERE account_id=?').bind(account.id).first();
   if(!attempt||attempt.status==='creating'&&now-attempt.created_at<30000)return json({pending:true,unlocked:false,message:'מכינים את ההזמנה. המתינו מעט ולחצו בדיקת התשלום שלי.'},202);
   checkout=await recoverAttempt(attempt.reference,attempt.created_at,env,fetcher);recoveredAttempt=true;
   if(!checkout)return json({pending:true,unlocked:false,message:'תוצאת יצירת ההזמנה עדיין אינה ידועה. אפשר לנסות שוב בבטחה; הזמנה נוספת לא תיווצר עד לאימות.'},202);
  }else{
   try{checkout=await createPaidCheckout('',env,fetcher,new URL(request.url).origin,reference);}
   catch{await env.ACCOUNTS_DB.prepare("UPDATE purchase_attempts SET status='unknown' WHERE account_id=? AND reference=?").bind(account.id,reference).run();return json({pending:true,unlocked:false,message:'תוצאת יצירת ההזמנה עדיין אינה ידועה. המתינו מעט ונסו שוב בבטחה.'},202);}
  }
  const order=await readPaidTicket(checkout.recoveryCode,env),id=`paid:${order.saleId}`;
  const inserted=await env.ACCOUNTS_DB.prepare('INSERT INTO purchase_orders(purchase_id,account_id,credential_cipher,created_at) VALUES(?,?,?,?) ON CONFLICT(account_id) DO NOTHING RETURNING purchase_id').bind(id,account.id,await encrypt(checkout.recoveryCode,credentialPurpose(id,account.id),env),now).first();
  if(!inserted){
   const winner=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_orders WHERE account_id=?').bind(account.id).first();
   const recoveryCode=await decrypt(winner.credential_cipher,credentialPurpose(winner.purchase_id,account.id),env),savedOrder=await readPaidTicket(recoveryCode,env),status=await inspectPaidOrder(recoveryCode,env,fetcher);
   if(status.purchase&&await saveEntitlement(account,status.purchase,recoveryCode,env,now))return json({unlocked:true});
   if(!status.payable)return json({pending:true,unlocked:false,message:'ההזמנה אותרה, אך אינה מוכנה לתשלום. נדרש בירור מצבה לפני ניסיון נוסף.'},202);
   return json({unlocked:false,recoveryCode,checkoutUrl:paidCheckoutUrl(savedOrder.saleId,env),price:990,currency:'ILS'});
  }
  await env.ACCOUNTS_DB.prepare("UPDATE purchase_attempts SET status='ready',purchase_id=? WHERE account_id=?").bind(id,account.id).run();
  if(recoveredAttempt){
   const status=await inspectPaidOrder(checkout.recoveryCode,env,fetcher);
   if(status.purchase&&await saveEntitlement(account,status.purchase,checkout.recoveryCode,env,now))return json({unlocked:true});
   if(!status.payable)return json({pending:true,unlocked:false,message:'ההזמנה אותרה, אך אינה מוכנה לתשלום. נדרש בירור מצבה לפני ניסיון נוסף.'},202);
  }
  return json({unlocked:false,...checkout});
 }catch{return json({unlocked:false,error:'לא הצלחנו לבדוק את הרכישה כרגע. נסו שוב; אין צורך לשלם שוב.'},503);}
}
export async function reconcilePaidCallback(saleId,env,fetcher=fetch){
 const id=`paid:${saleId}`,row=await env.ACCOUNTS_DB.prepare('SELECT * FROM purchase_orders WHERE purchase_id=? UNION SELECT purchase_id,account_id,credential_cipher,created_at FROM purchase_history WHERE purchase_id=?').bind(id,id).first();
 if(!row)return false;
 const accountRow=await env.ACCOUNTS_DB.prepare('SELECT id,email_cipher FROM accounts WHERE id=?').bind(row.account_id).first();if(!accountRow)return false;
 const account={id:accountRow.id,email:await decrypt(accountRow.email_cipher,'email',env)},credential=await decrypt(row.credential_cipher,credentialPurpose(id,account.id),env),checked=await inspectPaidOrder(credential,env,fetcher);
 if(checked.purchase)return saveEntitlement(account,checked.purchase,credential,env,Date.now());
 if(['refunded','chargeback'].includes(checked.status))await env.ACCOUNTS_DB.batch([
  env.ACCOUNTS_DB.prepare('UPDATE purchase_entitlements SET active=0,checked_at=? WHERE purchase_id=? AND account_id=?').bind(Date.now(),id,account.id),
  env.ACCOUNTS_DB.prepare('INSERT OR IGNORE INTO purchase_history(purchase_id,account_id,credential_cipher,created_at,closed_status) SELECT purchase_id,account_id,credential_cipher,created_at,? FROM purchase_orders WHERE purchase_id=? AND account_id=?').bind(checked.status,id,account.id),
  env.ACCOUNTS_DB.prepare('DELETE FROM purchase_orders WHERE purchase_id=? AND account_id=?').bind(id,account.id),
  env.ACCOUNTS_DB.prepare('DELETE FROM purchase_attempts WHERE account_id=? AND purchase_id=?').bind(account.id,id),
 ]);
 return false;
}
