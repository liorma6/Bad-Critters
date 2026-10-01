import {test,expect} from '@playwright/test';
import {seedRole} from './dubbing-helpers.mjs';
async function accountApi(page,{paid=false,emailFailure=false}={}){
 const state={authenticated:false,paid,emails:[],checkouts:0,email:''};
 await page.route('**/api/dubbing/**',async route=>{
  const path=new URL(route.request().url()).pathname.split('/').pop(),body=route.request().method()==='POST'?route.request().postDataJSON():{};
  if(path==='session')return route.fulfill({json:{enabled:true,authenticated:state.authenticated,email:state.email}});
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
   return route.fulfill({json:{accountBased:true,unlocked:false,price:990,currency:'ILS',recoveryCode:'ZB1.test.account-recovery',checkoutUrl:'https://live.payme.io/sale/generate/SALE1234-12345678-12345678-12345678'}});
  }
  return route.fulfill({status:403,json:{unlocked:false,error:'אין רכישה תקפה'}});
 });return state;
}
async function login(page,email='buyer@example.test'){
 await page.locator('#account-email').fill(email);await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();await page.locator('#account-code').fill('123456');await page.locator('#verify-login-code').click();
}
test('record first, then verified email, then fixed-price payment; switching account hides the previous checkout',async({page})=>{
 const state=await accountApi(page);await page.goto('/?test-profile=account-purchase');await seedRole(page,{profile:'account-purchase',characterId:'badger'});await page.reload();
 await page.locator('#start').click();await page.locator('#choose-quick').click();await expect(page.locator('#account-email')).toHaveCount(0);await page.locator('#use-complete').click();
 await expect(page.locator('#buy-dubbing')).toBeDisabled();expect(state.checkouts).toBe(0);
 await page.locator('#account-email').fill('buyer@example.test');await page.locator('#send-login-code').click();await page.locator('#account-code').fill('000000');await page.locator('#verify-login-code').click();await expect(page.locator('#account-status')).toContainText('הקוד שגוי');await expect(page.locator('#buy-dubbing')).toBeDisabled();
 await page.locator('#account-code').fill('123456');await page.locator('#verify-login-code').click();await expect(page.locator('#account-area')).toContainText('buyer@example.test');await page.locator('#buy-dubbing').click();await expect(page.locator('#paid-checkout')).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zoobluff-paid-purchase-v1')));expect(saved.accountEmail).toBe('buyer@example.test');expect(saved.intent.characterIds).toEqual(['badger']);
 await page.locator('#account-logout').click();await expect(page.locator('#account-email')).toBeVisible();await expect(page.locator('#paid-checkout')).toBeHidden();await expect(page.locator('#buy-dubbing')).toBeDisabled();
 await page.locator('#purchase-back').click();await expect(page.locator('#use-complete')).toBeVisible();expect(state.checkouts).toBe(1);
});
test('returning paid customer signs in and starts the saved role without buying again',async({page})=>{
 const state=await accountApi(page,{paid:true});await page.goto('/?test-profile=account-return');await seedRole(page,{profile:'account-return',characterId:'badger'});await page.reload();await page.locator('#start').click();await page.locator('#choose-quick').click();await page.locator('#use-complete').click();await login(page);
 await expect(page.locator('#begin-case')).toBeVisible();expect(state.checkouts).toBe(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('neighborhood-test-account-return')).caseCasting.characterId)).toBe('badger');
});
test('email errors leave free play available and mobile form fits without horizontal scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await accountApi(page,{emailFailure:true});await page.goto('/?test-profile=account-mobile&dubbing=activate');await page.locator('#account-email').fill('buyer@example.test');await page.locator('#send-login-code').click();await expect(page.locator('#account-status')).toContainText('אינה זמינה');await expect(page.locator('#buy-dubbing')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.cache/account-mobile.png',fullPage:true});
 await page.locator('#purchase-free').click();await expect(page.locator('#begin-case')).toBeVisible();
});
test('editing the email invalidates the visible code challenge',async({page})=>{
 const state=await accountApi(page);await page.goto('/?test-profile=account-email-change&dubbing=activate');await page.locator('#account-email').fill('first@example.test');await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();await page.locator('#account-email').fill('second@example.test');await expect(page.locator('#account-code')).toBeHidden();
 await login(page,'second@example.test');await expect(page.locator('#account-area')).toContainText('second@example.test');expect(state.emails).toEqual(['first@example.test','second@example.test']);
});
