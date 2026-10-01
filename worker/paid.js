// Paid uses PayMe's hosted checkout. No card details pass through this Worker.
export const PAID_PRICE=990;
export const PAID_PRODUCT='זובלוף — דיבוב אישי ללא הגבלה';
const API='https://live.payme.io/api/';
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const saleIdPattern=/^SALE[A-Z0-9-]{20,60}$/;
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.DUBBING_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
const aad=env=>encoder.encode(`zoobluff-paid-order-v1|${env.PAID_SELLER_ID}`);
async function ticket(order,env){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(env)},await key(env),encoder.encode(JSON.stringify(order)));
 return `ZB1.${encode(iv)}.${encode(new Uint8Array(data))}`;
}
export async function readPaidTicket(code,env){
 try{
  if(!env.PAID_SELLER_ID||typeof code!=='string'||code.length>900)return null;
  const [version,iv,data,...rest]=code.split('.');if(version!=='ZB1'||rest.length)return null;
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:aad(env)},await key(env),decode(data));
  const order=JSON.parse(new TextDecoder().decode(raw));
  return saleIdPattern.test(order.saleId)&&/^ZB-[a-f0-9-]{36}$/.test(order.reference)?order:null;
 }catch{return null;}
}
async function api(method,body,env,fetcher){
 const response=await fetcher(API+method,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({seller_payme_id:env.PAID_SELLER_ID,...body}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();
 if(!response.ok||result.status_code!==0)throw Error('Paid unavailable');
 return result;
}
export function validPaidSale(sale,order,env){
 return sale?.seller_payme_id===env.PAID_SELLER_ID&&sale.sale_payme_id===order.saleId&&sale.transaction_id===order.reference&&sale.sale_status==='completed'&&Number(sale.sale_type)===1&&Number(sale.sale_price)===PAID_PRICE&&sale.sale_currency==='ILS'&&sale.sale_description===PAID_PRODUCT&&Number(sale.sale_installments)===1;
}
export async function verifyPaid(code,env,fetcher){
 const order=await readPaidTicket(code,env);if(!order)return false;
 // Query this exact sale, never accept a browser redirect/callback as proof.
 const result=await api('get-sales',{sale_payme_id:order.saleId,sale_status:'completed',page_size:1},env,fetcher);
 return result.items?.length===1&&validPaidSale(result.items[0],order,env);
}
export function paidCheckoutUrl(saleId){return `https://live.payme.io/sale/generate/${saleId}`;}
export async function createPaidCheckout(previousCode,env,fetcher,origin='https://zoobluff.com'){
 if(!env.PAID_SELLER_ID)throw Error('Paid not configured');
 if(previousCode){
  const previous=await readPaidTicket(previousCode,env);
  // Reuse the same sale across retries; a paid sale is checked before this call.
  if(previous)return {checkoutUrl:paidCheckoutUrl(previous.saleId),recoveryCode:previousCode,price:PAID_PRICE,currency:'ILS'};
  throw Error('Invalid saved purchase');
 }
 const reference=`ZB-${crypto.randomUUID()}`;
 const result=await api('generate-sale',{
  sale_price:PAID_PRICE,currency:'ILS',product_name:PAID_PRODUCT,transaction_id:reference,installments:'1',
  sale_type:'sale',sale_payment_method:'credit-card',capture_buyer:'0',language:'he',sale_send_notification:false,
  sale_return_url:`${['https://zoobluff.com','https://bad-critters.board-experience-engine.workers.dev'].includes(origin)?origin:'https://zoobluff.com'}/?dubbing=paid-return`,
 },env,fetcher);
 if(!saleIdPattern.test(result.payme_sale_id)||Number(result.price)!==PAID_PRICE||result.currency!=='ILS'||result.transaction_id!==reference||result.sale_url!==paidCheckoutUrl(result.payme_sale_id))throw Error('Unexpected Paid checkout');
 return {checkoutUrl:result.sale_url,recoveryCode:await ticket({saleId:result.payme_sale_id,reference},env),price:PAID_PRICE,currency:'ILS'};
}
