import {test,expect} from '@playwright/test';
import {wav} from './dubbing-helpers.mjs';
test('SYNTHETIC every personal line drives its own speaker and mouth, then resets on stop',async({page})=>{
 test.setTimeout(120000);await page.goto('/?test-profile=every-mouth');await page.locator('#start').click();
 const result=await page.evaluate(async bytes=>{
  const {VoiceStore}=await import('/src/voice-store.js'),{VOICES}=await import('/src/content.js'),{CASE_RECORDING_MANIFEST}=await import('/src/dialogue-manifest.js'),{AudioManager}=await import('/src/audio.js'),{speech}=await import('/src/speech-animation.js'),{MOUTH_RIGS}=await import('/src/mouth-rigs.js');
  const store=new VoiceStore({name:'neighborhood-voices-test-every-mouth'});await store.ready;const blob=new Blob([new Uint8Array(bytes)],{type:'audio/wav'});
  for(const line of VOICES.filter(l=>l.personal))await store.put(line,{blob});
  const audio=new AudioManager(()=>{});audio.store=store;audio.unlock();await audio.ready;const heard=[],failures=[],seen=new Set();
  for(const c of Object.values(CASE_RECORDING_MANIFEST))for(const role of Object.values(c.characters).filter(r=>r.eligible)){
   audio.configureCase(c.caseId,role.characterId);
   for(const id of role.lineIds){
    if(seen.has(id))continue;seen.add(id);audio.say(id);
    const deadline=performance.now()+4000;
    while(performance.now()<deadline&&!(speech.resident===role.characterId&&speech.mouth>0))await new Promise(r=>setTimeout(r,20));
    if(speech.resident!==role.characterId||speech.mouth===0||!MOUTH_RIGS[role.characterId]||audio.voiceSourceKind!=='personal')failures.push(id);else heard.push(id);
    audio.stop();if(speech.resident!==null||speech.mouth!==0)failures.push(id+':reset');
   }
  }
  await audio.context.close();store.db.close();return {heard:heard.length,total:VOICES.filter(l=>l.personal).length,failures};
 },[...wav()]);expect(result.failures).toEqual([]);expect(result.heard).toBe(result.total);expect(result.total).toBe(126);
});
