import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleDubbing} from '../../worker/dubbing.js';
import {seedRole} from './dubbing-helpers.mjs';

// Real Worker handlers + real SQL/session cryptography, with isolated provider/mail fixtures.
test('account panel revokes the real server session, preserves recordings, isolates a second account and restores the original purchase',async({page,context})=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('migrations/0001_accounts.sql','utf8')+readFileSync('migrations/0002_launch_safety.sql','utf8'));
 const prepare=(sql,args=[])=>({bind(...v){return prepare(sql,v);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);}});
 const db={prepare,async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const env={ACCOUNTS_ENABLED:'true',ACCOUNTS_DB:db,RESEND_API_KEY:'local-fixture',AUTH_EMAIL_FROM:'QA <qa@example.test>',PAID_SELLER_ID:'local-fixture',GUMROAD_PRODUCT_ID:'local-fixture',DUBBING_SESSION_SECRET:'isolated-browser-test-secret-at-least-32-characters'};
 const mails=[],sales=[];let now=Date.now();
 const fetcher=async(url,options)=>{
  const b=JSON.parse(options.body);
  if(url==='https://api.resend.com/emails'){mails.push(b);return Response.json({id:'test-mail'});}
  if(url.endsWith('/generate-sale')){const sale={seller_payme_id:env.PAID_SELLER_ID,sale_payme_id:'SALE'+crypto.randomUUID().toUpperCase(),transaction_id:b.transaction_id,sale_status:'initial',sale_type:1,sale_price:b.sale_price,sale_currency:b.currency,sale_description:b.product_name,sale_installments:1,sale_buyer_details:{buyer_email:'buyer@example.test'}};sales.push(sale);return Response.json({status_code:0,price:990,currency:'ILS',payme_sale_id:sale.sale_payme_id,transaction_id:b.transaction_id,sale_url:'https://live.payme.io/sale/generate/'+sale.sale_payme_id});}
  if(url.endsWith('/get-sales'))return Response.json({status_code:0,items:sales.filter(s=>(!b.sale_payme_id||s.sale_payme_id===b.sale_payme_id)&&(!b.buyer_email||s.sale_buyer_details.buyer_email===b.buyer_email))});
  throw Error('Unexpected external request');
 };
 await context.route('**/api/dubbing/**',async route=>{const q=route.request(),r=await handleDubbing(new Request(q.url(),{method:q.method(),headers:q.headers(),...(q.postData()?{body:q.postData()}: {})}),env,{fetcher,now});const headers=Object.fromEntries(r.headers);if(r.headers.getSetCookie().length)headers['set-cookie']=r.headers.getSetCookie()[0];await route.fulfill({status:r.status,headers,body:await r.text()});});
 await context.route('https://live.payme.io/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Isolated provider fixture</h1>'}));
 const login=async email=>{await page.locator('#account-email').fill(email);await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();await page.locator('#account-code').fill(mails.at(-1).text.match(/\d{6}/)[0]);await page.locator('#verify-login-code').click();};
 try{
  await page.goto('/?test-profile=launch-account&dubbing=activate');await page.locator('#buy-dubbing').click();await login('buyer@example.test');await expect(page).toHaveURL(/live.payme.io/);expect(sales).toHaveLength(1);sales[0].sale_status='completed';
  await page.goto('/?test-profile=launch-account&dubbing=paid-return');await expect(page.locator('#choose-all')).toBeVisible();
  await seedRole(page,{profile:'launch-account',characterId:'goat'});await page.reload();await expect(page.locator('#choose-all')).toBeVisible();await page.locator('#creator-start').click();await page.locator('#skip-intro').click();await page.locator('#settings').click();await page.locator('#manage-account').click();await expect(page.locator('#account-management')).toContainText('buyer@example.test');await expect(page.locator('#account-access-state')).toContainText('פתוח');
  const oldCookie=(await context.cookies()).find(c=>c.name==='zoobluff_account');expect(oldCookie).toBeTruthy();
  const second=await context.newPage();await second.goto('/?test-profile=launch-account-tab&dubbing=activate');await expect(second.locator('#choose-all')).toBeVisible();
  await page.locator('#account-switch').click();await expect(page.locator('#account-email')).toBeVisible();
  expect(sqlite.prepare('SELECT count(*) n FROM auth_sessions').get().n).toBe(0);const denied=await handleDubbing(new Request('http://127.0.0.1:4173/api/dubbing/access',{headers:{Cookie:oldCookie.name+'='+oldCookie.value}}),env,{fetcher,now});expect((await denied.json()).unlocked).toBe(false);
  await second.reload();await expect(second.locator('#choose-all')).toHaveCount(0);await second.close();
  await login('second@example.test');await expect(page.locator('#account-management')).toContainText('second@example.test');await expect(page.locator('#account-access-state')).toContainText('אין כרגע רכישה מאומתת');expect(sales).toHaveLength(1);
  await page.locator('#account-switch').click();now+=61000;await login('buyer@example.test');await expect(page.locator('#account-access-state')).toContainText('פתוח');expect(sales).toHaveLength(1);
  expect(await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js');const s=new VoiceStore({name:'neighborhood-voices-test-launch-account'});await s.ready;const c=s.coverage('fire','goat');s.db.close();return c.approved;})).toBe(13);
  await page.screenshot({path:'reports/launch-2026-10-04/account-restored.png'});
 }finally{sqlite.close();}
});
