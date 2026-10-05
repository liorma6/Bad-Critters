import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './accounts.test.mjs';
import {queueGumroadCallback,reconcileGumroadCallback} from '../worker/account-purchases.js';
import {gumroadCallback} from '../worker/gumroad-callback.js';
import {GUMROAD_PRODUCT_ID,gumroadCheckoutUrl,validGumroadCheckoutUrl} from '../src/gumroad-checkout.js';
import {DubbingAccess} from '../src/dubbing-access.js';
import {handleAccountPurchase} from '../worker/account-purchases.js';
const license='TEST-ONLY-LICENSE-123';
function setup(t,options){
 const f=fixture(t,options);Object.assign(f.env,{PAYMENT_PROVIDER:'gumroad',GUMROAD_PRODUCT_ID});
 f.state.gumroad={success:true,purchase:{product_id:GUMROAD_PRODUCT_ID,email:'buyer@example.test',price:290,refunded:false,disputed:false}};
 f.data={product_id:GUMROAD_PRODUCT_ID,email:'buyer@example.test',license_key:license};return f;
}
test('new checkout is 990 ILS, authenticated, allowlisted and makes no Paid calls',async t=>{
 const f=setup(t);assert.equal((await f.call('checkout',{})).status,401);
 const cookie=await f.login('buyer@example.test');f.state.providerFailure=true;
 const response=await f.call('checkout',{},cookie),result=await response.json();
 assert.equal(response.status,200);assert.equal(result.price,990);assert.equal(result.currency,'ILS');assert.equal(result.provider,'gumroad');assert(validGumroadCheckoutUrl(result.checkoutUrl));assert.equal(f.state.creates,0);
 assert.equal(new URL(result.checkoutUrl).searchParams.get('email'),'buyer@example.test');
 assert.equal((await f.call('checkout',{},cookie,{Origin:'https://evil.test'})).status,403);
});
test('unsigned callbacks cannot unlock until verified; provider email determines ownership and a second device restores by email',async t=>{
 const f=setup(t),wrong=await f.login('attacker@example.test');
 const id=await queueGumroadCallback({...f.data,email:'attacker@example.test',refunded:'false',price:'990'},f.env,f.state.now);
 assert.equal((await f.db.prepare('SELECT * FROM purchase_entitlements').all()).results.length,0);
 assert(await reconcileGumroadCallback(id,f.env,f.fetcher,f.state.now));
 assert.equal((await (await f.call('access',undefined,wrong)).json()).unlocked,false);
 const owner=await f.login('buyer@example.test');assert.equal((await (await f.call('access',undefined,owner)).json()).unlocked,true);
 assert.equal((await (await f.call('checkout',{},owner)).json()).unlocked,true);
 const rows=JSON.stringify(f.db.sqlite.prepare('SELECT * FROM purchase_entitlements').all());assert(!rows.includes(license));assert(!rows.includes('buyer@example.test'));
});
test('refunds, forged success, wrong product, free licenses and creator test purchases cannot unlock production',async t=>{
 const f=setup(t);
 for(const change of [{refunded:true},{disputed:true},{test:true},{is_test_purchase:true},{price:0},{product_id:'other'},{license_disabled:true},{chargebacked:true}]){
  const original=f.state.gumroad.purchase;f.state.gumroad.purchase={...original,...change};
  const id=await queueGumroadCallback(f.data,f.env,f.state.now);assert.equal(await reconcileGumroadCallback(id,f.env,f.fetcher,f.state.now),false);f.state.gumroad.purchase=original;
 }
 assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM purchase_entitlements WHERE active=1').get().n,0);
 assert.equal(await queueGumroadCallback({...f.data,product_id:'other'},f.env),null);
});
test('a dropped verification is retained encrypted and retried on login; duplicate and out-of-order refund notifications are safe',async t=>{
 const f=setup(t),cookie=await f.login('buyer@example.test'),id=await queueGumroadCallback(f.data,f.env,f.state.now);
 await assert.rejects(reconcileGumroadCallback(id,f.env,async()=>Response.json({},{status:503}),f.state.now));
 assert(!JSON.stringify(f.db.sqlite.prepare('SELECT * FROM gumroad_inbox').all()).includes(license));
 assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,true);
 assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM gumroad_inbox').get().n,0);
 for(let i=0;i<2;i++)await reconcileGumroadCallback(await queueGumroadCallback(f.data,f.env),f.env,f.fetcher,f.state.now);
 assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM purchase_entitlements').get().n,1);
 f.state.gumroad.purchase.refunded=true;
 await reconcileGumroadCallback(await queueGumroadCallback(f.data,f.env),f.env,f.fetcher,f.state.now);
 assert.equal((await (await f.call('access',undefined,cookie)).json()).unlocked,false);
});
test('sandbox accepts only creator tests for allowed emails and never redirects to the live checkout',async t=>{
 const f=setup(t,{sandbox:true});f.env.AUTH_ALLOWED_EMAILS='buyer@example.test';const cookie=await f.login('buyer@example.test');
 assert.equal((await f.call('checkout',{},cookie)).status,409);
 const reconcile=async()=>reconcileGumroadCallback(await queueGumroadCallback(f.data,f.env),f.env,f.fetcher,f.state.now);
 assert.equal(await reconcile(),false);f.state.gumroad.purchase.test=true;assert.equal(await reconcile(),true);
 f.state.gumroad.purchase.email='outsider@example.test';assert.equal(await reconcile(),false);
});
test('callback acknowledges only after persistence, rejects oversized bodies and preserves retry on storage failure',async t=>{
 const f=setup(t),request=body=>new Request('https://zoobluff.com/api/dubbing/gumroad-callback',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 let work;const response=await gumroadCallback(request(new URLSearchParams(f.data)),f.env,{waitUntil(value){work=value;}},{fetcher:f.fetcher});assert.equal(response.status,200);await work;
 assert.equal((await gumroadCallback(request('x'.repeat(16385)),f.env,{})).status,400);
 const broken={...f.env,ACCOUNTS_DB:{prepare(){throw Error('Database unavailable');}}};assert.equal((await gumroadCallback(request(new URLSearchParams(f.data)),broken,{})).status,503);
});
test('client preserves the selected role without license fields and rejects wrong prices or redirected destinations',async t=>{
 const old=globalThis.localStorage,values=new Map();globalThis.localStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};t.after(()=>globalThis.localStorage=old);
 const result={provider:'gumroad',price:990,currency:'ILS',checkoutUrl:gumroadCheckoutUrl('buyer@example.test')},access=new DubbingAccess({fetcher:async()=>Response.json(result)});
 access.account={email:'buyer@example.test'};assert(await access.checkout({caseIndex:0,characterIds:['badger']}));assert.deepEqual(access.saved().intent,{caseIndex:0,characterIds:['badger']});assert.equal(access.saved().recoveryCode,undefined);
 for(const change of [{price:991},{currency:'USD'},{checkoutUrl:'https://evil.test'},{checkoutUrl:result.checkoutUrl+'&redirect=https://evil.test'}]){access.fetcher=async()=>Response.json({...result,...change});assert.equal(await access.checkout(null),null);}
});
test('read-only sales lookup recovers a missed notification, filters product and verified email, and blocks checkout during outages',async t=>{
 const f=setup(t),cookie=await f.login('buyer@example.test');f.env.GUMROAD_ACCESS_TOKEN='test-only-sales-token';
 let sales=[{product_id:'unrelated',email:'buyer@example.test',license_key:license},{product_id:GUMROAD_PRODUCT_ID,email:'wrong@example.test',license_key:license}];
 let outage=false,licenseChecks=0;
 const fetcher=async(url,options)=>{
  if(new URL(url).pathname==='/v2/sales'){
   assert.equal(new URL(url).searchParams.get('product_id'),GUMROAD_PRODUCT_ID);assert.equal(new URL(url).searchParams.get('email'),'buyer@example.test');assert.equal(options.headers.Authorization,'Bearer test-only-sales-token');assert(!url.includes('test-only-sales-token'));
   return outage?Response.json({},{status:503}):Response.json({success:true,sales});
  }
  licenseChecks++;return f.fetcher(url,options);
 };
 const call=action=>handleAccountPurchase(new Request(`https://zoobluff.com/api/dubbing/${action}`,{headers:{Cookie:cookie,'Content-Type':'application/json'},...(action==='checkout'?{method:'POST',body:'{}'}:{})}),f.env,{fetcher,now:f.state.now});
 assert.equal((await (await call('access')).json()).unlocked,false);assert.equal(licenseChecks,0);
 outage=true;assert.equal((await call('checkout')).status,503);outage=false;
 sales.push({product_id:GUMROAD_PRODUCT_ID,email:'buyer@example.test',license_key:license});
 assert.equal((await (await call('access')).json()).unlocked,true);assert.equal(licenseChecks,1);
});
