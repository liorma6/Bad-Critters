import {test,expect} from '@playwright/test';
import {openRecord as openFullRecord,acceptSpoilers} from './dubbing-helpers.mjs';
const openRecord=(page,profile='mic-synthetic')=>openFullRecord(page,'goat',profile);
const diagnostics=page=>page.locator('#microphone-diagnostics');
const inputPeak=page=>diagnostics(page).textContent().then(text=>Number(text.match(/peak RMS: ([\de+.-]+)/)[1]));
async function syntheticStream(page,amplitude=0){
 await page.addInitScript(amplitude=>{
  window.syntheticAmplitude=amplitude;
  navigator.mediaDevices.getUserMedia=async()=>{
   const context=new AudioContext();await context.resume();const oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
   oscillator.frequency.value=220;gain.gain.value=window.syntheticAmplitude;oscillator.connect(gain);gain.connect(destination);oscillator.start();
   window.syntheticContext=context;window.syntheticGain=gain;window.syntheticStream=destination.stream;
   return destination.stream;
  };
 },amplitude);
}

for(const [name,enhance,noise] of [['raw',false,false],['highpass and compressor',true,false],['browser noise processing',false,true],['all processing',true,true]]){
 test(`SYNTHETIC WAV capture: ${name}, decoded signal, audible playback, save, reload, gameplay`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.name));await openRecord(page);
  if(enhance)await page.locator('#enhance-voice').check();if(noise)await page.locator('#noise-reduction').check();
  await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();
  await expect.poll(()=>inputPeak(page)).toBeGreaterThan(.00001);
  await expect.poll(()=>page.locator('#input-level').evaluate(e=>e.value)).toBeGreaterThan(.05);
  await page.waitForTimeout(1000);await page.locator('#stop-take').click();await expect(page.locator('#listen-take')).toBeEnabled();
  await expect(diagnostics(page)).toContainText('Decoded signal: true');await expect(diagnostics(page)).toContainText('Track: ended');
  await page.locator('#listen-take').click();
  await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.level),{intervals:[30,50]}).toBeGreaterThan(.00001);
  await expect(page.locator('#accept-take')).toBeEnabled();await page.locator('#accept-take').click();await expect(page.locator('#take-count')).toContainText('1 מתוך');
  const result=await page.evaluate(async()=>{
   const {VoiceStore}=await import('/src/voice-store.js'),{LINE}=await import('/src/content.js');const store=new VoiceStore({name:'neighborhood-voices-test-mic-synthetic'});await store.ready;
   const take=store.get(LINE['goat.greet']),ctx=new AudioContext(),decoded=await ctx.decodeAudioData(await take.blob.arrayBuffer());
   const data=decoded.getChannelData(0);let a=0,b=0;
   for(let i=0;i<data.length;i++){a+=data[i]*Math.cos(2*Math.PI*220*i/decoded.sampleRate);b+=data[i]*Math.sin(2*Math.PI*220*i/decoded.sampleRate);}
   await ctx.close();store.db.close();return {validation:take.validation,processing:take.processing,knownTone:Math.hypot(a,b)/data.length,bytes:take.blob.size};
  });
  expect(result.validation.hasSignal).toBe(true);expect(result.validation.duration).toBeGreaterThan(.8);expect(result.bytes).toBeGreaterThan(500);expect(result.knownTone).toBeGreaterThan(.00001);expect(result.processing.enhance).toBe(enhance);
  if(!noise)for(const key of ['echoCancellation','noiseSuppression','autoGainControl'])expect(result.processing[key]).toBe(false);
  // Complete the remaining role with this known synthetic take, then verify the strict case casting path.
  await page.evaluate(async()=>{const {VoiceStore}=await import('/src/voice-store.js'),{requiredLines}=await import('/src/dialogue-manifest.js'),{LINE}=await import('/src/content.js');const s=new VoiceStore({name:'neighborhood-voices-test-mic-synthetic'});await s.ready;const take=s.get(LINE['goat.greet']);for(const line of requiredLines('fire','goat'))if(!s.get(line))await s.put(line,take,{caseId:'fire'});s.db.close();});
  await page.reload();await page.locator('#start').click();await page.locator('#choose-voice').click();await page.locator('[data-voice="goat"]').click();await page.locator('#use-complete').click();await page.locator('#skip-intro').click();
  await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.level),{intervals:[30,50]}).toBeGreaterThan(.00001);
  await openRecord(page);await page.locator('[data-line="0"]').click();await page.locator('#listen-take').click();await expect.poll(()=>page.evaluate(async()=>(await import('/src/speech-animation.js')).speech.level),{intervals:[30,50]}).toBeGreaterThan(.00001);expect(errors).toEqual([]);

 });
}
test('SYNTHETIC silence is reported and rejected; Retry accepts very quiet signal without reload',async({page})=>{
 await syntheticStream(page);await openRecord(page);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();
 await expect(page.locator('#record-status')).toContainText('לא זוהה קול');await page.locator('#stop-take').click();
 await expect(diagnostics(page)).toContainText('SilentInputError');await expect(page.locator('#listen-take')).toBeDisabled();await expect(page.locator('#accept-take')).toBeDisabled();await expect(page.locator('#take-count')).toContainText('0 מתוך');
 await page.evaluate(async()=>{await window.syntheticContext.close();window.syntheticAmplitude=.0001;});
 await page.locator('#retry-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await expect.poll(()=>inputPeak(page)).toBeGreaterThan(.00001);
 await page.waitForTimeout(650);await page.locator('#stop-take').click();await expect(page.locator('#listen-take')).toBeEnabled();await expect(diagnostics(page)).toContainText('Decoded signal: true');
});
test('a delayed permission response resumes audio before acquisition; transient hiding does not cancel it',async({page})=>{
 await page.addInitScript(()=>{
  const Context=window.AudioContext,get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.audioOrder=[];
  window.AudioContext=class extends Context{resume(){if(window.checkGestureOrder){window.audioOrder.push('resume');if(window.permissionRequested)return Promise.reject(new DOMException('Lost gesture','NotAllowedError'));}return super.resume();}};
  navigator.mediaDevices.getUserMedia=async opts=>{window.audioOrder.push('acquire');window.permissionRequested=true;const stream=await get(opts);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,300));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));return stream;};
 });
 await openRecord(page);await page.evaluate(()=>{window.checkGestureOrder=true;window.audioOrder=[];});await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();
 expect(await page.evaluate(()=>window.audioOrder.slice(0,2))).toEqual(['resume','acquire']);await expect.poll(()=>inputPeak(page)).toBeGreaterThan(.00001);
});
test('late capture from an abandoned screen stops only its own tracks',async({page})=>{
 await page.addInitScript(()=>{
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.captureCalls=0;
  navigator.mediaDevices.getUserMedia=async opts=>{const n=++window.captureCalls,stream=await get(opts);if(n===1){window.oldCapture=stream;await new Promise(r=>window.releaseOldCapture=r);}else window.newCapture=stream;return stream;};
 });
 await openRecord(page);await page.locator('#record-take').click();await expect.poll(()=>page.evaluate(()=>!!window.releaseOldCapture)).toBe(true);
 await page.locator('#change-voice').click();await page.locator('[data-voice="goat"]').click();await acceptSpoilers(page);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await page.evaluate(()=>window.releaseOldCapture());
 await expect.poll(()=>page.evaluate(()=>window.oldCapture.getTracks().every(t=>t.readyState==='ended'))).toBe(true);
 expect(await page.evaluate(()=>window.newCapture.getAudioTracks()[0].readyState)).toBe('live');await expect.poll(()=>inputPeak(page)).toBeGreaterThan(.00001);
});
test('input selection appears after permission, switches without reload, persists, and falls back if removed',async({page})=>{
 await page.addInitScript(()=>{
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.inputOptions=[];window.acquired=false;
  navigator.mediaDevices.enumerateDevices=async()=>window.acquired?['default','input-a','input-b'].map((deviceId,i)=>({deviceId,kind:'audioinput',label:`Synthetic input ${i}`})):[];
  navigator.mediaDevices.getUserMedia=async opts=>{window.inputOptions.push(opts);const stream=await get({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});window.acquired=true;window.selectedStream=stream;const track=stream.getAudioTracks()[0],settings=track.getSettings.bind(track);track.getSettings=()=>({...settings(),deviceId:opts.audio.deviceId?.ideal||'input-a'});return stream;};
 });
 await openRecord(page);await expect(page.locator('#microphone-input')).toBeHidden();await page.locator('#record-take').click();await expect(page.locator('#microphone-choice')).toBeVisible();
 await page.locator('#microphone-choice').selectOption('input-b');await expect(page.locator('#record-take')).toBeEnabled();expect(await page.evaluate(()=>window.selectedStream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);
 await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();expect(await page.evaluate(()=>window.inputOptions.at(-1).audio.deviceId.ideal)).toBe('input-b');
 await page.reload();await page.locator('#start').click();await page.locator('#choose-voice').click();await page.locator('[data-voice="goat"]').click();await acceptSpoilers(page);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();expect(await page.evaluate(()=>window.inputOptions[0].audio.deviceId.ideal)).toBe('input-b');
 await page.locator('#change-voice').click();await page.evaluate(()=>{navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audioinput',deviceId:'input-a',label:'Synthetic input A'}];});await page.locator('[data-voice="goat"]').click();await acceptSpoilers(page);await expect.poll(()=>page.evaluate(()=>localStorage.getItem('neighborhood-microphone-choice'))).toBe(null);
});
test('corrupt nonempty recording is rejected with the actual decode error and retry remains available',async({page})=>{
 await page.addInitScript(()=>{const Context=window.AudioContext;window.AudioContext=class extends Context{decodeAudioData(){return Promise.reject(new DOMException('Invalid encoding','EncodingError'));}};});
 await openRecord(page);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await page.waitForTimeout(600);await page.locator('#stop-take').click();
 await expect(diagnostics(page)).toContainText('DecodeError at decoding (EncodingError)');await expect(page.locator('#listen-take')).toBeDisabled();await expect(page.locator('#accept-take')).toBeDisabled();await expect(page.locator('#retry-take')).toBeEnabled();
});
test('suspended audio context is actionable; no false recording state and retry works',async({page})=>{
 await page.addInitScript(()=>{const Context=window.AudioContext;window.AudioContext=class extends Context{resume(){return window.blockAudio?Promise.reject(new DOMException('Blocked','NotAllowedError')):super.resume();}};});
 await openRecord(page);await page.evaluate(()=>window.blockAudio=true);await page.locator('#record-take').click();await expect(diagnostics(page)).toContainText('AudioContextError');await expect(page.locator('#stop-take')).toBeDisabled();
 await page.evaluate(()=>window.blockAudio=false);await page.locator('#retry-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await expect.poll(()=>inputPeak(page)).toBeGreaterThan(.00001);
});
