import test from 'node:test';
import assert from 'node:assert/strict';
import {handleDubbing,validPurchase} from '../worker/dubbing.js';
import {DubbingAccess} from '../src/dubbing-access.js';
const env={GUMROAD_PRODUCT_ID:'product-under-test',DUBBING_SESSION_SECRET:'test-only-secret-with-at-least-32-characters'};
const purchase={product_id:env.GUMROAD_PRODUCT_ID,price:990,refunded:false,disputed:false};
const origin='https://zoobluff.com';
const activate=(key='VALID-TEST-KEY',extra={})=>new Request(`${origin}/api/dubbing/activate`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify({licenseKey:key})});
const result=p=>({success:true,purchase:p});
test('only a paid purchase for this product can unlock; refunds, disputes, tests and revocations fail closed',()=>{
 assert.equal(validPurchase(result(purchase),env.GUMROAD_PRODUCT_ID),true);
 for(const change of [{product_id:'other'},{price:0},{refunded:true},{disputed:true},{chargebacked:true},{chargedback:true},{license_disabled:true},{access_revoked:true},{test:true},{is_test_purchase:true},{subscription_ended_at:'2026-01-01'}])assert.equal(validPurchase(result({...purchase,...change}),env.GUMROAD_PRODUCT_ID),false,JSON.stringify(change));
 for(const value of [{success:false},{success:true},{success:true,purchase:{product_id:env.GUMROAD_PRODUCT_ID,price:990}}])assert.equal(validPurchase(value,env.GUMROAD_PRODUCT_ID),false);
});
test('activation verifies server-side without counting uses or returning customer data; encrypted cookie restores access',async()=>{
 let calls=0;const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.gumroad.com/v2/licenses/verify');assert.equal(init.body.get('product_id'),env.GUMROAD_PRODUCT_ID);assert.equal(init.body.get('increment_uses_count'),'false');return Response.json(result({...purchase,email:'private@example.test',license_key:'VALID-TEST-KEY'}));};
 const response=await handleDubbing(activate(),env,{fetcher});assert.equal(response.status,200);assert.deepEqual(await response.json(),{unlocked:true});
 const setCookie=response.headers.get('Set-Cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/api/dubbing'])assert(setCookie.includes(flag));assert(!setCookie.includes('VALID-TEST-KEY'));assert.match(response.headers.get('Cache-Control'),/no-store/);
 const cookie=setCookie.split(';')[0];
 const restored=await handleDubbing(new Request(`${origin}/api/dubbing/access`,{headers:{Cookie:cookie}}),env,{fetcher});assert.deepEqual(await restored.json(),{unlocked:true});assert.equal(calls,1);
 const tampered=await handleDubbing(new Request(`${origin}/api/dubbing/access`,{headers:{Cookie:cookie+'tampered'}}),env,{fetcher});assert.deepEqual(await tampered.json(),{unlocked:false});assert.equal(calls,1);
 const otherOrigin=await handleDubbing(new Request('https://different.example/api/dubbing/access',{headers:{Cookie:cookie}}),env,{fetcher});assert.deepEqual(await otherOrigin.json(),{unlocked:false});
});
test('a later refund removes an existing entitlement, while provider outages keep the cookie for retry',async()=>{
 const response=await handleDubbing(activate(),env,{now:Date.now()-7*60*60*1000,fetcher:async()=>Response.json(result(purchase))});
 const request=new Request(`${origin}/api/dubbing/access`,{headers:{Cookie:response.headers.get('Set-Cookie').split(';')[0]}});
 const unavailable=await handleDubbing(request,env,{fetcher:async()=>new Response('',{status:503})});assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('Set-Cookie'),null);
 const refunded=await handleDubbing(request,env,{fetcher:async()=>Response.json(result({...purchase,refunded:true}))});assert.equal((await refunded.json()).unlocked,false);assert.match(refunded.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('missing cookie, wrong method, cross-site requests and malformed input never call Gumroad',async()=>{
 const fetcher=()=>{throw Error('Should not call provider');};
 assert.deepEqual(await (await handleDubbing(new Request(`${origin}/api/dubbing/access`),env,{fetcher})).json(),{unlocked:false});
 assert.equal((await handleDubbing(new Request(`${origin}/api/dubbing/activate`),env,{fetcher})).status,405);
 assert.equal((await handleDubbing(activate('KEY',{Origin:'https://evil.example'}),env,{fetcher})).status,403);
 assert.equal((await handleDubbing(activate(''),env,{fetcher})).status,400);
 assert.equal((await handleDubbing(activate('x'.repeat(1100)),env,{fetcher})).status,400);
 assert.equal((await handleDubbing(activate(),{...env,DUBBING_SESSION_SECRET:''},{fetcher})).status,503);
 assert.equal((await handleDubbing(activate(),{...env,DUBBING_RATE_LIMITER:{limit:async()=>({success:false})}},{fetcher})).status,429);
});
test('fake success, invalid license and upstream failure cannot become an unlocked client state',async()=>{
 const denied=await handleDubbing(activate(),env,{fetcher:async()=>Response.json({success:false},{status:404})});assert.equal(denied.status,403);
 const unavailable=await handleDubbing(activate(),env,{fetcher:async()=>{throw Error('offline');}});assert.equal(unavailable.status,503);
 const access=new DubbingAccess({fetcher:async()=>Response.json({unlocked:true},{status:503})});assert.equal(await access.check(),false);
 access.fetcher=async()=>Response.json({unlocked:true});assert.equal(await access.activate('KEY'),true);
 access.checkedAt=0;access.fetcher=async()=>{throw Error('offline');};assert.equal(await access.check(),false);
});
