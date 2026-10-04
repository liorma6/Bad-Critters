import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function start(page){await page.goto('/?test-profile=touch-highlights');await page.locator('#start').click();await page.locator('#creator-start').click();await page.locator('#skip-intro').click();await page.locator('#pause').click();}
const style=locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,transform:s.transform,outline:s.outlineStyle};});
async function neutralQuestions(page){
 await expect(page.locator('#dialog')).toBeFocused();
 await expect.poll(()=>page.locator('.question-options>button').evaluateAll(nodes=>nodes.every(el=>{const s=getComputedStyle(el);return s.backgroundColor==='rgb(252, 243, 223)'&&s.transform==='none'&&s.outlineStyle==='none'&&!el.matches('[aria-pressed="true"],.selected,.active');}))).toBe(true);
}

test('touch conversation buttons never retain a suggested answer after a tap, rerender, or another character',async({page,isMobile},info)=>{
 test.skip(!isMobile,'Run the mobile projects in playwright.touch.config.mjs for touch input.');
 test.setTimeout(150000);
 await start(page);await page.locator('.accessible-map summary').tap();
 for(const id of ['goat','pigeon','goat']){
  await page.locator(`[data-resident="${id}"]`).tap();await neutralQuestions(page);
  await page.locator('[data-question="secret"]').tap();await neutralQuestions(page);
  await page.locator('.optional-talk summary').tap();await page.locator('[data-flavor="complaint"]').tap();await neutralQuestions(page);
  await page.locator('#physical').tap();await page.locator('#back-person').tap();await neutralQuestions(page);
  await page.screenshot({path:info.outputPath(`conversation-${id}.png`)});
  await page.locator('#leave-person').tap();
 }
 await page.locator('#pause').tap();await page.locator('#next-action').tap();await expect(page.locator('#guide-action')).toHaveText('לבדוק מה קרה',{timeout:22000});await page.locator('#guide-action').tap();await page.locator('#pause').tap();
 for(const id of ['pigeon','goat']){
  await page.locator(`[data-resident="${id}"]`).tap();await neutralQuestions(page);
  for(const question of ['alibi','detail','secret']){await page.locator(`[data-question="${question}"]`).tap();await neutralQuestions(page);}
  await page.locator('#leave-person').tap();
 }
});

test('picker opens without choosing a target; keyboard traversal and Escape still work',async({page,isMobile},info)=>{
 let source=await readFile('src/residents.js','utf8');source=source.replace('spawn:[345,365]','spawn:[830,355]').replace('spawn:[641,390]','spawn:[830,355]');
 await page.route('**/src/residents.js',r=>r.fulfill({body:source,contentType:'text/javascript'}));await start(page);
 await page.locator('#world').scrollIntoViewIfNeeded();const b=await page.locator('#world').boundingBox(),x=b.x+830*b.width/1000,y=b.y+334*b.height/760;
 if(isMobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 await expect(page.locator('#target-picker')).toBeVisible();await page.screenshot({path:info.outputPath('picker-initial.png')});
 await expect(page.locator('#target-picker')).toBeFocused();
 await expect(page.locator('#target-picker button:focus')).toHaveCount(0);
 const buttons=page.locator('#target-picker button');
 await page.keyboard.press('Shift+Tab');await expect(buttons.last()).toBeFocused();
 await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();
 expect(await buttons.first().evaluate(el=>el.matches(':focus-visible'))).toBe(true);
 await page.keyboard.press('Tab');await expect(buttons.nth(1)).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#target-picker-layer')).toBeHidden();await expect(page.locator('#overlay')).toBeHidden();
});

test('mouse hover remains useful and keyboard focus remains visible in a conversation',async({page})=>{
 await start(page);await page.locator('.accessible-map summary').click();await page.locator('[data-resident="goat"]').click();
 const question=page.locator('[data-question="secret"]');await page.mouse.move(1,1);
 await expect.poll(async()=>(await style(question)).background).toBe('rgb(252, 243, 223)');
 await question.hover();await expect.poll(async()=>(await style(question)).background).toBe('rgb(240, 219, 173)');
 await page.mouse.move(1,1);await page.keyboard.press('Tab');await expect(page.locator('#close-dialog')).toBeFocused();
 await page.keyboard.press('Tab');await expect(question).toBeFocused();expect(await question.evaluate(el=>el.matches(':focus-visible'))).toBe(true);
});
