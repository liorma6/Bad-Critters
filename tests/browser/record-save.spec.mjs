import {test,expect} from '@playwright/test';
import {openRecord,seedRole,recordingControl} from './dubbing-helpers.mjs';

test.beforeEach(async({page})=>{await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));});

test('save and continue approves a prior draft without listening and survives reload',async({page})=>{
 await page.goto('/?test-profile=save-next');await seedRole(page,{profile:'save-next',characterId:'goat',draft:true});await openRecord(page,'goat','save-next');
 await expect(page.locator('#accept-take')).toHaveText('שמירה והמשך ←');await expect(page.locator('#accept-take')).toBeEnabled();
 await expect(page.locator('.record-settings')).not.toHaveAttribute('open');await expect(page.locator('.record-navigation')).not.toHaveAttribute('open');
 await page.locator('#accept-take').click();await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 2');await expect(page.locator('#record-status')).toContainText('הקודם נשמר במכשיר');
 await openRecord(page,'goat','save-next');await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 2');
 expect(await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js'),{LINE}=await import('/src/content.js');const s=new VoiceStore({name:'neighborhood-voices-test-save-next'});await s.ready;const result={approved:!!s.get(LINE['goat.greet']),bytes:s.get(LINE['goat.greet'])?.blob.size};s.db.close();return result;})).toMatchObject({approved:true,bytes:32044});
});

test('a failed IndexedDB commit never advances or claims saved, and the same take can be retried',async({page})=>{
 await page.goto('/?test-profile=save-failure');await seedRole(page,{profile:'save-failure',characterId:'goat',draft:true});await openRecord(page,'goat','save-failure');
 await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js');window.originalPersist=VoiceStore.prototype.persist;VoiceStore.prototype.persist=async function(record){return record.reviewed?false:window.originalPersist.call(this,record);};});
 await page.locator('#accept-take').click();await expect(page.locator('#record-status')).toContainText('לא עברנו למשפט הבא');await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 1');await expect(page.locator('#take-count')).toContainText('0 מתוך 13');await expect(page.locator('#listen-take')).toBeEnabled();
 await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js');VoiceStore.prototype.persist=window.originalPersist;});
 await page.locator('#accept-take').click();await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 2');await expect(page.locator('#take-count')).toContainText('1 מתוך 13');
});

test('real synthetic capture can stop preview early and save without listening to the end',async({page})=>{
 await openRecord(page,'goat','simple-capture');await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeVisible();await expect(page.locator('#record-take')).toBeHidden();await page.waitForTimeout(1700);await page.locator('#stop-take').click();await expect(page.locator('#accept-take')).toBeEnabled();
 await page.locator('#listen-take').click();await expect(page.locator('#listen-take')).toHaveText('■ עצירת ההאזנה');await page.locator('#listen-take').click();await expect(page.locator('#record-status')).toContainText('נעצרה');
 await page.locator('#accept-take').click();await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 2');await expect(page.locator('#take-count')).toContainText('1 מתוך 13');
 await (await recordingControl(page,'[data-line="0"]')).click();await expect(page.locator('#record-status')).toContainText('כבר שמור');await expect(page.locator('#listen-take')).toBeEnabled();
});

test('saving the final quick line completes the role and keeps a single obvious primary action',async({page})=>{
 await page.goto('/?test-profile=save-final');await seedRole(page,{profile:'save-final',characterId:'badger',draft:true});await page.reload();await page.locator('#start').click();await page.locator('#choose-quick').click();
 for(let i=0;i<5;i++){await expect(page.locator('.record-header .eyebrow')).toContainText(`משפט ${i+1}`);if(i===4)await expect(page.locator('#accept-take')).toHaveText('שמירה וסיום התפקיד ✓');await page.locator('#accept-take').click();}
 await expect(page.locator('#dialog-title')).toHaveText('התפקיד מוכן');await expect(page.locator('#use-complete')).toBeEnabled();
});

test('mobile recorder is concise and primary save stays reachable without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openRecord(page,'goat','simple-mobile');
 await expect(page.locator('#accept-take')).toBeVisible();expect(await page.locator('#dialog button:visible').count()).toBe(5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#dialog').screenshot({path:'.cache/recording-simple-mobile.png'});
});

test('legal links work before playing and information is readable without JavaScript',async({page,browser})=>{
 await page.goto('/?test-profile=legal');const popupPromise=page.waitForEvent('popup');await page.locator('#dialog a[href="/information/#accessibility"]').click();const popup=await popupPromise;await expect(popup.locator('#accessibility-title')).toBeVisible();await expect(popup.locator('body')).toContainText('טרם הושלמה בדיקת נגישות');await popup.close();
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),legal=await context.newPage();await legal.goto('http://127.0.0.1:4191/information/');await expect(legal.locator('h1')).toHaveText('מידע ושירות');await expect(legal.locator('#contact')).toContainText('ליאור משיח');await expect(legal.locator('#contact')).toContainText('206173072');await expect(legal.locator('#cancellation .button')).toHaveAttribute('href',/^mailto:liorma6@gmail.com/);expect(await legal.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});
