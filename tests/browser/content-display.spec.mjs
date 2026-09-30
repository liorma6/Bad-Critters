import {test,expect} from '@playwright/test';
import {CASES,LOCATIONS,RESIDENTS} from '../../src/content.js';

const invalidText=/\b(?:undefined|null|NaN)\b|\[object Object\]/;
async function cleanScreen(page){
 await expect(page.locator('body')).not.toContainText(invalidText);
 const labels=await page.locator('[aria-label],img[alt]').evaluateAll(nodes=>nodes.map(n=>(n.getAttribute('aria-label')||'')+' '+(n.getAttribute('alt')||'')).join('\n'));
 expect(labels).not.toMatch(invalidText);
}
async function startCase(page,index){
 await page.goto('/?test-profile=content-display-'+index);await page.locator('#choose-start').click();await cleanScreen(page);
 await page.locator(`[data-case="${index}"]`).click();await cleanScreen(page);await page.locator('#creator-start').click();await cleanScreen(page);
 await page.locator(index===0?'#skip-intro':'#begin-case').click();await page.locator('.accessible-map summary').click();
}
async function journal(page){
 await page.locator('#notebook').click();
 for(const section of ['case','evidence','people','timeline','accusation']){await page.locator(`[data-note="${section}"]`).click();await cleanScreen(page);}
 await page.locator('#notebook-close').click();
}
async function supporting(page){
 if(!await page.locator('#meet-support').count())return;
 await page.locator('#meet-support').click();await cleanScreen(page);
 const events=await page.locator('[data-support-event]').evaluateAll(nodes=>nodes.map(n=>n.dataset.supportEvent));
 for(const event of events){await page.locator(`[data-support-event="${event}"]`).click();await cleanScreen(page);}
 await page.locator('#support-back').click();
}
for(const [index,c] of CASES.entries())test(`${c.id}: all location, resident and notebook screens show complete text before and after the incident`,async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await startCase(page,index);
 for(const after of [false,true]){
  if(after){await page.locator('#next-action').click();await expect(page.locator('#guide-action')).toHaveText('לבדוק מה קרה',{timeout:22000});await cleanScreen(page);await page.locator('#guide-action').click();}
  for(const place of LOCATIONS){
   await page.locator(`[data-location="${place.id}"]`).click();await expect(page.locator('#dialog-title')).toHaveText(place.name);await cleanScreen(page);
   if(!after)await expect(page.locator('#dialog')).toContainText(place.id===c.preLocation?c.preFact:place.description);
   if(index===0&&!after&&['center','bakery'].includes(place.id))await page.screenshot({path:`test-results/location-${place.id}-fixed.png`});
   if(await page.locator('#meet-support').count())await supporting(page);else await page.locator('#back-world').click();
  }
  for(const resident of RESIDENTS){
   await page.locator(`[data-resident="${resident.id}"]`).click();await cleanScreen(page);
   const questions=await page.locator('[data-question]').evaluateAll(nodes=>nodes.map(n=>n.dataset.question));
   for(const question of questions){await page.locator(`[data-question="${question}"]`).click();await cleanScreen(page);}
   await page.locator('.optional-talk summary').click();
   for(const flavor of ['complaint','boast','question','encounter']){if(!await page.locator(`[data-flavor="${flavor}"]`).isVisible())await page.locator('.optional-talk summary').click();await page.locator(`[data-flavor="${flavor}"]`).click();await cleanScreen(page);}
   await page.locator('#physical').click();await cleanScreen(page);await page.locator('#leave-person').click();
  }
  await journal(page);await page.locator('#context-help').click();await cleanScreen(page);await page.locator('#help-back').click();
 }
 await page.locator('#accuse').click();await cleanScreen(page);await page.locator('[data-suspect="'+c.culprit+'"]').click();
 for(const group of c.proofGroups)await page.locator(`input[value="${group[0]}"]`).check();
 await page.locator('#review-accusation').click();await cleanScreen(page);await page.locator('#keep-looking').click();
 expect(errors).toEqual([]);
});

test('mobile: bakery and community center show readable Hebrew descriptions',async({page})=>{
 await page.setViewportSize({width:390,height:844});await startCase(page,0);
 for(const id of ['bakery','center']){const place=LOCATIONS.find(p=>p.id===id);await page.locator(`[data-location="${id}"]`).click();await expect(page.locator('#dialog')).toContainText(place.description);await cleanScreen(page);await page.screenshot({path:`test-results/location-${id}-mobile.png`});await page.locator('#back-world').click();}
});
