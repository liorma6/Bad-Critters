import {test,expect} from '@playwright/test';
import {startCreatorServer} from '../../tools/creator/server.mjs';
import {creatorCatalogue} from '../../tools/creator/catalogue.mjs';
import {readLibrary,sha256,publicMapping} from '../../tools/creator/storage.mjs';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CASES} from '../../src/content.js';
import {observeSpeech,expectSpeech,wav} from '../browser/dubbing-helpers.mjs';
let app,voiceRoot,failCommit=false,catalogue=creatorCatalogue();
const start=()=>startCreatorServer({port:4176,voiceRoot,catalogue:async()=>catalogue,beforeCommit:()=>{if(failCommit)throw Error('TEST ONLY disk failure');}});
test.beforeAll(async()=>{await mkdir('.cache',{recursive:true});voiceRoot=await mkdtemp(resolve('.cache/creator-browser-'));app=await start();});
test.afterAll(async()=>{await app.close();});
const speech=page=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech);
async function record(page){await page.locator('#record').click();await expect(page.locator('#stop')).toBeEnabled();await expect.poll(()=>page.locator('#input-level').evaluate(el=>el.value)).toBeGreaterThan(.05);await page.waitForTimeout(1000);await page.locator('#stop').click();await expect(page.locator('#listen')).toBeEnabled();await expect(page.locator('#microphone-diagnostics')).toContainText('Decoded signal: true');}
async function listen(page){await page.locator('#listen').click();await expect.poll(async()=>(await speech(page)).mouth,{intervals:[30,50]}).toBeGreaterThan(0);await expect(page.locator('#save-next')).toBeEnabled();}
test('SYNTHETIC creator pipeline: disk, source, game mouth, replacement, failed commit, reload and server restart',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('/creator/');await expect(page.locator('#total-count')).toContainText('0 מתוך 133');await expect(page.locator('[data-character]')).toHaveCount(9);
 await page.locator('[data-character="snake"]').click();await page.locator('[data-line="snake.greet"]').click();await expect(page.locator('#line-text')).toContainText('כן אמא, אכלתי');await record(page);await listen(page);
 // Unsaved candidate survives browser reload and contains the exact preview bytes.
 await page.reload();await expect(page.locator('#line-id')).toContainText('snake.greet');await expect(page.locator('#listen')).toBeEnabled();await listen(page);
 const previewHash=await page.evaluate(async()=>{const {drafts}=await import('/creator/drafts.js');const d=await drafts.get('snake.greet');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await d.blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');});
 await page.locator('#save-next').click();await expect(page.locator('#total-count')).toContainText('1 מתוך 133');await expect(page.locator('#record')).toBeEnabled();await expect(page.locator('#stop')).toBeDisabled();
 let state=await readLibrary(voiceRoot);const first=state.entries['snake.greet'];expect(first.sha256).toBe(previewHash);expect(first.file).toMatch(/\.wav$/);expect(first.sourceFile).toMatch(/\.webm$/);expect(first.processing.enhance).toBe(true);
 expect(sha256(await readFile(join(voiceRoot,first.file)))).toBe(previewHash);expect((await readFile(join(voiceRoot,first.sourceFile))).length).toBeGreaterThan(500);
 const resumedId=await page.locator('#line-id').textContent();await page.reload();await expect(page.locator('#line-id')).toHaveText(resumedId);
 await app.close();app=await start();await page.reload();await expect(page.locator('#total-count')).toContainText('1 מתוך 133');await expect(page.locator('#line-id')).toHaveText(resumedId);
 await page.locator('[data-line="snake.greet"]').click();await page.locator('#listen-saved').click();await expect.poll(async()=>(await speech(page)).level,{intervals:[30,50]}).toBeGreaterThan(.00001);await expect(page.locator('#record')).toBeEnabled();
 // Open the actual game conversation through the player's normal controls.
 const game=await context.newPage(),requested=[];game.on('request',r=>{if(r.url().includes('/voices/creator/'))requested.push(r.url());});await observeSpeech(game);await game.goto('/?test-profile=creator-synthetic');await game.locator('#start').click();await game.locator('#creator-start').click();await game.locator('#skip-intro').click();await game.locator('.accessible-map summary').click();await game.locator('[data-resident="snake"]').click();
 await expectSpeech(game,'snake.greet','creator');await expect.poll(async()=>(await speech(game)).mouth,{intervals:[30,50]}).toBeGreaterThan(0);await expect(game.locator('.speech')).toContainText('כן אמא, אכלתי');expect(requested.at(-1)).toContain(first.takeId);
 await expect.poll(async()=>(await speech(game)).resident).toBe(null);
 await page.bringToFront();await record(page);await listen(page);failCommit=true;await page.locator('#save-next').click();await expect(page.locator('#record-status')).toContainText('ניסיון נוסף');expect((await readLibrary(voiceRoot)).entries['snake.greet'].takeId).toBe(first.takeId);await expect(page.locator('#save-next')).toBeEnabled();
 failCommit=false;await page.locator('#save-next').click();await expect(page.locator('#record-status')).toContainText('נשמר בפרויקט');state=await readLibrary(voiceRoot);const second=state.entries['snake.greet'];expect(second.takeId).not.toBe(first.takeId);expect(state.history).toHaveLength(1);
 await game.bringToFront();await game.waitForTimeout(2100);await game.locator('#leave-person').click();await game.locator('[data-resident="snake"]').click();await expect.poll(()=>requested.at(-1)).toContain(second.takeId);await expect.poll(async()=>(await speech(game)).mouth,{intervals:[30,50]}).toBeGreaterThan(0);
 // Content changes invalidate the official mapping, while retaining the old take for review.
 catalogue=structuredClone(catalogue);const changed=catalogue.lines.find(l=>l.id==='snake.greet');changed.text+=' TEST VERSION';changed.scriptVersion++;changed.fingerprint='synthetic-revision-only';
 await page.bringToFront();await page.locator('#refresh').click();await page.locator('#filter').selectOption('stale');await expect(page.locator('#line-text')).toContainText('TEST VERSION');await expect(page.locator('#line-status')).toContainText('נדרשת הקלטה מחדש');expect(publicMapping(await readLibrary(voiceRoot),catalogue.lines)['snake.greet']).toBeUndefined();
 await page.screenshot({path:'test-results/creator-stale.png',fullPage:true});expect(errors).toEqual([]);
 catalogue=creatorCatalogue();await game.close();
 await writeFile('.cache/creator-isolated-storage.json',JSON.stringify({voiceRoot,officialRecordings:0,syntheticOnly:true,first:first.file,replacement:second.file},null,2));
});
test('long creator confession holds the actual reconstruction until audio has finished',async({page})=>{
 test.setTimeout(90000);const line=catalogue.lines.find(l=>l.id==='cat.fire.detail'),bytes=wav(12);
 await app.library.save({lineId:line.id,takeId:randomUUID(),expectedTakeId:null,scriptVersion:line.scriptVersion,fingerprint:line.fingerprint,performanceKey:line.performanceKey,validation:{duration:12,peak:.2,hasSignal:true}},{type:'audio/wav',bytes},{type:'audio/wav',bytes});
 await observeSpeech(page);await page.goto('/?test-profile=creator-long');await page.locator('#start').click();await page.locator('#creator-start').click();await page.locator('#skip-intro').click();await page.locator('.accessible-map summary').click();await page.locator('#guide-action').click();await expect(page.locator('#guide-action')).toHaveText('לבדוק מה קרה',{timeout:22000});await page.locator('#guide-action').click();
 for(const location of ['home','delivery','center','shed']){await page.locator(`[data-location="${location}"]`).click();await page.locator('#back-world').click();}await page.locator('[data-resident="goat"]').click();await page.locator('[data-question="alibi"]').click();await page.locator('#leave-person').click();
 await page.locator('#accuse').click();await page.locator('[data-suspect="cat"]').click();for(const id of CASES[0].proofGroups.map(g=>g[0]))await page.locator(`input[value="${id}"]`).check();await page.locator('#review-accusation').click();await page.locator('#submit-accusation').click();await expectSpeech(page,'cat.fire.detail','creator',25000);
 await expect.poll(async()=>(await speech(page)).mouth).toBeGreaterThan(0);await page.waitForTimeout(9000);await expect(page.locator('#next-case')).toBeHidden();await expect(page.locator('#next-case')).toBeVisible({timeout:8000});
});
test('source capture without enhancement, shared/case filters, narrator and restart token recovery',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/creator/');await page.locator('#filter').selectOption('all');await page.locator('[data-character="guide"]').click();await expect(page.locator('#character-title')).toHaveText('קריינות');await page.locator('#group').selectOption('fire');await page.locator('[data-line="guide.crime.fire"]').click();await page.locator('#enhance').uncheck();await record(page);await listen(page);
 await app.close();app=await start();await page.locator('#save-next').click();await expect(page.locator('#record-status')).toContainText('רעננו');await expect(page.locator('#listen')).toBeEnabled();await page.locator('#refresh').click();await page.locator('#save-next').click();await expect(page.locator('#record-status')).toContainText('נשמר בפרויקט');
 const entry=(await readLibrary(voiceRoot)).entries['guide.crime.fire'];expect(entry.processing.enhance).toBe(false);expect(entry.sha256).toBe(entry.sourceSha256);expect(entry.file).toMatch(/\.webm$/);
});
