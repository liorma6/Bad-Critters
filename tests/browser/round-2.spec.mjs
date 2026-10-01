import {test,expect} from '@playwright/test';
import {seedRole,acceptSpoilers} from './dubbing-helpers.mjs';
import {recordingControl} from './dubbing-helpers.mjs';
test.beforeEach(async({page})=>{await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));});

test('changed personal line is visibly marked for rerecording without losing the other takes',async({page})=>{
 const profile='round2-stale';await page.goto('/?test-profile='+profile);
 await seedRole(page,{profile,characterId:'goat'});
 const index=await page.evaluate(async profile=>{
  const {VoiceStore}=await import('/src/voice-store.js'),{requiredLines}=await import('/src/dialogue-manifest.js');
  const s=new VoiceStore({name:'neighborhood-voices-test-'+profile});await s.ready;
  const lines=requiredLines('fire','goat'),line=lines.find(l=>l.id==='goat.secret');
  const old={...s.get(line),scriptVersion:line.scriptVersion-1,fingerprint:'previous-editorial-text'};
  await s.persist(old);s.db.close();return lines.indexOf(line);
 },profile);
 await page.reload();await page.locator('#start').click();await page.locator('#choose-voice').click();
 const card=page.locator('.voice-card').filter({has:page.locator('[data-voice="goat"]')});
 await expect(card).toContainText('12 הקלטות תואמות');await expect(card).toContainText('1 דורשים הקלטה מחדש');
 await page.locator('[data-voice="goat"]').click();await acceptSpoilers(page);await (await recordingControl(page,`[data-line="${index}"]`)).click();
 await expect(page.locator('#record-status')).toContainText('צריך להקליט את המשפט מחדש');
 await expect(page.locator(`[data-line="${index}"]`)).toHaveAttribute('aria-label',/נדרשת הקלטה מחדש/);
 await expect(page.locator('.record-line')).toContainText('יש לי רשימה');await expect(page.locator('#listen-take')).toBeDisabled();await expect(page.locator('#play-personal')).toBeDisabled();
 await page.screenshot({path:'docs/screenshots/round-2-rerecord.png'});
});

test('updated pouch sprite and complaint-list pose render with speaking and watched states',async({page})=>{
 await page.goto('/?test-profile=round2-art');
 await page.evaluate(async()=>{
  const {loadArt,artAssets}=await import('/src/art-assets.js'),{drawSupporting}=await import('/src/supporting-sprites.js'),{drawCharacter}=await import('/src/characters.js'),{RESIDENTS}=await import('/src/residents.js'),{speech}=await import('/src/speech-animation.js');
  await loadArt();document.body.innerHTML='<canvas id="round2-art" width="1000" height="780"></canvas>';
  const c=document.querySelector('canvas').getContext('2d');c.fillStyle='#f5ecd9';c.fillRect(0,0,1000,780);
  drawSupporting(c,'badger',20,15,290,435);
  const goat=RESIDENTS.find(r=>r.id==='goat');
  const rig={x:465,y:410,walk:0,gait:0,watch:0,facing:1,seed:0};
  drawCharacter(c,{...goat,action:'check-list'},rig,7,3.3,false);
  drawCharacter(c,{...goat,action:'pretend',watched:true},{...rig,x:740},7,3.3,false);
  c.fillStyle='#244d47';c.textAlign='center';c.font='18px Arial';
  c.fillText('עמוס — פאוץ׳ מטבעות וקבלות',170,475);c.fillText('ירחמיאל — פנקס תלונות',465,475);c.fillText('תחת העדשה — הפנקס מוסתר',790,475);
  for(let mouth=0;mouth<4;mouth++){
   c.save();c.beginPath();c.rect(mouth*250,505,250,250);c.clip();
   speech.resident='badger';speech.mouth=mouth;
   drawSupporting(c,'badger',mouth*250-725+125,540-338,1024,1536);c.restore();
  }
  speech.resident=null;speech.mouth=0;
  window.round2Art={width:artAssets['badger-alive'].naturalWidth,height:artAssets['badger-alive'].naturalHeight};
 });
 expect(await page.evaluate(()=>window.round2Art)).toEqual({width:1024,height:1536});
 await page.locator('#round2-art').screenshot({path:'docs/screenshots/round-2-portraits.png'});
});
