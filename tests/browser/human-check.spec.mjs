import {test,expect} from '@playwright/test';

async function protectedAccount(page){
 const state={sent:0};
 await page.route('**/api/dubbing/**',async r=>{
  const action=new URL(r.request().url()).pathname.split('/').pop();
  if(action==='session')return r.fulfill({json:{enabled:true,authenticated:false,botProtectionRequired:true,turnstileSiteKey:'isolated-widget'}});
  if(action==='request'){expect(r.request().postDataJSON().turnstileToken).toBe('isolated-proof');state.sent++;return r.fulfill({json:{sent:true,challengeId:'isolated-challenge'}});}
  return r.fulfill({json:{accountBased:true,unlocked:false}});
 });return state;
}
const provider=`window.widgetCalls=[];window.widgetCallbacks=[];window.turnstile={render(el,options){const visible=el.getBoundingClientRect().width>0;window.widgetCalls.push({visible,size:options.size});window.widgetCallbacks.push(options);el.textContent='בדיקת אבטחה לדוגמה';return String(window.widgetCalls.length);},remove(){}};`;

test('hidden payment form defers security widget, visible form can send and resend after verification',async({page})=>{
 const state=await protectedAccount(page);await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:provider}));
 await page.goto('/?dubbing=activate&test-profile=human-visible');await expect(page.locator('#account-email')).toBeAttached();await expect(page.locator('#account-area')).toBeHidden();
 expect(await page.evaluate(()=>window.widgetCalls?.length||0)).toBe(0);
 await page.locator('#buy-dubbing').click();await expect(page.locator('#human-check')).toHaveText('בדיקת אבטחה לדוגמה');await expect(page.locator('#send-login-code')).toBeDisabled();
 expect(await page.evaluate(()=>window.widgetCalls.every(c=>c.visible))).toBe(true);
 await page.locator('#account-email').fill('owner@example.test');await page.evaluate(()=>window.widgetCallbacks.at(-1).callback('isolated-proof'));await expect(page.locator('#send-login-code')).toBeEnabled();
 await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();expect(state.sent).toBe(1);
 await page.locator('#change-email').click();await expect(page.locator('#account-email')).toBeVisible();await expect(page.locator('#send-login-code')).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>window.widgetCalls.length)).toBeGreaterThan(1);
 await page.evaluate(()=>window.widgetCallbacks.at(-1).callback('isolated-proof'));await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();expect(state.sent).toBe(2);
});

test('failed security script gives a working retry without reloading or losing the email',async({page})=>{
 const state=await protectedAccount(page);let attempts=0;
 await page.route('https://challenges.cloudflare.com/**',r=>++attempts===1?r.abort():r.fulfill({contentType:'text/javascript',body:provider}));
 await page.goto('/?dubbing=activate&test-profile=human-retry');await page.locator('#buy-dubbing').click();await page.locator('#account-email').fill('owner@example.test');
 await expect(page.locator('#human-check-status')).toContainText('לא נטענה');await expect(page.locator('#send-login-code')).toBeDisabled();expect(state.sent).toBe(0);
 await page.locator('#retry-human-check').click();await expect(page.locator('#human-check')).toHaveText('בדיקת אבטחה לדוגמה');await expect(page.locator('#account-email')).toHaveValue('owner@example.test');
 await page.evaluate(()=>window.widgetCallbacks.at(-1).callback('isolated-proof'));await page.locator('#send-login-code').click();await expect(page.locator('#account-code')).toBeVisible();expect(state.sent).toBe(1);
});

test('silent widget timeout and expired proof show recovery and cannot send mail',async({page})=>{
 const state=await protectedAccount(page);await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:provider}));
 await page.clock.install();await page.goto('/?dubbing=activate&test-profile=human-timeout');await page.locator('#buy-dubbing').click();await expect(page.locator('#human-check')).toHaveText('בדיקת אבטחה לדוגמה');
 await page.clock.fastForward(26000);await expect(page.locator('#retry-human-check')).toBeVisible();await expect(page.locator('#send-login-code')).toBeDisabled();expect(state.sent).toBe(0);
 await page.locator('#retry-human-check').click();await page.evaluate(()=>window.widgetCallbacks.at(-1).callback('isolated-proof'));await expect(page.locator('#send-login-code')).toBeEnabled();
 await page.evaluate(()=>window.widgetCallbacks.at(-1)['expired-callback']());await expect(page.locator('#human-check-status')).toContainText('פג');await expect(page.locator('#send-login-code')).toBeDisabled();
});

test('narrow phone form uses the compact provider widget',async({page})=>{
 await page.setViewportSize({width:320,height:667});await protectedAccount(page);await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:provider}));
 await page.goto('/?dubbing=activate&test-profile=human-mobile');await page.locator('#buy-dubbing').click();await expect(page.locator('#human-check')).toHaveText('בדיקת אבטחה לדוגמה');
 expect(await page.evaluate(()=>window.widgetCalls[0].size)).toBe('compact');expect(await page.evaluate(()=>document.getElementById('dialog').scrollWidth<=document.getElementById('dialog').clientWidth)).toBe(true);
});
