import {test,expect} from '@playwright/test';
import {seedRole,observeSpeech,expectSpeech} from './dubbing-helpers.mjs';

test('free creator play never requests payment or microphone; all paid choices require activation',async({page})=>{
 let checks=0;await page.route('**/api/dubbing/access',r=>{checks++;return r.fulfill({json:{unlocked:false}});});
 await page.addInitScript(()=>{window.micCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.micCalls++;throw Error('Not purchased');};});
 for(const choice of ['choose-quick','choose-voice','choose-all']){
  await page.goto('/?test-profile=paywall');await page.locator('#start').click();await page.locator(`#${choice}`).click();
  await expect(page.locator('#buy-dubbing')).toHaveAttribute('href','https://liorma.gumroad.com/l/zoobluff-dubbing');await expect(page.locator('#dialog')).toContainText('9.90 ₪');await expect(page.locator('#record-take')).toHaveCount(0);
 }
 expect(checks).toBe(3);expect(await page.evaluate(()=>window.micCalls)).toBe(0);
 await page.locator('#purchase-free').click();await page.locator('#skip-intro').click();await expect(page.locator('#overlay')).toBeHidden();expect(checks).toBe(3);
});
test('invalid activation stays locked; a verified purchase unlocks repeat dubbing and survives reload',async({page})=>{
 let unlocked=false;await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked}}));
 await page.route('**/api/dubbing/activate',r=>{unlocked=r.request().postDataJSON().licenseKey==='PURCHASE-FIXTURE';return r.fulfill({status:unlocked?200:403,json:{unlocked,error:'קוד לא תקין'}});});
 await page.goto('/?test-profile=activation&dubbing=activate');await page.locator('#license-key').fill('WRONG');await page.locator('#activate-license').click();await expect(page.locator('#purchase-status')).toContainText('קוד לא תקין');await expect(page.locator('#record-take')).toHaveCount(0);
 await page.locator('#license-key').fill('PURCHASE-FIXTURE');await page.locator('#activate-license').click();await page.locator('#choose-quick').click();await expect(page.locator('#record-take')).toBeVisible();
 await page.reload();await page.locator('#choose-quick').click();await expect(page.locator('#record-take')).toBeVisible();await expect(page.locator('#buy-dubbing')).toHaveCount(0);
});
test('network failure offers retry and free play without erasing a saved take',async({page})=>{
 await page.goto('/?test-profile=network');await seedRole(page,{profile:'network',characterId:'badger'});await page.route('**/api/dubbing/access',r=>r.abort());
 await page.locator('#start').click();await page.locator('#choose-all').click();await expect(page.locator('#purchase-status')).toContainText('ההקלטות השמורות');await page.locator('#purchase-free').click();await expect(page.locator('#begin-case')).toBeVisible();
 expect(await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js');const s=new VoiceStore({name:'neighborhood-voices-test-network'});await s.ready;const count=s.count('badger','fire');s.db.close();return count;})).toBe(5);
});
test('all cast requires every complete role including narrator, reuses recordings and plays personal speakers',async({page})=>{
 test.setTimeout(90000);await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));await observeSpeech(page);
 await page.goto('/?test-profile=all-cast');await page.locator('#start').click();await page.locator('#choose-all').click();await expect(page.locator('[data-all-voice]')).toHaveCount(8);await expect(page.locator('#use-all')).toBeDisabled();
 await page.locator('[data-all-voice="guide"]').click();await expect(page.locator('#spoiler-ack')).toBeVisible();await page.locator('#spoiler-ack').check();await page.locator('#full-record').click();await expect(page.locator('#dialog-title')).toContainText('קריין');await page.locator('#exit-draft').click();await expect(page.locator('#use-all')).toBeDisabled();
 for(const characterId of ['goat','pigeon','snake','cat','boar','turtle','badger','guide'])await seedRole(page,{profile:'all-cast',characterId,omit:characterId==='cat'?['cat.greet']:[]});
 await page.reload();await page.locator('#start').click();await page.locator('#choose-all').click();await expect(page.locator('#use-all')).toBeDisabled();await expect(page.locator('.all-cast-total')).toContainText('87 מתוך 88');
 await seedRole(page,{profile:'all-cast',characterId:'cat'});await page.reload();await page.locator('#start').click();await page.locator('#choose-all').click();await expect(page.locator('#use-all')).toBeEnabled();await page.locator('#use-all').click();await page.locator('#begin-case').click();await expectSpeech(page,'guide.role');
 const casting=await page.evaluate(()=>JSON.parse(localStorage.getItem('neighborhood-test-all-cast')).caseCasting);expect(casting.characterIds).toHaveLength(8);expect(casting.requirements).toHaveLength(88);
 await page.locator('#skip-tutorial').click();await expect(page.locator('#tutorial-coach')).toBeHidden();await page.locator('#notebook').click();await page.locator('[data-note="people"]').click();await page.locator('[data-talk="goat"]').click();await expectSpeech(page,'goat.greet');await page.locator('#leave-person').click();
 await page.locator('#cases').click();await page.locator('[data-case="1"]').click();await expect(page.locator('#creator-start')).toBeVisible();await page.locator('#choose-all').click();await expect(page.locator('.all-cast-total')).not.toContainText('0 מתוך');await expect(page.locator('#use-all')).toBeDisabled();
});
test('mobile Hebrew checkout has no horizontal overflow and leaves a free exit',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:false}}));await page.goto('/?dubbing=activate&test-profile=mobile-purchase');await expect(page.locator('#buy-dubbing')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#purchase-free').scrollIntoViewIfNeeded();await expect(page.locator('#purchase-free')).toBeVisible();await page.screenshot({path:'.cache/purchase-mobile.png',fullPage:true});
});
