import {test,expect} from '@playwright/test';
import {openRecord,seedRole,recordingControl} from './dubbing-helpers.mjs';
const stage=(p,s)=>expect(p.locator('#tutorial-coach')).toHaveAttribute('data-step',s);
const snap=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('neighborhood-test-launch-resume:active')));

test('keyboard tutorial and real resume preserve clock, evidence, notes, consumed actions and radio accusation',async({page})=>{
 test.setTimeout(80000);
 await page.goto('/?test-profile=launch-resume');await page.locator('#start').click();await page.locator('#creator-start').click();await page.locator('#begin-case').click();
 await page.locator('#lens').press('Enter');await stage(page,'place-lens');await page.locator('#world').press('Enter');await stage(page,'watch');
 await page.reload();await page.locator('#continue-investigation').click();await stage(page,'notebook-before');
 await page.locator('#notebook').press('Enter');await stage(page,'notebook-entry');await page.locator('#entry-watch-goat summary').press('Enter');await stage(page,'notebook-return');await page.locator('#notebook-close').press('Enter');await stage(page,'prefact');
 await page.reload();await page.locator('#continue-investigation').click();await stage(page,'prefact');await expect(page.locator('#next-action')).toHaveText('לבדוק את ההודעה בכניסה');await page.locator('#world').press('Enter');await stage(page,'prefact-return');await expect(page.locator('#preliminary-notice')).toContainText('מחר ביקורת');
 await page.reload();await page.locator('#continue-investigation').click();await stage(page,'prefact-return');await expect(page.locator('#preliminary-notice')).toBeInViewport();expect((await snap(page)).state.preliminary).toHaveLength(1);await page.locator('#back-world').press('Enter');await expect(page.locator('#tutorial-coach')).toBeHidden();await expect(page.locator('#next-action')).toHaveText('סיום התצפית · מעבר ללילה');
 await page.locator('#next-action').press('Enter');await expect(page.locator('#phase')).toHaveText('הלילה יורד');
 await page.reload();const night=await snap(page);expect(night.state.crimeDone).toBe(false);await page.locator('#continue-investigation').click();
 await expect(page.locator('#guide-action')).toHaveText('לבדוק מה קרה',{timeout:22000});await expect(page.locator('#tutorial-coach')).toBeHidden();await page.locator('#guide-action').press('Enter');await stage(page,'trace');
 await page.locator('#guide-action').press('Enter');await stage(page,'trace-return');await page.locator('#back-world').press('Enter');await stage(page,'witness');
 await page.locator('#world').press('Enter');await stage(page,'ask-witness');await page.locator('[data-question="alibi"]').press('Enter');await page.locator('#leave-person').press('Enter');await expect(page.locator('#tutorial-coach')).toBeHidden();
 await page.locator('#bell').click();await page.locator('#notebook').click();await page.locator('.personal-notes summary').click();await page.locator('#notes').fill('הערת QA בעברית — נשמרת לפני סגירת הדף');
 await expect.poll(async()=>(await snap(page))?.state.notes).toContain('הערת QA');const before=await snap(page);await page.reload();await page.locator('#continue-investigation').click();
 const after=await snap(page);expect(after.state.notes).toBe(before.state.notes);expect(after.state.clues).toEqual(before.state.clues);expect(after.state.bell).toBe(before.state.bell);expect(after.state.time-before.state.time).toBeLessThan(2);expect(after.state.events.filter(e=>e.kind==='crime')).toHaveLength(1);
 await page.locator('#notebook').click();await page.locator('.personal-notes summary').click();await expect(page.locator('#notes')).toHaveValue(before.state.notes);await page.locator('#notebook-close').click();
 await page.locator('.accessible-map summary').click();for(const location of ['delivery','center','shed']){await page.locator(`[data-location="${location}"]`).click();await page.locator('#back-world').click();}
 await page.locator('#accuse').click();await expect(page.getByRole('radio')).toHaveCount(6);await page.locator('[data-suspect="goat"]').check();await page.locator('[data-suspect="goat"]').press('ArrowDown');
 await expect(page.locator('[data-suspect="pigeon"]')).toBeChecked();await page.locator('.clue-card input').first().check();await page.reload();await page.locator('#continue-investigation').click();
 await expect(page.locator('[data-suspect="pigeon"]')).toBeChecked();await expect(page.locator('.clue-card input:checked')).toHaveCount(1);await page.screenshot({path:'reports/launch-2026-10-04/resumed-accusation.png'});
});

test('replacement draft cancels without changing approved audio; genuine IndexedDB abort preserves it across reload',async({page})=>{
 await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));
 await page.goto('/?test-profile=launch-draft');await seedRole(page,{profile:'launch-draft',characterId:'goat',omit:[]});await openRecord(page,'goat','launch-draft');
 const stored=()=>page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js'),{LINE}=await import('/src/content.js');const s=new VoiceStore({name:'neighborhood-voices-test-launch-draft'});await s.ready;const row=s.get(LINE['goat.greet']);const result={bytes:row?.blob.size,acceptedAt:row?.acceptedAt,draft:s.hasDraft(LINE['goat.greet'])};s.db.close();return result;});
 const original=await stored();const capture=async()=>{await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await page.waitForTimeout(750);await page.locator('#stop-take').click();await expect(page.locator('#discard-draft')).toBeVisible();};
 await capture();expect(await stored()).toMatchObject({...original,draft:true});await page.locator('#discard-draft').click();expect(await stored()).toEqual(original);
 await capture();await openRecord(page,'goat','launch-draft');await expect(page.locator('#discard-draft')).toBeVisible();expect(await stored()).toMatchObject({...original,draft:true});
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const r=put.apply(this,args);if(this.name==='takes')this.transaction.abort();return r;};});
 await page.locator('#accept-take').click();await expect(page.locator('#record-status')).toContainText('לא עברנו');expect(await stored()).toMatchObject({...original,draft:true});
 await openRecord(page,'goat','launch-draft');expect(await stored()).toMatchObject({...original,draft:true});await page.locator('#accept-take').click();await expect(page.locator('.record-header .eyebrow')).toContainText('משפט 2');expect((await stored()).acceptedAt).not.toBe(original.acceptedAt);expect((await stored()).draft).toBe(false);
 await (await recordingControl(page,'[data-line="0"]')).click();await page.evaluate(()=>{const del=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(...args){const r=del.apply(this,args);if(this.name==='takes')this.transaction.abort();return r;};});
 await (await recordingControl(page,'#delete-take')).click();await expect(page.locator('#record-status')).toContainText('המחיקה לא הצליחה');await expect(page.locator('#listen-take')).toBeEnabled();const kept=await stored();
 await openRecord(page,'goat','launch-draft');expect(await stored()).toEqual(kept);await (await recordingControl(page,'#delete-take')).click();await expect(page.locator('#listen-take')).toBeDisabled();expect((await stored()).bytes).toBeUndefined();await expect(page.locator('#take-count')).toContainText('12 מתוך 13');
});

test('real recorder duration limit finishes playable audio and releases microphone, nodes and buffers',async({page})=>{
 await page.goto('/?test-profile=launch-limit');
 await page.evaluate(async()=>{const {QuickRecorder}=await import('/src/recorder.js');window.limitResult=null;window.limitRecorder=new QuickRecorder({onLimit:async()=>{window.limitResult=await window.limitRecorder.stop();}});await window.limitRecorder.start({maxSeconds:1});});
 await expect.poll(()=>page.evaluate(()=>window.limitResult?.validation.hasSignal)).toBe(true);
 expect(await page.evaluate(()=>{const s=window.limitRecorder.session;return {tracks:s.stream.getTracks().every(t=>t.readyState==='ended'),closed:s.context.state==='closed',chunks:s.chunks.length,nodes:s.nodes.length,duration:window.limitResult.duration};})).toMatchObject({tracks:true,closed:true,chunks:0,nodes:0});
 expect(await page.evaluate(()=>window.limitResult.duration)).toBeLessThan(3);
});

test('atmosphere subtitles honor preference; essential dialogue and missing personal audio retain text',async({page})=>{
 await page.route('**/assets/voices/available.json',r=>r.fulfill({json:{}}));await page.goto('/?test-profile=launch-subtitles');
 await page.evaluate(async()=>{const {AudioManager}=await import('/src/audio.js');window.qaSubtitle=null;window.qaAudio=new AudioManager(l=>window.qaSubtitle=l);await window.qaAudio.ready;window.qaAudio.settings={sound:false,music:false,subtitles:false};window.qaAudio.ambient('goat.bell');});
 await expect.poll(()=>page.evaluate(()=>window.qaAudio.busy)).toBe(false);expect(await page.evaluate(()=>window.qaSubtitle)).toBe(null);
 await page.evaluate(()=>window.qaAudio.say('goat.greet',true));await expect.poll(()=>page.evaluate(()=>window.qaSubtitle?.id)).toBe('goat.greet');
 await page.evaluate(()=>{window.qaAudio.stop();window.qaAudio.settings.sound=true;window.qaAudio.say('pigeon.greet',false);});await expect.poll(()=>page.evaluate(()=>window.qaSubtitle?.id)).toBe('pigeon.greet');
 await page.evaluate(()=>{window.qaAudio.personalCharacter='goat';window.qaAudio.store={ready:Promise.resolve(),get:()=>null};window.qaAudio.say('goat.greet',true);});await expect.poll(()=>page.evaluate(()=>window.qaAudio.voiceSourceKind)).toBe('personal-subtitles');expect(await page.evaluate(()=>window.qaSubtitle?.id)).toBe('goat.greet');
});
