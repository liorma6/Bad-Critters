import {queueGumroadCallback,reconcileGumroadCallback} from './account-purchases.js';
import {usesGumroad} from './gumroad.js';
export async function gumroadCallback(request,env,ctx,{fetcher=fetch}={}){
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'POST'}});
 if(!usesGumroad(env)||env.ACCOUNTS_ENABLED!=='true'||!env.ACCOUNTS_DB)return new Response('Unavailable',{status:503,headers});
 if(env.DUBBING_RATE_LIMITER&&!(await env.DUBBING_RATE_LIMITER.limit({key:`gumroad-callback:${request.headers.get('CF-Connecting-IP')||'unknown'}`})).success)return new Response('Retry later',{status:503,headers});
 if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Invalid content type',{status:415,headers});
 let data;
 try{
  const reader=request.body?.getReader(),chunks=[];let length=0;
  if(!reader)throw Error();
  try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>16384){await reader.cancel();throw Error();}chunks.push(r.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  data=Object.fromEntries(new URLSearchParams(new TextDecoder().decode(bytes)));
 }catch{return new Response('Invalid body',{status:400,headers});}
 try{
  // Persist before acknowledging. Failed verification remains queued for the buyer's next access check.
  const id=await queueGumroadCallback(data,env);
  if(id){
   const work=reconcileGumroadCallback(id,env,fetcher).catch(()=>console.warn(JSON.stringify({event:'gumroad_callback_verification_failed'})));
   if(ctx?.waitUntil)ctx.waitUntil(work);else await work;
  }
  return new Response('OK',{headers});
 }catch{return new Response('Retry later',{status:503,headers});}
}
