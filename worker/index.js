import {handleDubbing} from './dubbing.js';
import {paymentCallback} from './payment-callback.js';
import {gumroadCallback} from './gumroad-callback.js';
export default {async fetch(request,env,ctx){
 if(new URL(request.url).pathname==='/api/dubbing/gumroad-callback')return gumroadCallback(request,env,ctx);
 if(new URL(request.url).pathname==='/api/dubbing/callback')return paymentCallback(request,env,ctx);
 if(new URL(request.url).pathname.startsWith('/api/dubbing/'))return handleDubbing(request,env);
 if(env.PAID_ENVIRONMENT==='sandbox'){
  if(new URL(request.url).pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain','X-Robots-Tag':'noindex, nofollow'}});
  const asset=await env.ASSETS.fetch(request),response=new Response(asset.body,asset);
  response.headers.set('X-Robots-Tag','noindex, nofollow');return response;
 }
 return env.ASSETS.fetch(request);
}};
