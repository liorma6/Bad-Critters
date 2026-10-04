// Paid uses PayMe's hosted checkout. No card details pass through this Worker.
import {paidConfig,paidReturnOrigin} from './paid-config.js';
export const PAID_PRICE=990;
export const PAID_PRODUCT='זובלוף — דיבוב אישי ללא הגבלה';
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const saleIdPattern=/^SALE[A-Z0-9-]{20,60}$/;
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.DUBBING_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
// Keep existing production tickets readable; sandbox tickets have a separate scope.
const aad=env=>{const config=paidConfig(env);return encoder.encode(`zoobluff-paid-order-v1|${config.seller}${config.sandbox?'|sandbox':''}`);};
async function ticket(order,env){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(env)},await key(env),encoder.encode(JSON.stringify(order)));
 return `ZB1.${encode(iv)}.${encode(new Uint8Array(data))}`;
}
export async function readPaidTicket(code,env){
 try{
  if(!paidConfig(env).seller||typeof code!=='string'||code.length>900)return null;
  const [version,iv,data,...rest]=code.split('.');if(version!=='ZB1'||rest.length)return null;
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:aad(env)},await key(env),decode(data));
  const order=JSON.parse(new TextDecoder().decode(raw));
  return saleIdPattern.test(order.saleId)&&/^ZB-[a-f0-9-]{36}$/.test(order.reference)?order:null;
 }catch{return null;}
}
async function api(method,body,env,fetcher){
 const config=paidConfig(env);if(!config.seller)throw Error('Paid not configured');
 const response=await fetcher(config.origin+'/api/'+method,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({seller_payme_id:config.seller,...body}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();
 if(!response.ok||result.status_code!==0)throw Error('Paid unavailable');
 return result;
}
export function validPaidSale(sale,order,env){
 return sale?.seller_payme_id===paidConfig(env).seller&&sale.sale_payme_id===order.saleId&&sale.transaction_id===order.reference&&sale.sale_status==='completed'&&Number(sale.sale_type)===1&&Number(sale.sale_price)===PAID_PRICE&&sale.sale_currency==='ILS'&&sale.sale_description===PAID_PRODUCT&&Number(sale.sale_installments)===1;
}
export async function inspectPaid(code,env,fetcher){
 const order=await readPaidTicket(code,env);if(!order)return false;
 // Query this exact sale, never accept a browser redirect/callback as proof.
 const result=await api('get-sales',{sale_payme_id:order.saleId,sale_status:'completed',page_size:1},env,fetcher);
 if(result.items?.length!==1||!validPaidSale(result.items[0],order,env))return null;
 return {id:`paid:${order.saleId}`,email:result.items[0].sale_buyer_details?.buyer_email||''};
}
export async function verifyPaid(code,env,fetcher){return !!await inspectPaid(code,env,fetcher);}
export async function inspectPaidOrder(code,env,fetcher){
 const order=await readPaidTicket(code,env);if(!order)throw Error('Invalid order');
 const result=await api('get-sales',{sale_payme_id:order.saleId,page_size:1},env,fetcher);
 const sale=result.items?.length===1?result.items[0]:null;
 if(!sale||sale.seller_payme_id!==paidConfig(env).seller||sale.sale_payme_id!==order.saleId||sale.transaction_id!==order.reference||Number(sale.sale_price)!==PAID_PRICE||sale.sale_currency!=='ILS'||sale.sale_description!==PAID_PRODUCT||Number(sale.sale_installments)!==1)throw Error('Unknown order state');
 const purchase=validPaidSale(sale,order,env)?{id:`paid:${order.saleId}`,email:sale.sale_buyer_details?.buyer_email||''}:null;
 return {status:sale.sale_status,purchase,payable:sale.sale_status==='initial'};
}
export async function recoverAttempt(reference,createdAt,env,fetcher){
 // get-sales documents date/page filters, not an idempotency guarantee for generate-sale.
 // Search for our durable reference; absence is unknown and NEVER authorises a new sale.
 for(let page=1;page<=5;page++){
  const result=await api('get-sales',{sale_created_min:new Date(createdAt-86400000).toISOString().slice(0,10)+' 00:00:00',page_size:100,page},env,fetcher);
  const items=result.items||[],matches=items.filter(s=>s.transaction_id===reference&&s.seller_payme_id===paidConfig(env).seller);
  if(matches.length===1){const sale=matches[0];if(!saleIdPattern.test(sale.sale_payme_id)||Number(sale.sale_price)!==PAID_PRICE||sale.sale_currency!=='ILS'||sale.sale_description!==PAID_PRODUCT)throw Error('Invalid recovered order');return {recoveryCode:await ticket({saleId:sale.sale_payme_id,reference},env),checkoutUrl:paidCheckoutUrl(sale.sale_payme_id,env),price:PAID_PRICE,currency:'ILS'};}
  if(matches.length>1)throw Error('Ambiguous provider reference');if(items.length<100)break;
 }
 return null;
}
export async function recoverPaid(email,env,fetcher){
 const result=await api('get-sales',{buyer_email:email,sale_status:'completed',sale_price:PAID_PRICE,sale_currency:'ILS',page_size:100},env,fetcher);
 for(const sale of result.items||[]){
  const order={saleId:sale.sale_payme_id,reference:sale.transaction_id};
  if(sale.sale_buyer_details?.buyer_email?.trim().toLowerCase()!==email||!saleIdPattern.test(order.saleId)||!/^ZB-[a-f0-9-]{36}$/.test(order.reference)||!validPaidSale(sale,order,env))continue;
  return {id:`paid:${order.saleId}`,email,credential:await ticket(order,env)};
 }
 return null;
}
export function paidCheckoutUrl(saleId,env={}){return `${paidConfig(env).origin}/sale/generate/${saleId}`;}
export async function createPaidCheckout(previousCode,env,fetcher,origin='https://zoobluff.com',reference=`ZB-${crypto.randomUUID()}`){
 if(!paidConfig(env).seller)throw Error('Paid not configured');
 const returnOrigin=paidReturnOrigin(origin,env);
 if(previousCode){
  const previous=await readPaidTicket(previousCode,env);
  // Reuse the same sale across retries; a paid sale is checked before this call.
  if(previous)return {checkoutUrl:paidCheckoutUrl(previous.saleId,env),recoveryCode:previousCode,price:PAID_PRICE,currency:'ILS'};
  throw Error('Invalid saved purchase');
 }
 if(!/^ZB-[a-f0-9-]{36}$/.test(reference))throw Error('Invalid reference');
 const result=await api('generate-sale',{
  sale_price:PAID_PRICE,currency:'ILS',product_name:PAID_PRODUCT,transaction_id:reference,installments:'1',
  sale_type:'sale',sale_payment_method:'credit-card',capture_buyer:'0',language:'he',sale_send_notification:false,
  sale_return_url:`${returnOrigin}/?dubbing=paid-return`,
  ...(env.ACCOUNTS_ENABLED==='true'?{sale_callback_url:`${returnOrigin}/api/dubbing/callback`}:{}),
 },env,fetcher);
 if(!saleIdPattern.test(result.payme_sale_id)||Number(result.price)!==PAID_PRICE||result.currency!=='ILS'||result.transaction_id!==reference||result.sale_url!==paidCheckoutUrl(result.payme_sale_id,env))throw Error('Unexpected Paid checkout');
 return {checkoutUrl:result.sale_url,recoveryCode:await ticket({saleId:result.payme_sale_id,reference},env),price:PAID_PRICE,currency:'ILS'};
}
