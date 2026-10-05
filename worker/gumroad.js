import {keyedDigest} from './account-crypto.js';
import {paidConfig} from './paid-config.js';
export const usesGumroad=env=>env.PAYMENT_PROVIDER==='gumroad';
export function validGumroadPurchase(result,productId,{testOnly=false}={}){
 const p=result?.purchase,isTest=p?.test===true||p?.is_test_purchase===true;
 return result?.success===true&&p?.product_id===productId&&p.refunded===false&&p.disputed===false&&!p.chargebacked&&!p.chargedback&&!p.license_disabled&&!p.access_revoked&&!p.subscription_ended_at&&!p.subscription_failed_at&&Number(p.price)>0&&(testOnly?isTest:!p.test&&!p.is_test_purchase);
}
export async function inspectGumroad(credential,env,fetcher=fetch){
 const sandbox=paidConfig(env).sandbox;
 if(sandbox&&!usesGumroad(env))return null;
 const response=await fetcher('https://api.gumroad.com/v2/licenses/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({product_id:env.GUMROAD_PRODUCT_ID,license_key:credential,increment_uses_count:'false'}),signal:AbortSignal.timeout(10000)});
 if(!response.ok&&![400,404].includes(response.status))throw Error('Gumroad unavailable');
 const result=await response.json();
 if(!response.ok||!validGumroadPurchase(result,env.GUMROAD_PRODUCT_ID,{testOnly:sandbox}))return null;
 return {id:`gumroad:${await keyedDigest(credential,env)}`,email:result.purchase.email||''};
}
export async function recoverGumroad(email,env,fetcher=fetch){
 if(!env.GUMROAD_ACCESS_TOKEN)return null;
 let pageKey;
 for(let page=0;page<5;page++){
  const url=new URL('https://api.gumroad.com/v2/sales');
  url.searchParams.set('product_id',env.GUMROAD_PRODUCT_ID);url.searchParams.set('email',email);
  if(pageKey)url.searchParams.set('page_key',pageKey);
  const response=await fetcher(url.href,{headers:{Authorization:`Bearer ${env.GUMROAD_ACCESS_TOKEN}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Gumroad sales unavailable');
  const result=await response.json();if(result.success!==true||!Array.isArray(result.sales))throw Error('Invalid Gumroad sales response');
  for(const sale of result.sales){
   const credential=sale.license_key;
   if(sale.product_id!==env.GUMROAD_PRODUCT_ID||typeof sale.email!=='string'||sale.email.trim().toLowerCase()!==email||typeof credential!=='string'||credential.length<8||credential.length>160)continue;
   const purchase=await inspectGumroad(credential,env,fetcher);
   if(purchase?.email.trim().toLowerCase()===email)return {...purchase,credential};
  }
  if(!result.next_page_key&&!result.next_page_url)return null;
  if(typeof result.next_page_key!=='string'||result.next_page_key.length>300)throw Error('Invalid Gumroad pagination');
  pageKey=result.next_page_key;
 }
 // An incomplete lookup must not invite a second purchase.
 throw Error('Gumroad sales lookup incomplete');
}
