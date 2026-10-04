import {test,expect} from '@playwright/test';
import {seedRole} from './dubbing-helpers.mjs';
const sandbox=process.env.ZOOBLUFF_BROWSER_SANDBOX==='1';
const checkoutOrigin=sandbox?'https://sandbox.payme.io':'https://live.payme.io';
const checkoutUrl=checkoutOrigin+'/sale/generate/SALE1234-12345678-12345678-12345678';
async function accountApi(page,{paid=false,emailFailure=false,sessionFailure=false,checkoutFailure=false,authenticated=false}={}){
 const state={authenticated,paid,emails:[],checkouts:0,email:authenticated?'buyer@example.test':'',sessionFailure,checkoutFailure};
 // Intercept the provider: these tests never create or charge a real sale.
 await page.route(checkoutOrigin+'/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Hosted checkout fixture</h1>'}));
 await page.route('**/api/dubbing/**',async route=>{
  const path=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().method()==='POST'?route.request().postDataJSON():{};
  if(path==='session')return route.fulfill({status:state.sessionFailure?503:200,json:state.sessionFailure?{error:'offline'}:{enabled:true,authenticated:state.authenticated,email:state.email}});
  if(path==='request'){
   state.emails.push(body.email);state.email=body.email;
   return route.fulfill({status:emailFailure?503:200,json:emailFailure?{error:'שליחת המייל אינה זמינה כרגע'}:{sent:true,challengeId:'challenge-test',expiresIn:600}});
  }
  if(path==='verify'){
   state.authenticated=body.code==='123456';return route.fulfill({status:state.authenticated?200:403,json:state.authenticated?{authenticated:true,email:state.email}:{error:'הקוד שגוי או פג תוקף'}});
  }
  if(path==='logout'){state.authenticated=false;return route.fulfill({json:{authenticated:false}});}
  if(path==='access')return route.fulfill({json:{accountBased:true,unlocked:state.authenticated&&state.paid,loginRequired:!state.authenticated}});
  if(path==='checkout'){
   state.checkouts++;if(!state.authenticated)return route.fulfill({status:401,json:{unlocked:false,loginRequired:true}});
   if(state.paid)return route.fulfill({json:{unlocked:true}});
   if(state.checkoutFailure)return route.fulfill({status:503,json:{error:'לא הצלחנו להכין את התשלום. נסו שוב.'}});
   return route.fulfill({json:{accountBased:true,unlocked:false,price:990,currency:'ILS',recoveryCode:'ZB1.test.account-recovery',checkoutUrl}});
  }
  return route.fulfill({status:403,json:{unlocked:false,error:'אין רכישה תקפה'}});
 });return state;
}
async function login(page,email='buyer@example.test'){
 await page.locator('#account-email').fill(email);await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();await page.locator('#account-code').fill('123456');await page.locator('#verify-login-code').click();
}

for(const mobile of [false,true])test.describe(mobile?'mobile':'desktop',()=>{
 test.use({viewport:mobile?{width:390,height:844}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile});
 test('payment leads through email directly to Paid and verified return restores the role',async({page})=>{
 const profile=mobile?'account-mobile-purchase':'account-purchase',state=await accountApi(page);
 await page.goto(`/?test-profile=${profile}`);await seedRole(page,{profile,characterId:'badger'});await page.reload();
 await page.locator('#start').click();await expect(page.locator('#choose-all')).toHaveCount(0);await page.locator('#choose-quick').click();await page.locator('#use-complete').click();
 await expect(page.locator('#buy-dubbing')).toBeEnabled();await expect(page.locator('#account-area')).toBeHidden();expect(state.checkouts).toBe(0);
 await expect(page.locator('#buy-dubbing')).toBeInViewport();
 if(sandbox){await expect(page.locator('.sandbox-notice')).toContainText('סביבת בדיקות');await expect(page.locator('#buy-dubbing')).toContainText('ללא חיוב אמיתי');}
 await expect(page.locator('#dialog')).not.toContainText(/Gumroad|License|קוד גיבוי|קוד רכישה/);
 const button=await page.locator('#buy-dubbing').boundingBox(),dialog=await page.locator('#dialog').boundingBox();expect(Math.abs(button.x+button.width/2-dialog.x-dialog.width/2)).toBeLessThan(4);
 await page.screenshot({path:`.cache/purchase-${sandbox?'sandbox-':''}${mobile?'mobile':'desktop'}-new.png`,fullPage:true});
 await page.locator('#buy-dubbing')[mobile?'tap':'click']();await expect(page.locator('#account-email')).toBeVisible();
 await page.locator('#account-email').fill('buyer@example.test');await page.locator('#send-login-code').click();await expect(page.locator('#account-email-form')).toBeHidden();
 await page.locator('#account-code').fill('000000');await page.locator('#verify-login-code').click();await expect(page.locator('#account-status')).toContainText('הקוד שגוי');expect(state.checkouts).toBe(0);
 await page.locator('#account-code').fill('123456');await page.locator('#verify-login-code').click();await expect(page).toHaveURL(checkoutUrl);expect(state.checkouts).toBe(1);
 await page.goto(`/?test-profile=${profile}&dubbing=paid-return&payme_status=success`);
 await expect(page.locator('#buy-dubbing')).toBeVisible();await expect(page.locator('#begin-case')).toHaveCount(0);await expect(page.locator('#choose-all')).toHaveCount(0);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zoobluff-paid-purchase-v1')));expect(saved.accountEmail).toBe('buyer@example.test');expect(saved.intent.characterIds).toEqual(['badger']);
 state.paid=true;await page.locator('#check-payment').click();await expect(page.locator('#begin-case')).toBeVisible();expect(state.checkouts).toBe(1);
 expect(await page.evaluate(p=>JSON.parse(localStorage.getItem(`neighborhood-test-${p}`)).caseCasting.characterId,profile)).toBe('badger');
});
});

test('returning paid customer restores by email without creating a checkout',async({page})=>{
 const state=await accountApi(page,{paid:true});await page.goto('/?test-profile=account-return');await page.locator('#start').click();await page.locator('#activate-dubbing').click();await login(page);
 await expect(page.locator('#choose-all')).toBeVisible();expect(state.checkouts).toBe(0);
 state.authenticated=false;await page.reload();await page.locator('#start').click();await expect(page.locator('#choose-all')).toHaveCount(0);
});

test('existing purchase detected during checkout continues without another sale',async({page})=>{
 await accountApi(page,{paid:true});await page.goto('/?test-profile=account-already-paid&dubbing=activate');await page.locator('#buy-dubbing').click();await login(page);
 await expect(page.locator('#choose-all')).toBeVisible();await expect(page).not.toHaveURL(checkoutUrl);
});

test('switching accounts requires the new email before payment',async({page})=>{
 const state=await accountApi(page,{authenticated:true});await page.goto('/?test-profile=account-switch&dubbing=activate');await expect(page.locator('#account-logout')).toBeVisible();
 await page.locator('#account-logout').click();await expect(page.locator('#account-email')).toBeVisible();await expect(page.locator('#buy-dubbing')).toBeHidden();
 await login(page,'second@example.test');await expect(page.locator('#checkout-status')).toContainText('לא נמצאה רכישה');expect(state.checkouts).toBe(0);
 await page.locator('#buy-dubbing').click();await expect(page).toHaveURL(checkoutUrl);
});

test('email errors leave creator play available and the mobile form fits',async({page})=>{
 await page.setViewportSize({width:320,height:667});await accountApi(page,{emailFailure:true});await page.goto('/?test-profile=account-mobile&dubbing=activate');await page.locator('#buy-dubbing').click();await page.locator('#account-email').fill('buyer@example.test');await page.locator('#send-login-code').click();await expect(page.locator('#account-status')).toContainText('אינה זמינה');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('dialog').scrollWidth<=document.getElementById('dialog').clientWidth)).toBe(true);
 await page.locator('#purchase-free').click();await expect(page.locator('#begin-case')).toBeVisible();
});

test('changing email clears the old challenge and restores one email form',async({page})=>{
 const state=await accountApi(page);await page.goto('/?test-profile=account-email-change&dubbing=activate');await page.locator('#restore-purchase').click();await page.locator('#account-email').fill('first@example.test');await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();await page.locator('#change-email').click();await expect(page.locator('#account-code')).toBeHidden();
 await login(page,'second@example.test');await expect(page.locator('#account-area')).toContainText('second@example.test');expect(state.emails).toEqual(['first@example.test','second@example.test']);expect(state.checkouts).toBe(0);
});

test('session lookup failure has a retry, and provider failure re-enables payment',async({page})=>{
 const state=await accountApi(page,{sessionFailure:true,checkoutFailure:true});await page.goto('/?test-profile=account-retry&dubbing=activate');await page.locator('#buy-dubbing').click();await expect(page.locator('#retry-account')).toBeVisible();
 state.sessionFailure=false;await page.locator('#retry-account').click();await login(page);await expect(page.locator('#buy-dubbing')).toBeEnabled();
 await page.locator('#buy-dubbing').click();await expect(page.locator('#checkout-status')).toContainText('לא הצלחנו');await expect(page.locator('#buy-dubbing')).toBeEnabled();
 state.checkoutFailure=false;await page.locator('#buy-dubbing').click();await expect(page).toHaveURL(checkoutUrl);
});
