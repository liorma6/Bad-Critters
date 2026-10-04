import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './accounts.test.mjs';
import {handleAccountPurchase,reconcilePaidCallback} from '../worker/account-purchases.js';
import {DubbingAccess,PURCHASE_TIMEOUT_MS} from '../src/dubbing-access.js';
import {paymentCallback} from '../worker/payment-callback.js';
test('concurrent requests make one provider sale, including retries from another tab',async t=>{
 const f=fixture(t),cookie=await f.login('parallel@example.test');
 const replies=await Promise.all(Array.from({length:6},()=>f.call('checkout',{},cookie).then(r=>r.json())));
 assert.equal(f.state.creates,1);assert.equal(replies.filter(r=>r.checkoutUrl).length,1);
 const retry=await (await f.call('checkout',{},cookie)).json();assert.equal(retry.checkoutUrl,replies.find(r=>r.checkoutUrl).checkoutUrl);assert.equal(f.state.creates,1);
});
test('lost create response is reconciled by durable reference without creating a second sale',async t=>{
 const f=fixture(t),cookie=await f.login('lost@example.test'),request=()=>new Request('https://zoobluff.com/api/dubbing/checkout',{method:'POST',headers:{Origin:'https://zoobluff.com','Content-Type':'application/json',Cookie:cookie},body:'{}'});
 let lost=true;const fetcher=async(url,options)=>{const response=await f.fetcher(url,options);if(lost&&url.endsWith('/generate-sale')){lost=false;throw Error('Connection lost after provider commit');}return response;};
 let result=await handleAccountPurchase(request(),f.env,{fetcher,now:f.state.now});assert.equal(result.status,202);assert.equal(f.state.creates,1);
 f.state.now+=31000;result=await handleAccountPurchase(request(),f.env,{fetcher,now:f.state.now});assert((await result.json()).checkoutUrl);assert.equal(f.state.creates,1);
});
test('unknown generation outcome never creates a blind replacement even after repeated retries',async t=>{
 const f=fixture(t),cookie=await f.login('unknown@example.test'),request=()=>new Request('https://zoobluff.com/api/dubbing/checkout',{method:'POST',headers:{Origin:'https://zoobluff.com','Content-Type':'application/json',Cookie:cookie},body:'{}'});
 let attempts=0;const fetcher=async(url,options)=>{if(url.endsWith('/generate-sale')){attempts++;throw Error('Unknown upstream outcome');}return f.fetcher(url,options);};
 for(let i=0;i<3;i++){const response=await handleAccountPurchase(request(),f.env,{fetcher,now:f.state.now});assert.equal(response.status,202);f.state.now+=60000;}assert.equal(attempts,1);
});
test('a completed sale recovered after a lost response unlocks once under concurrent retries',async t=>{
 const f=fixture(t),cookie=await f.login('lost-paid@example.test'),request=()=>new Request('https://zoobluff.com/api/dubbing/checkout',{method:'POST',headers:{Origin:'https://zoobluff.com','Content-Type':'application/json',Cookie:cookie},body:'{}'});
 const fetcher=async(url,options)=>{const response=await f.fetcher(url,options);if(url.endsWith('/generate-sale'))throw Error('Lost response');return response;};
 assert.equal((await handleAccountPurchase(request(),f.env,{fetcher,now:f.state.now})).status,202);f.state.sales[0].sale_status='completed';f.state.now+=31000;
 const replies=await Promise.all(Array.from({length:3},()=>handleAccountPurchase(request(),f.env,{fetcher,now:f.state.now}).then(r=>r.json())));
 assert(replies.every(r=>r.unlocked===true&&!r.checkoutUrl));assert.equal(f.state.creates,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_entitlements').get().n,1);
});
test('cancelled provider status blocks reuse and blind replacement until provider semantics are verified',async t=>{
 const f=fixture(t),cookie=await f.login('cancel@example.test');await f.call('checkout',{},cookie);f.state.sales[0].sale_status='canceled';f.state.now+=7*86400000;
 const r=await f.call('checkout',{},cookie);assert.equal(r.status,202);assert.equal((await r.json()).checkoutUrl,undefined);assert.equal(f.state.creates,1);
});
test('callback returns 200 then verifies server-side; repeated and forged callbacks cannot create entitlement',async t=>{
 const f=fixture(t),cookie=await f.login('callback@example.test');await f.call('checkout',{},cookie);const sale=f.state.sales[0],pending=[];
 const callback=()=>paymentCallback(new Request('https://zoobluff.com/api/dubbing/callback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payme_sale_id:sale.sale_payme_id,sale_status:'completed'})}),f.env,{waitUntil:p=>pending.push(p)},{fetcher:f.fetcher});
 assert.equal((await callback()).status,200);await Promise.all(pending);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_entitlements').get().n,0);
 sale.sale_status='completed';await callback();await callback();await Promise.all(pending);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_entitlements').get().n,1);
 sale.sale_status='refunded';await reconcilePaidCallback(sale.sale_payme_id,f.env,f.fetcher);assert.equal(f.db.sqlite.prepare('SELECT active FROM purchase_entitlements').get().active,0);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM purchase_history').get().n,1);
});
test('purchase client gives the bounded server chain headroom and deduplicates its own in-flight checkout',async()=>{
 assert(PURCHASE_TIMEOUT_MS>28000);let calls=0,resolve;
 const a=new DubbingAccess({fetcher:()=>{calls++;return new Promise(r=>resolve=r);}});
 const first=a.checkout(),second=a.checkout();resolve(Response.json({pending:true}));await Promise.all([first,second]);assert.equal(calls,1);assert.equal(a.unlocked,false);
});
test('an in-flight entitlement response cannot re-enable access after account invalidation',async()=>{
 let resolve;const a=new DubbingAccess({fetcher:()=>new Promise(r=>resolve=r)});const pending=a.check();a.clearAccount(false);resolve(Response.json({unlocked:true}));assert.equal(await pending,false);assert.equal(a.unlocked,false);
});
