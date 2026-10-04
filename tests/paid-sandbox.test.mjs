import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaidCheckout,readPaidTicket,inspectPaid,PAID_PRODUCT} from '../worker/paid.js';
import {handleDubbing} from '../worker/dubbing.js';
import worker from '../worker/index.js';
import {SANDBOX_ORIGIN,SANDBOX_LOCAL_ORIGIN,validCheckoutUrl} from '../src/paid-environment.js';
const saleId='SALE1234-12345678-12345678-12345678';
const base={DUBBING_SESSION_SECRET:'fixture-secret-with-at-least-32-characters',GUMROAD_PRODUCT_ID:'fixture-product'};
const sandbox={...base,PAID_ENVIRONMENT:'sandbox',PAID_SANDBOX_SELLER_ID:'fixture-seller'};
function provider({wrongHost=false}={}){
 let reference;
 return async(url,options)=>{
  const body=JSON.parse(options.body);assert.equal(body.seller_payme_id,'fixture-seller');
  assert(url.startsWith('https://sandbox.payme.io/api/'));
  if(url.endsWith('/generate-sale')){
   reference=body.transaction_id;assert.equal(body.sale_return_url,SANDBOX_ORIGIN+'/?dubbing=paid-return');
   return Response.json({status_code:0,payme_sale_id:saleId,transaction_id:reference,price:990,currency:'ILS',sale_url:`https://${wrongHost?'live':'sandbox'}.payme.io/sale/generate/${saleId}`});
  }
  return Response.json({status_code:0,items:[{seller_payme_id:'fixture-seller',sale_payme_id:saleId,transaction_id:reference,sale_status:'completed',sale_type:1,sale_price:990,sale_currency:'ILS',sale_description:PAID_PRODUCT,sale_installments:1}]});
 };
}
test('sandbox tickets are bound to the environment even if a merchant and encryption secret were reused',async()=>{
 const fetcher=provider(),order=await createPaidCheckout('',sandbox,fetcher,SANDBOX_ORIGIN);
 assert(await inspectPaid(order.recoveryCode,sandbox,fetcher));
 assert.equal(await readPaidTicket(order.recoveryCode,{...base,PAID_SELLER_ID:'fixture-seller'}),null);
 const retry=await createPaidCheckout(order.recoveryCode,sandbox,()=>{throw Error('Retry must not generate another sale');},SANDBOX_ORIGIN);
 assert.equal(retry.checkoutUrl,order.checkoutUrl);
});
test('sandbox never falls back to live credentials or accepts a live provider URL',async()=>{
 let calls=0;const never=()=>{calls++;throw Error('Must not call provider');};
 await assert.rejects(createPaidCheckout('',{...base,PAID_ENVIRONMENT:'sandbox',PAID_SELLER_ID:'live-key'},never,SANDBOX_ORIGIN));
 await assert.rejects(createPaidCheckout('',sandbox,never,'https://zoobluff.com'));
 await assert.rejects(createPaidCheckout('',{...sandbox,PAID_ENVIRONMENT:'typo'},never,SANDBOX_ORIGIN));
 assert.equal(calls,0);
 await assert.rejects(createPaidCheckout('',sandbox,provider({wrongHost:true}),SANDBOX_ORIGIN));
});
test('misconfigured hosts fail before authentication, storage, or provider calls',async()=>{
 const never=()=>{throw Error('External call not allowed');};
 for(const [env,origin] of [[sandbox,'https://zoobluff.com'],[sandbox,'https://evil.example'],[{...base,PAID_SELLER_ID:'live'},SANDBOX_ORIGIN],[{...base,PAID_ENVIRONMENT:'typo'},'https://zoobluff.com']]){
  for(const path of ['access','auth/session']){
   const response=await handleDubbing(new Request(origin+'/api/dubbing/'+path),env,{fetcher:never});
   assert.equal(response.status,503);assert.equal((await response.json()).unlocked,false);
  }
 }
});
test('browser checkout validation permits only the provider belonging to its exact deployment origin',()=>{
 const live=`https://live.payme.io/sale/generate/${saleId}`,testUrl=`https://sandbox.payme.io/sale/generate/${saleId}`;
 for(const origin of ['https://zoobluff.com','https://bad-critters.board-experience-engine.workers.dev','https://zoobluff.com?sandbox=1']){
  assert(validCheckoutUrl(live,origin));assert(!validCheckoutUrl(testUrl,origin));
 }
 for(const origin of [SANDBOX_ORIGIN,SANDBOX_LOCAL_ORIGIN]){
  assert(validCheckoutUrl(testUrl,origin));assert(!validCheckoutUrl(live,origin));
  for(const url of [testUrl+'?redirect=evil',testUrl+'/extra',testUrl.replace('.io/','.io.evil/'),'javascript:alert(1)',undefined])assert(!validCheckoutUrl(url,origin));
 }
});
test('sandbox pages and robots exclude the test deployment from search indexing',async()=>{
 const env={...sandbox,ASSETS:{fetch:async()=>new Response('<html>fixture</html>',{headers:{'Content-Type':'text/html'}})}};
 const response=await worker.fetch(new Request(SANDBOX_ORIGIN),env);assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.equal(await response.text(),'<html>fixture</html>');assert.equal(response.headers.get('Content-Type'),'text/html');
 const robots=await worker.fetch(new Request(SANDBOX_ORIGIN+'/robots.txt'),env);assert.match(await robots.text(),/Disallow: \//);
 const live=await worker.fetch(new Request('https://zoobluff.com'),{ASSETS:env.ASSETS});assert.equal(live.headers.get('X-Robots-Tag'),null);
});
