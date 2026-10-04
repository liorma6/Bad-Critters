import {reconcilePaidCallback} from './account-purchases.js';
import {readJson} from './request-body.js';
export async function paymentCallback(request,env,ctx,{fetcher=fetch}={}){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(env.DUBBING_RATE_LIMITER&&!((await env.DUBBING_RATE_LIMITER.limit({key:`callback:${request.headers.get('CF-Connecting-IP')||'unknown'}`})).success))return new Response('OK');
 let data;try{if(request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')){
  // Read the stream through the same bounded reader, then parse the provider form.
  const reader=request.body?.getReader(),chunks=[];let length=0;if(reader){try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>4096){await reader.cancel();throw Error();}chunks.push(r.value);}}finally{reader.releaseLock();}}
  const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}data=Object.fromEntries(new URLSearchParams(new TextDecoder().decode(bytes)));
 }else data=await readJson(request);}catch{return new Response('OK');}
 const saleId=data.payme_sale_id||data.sale_payme_id;
 if(!/^SALE[A-Z0-9-]{20,60}$/.test(saleId||''))return new Response('OK');
 // No entitlement comes from this body. A known server-owned order is reread from PayMe.
 const work=reconcilePaidCallback(saleId,env,fetcher).catch(()=>console.warn(JSON.stringify({event:'payment_callback_verification_failed'})));
 if(ctx?.waitUntil)ctx.waitUntil(work);else await work;
 return new Response('OK',{headers:{'Cache-Control':'no-store'}});
}
