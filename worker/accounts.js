import {randomToken,digest,keyedDigest,encrypt,decrypt} from './account-crypto.js';
import {paidConfig,SANDBOX_ORIGIN} from './paid-config.js';
import {readJson} from './request-body.js';
import {verifyHuman,authMetric,mailDailyLimit} from './auth-protection.js';
import {usesGumroad} from './gumroad.js';
const COOKIE='zoobluff_account';
const SESSION_MS=30*24*60*60*1000;
const CODE_MS=10*60*1000;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const accountsEnabled=env=>env.ACCOUNTS_ENABLED==='true';
const configured=env=>accountsEnabled(env)&&env.ACCOUNTS_DB&&env.RESEND_API_KEY&&env.AUTH_EMAIL_FROM&&env.DUBBING_SESSION_SECRET?.length>=32;
export function normalizeEmail(value){
 if(typeof value!=='string')return null;const email=value.trim().toLowerCase();
 return email.length<=254&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)&&!email.includes('..')?email:null;
}
export const emailIdentity=(email,env)=>keyedDigest(`email:${email}`,env);
function sessionCookie(request,token,maxAge=SESSION_MS/1000){return `${COOKIE}=${token}; Path=/api/dubbing; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function tokenFrom(request){return request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||'';}
export async function accountSession(request,env,now=Date.now()){
 if(!accountsEnabled(env)||!env.ACCOUNTS_DB)return null;
 const token=tokenFrom(request);if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const account=await env.ACCOUNTS_DB.prepare('SELECT a.id,a.email_cipher FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),now).first();
 return account?{id:account.id,email:await decrypt(account.email_cipher,'email',env)}:null;
}
async function reserveLimit(id,limit,period,cooldown,env,now){
 const row=await env.ACCOUNTS_DB.prepare(`INSERT INTO auth_limits(id,count,reset_at,last_at) VALUES(?,1,?,?)
 ON CONFLICT(id) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END,last_at=?
 WHERE last_at<=? AND (count<? OR reset_at<=?) RETURNING id`).bind(id,now+period,now,now,now,now+period,now,now-cooldown,limit,now).first();
 return !!row;
}
function loginCode(){
 let value;do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=4294000000);
 return String(value%1000000).padStart(6,'0');
}
async function sendCode(email,code,challengeId,env,fetcher){
 const sandbox=paidConfig(env).sandbox,site=sandbox?new URL(SANDBOX_ORIGIN).host:'zoobluff.com',title=sandbox?'כניסה לזובלוף — סביבת בדיקות':'כניסה לזובלוף';
 const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`login/${challengeId}`},signal:AbortSignal.timeout(10000),body:JSON.stringify({
  from:env.AUTH_EMAIL_FROM,to:[email],subject:sandbox?'קוד הכניסה לזובלוף — סביבת בדיקות':'קוד הכניסה שלך לזובלוף',
  text:`קוד הכניסה שלך לזובלוף${sandbox?' — סביבת בדיקות':''}: ${code}\nהקוד תקף ל־10 דקות ולשימוש אחד. הקלידו אותו רק באתר ${site}. אם לא ביקשתם להתחבר, אפשר להתעלם מההודעה. אין למסור את הקוד לאדם אחר.`,
  html:`<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h1>${title}</h1><p>קוד הכניסה שלך:</p><p dir="ltr" style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>הקוד תקף ל־10 דקות ולשימוש אחד. הקלידו אותו רק באתר ${site}.</p><p>אם לא ביקשתם להתחבר, אפשר להתעלם מההודעה. אין למסור את הקוד לאדם אחר.</p></div>`,
 })});
 const result=await response.json();if(!response.ok||!result.id)throw Error('Email delivery failed');
}
export async function handleAccount(request,env,{fetcher=fetch,now=Date.now()}={}){
 const url=new URL(request.url),action=url.pathname.split('/').pop();
 if(!['session','request','verify','logout'].includes(action))return json({error:'לא נמצא'},404);
 const method=action==='session'?'GET':'POST';
 if(request.method!==method)return json({error:'בקשה לא נתמכת'},405,{Allow:method});
 if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)||(method==='POST'&&request.headers.get('Origin')!==url.origin))return json({error:'התחברו מתוך אתר המשחק.'},403);
 if(action==='session'&&!accountsEnabled(env))return json({enabled:false,authenticated:false});
 if(!configured(env))return json({enabled:accountsEnabled(env),error:'ההתחברות במייל אינה זמינה כרגע. נסו שוב מאוחר יותר.'},503);
 try{
  if(action==='session'){const account=await accountSession(request,env,now);return json({enabled:true,authenticated:!!account,paymentProvider:usesGumroad(env)?'gumroad':'paid',turnstileSiteKey:env.AUTH_TURNSTILE_REQUIRED==='true'?env.TURNSTILE_SITE_KEY||null:null,botProtectionRequired:env.AUTH_TURNSTILE_REQUIRED==='true',...(account?{email:account.email}:{})});}
  if(env.DUBBING_RATE_LIMITER&&!((await env.DUBBING_RATE_LIMITER.limit({key:`auth:${request.headers.get('CF-Connecting-IP')||'unknown'}`})).success))return json({error:'יותר מדי ניסיונות. נסו שוב בעוד דקה.'},429);
  if(action==='logout'){
   await env.ACCOUNTS_DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(tokenFrom(request))).run();
   const headers=new Headers();headers.append('Set-Cookie',sessionCookie(request,'',0));headers.append('Set-Cookie',`zoobluff_dubbing=; Path=/api/dubbing; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol==='https:'?'; Secure':''}`);
   const response=json({authenticated:false});for(const value of headers.getSetCookie())response.headers.append('Set-Cookie',value);return response;
  }
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'בקשה לא תקינה'},400);
  let input;try{input=await readJson(request);}catch{return json({error:'בקשה לא תקינה'},400);}
  if(action==='request'){
   const email=normalizeEmail(input.email);if(!email)return json({error:'הזינו כתובת מייל תקינה.'},400);
   if(paidConfig(env).sandbox&&env.AUTH_ALLOWED_EMAILS&&!env.AUTH_ALLOWED_EMAILS.split(',').map(s=>s.trim().toLowerCase()).includes(email))return json({error:'סביבת הבדיקות פתוחה כרגע רק לכתובות הבדיקה שאושרו.'},403);
   const accountId=await emailIdentity(email,env),ip=await keyedDigest(`ip:${request.headers.get('CF-Connecting-IP')||'unknown'}`,env);
   const requestId=typeof input.requestId==='string'&&/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId)?await keyedDigest(`request:${accountId}:${ip}:${input.requestId}`,env):null;
   if(requestId){const previous=await env.ACCOUNTS_DB.prepare('SELECT r.challenge_id,r.sent FROM auth_requests r JOIN auth_challenges c ON c.id=r.challenge_id WHERE r.id=? AND r.expires_at>? AND c.used_at IS NULL AND c.attempts<5').bind(requestId,now).first();if(previous)return previous.sent?json({sent:true,challengeId:previous.challenge_id,expiresIn:CODE_MS/1000,reused:true}):json({error:'שליחת הקוד הקודמת עדיין נבדקת. המתינו דקה ונסו שוב.',retryAfter:60},429);}
   if(!await reserveLimit(`ip:${ip}`,20,60*60*1000,0,env,now)){await authMetric(env,'source_limited',now);return json({error:'יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.',retryAfter:60},429);}
   if(!await verifyHuman(request,input,env,fetcher)){await authMetric(env,'bot_rejected',now);return json({error:'אימות האבטחה לא הושלם. נסו שוב מתוך המשחק.'},403);}
   const limit=mailDailyLimit(env),mailId=`mail:${Math.floor(now/86400000)}`;
   if(!await reserveLimit(`email:${accountId}`,5,60*60*1000,60000,env,now)||!await reserveLimit(mailId,limit,86400000,0,env,now)){await authMetric(env,'mail_limited',now);return json({error:'לא ניתן לשלוח קוד נוסף כרגע. אם כבר ביקשתם קוד, בדקו גם בספאם; אחרת נסו שוב מאוחר יותר.',retryAfter:60},429);}
   const challengeId=randomToken(),code=loginCode(),emailCipher=await encrypt(email,'email',env);
   await env.ACCOUNTS_DB.prepare('INSERT INTO auth_challenges(id,account_id,email_cipher,code_hash,expires_at) VALUES(?,?,?,?,?)').bind(challengeId,accountId,emailCipher,await keyedDigest(`otp:${challengeId}:${code}`,env),now+CODE_MS).run();
   if(requestId)await env.ACCOUNTS_DB.prepare('INSERT INTO auth_requests(id,account_id,challenge_id,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET challenge_id=excluded.challenge_id,expires_at=excluded.expires_at,sent=0').bind(requestId,accountId,challengeId,now+60000).run();
   await sendCode(email,code,challengeId,env,fetcher);
   await env.ACCOUNTS_DB.batch([
    env.ACCOUNTS_DB.prepare('UPDATE auth_challenges SET sent=1 WHERE id=?').bind(challengeId),
    env.ACCOUNTS_DB.prepare('DELETE FROM auth_challenges WHERE id IN (SELECT id FROM auth_challenges WHERE expires_at<? LIMIT 100)').bind(now-86400000),
    env.ACCOUNTS_DB.prepare('DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE expires_at<? LIMIT 100)').bind(now),
    env.ACCOUNTS_DB.prepare('DELETE FROM auth_limits WHERE id IN (SELECT id FROM auth_limits WHERE reset_at<? LIMIT 100)').bind(now-86400000),
   ]);
   if(requestId)await env.ACCOUNTS_DB.prepare('UPDATE auth_requests SET sent=1,expires_at=? WHERE id=?').bind(now+CODE_MS,requestId).run();
   await authMetric(env,'sent',now);
   const usage=await env.ACCOUNTS_DB.prepare('SELECT count FROM auth_limits WHERE id=?').bind(mailId).first();
   if(usage?.count>=Math.floor(limit*.8)){await authMetric(env,'near_limit',now);console.warn(JSON.stringify({event:'auth_mail_near_limit',count:usage.count,limit,sandbox:paidConfig(env).sandbox}));}
   // The same response is used for new users and existing purchasers.
   return json({sent:true,challengeId,expiresIn:CODE_MS/1000});
  }
  if(!/^[A-Za-z0-9_-]{43}$/.test(input.challengeId)||!/^\d{6}$/.test(input.code))return json({error:'הזינו את הקוד בן 6 הספרות שקיבלתם במייל.'},400);
  const hash=await keyedDigest(`otp:${input.challengeId}:${input.code}`,env);
  // Conditional UPDATE consumes a correct code atomically, including parallel requests.
  const challenge=await env.ACCOUNTS_DB.prepare(`UPDATE auth_challenges SET attempts=attempts+1,used_at=CASE WHEN code_hash=? THEN ? ELSE NULL END
   WHERE id=? AND used_at IS NULL AND expires_at>? AND attempts<5 AND sent=1 RETURNING account_id,email_cipher,code_hash,used_at`).bind(hash,now,input.challengeId,now).first();
  if(!challenge||challenge.code_hash!==hash||challenge.used_at===null)return json({error:'הקוד שגוי, פג תוקף או כבר נוצל. אפשר לבקש קוד חדש.'},403);
  const token=randomToken();await env.ACCOUNTS_DB.batch([
   env.ACCOUNTS_DB.prepare('INSERT INTO accounts(id,email_cipher,created_at,last_login_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_login_at=excluded.last_login_at').bind(challenge.account_id,challenge.email_cipher,now,now),
   env.ACCOUNTS_DB.prepare('INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').bind(await digest(token),challenge.account_id,now+SESSION_MS),
  ]);
  return json({authenticated:true,email:await decrypt(challenge.email_cipher,'email',env)},200,{'Set-Cookie':sessionCookie(request,token)});
 }catch{await authMetric(env,'provider_or_storage_error',now);console.warn(JSON.stringify({event:'auth_provider_or_storage_error',sandbox:paidConfig(env).sandbox}));return json({error:'לא הצלחנו להשלים את ההתחברות כרגע. נסו שוב; ההקלטות נשארות במכשיר.'},503);}
}
