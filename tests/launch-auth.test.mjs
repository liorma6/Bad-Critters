import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './accounts.test.mjs';
import {handleAccount} from '../worker/accounts.js';
test('distributed unauthenticated requests without bot proof cannot consume the mail budget',async t=>{
 const f=fixture(t);Object.assign(f.env,{AUTH_TURNSTILE_REQUIRED:'true',TURNSTILE_SITE_KEY:'live-site-key',TURNSTILE_SECRET_KEY:'live-secret-key'});
 for(let i=0;i<90;i++)assert.equal((await f.call('auth/request',{email:`bot${i}@example.test`},'',{'CF-Connecting-IP':`test-${i}`})).status,403);
 assert.equal(f.state.mails.length,0);assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM auth_limits WHERE id LIKE 'mail:%'").get().n,0);
 assert.equal(f.db.sqlite.prepare("SELECT count FROM auth_metrics WHERE event='bot_rejected'").get().count,90);
});
test('proof validates hostname/action, request retries reuse one email, and the configured budget stays bounded',async t=>{
 const f=fixture(t);Object.assign(f.env,{AUTH_TURNSTILE_REQUIRED:'true',TURNSTILE_SITE_KEY:'live-site-key',TURNSTILE_SECRET_KEY:'live-secret-key',AUTH_DAILY_LIMIT:'2'});
 let wrong=true;const fetcher=(url,options)=>url.includes('/siteverify')?Promise.resolve(Response.json({success:true,action:'login',hostname:wrong?'evil.test':'zoobluff.com'})):f.fetcher(url,options);
 const call=(email,requestId)=>handleAccount(new Request('https://zoobluff.com/api/dubbing/auth/request',{method:'POST',headers:{Origin:'https://zoobluff.com','Content-Type':'application/json'},body:JSON.stringify({email,requestId,turnstileToken:'fixture-token'})}),f.env,{fetcher,now:f.state.now});
 assert.equal((await call('a@example.test')).status,403);wrong=false;const id=crypto.randomUUID(),first=await (await call('a@example.test',id)).json();const retry=await (await call('a@example.test',id)).json();assert.equal(first.challengeId,retry.challengeId);assert.equal(f.state.mails.length,1);
 assert.equal((await call('b@example.test')).status,200);assert.equal((await call('c@example.test')).status,429);assert.equal(f.state.mails.length,2);
});
test('a failed delivery request can retry after the advertised minute without reusing an unsent challenge',async t=>{
 const f=fixture(t),body={email:'retry@example.test',requestId:crypto.randomUUID()};f.state.emailFailure=true;
 assert.equal((await f.call('auth/request',body)).status,503);const old=f.db.sqlite.prepare('SELECT id FROM auth_challenges').get().id;
 assert.equal((await f.call('auth/request',body)).status,429);f.state.now+=61000;f.state.emailFailure=false;
 const result=await (await f.call('auth/request',body)).json();assert.equal(result.sent,true);assert.notEqual(result.challengeId,old);assert.equal(f.state.mails.length,2);
});
