import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDubbing} from '../worker/dubbing.js';
import {createPaidCheckout,readPaidTicket,validPaidSale,PAID_PRODUCT} from '../worker/paid.js';
const env={PAID_SELLER_ID:'test-seller',GUMROAD_PRODUCT_ID:'legacy-product',DUBBING_SESSION_SECRET:'test-only-secret-with-at-least-32-characters'};
const origin='https://zoobluff.com';
const saleId='SALE1234-12345678-12345678-12345678';
const post=(path,body={},headers={})=>new Request(`${origin}/api/dubbing/${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function provider(){
 const state={creates:0,queries:0,status:'initial',price:990,currency:'ILS'};
 state.fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.seller_payme_id,env.PAID_SELLER_ID);
  if(url.endsWith('/generate-sale')){
   state.creates++;state.reference=body.transaction_id;
   assert.equal(body.sale_price,990);assert.equal(body.currency,'ILS');assert.equal(body.installments,'1');assert.equal(body.capture_buyer,'0');assert.equal(body.sale_send_notification,false);assert.equal(body.sale_return_url,'https://zoobluff.com/?dubbing=paid-return');assert.equal(body.buyer_key,undefined);
   return Response.json({status_code:0,price:990,currency:'ILS',payme_sale_id:saleId,transaction_id:body.transaction_id,sale_url:`https://live.payme.io/sale/generate/${saleId}`});
  }
  assert.equal(url,'https://live.payme.io/api/get-sales');assert.equal(body.sale_payme_id,saleId);assert.equal(body.sale_status,'completed');state.queries++;
  return Response.json({status_code:0,items:[{seller_payme_id:env.PAID_SELLER_ID,sale_payme_id:saleId,transaction_id:state.reference,sale_status:state.status,sale_type:1,sale_price:state.price,sale_currency:state.currency,sale_description:PAID_PRODUCT,sale_installments:1,sale_buyer_details:{buyer_email:'private@example.test'}}]});
 };
 return state;
}
test('checkout fixes amount and currency on the server, retries reuse the sale, unpaid orders cannot unlock',async()=>{
 const p=provider();const created=await handleDubbing(post('checkout',{price:1,currency:'USD'}),env,{fetcher:p.fetcher});const order=await created.json();
 assert.equal(created.status,200);assert.equal(order.unlocked,false);assert.equal(order.price,990);assert.equal(order.currency,'ILS');assert.equal(created.headers.get('Set-Cookie'),null);assert(!JSON.stringify(order).includes(env.PAID_SELLER_ID));
 const unpaid=await handleDubbing(post('activate',{licenseKey:order.recoveryCode}),env,{fetcher:p.fetcher});assert.equal(unpaid.status,403);assert.equal((await unpaid.json()).unlocked,false);
 const retry=await handleDubbing(post('checkout',{licenseKey:order.recoveryCode}),env,{fetcher:p.fetcher});assert.equal((await retry.json()).checkoutUrl,order.checkoutUrl);assert.equal(p.creates,1);
 const forged=await handleDubbing(post('activate',{licenseKey:order.recoveryCode+'fake',payme_status:'success'}),env,{fetcher:p.fetcher});assert.equal(forged.status,403);assert.equal(await readPaidTicket(order.recoveryCode,{...env,PAID_SELLER_ID:'another'}),null);
});
test('only verified completed exact-price purchases activate; existing buyers never get a second sale',async()=>{
 const p=provider();const order=await createPaidCheckout('',env,p.fetcher);p.status='completed';
 for(const [field,value]of [['price',989],['currency','USD'],['status','refunded'],['status','chargeback'],['status','authorized']]){
  const before=p[field];p[field]=value;const r=await handleDubbing(post('activate',{licenseKey:order.recoveryCode}),env,{fetcher:p.fetcher});assert.equal(r.status,403);p[field]=before;
 }
 const activated=await handleDubbing(post('checkout',{licenseKey:order.recoveryCode}),env,{fetcher:p.fetcher});assert.deepEqual(await activated.json(),{unlocked:true});const cookie=activated.headers.get('Set-Cookie');assert(cookie.includes('HttpOnly'));assert(!cookie.includes(order.recoveryCode));
 const duplicate=await handleDubbing(post('checkout',{}, {Cookie:cookie.split(';')[0]}),env,{fetcher:p.fetcher});assert.deepEqual(await duplicate.json(),{unlocked:true});assert.equal(p.creates,1);
 const access=await handleDubbing(new Request(`${origin}/api/dubbing/access`,{headers:{Cookie:cookie.split(';')[0]}}),env,{fetcher:p.fetcher,now:Date.now()+7*60*60*1000});assert.equal((await access.json()).unlocked,true);
 p.status='refunded';const refunded=await handleDubbing(new Request(`${origin}/api/dubbing/access`,{headers:{Cookie:cookie.split(';')[0]}}),env,{fetcher:p.fetcher,now:Date.now()+7*60*60*1000});assert.equal((await refunded.json()).unlocked,false);
});
test('provider scope, sale identity and product must all match, even when the price matches',async()=>{
 const p=provider();const checkout=await createPaidCheckout('',env,p.fetcher),order=await readPaidTicket(checkout.recoveryCode,env);
 const sale={seller_payme_id:env.PAID_SELLER_ID,sale_payme_id:saleId,transaction_id:p.reference,sale_status:'completed',sale_type:1,sale_price:990,sale_currency:'ILS',sale_description:PAID_PRODUCT,sale_installments:1};
 assert.equal(validPaidSale(sale,order,env),true);
 for(const change of [{seller_payme_id:'other'},{sale_payme_id:'other'},{transaction_id:'other'},{sale_description:'other'},{sale_type:'authorize'},{sale_installments:2}])assert.equal(validPaidSale({...sale,...change},order,env),false);
});
test('checkout rejects cross-site, missing config and provider failures without an entitlement',async()=>{
 const p=provider();assert.equal((await handleDubbing(post('checkout',{}, {Origin:'https://evil.test'}),env,{fetcher:p.fetcher})).status,403);assert.equal(p.creates,0);
 assert.equal((await handleDubbing(post('checkout'),{...env,PAID_SELLER_ID:''},{fetcher:p.fetcher})).status,503);
 const unavailable=await handleDubbing(post('checkout'),env,{fetcher:async()=>Response.json({status_code:1},{status:500})});assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('Set-Cookie'),null);
 const wrongPrice=await handleDubbing(post('checkout'),env,{fetcher:async()=>Response.json({status_code:0,price:991,currency:'ILS',payme_sale_id:saleId})});assert.equal(wrongPrice.status,503);
});
