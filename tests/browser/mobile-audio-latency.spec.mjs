import {test,expect} from '@playwright/test';
import {seedRole} from './dubbing-helpers.mjs';

async function instrument(page){
 await page.evaluate(async()=>{
  const {AudioManager}=await import('/src/audio.js'),configure=AudioManager.prototype.configureCase,say=AudioManager.prototype.say,read=AnalyserNode.prototype.getFloatTimeDomainData;
  window.audioTimings=[];
  AudioManager.prototype.configureCase=function(...args){window.measuredAudio=this;return configure.apply(this,args);};
  AudioManager.prototype.say=function(id,...args){window.audioTiming={id,clickAt:window.audioClickAt,sayAt:performance.now()};return say.call(this,id,...args);};
  AnalyserNode.prototype.getFloatTimeDomainData=function(samples){const result=read.call(this,samples),t=window.audioTiming;
   if(t&&!t.signalAt&&this===window.measuredAudio?.voiceAnalyser&&window.measuredAudio.line?.id===t.id&&samples.some(v=>Math.abs(v)>.003)){t.signalAt=performance.now();t.source=window.measuredAudio.voiceSourceKind;window.audioTimings.push({...t});}return result;
  };
  document.addEventListener('click',e=>{if(e.target.closest('[data-resident],[data-question]'))window.audioClickAt=performance.now();},true);
 });
}
async function start(page,{personal=false}={}){
 await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));
 await page.goto('/?test-profile=mobile-audio');await page.locator('#start').waitFor();
 const audioSupported=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
 test.skip(!audioSupported,'This Playwright WebKit build has no Web Audio; it cannot measure iOS audio latency. Run on a Web Audio capable host or a physical iPhone.');
 if(personal){await seedRole(page,{profile:'mobile-audio',characterId:'goat',omit:[]});await page.reload();await page.locator('#start').waitFor();}
 await instrument(page);await page.locator('#start').click();
 if(personal){await page.locator('#choose-voice').click();await page.locator('[data-voice="goat"]').click();await page.locator('#use-complete').click();}
 else await page.locator('#creator-start').click();
 await page.locator('#skip-intro').click();await page.locator('#pause').click();await page.locator('.accessible-map summary').click();
}
async function creatorReady(page,id){await expect.poll(()=>page.evaluate(id=>!!window.measuredAudio.buffers.get(window.measuredAudio.creatorFiles[id]?.file),id)).toBe(true);}
async function speakTo(page,id){
 await page.evaluate(()=>{window.measuredAudio.refreshedAt=0;window.audioTiming=null;});await page.locator(`[data-resident="${id}"]`).click();
 await expect.poll(()=>page.evaluate(()=>window.audioTiming?.signalAt)).toBeTruthy();
 const row=await page.evaluate(()=>window.audioTiming);expect(row.id).toBe(id+'.greet');expect(row.signalAt-row.clickAt).toBeLessThan(600);return row;
}

test('ready creator conversations start promptly despite a slow network; suspended mobile context resumes on the next click',async({page},info)=>{
 let manifests=0;await page.route('**/assets/voices/available.json',async r=>{if(++manifests>1)await new Promise(resolve=>setTimeout(resolve,1400));await r.continue();});
 await page.route('**/assets/voices/creator/*.wav',async r=>{await new Promise(resolve=>setTimeout(resolve,450));await r.continue();});
 await start(page);
 const rows=[];for(const id of ['goat','pigeon','snake']){await creatorReady(page,id+'.greet');rows.push(await speakTo(page,id));await page.locator('#leave-person').click();}
 await creatorReady(page,'goat.greet');await page.evaluate(()=>window.measuredAudio.context.suspend());rows.push(await speakTo(page,'goat'));expect(await page.evaluate(()=>window.measuredAudio.context.state)).toBe('running');
 await page.locator('#leave-person').click();expect(await page.evaluate(()=>({buffer:!!window.measuredAudio.bufferSource,media:!!window.measuredAudio.current}))).toEqual({buffer:false,media:false});
 expect(await page.evaluate(()=>window.measuredAudio.buffers.bytes)).toBeLessThanOrEqual(32*1024*1024);
 await info.attach('audio-onset.json',{body:JSON.stringify({engine:info.project.name,method:'Click to decoded voice analyser signal; no hardware speaker measurement',rows:rows.map(r=>({line:r.id,milliseconds:r.signalAt-r.clickAt,source:r.source}))},null,2),contentType:'application/json'});
});

test('personal voice warms locally, a replacement uses its new Blob, and a cancelled download never starts speaking later',async({page},info)=>{
 await start(page,{personal:true});
 await expect.poll(()=>page.evaluate(async()=>{const {LINE}=await import('/src/content.js'),a=window.measuredAudio;return !!a.buffers.get(a.store.get(LINE['goat.greet']).blob);})).toBe(true);
 const row=await speakTo(page,'goat');expect(row.source).toBe('personal');await page.locator('#leave-person').click();
 await seedRole(page,{profile:'mobile-audio',characterId:'goat',omit:[]});
 // The in-game store is refreshed through normal database loading; new Blob identity
 // prevents an old approved take's buffer from being used for its replacement.
 await page.evaluate(async()=>{window.measuredAudio.store.db.close();await window.measuredAudio.store.load();window.measuredAudio.prepareCase();});
 await expect.poll(()=>page.evaluate(async()=>{const {LINE}=await import('/src/content.js'),a=window.measuredAudio;return !!a.buffers.get(a.store.get(LINE['goat.greet']).blob);})).toBe(true);
 const replacement=await speakTo(page,'goat');expect(replacement.source).toBe('personal');await page.locator('#leave-person').click();
 await page.route('**/assets/voices/creator/pigeon.greet*.wav',async r=>{await new Promise(resolve=>setTimeout(resolve,900));await r.continue();});
 await page.evaluate(()=>window.measuredAudio.buffers.clear());await page.locator('[data-resident="pigeon"]').click();await page.locator('#leave-person').click();await page.waitForTimeout(1600);
 expect(await page.evaluate(async()=>{const {speech}=await import('/src/speech-animation.js');return {speaker:speech.resident,buffer:!!window.measuredAudio.bufferSource,media:!!window.measuredAudio.current,busy:window.measuredAudio.busy};})).toEqual({speaker:null,buffer:false,media:false,busy:false});
 await info.attach('personal-onset.json',{body:JSON.stringify({engine:info.project.name,milliseconds:[row.signalAt-row.clickAt,replacement.signalAt-replacement.clickAt]}),contentType:'application/json'});
});
