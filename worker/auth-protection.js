import {paidConfig} from './paid-config.js';
export function mailDailyLimit(env){const value=Number(env.AUTH_DAILY_LIMIT||90);return Number.isInteger(value)&&value>=1&&value<=50000?value:90;}
export async function authMetric(env,event,now=Date.now()){
 try{await env.ACCOUNTS_DB.prepare('INSERT INTO auth_metrics(day,event,count) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET count=count+1').bind(new Date(now).toISOString().slice(0,10),event).run();}catch{}
}
export async function verifyHuman(request,input,env,fetcher){
 if(env.AUTH_TURNSTILE_REQUIRED!=='true')return true;
 const token=input.turnstileToken;if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY||typeof token!=='string'||!token||token.length>2048)return false;
 if(!paidConfig(env).sandbox&&/^1x000000/.test(env.TURNSTILE_SECRET_KEY))return false;
 try{
  const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined})});
  const result=await response.json();return response.ok&&result.success===true&&result.action==='login'&&result.hostname===new URL(request.url).hostname;
 }catch{return false;}
}
