import {expect} from '@playwright/test';
export async function acceptSpoilers(page){
 await expect(page.locator('#edit-complete').or(page.locator('#spoiler-ack'))).toBeVisible();
 if(await page.locator('#edit-complete').isVisible())await page.locator('#edit-complete').click();
 await page.locator('#spoiler-ack').check();await page.locator('#full-record').click();
 await expect(page.locator('#record-take')).toBeVisible();
}
export async function openRecord(page,id='goat',profile='browser'){
 await page.goto(`/?test-profile=${profile}`);await page.locator('#start').click();await page.locator('#choose-voice').click();await page.locator(`[data-voice="${id}"]`).click();await acceptSpoilers(page);
}
export async function recordingControl(page,selector){
 const control=page.locator(selector);
 for(const details of await control.locator('xpath=ancestor::details').all())if(!await details.getAttribute('open')){if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();}
 return control;
}
export function wav(seconds=1){const rate=16000,n=Math.floor(rate*seconds),b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*220)*9000),44+i*2);return b;}
export async function seedRole(page,{caseId='fire',characterId='cat',profile='roles',omit=[],draft=false}={}){
 await page.evaluate(async({caseId,characterId,profile,omit,draft,bytes})=>{
  const {VoiceStore}=await import('/src/voice-store.js'),{requiredLines}=await import('/src/dialogue-manifest.js');const s=new VoiceStore({name:`neighborhood-voices-test-${profile}`});await s.ready;
  for(const line of requiredLines(caseId,characterId))if(!omit.includes(line.id))await s[draft?'putDraft':'put'](line,{blob:new Blob([new Uint8Array(bytes)],{type:'audio/wav'})},{caseId});s.db.close();
 },{caseId,characterId,profile,omit,draft,bytes:[...wav()]});
}
export async function observeSpeech(page){await page.addInitScript(()=>{window.speechEvents=[];window.mouthEvents=[];window.addEventListener('neighborhood-speech',e=>window.speechEvents.push(e.detail));import('/src/speech-animation.js').then(({speech})=>{setInterval(()=>{if(speech.mouth>0)window.mouthEvents.push({resident:speech.resident,mouth:speech.mouth});},40);});});}
export async function expectSpeech(page,lineId,source='personal',timeout=10000){await expect.poll(()=>page.evaluate(({lineId,source})=>window.speechEvents.some(e=>e.lineId===lineId&&e.source===source),{lineId,source}),{timeout}).toBe(true);}
