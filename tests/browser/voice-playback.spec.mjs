import {test,expect} from '@playwright/test';
import {seedRole} from './dubbing-helpers.mjs';
function wav(seconds=3){const rate=16000,n=rate*seconds,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++){const t=i/rate;b.writeInt16LE(t>1&&t<2?0:Math.round(Math.sin(t*2*Math.PI*180)*9000),44+i*2);}return b;}
const ids=['goat','pigeon','snake','cat','boar','turtle'];
for(const [index,id]of ids.entries())test(id+': complete current-case role is explicitly cast and heard early',async({page})=>{
 const profile='early-'+id,caseIndex=index%3,caseId=['fire','courtyard','balcony'][caseIndex];await page.goto('/?test-profile='+profile);await expect(page.locator('#start')).toBeVisible();await seedRole(page,{profile,caseId,characterId:id});
 await page.reload();await page.locator('#choose-start').click();await page.locator('[data-case="'+caseIndex+'"]').click();await page.locator('#choose-voice').click();await page.locator('[data-voice="'+id+'"]').click();await page.locator('#use-complete').click();await page.locator('#begin-case').click();
 if(caseIndex===0)await page.locator('#skip-tutorial').click();
 await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.resident),{intervals:[30,50]}).toBe(id);
 await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.mouth),{intervals:[30,50]}).toBeGreaterThan(0);
 await page.locator('#pause').click();expect(await page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.resident)).toBe(null);
});
test('personal stays personal; other characters use creator → subtitle fallback, real duration and voice-only mouth animation',async({page})=>{
 const fixture=wav();await page.route('**/test-creator.wav',route=>route.fulfill({contentType:'audio/wav',body:fixture}));await page.goto('/?test-profile=audio');await page.locator('#start').click();
 await page.evaluate(async bytes=>{const {AudioManager}=await import('/src/audio.js'),{LINE}=await import('/src/content.js');window.testAudio=new AudioManager(line=>window.testSubtitle=line);const a=window.testAudio;await a.ready;a.personalCharacter='goat';a.creatorFiles={'pigeon.greet':{file:'/test-creator.wav',scriptVersion:LINE['pigeon.greet'].scriptVersion}};a.available=new Set(['pigeon.greet']);a.store={ready:Promise.resolve(),get:line=>['goat.greet','pigeon.greet'].includes(line.id)?{blob:new Blob([new Uint8Array(bytes)],{type:'audio/wav'})}:null};a.say('goat.greet');},[...fixture]);
 await expect.poll(()=>page.evaluate(()=>window.testAudio.current?.src)).toMatch(/^blob:/);await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.mouth),{intervals:[50]}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.mouth),{intervals:[50]}).toBe(0);await expect.poll(()=>page.evaluate(()=>window.testAudio.busy)).toBe(false);
 await page.evaluate(()=>window.testAudio.say('pigeon.greet'));await expect.poll(()=>page.evaluate(()=>window.testAudio.current?.src)).toContain('/test-creator.wav');await page.evaluate(()=>window.testAudio.stop());expect(await page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.mouth)).toBe(0);
 await page.evaluate(()=>{window.testAudio.settings.subtitles=false;window.testAudio.say('cat.greet');});await expect.poll(()=>page.evaluate(()=>window.testSubtitle?.id)).toBe('cat.greet');expect(await page.evaluate(()=>window.testAudio.current)).toBe(null);
 await page.evaluate(()=>{window.testAudio.stop();window.testAudio.tone(180,.5,.1);});await page.waitForTimeout(200);expect(await page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.mouth)).toBe(0);
});
test('creator load error, incompatible take and overlap cooldown recover to subtitles',async({page})=>{
 await page.goto('/?test-profile=fallback');await page.evaluate(async()=>{const {AudioManager}=await import('/src/audio.js');window.testAudio=new AudioManager(l=>window.testSubtitle=l);await window.testAudio.ready;window.testAudio.available.add('goat.greet');window.testAudio.say('goat.greet');});await expect.poll(()=>page.evaluate(()=>window.testSubtitle?.id)).toBe('goat.greet');await expect.poll(()=>page.evaluate(()=>window.testAudio.current)).toBe(null);
 expect(await page.evaluate(()=>window.testAudio.ambient('pigeon.greet'))).toBe(false);await page.evaluate(()=>window.testAudio.stop());expect(await page.evaluate(()=>window.testAudio.ambient('pigeon.greet'))).toBe(true);await page.evaluate(()=>window.testAudio.stop());expect(await page.evaluate(()=>window.testAudio.ambient('pigeon.greet'))).toBe(false);
});
