import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleDubbing} from '../worker/dubbing.js';
import {PAID_PRODUCT} from '../worker/paid.js';
import {paidConfig,SANDBOX_ORIGIN} from '../worker/paid-config.js';
const origin='https://zoobluff.com';
const start=1800000000000;
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;'+readFileSync(new URL('../migrations/0001_accounts.sql',import.meta.url),'utf8')+readFileSync(new URL('../migrations/0002_launch_safety.sql',import.meta.url),'utf8')+readFileSync(new URL('../migrations/0003_gumroad_inbox.sql',import.meta.url),'utf8'));
 const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:sqlite.prepare(sql).run(...args)};}});
 return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
export function fixture(t,{sandbox=false}={}){
 const db=database();t.after(()=>db.sqlite.close());
 const env={ACCOUNTS_ENABLED:'true',ACCOUNTS_DB:db,RESEND_API_KEY:'test-only-mail-key',AUTH_EMAIL_FROM:'Zoobluff <login@example.test>',PAID_SELLER_ID:'test-seller',GUMROAD_PRODUCT_ID:'test-product',DUBBING_SESSION_SECRET:'test-only-secret-with-at-least-32-characters'};
 if(sandbox){delete env.PAID_SELLER_ID;Object.assign(env,{PAID_ENVIRONMENT:'sandbox',PAID_SANDBOX_SELLER_ID:'sandbox-seller',DUBBING_SESSION_SECRET:env.DUBBING_SESSION_SECRET+'-sandbox'});}
 const config=paidConfig(env),siteOrigin=sandbox?SANDBOX_ORIGIN:origin;
 const state={now:start,mails:[],sales:[],emailFailure:false,providerFailure:false,creates:0};
 const fetcher=async(url,options)=>{
  if(url==='https://api.gumroad.com/v2/licenses/verify')return Response.json(state.gumroad||{success:false});
  const body=JSON.parse(options.body);
  if(url==='https://api.resend.com/emails'){
   assert.equal(options.headers.Authorization,'Bearer test-only-mail-key');assert.match(options.headers['Idempotency-Key'],/^login\//);state.mails.push(body);
   return state.emailFailure?Response.json({error:'failure'},{status:503}):Response.json({id:'mail-id'});
  }
  if(state.providerFailure)return Response.json({status_code:1},{status:503});
  assert.equal(body.seller_payme_id,config.seller);
  if(url.endsWith('/generate-sale')){
   state.creates++;assert.equal(body.sale_price,990);assert.equal(body.currency,'ILS');assert.equal(body.installments,'1');
   assert.equal(url,config.origin+'/api/generate-sale');assert.equal(body.sale_return_url,siteOrigin+'/?dubbing=paid-return');
   const id='SALE'+crypto.randomUUID().toUpperCase();state.sales.push({seller_payme_id:config.seller,sale_payme_id:id,transaction_id:body.transaction_id,sale_status:'initial',sale_type:1,sale_price:990,sale_currency:'ILS',sale_description:PAID_PRODUCT,sale_installments:1,sale_buyer_details:{buyer_email:'payer@example.test'}});
   return Response.json({status_code:0,price:990,currency:'ILS',payme_sale_id:id,transaction_id:body.transaction_id,sale_url:`${config.origin}/sale/generate/${id}`});
  }
  assert.equal(url,config.origin+'/api/get-sales');assert([undefined,'completed'].includes(body.sale_status));
  return Response.json({status_code:0,items:state.sales.filter(s=>(!body.sale_payme_id||s.sale_payme_id===body.sale_payme_id)&&(!body.buyer_email||s.sale_buyer_details.buyer_email===body.buyer_email))});
 };
 const call=(action,body,cookie='',headers={})=>handleDubbing(new Request(`${siteOrigin}/api/dubbing/${action}`,{method:body===undefined?'GET':'POST',headers:{Origin:siteOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{fetcher,now:state.now});
 async function request(email){const response=await call('auth/request',{email});assert.equal(response.status,200);const result=await response.json();return {...result,code:state.mails.at(-1).text.match(/\d{6}/)[0]};}
 async function login(email){const challenge=await request(email);const response=await call('auth/verify',{challengeId:challenge.challengeId,code:challenge.code});assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);return cookie.split(';')[0];}
 return {db,env,state,call,request,login,fetcher};
}
test('mail verification creates an encrypted account and hashed session; replay and logout cannot authenticate',async t=>{
 const f=fixture(t),challenge=await f.request(' Buyer@Example.Test ');
 assert.equal(f.state.mails[0].to[0],'buyer@example.test');
 assert.equal((await (await f.call('auth/session')).json()).authenticated,false);
 const verified=await f.call('auth/verify',challenge);assert.equal(verified.status,200);const cookie=verified.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await (await f.call('auth/session',undefined,cookie)).json()).email,'buyer@example.test');
 assert.equal((await f.call('auth/verify',challenge)).status,403);
 const stored=JSON.stringify(f.db.sqlite.prepare('SELECT * FROM accounts').all())+JSON.stringify(f.db.sqlite.prepare('SELECT * FROM auth_sessions').all())+JSON.stringify(f.db.sqlite.prepare('SELECT * FROM auth_challenges').all());
 assert(!stored.includes('buyer@example.test'));assert(!stored.includes(cookie.split('=')[1]));assert(!stored.includes(`"${challenge.code}"`));
 const logout=await f.call('auth/logout',{},cookie);assert.equal(logout.headers.getSetCookie().length,2);
 assert.equal((await (await f.call('auth/session',undefined,cookie)).json()).authenticated,false);
});
test('codes expire and five wrong attempts exhaust them; resend cooldown, invalid input and CSRF are enforced',async t=>{
 const f=fixture(t),c=await f.request('a@example.test');
 assert.equal((await f.call('auth/request',{email:'a@example.test'})).status,429);
 for(let i=0;i<5;i++)assert.equal((await f.call('auth/verify',{...c,code:c.code==='000000'?'000001':'000000'})).status,403);
 assert.equal((await f.call('auth/verify',c)).status,403);
 f.state.now+=61000;const next=await f.request('a@example.test');f.state.now+=600001;assert.equal((await f.call('auth/verify',next)).status,403);
 assert.equal((await f.call('auth/request',{email:'bad<script>@mail'})).status,400);
 assert.equal((await f.call('auth/request',{email:'b@example.test'},'',{Origin:'https://evil.test'})).status,403);
 assert.equal((await f.call('auth/verify',{},'',{'Sec-Fetch-Site':'cross-site'})).status,403);
});
test('one correct code is consumed only once under concurrent verification and sessions expire',async t=>{
 const f=fixture(t),c=await f.request('parallel@example.test');
 const responses=await Promise.all([f.call('auth/verify',c),f.call('auth/verify',c)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,403]);
 const cookie=responses.find(r=>r.status===200).headers.get('Set-Cookie').split(';')[0];f.state.now+=30*86400000+1;
 assert.equal((await (await f.call('auth/session',undefined,cookie)).json()).authenticated,false);
});
test('failed email delivery and missing credentials fail closed',async t=>{
 const f=fixture(t);f.state.emailFailure=true;assert.equal((await f.call('auth/request',{email:'a@example.test'})).status,503);
 assert.equal(f.db.sqlite.prepare('SELECT sent FROM auth_challenges').get().sent,0);
 f.env.RESEND_API_KEY='';assert.equal((await f.call('auth/request',{email:'b@example.test'})).status,503);
 assert.equal((await f.call('checkout',{})).status,401);
});
test('email alone and forged return flags do not unlock; server-owned orders survive loss of all browser data',async t=>{
 const f=fixture(t);assert.equal((await f.call('checkout',{email:'buyer@example.test',payme_status:'success'})).status,401);
 const cookie=await f.login('buyer@example.test');assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,false);
 const checkout=await (await f.call('checkout',{price:1,currency:'USD'},cookie)).json();assert.equal(checkout.price,990);
 const unpaid=await f.call('activate',{licenseKey:checkout.recoveryCode,payme_status:'success'},cookie);assert.equal(unpaid.status,403);
 const retry=await (await f.call('checkout',{},cookie)).json();assert.equal(retry.checkoutUrl,checkout.checkoutUrl);assert.equal(f.state.creates,1);
 f.state.sales[0].sale_status='completed'; // Payer can differ, because the order is bound before checkout.
 f.state.now+=61000;const newCookie=await f.login('buyer@example.test');
 assert.equal((await (await f.call('access',undefined,newCookie)).json()).unlocked,true);
 assert.equal((await (await f.call('checkout',{},newCookie)).json()).unlocked,true);assert.equal(f.state.creates,1);
 const stored=JSON.stringify(f.db.sqlite.prepare('SELECT * FROM purchase_orders').all());assert(!stored.includes(checkout.recoveryCode));
 const thief=await f.login('payer@example.test');assert.equal((await (await f.call('access',undefined,thief)).json()).unlocked,false);
 assert.equal((await f.call('activate',{licenseKey:checkout.recoveryCode},thief)).status,403);
});
test('legacy Paid sale recovers only after verifying the actual buyer mailbox and exact product/amount',async t=>{
 const f=fixture(t);
 f.state.sales.push({seller_payme_id:'test-seller',sale_payme_id:'SALE1234-12345678-12345678-12345678',transaction_id:'ZB-'+crypto.randomUUID(),sale_status:'completed',sale_type:1,sale_price:990,sale_currency:'ILS',sale_description:PAID_PRODUCT,sale_installments:1,sale_buyer_details:{buyer_email:'legacy@example.test'}});
 const wrong=await f.login('other@example.test');assert.equal((await (await f.call('access',undefined,wrong)).json()).unlocked,false);
 const buyer=await f.login('legacy@example.test');
 f.state.sales[0].sale_price=1;assert.equal((await (await f.call('access',undefined,buyer)).json()).unlocked,false);
 f.state.sales[0].sale_price=990;assert.equal((await (await f.call('access',undefined,buyer)).json()).unlocked,true);
 assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_entitlements').get().n,1);
});
test('provider outages fail closed after cache expiry, then refunds revoke access and allow a fresh purchase',async t=>{
 const f=fixture(t),cookie=await f.login('buyer@example.test');await f.call('checkout',{},cookie);f.state.sales[0].sale_status='completed';
 assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,true);
 f.state.now+=6*3600000+1;f.state.providerFailure=true;assert.equal((await f.call('access',undefined,cookie)).status,503);
 f.state.providerFailure=false;f.state.sales[0].sale_status='refunded';assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,false);
 assert.equal(f.db.sqlite.prepare('SELECT active FROM purchase_entitlements').get().active,0);
 const checkout=await f.call('checkout',{},cookie);assert.equal(checkout.status,200);assert.equal(f.state.creates,2);
});
test('concurrent checkout requests expose one persisted order and forged session cookies do not work',async t=>{
 const f=fixture(t),cookie=await f.login('buyer@example.test');
 const results=await Promise.all([f.call('checkout',{},cookie),f.call('checkout',{},cookie)]);const orders=await Promise.all(results.map(r=>r.json()));
 assert.equal(orders.filter(o=>o.checkoutUrl).length,1);assert.equal(orders.filter(o=>o.pending).length,1);assert.equal(f.state.creates,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_orders').get().n,1);
 assert.equal((await f.call('checkout',{},'zoobluff_account='+'x'.repeat(43))).status,401);
});
test('persistent hourly and daily mail limits hold across requests and reset after their windows',async t=>{
 const f=fixture(t);for(let i=0;i<5;i++){await f.request('limited@example.test');f.state.now+=61000;}
 assert.equal((await f.call('auth/request',{email:'limited@example.test'})).status,429);
 f.state.now=start+3600001;await f.request('limited@example.test');
 f.db.sqlite.prepare("UPDATE auth_limits SET count=90 WHERE id LIKE 'mail:%'").run();
 assert.equal((await f.call('auth/request',{email:'new@example.test'})).status,429);
 f.state.now+=86400001;await f.request('new@example.test');
 assert.equal((await f.call('auth/request',null)).status,400);
});
test('legacy Gumroad keys attach only to the verified buyer, with strict paid/refund flags',async t=>{
 const f=fixture(t),owner=await f.login('owner@example.test'),other=await f.login('other@example.test');
 f.state.gumroad={success:true,purchase:{product_id:'test-product',email:'owner@example.test',refunded:false,disputed:false,price:1000}};
 assert.equal((await f.call('activate',{licenseKey:'LEGACY-KEY'},other)).status,403);
 const purchase=f.state.gumroad.purchase;delete purchase.price;assert.equal((await f.call('activate',{licenseKey:'LEGACY-KEY'},owner)).status,403);
 purchase.price=1000;purchase.refunded=true;assert.equal((await f.call('activate',{licenseKey:'LEGACY-KEY'},owner)).status,403);
 purchase.refunded=false;assert.equal((await f.call('activate',{licenseKey:'LEGACY-KEY'},owner)).status,200);
 assert.equal((await (await f.call('access',undefined,owner)).json()).unlocked,true);
});

test('sandbox email, checkout, retries, return, restore and refund use an isolated account database',async t=>{
 const f=fixture(t,{sandbox:true}),live=fixture(t),cookie=await f.login('buyer@example.test');
 assert.match(f.state.mails[0].subject,/סביבת בדיקות/);assert(f.state.mails[0].text.includes(new URL(SANDBOX_ORIGIN).host));
 const order=await (await f.call('checkout',{},cookie)).json();assert.match(order.checkoutUrl,/^https:\/\/sandbox\.payme\.io\//);
 assert.equal((await (await f.call('checkout',{},cookie)).json()).checkoutUrl,order.checkoutUrl);assert.equal(f.state.creates,1);
 assert.equal((await f.call('activate',{licenseKey:order.recoveryCode,payme_status:'success'},cookie)).status,403);
 const parallel=await Promise.all([f.call('checkout',{},cookie),f.call('checkout',{},cookie)]);
 for(const response of parallel)assert.equal((await response.json()).checkoutUrl,order.checkoutUrl);
 f.state.sales[0].sale_status='completed';assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,true);
 assert.equal((await (await live.call('access',undefined,cookie)).json()).unlocked,false);
 const liveCookie=await live.login('buyer@example.test');assert.equal((await live.call('activate',{licenseKey:order.recoveryCode},liveCookie)).status,403);
 assert.equal((await (await live.call('access',undefined,liveCookie)).json()).unlocked,false);
 f.state.now+=61000;const restored=await f.login('buyer@example.test');assert.equal((await (await f.call('access',undefined,restored)).json()).unlocked,true);
 f.state.now+=6*3600000+1;f.state.sales[0].sale_status='refunded';assert.equal((await (await f.call('access',undefined,restored)).json()).unlocked,false);
 const again=await (await f.call('checkout',{},restored)).json();assert.match(again.checkoutUrl,/^https:\/\/sandbox\.payme\.io\//);assert.equal(f.state.creates,2);
 assert.equal((await f.call('activate',{licenseKey:'LEGACY-LIVE-KEY'},restored)).status,403);
});
