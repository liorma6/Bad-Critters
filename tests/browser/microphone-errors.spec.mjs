import {test,expect} from '@playwright/test';
import {openRecord as openFullRecord,acceptSpoilers} from './dubbing-helpers.mjs';
test.beforeEach(async({page})=>{await page.route('**/api/dubbing/access',r=>r.fulfill({json:{unlocked:true}}));});
const openRecord=page=>openFullRecord(page,'goat','mic-errors');
const diagnostic=page=>page.locator('#microphone-diagnostics');
for(const name of ['NotFoundError','NotReadableError','AbortError'])test(`acquisition ${name} is identified and can retry in place`,async({page})=>{
 await page.addInitScript(name=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=opts=>window.retryCapture?get(opts):Promise.reject(new DOMException('Test acquisition failure',name));},name);
 await openRecord(page);await page.locator('#record-take').click();await expect(diagnostic(page)).toContainText(`${name} at acquisition`);await expect(page.locator('#stop-take')).toBeDisabled();await expect(page.locator('#accept-take')).toBeDisabled();
 await page.evaluate(()=>window.retryCapture=true);await page.locator('#retry-take').click();await expect(page.locator('#stop-take')).toBeEnabled();
});
for(const [mode,expected] of [['silent','SilentOutputError'],['disconnected','RecordingError']])test(`SYNTHETIC ${mode} enhancement is rejected; capture never connects to speakers`,async({page})=>{
 await page.addInitScript(mode=>{
  const Context=window.AudioContext,connect=AudioNode.prototype.connect;window.captureSpeakerConnections=0;
  AudioNode.prototype.connect=function(target,...args){if(window.checkCapture&&target instanceof AudioDestinationNode)window.captureSpeakerConnections++;return connect.call(this,target,...args);};
  window.AudioContext=class extends Context{createMediaStreamDestination(){const destination=super.createMediaStreamDestination(),silence=this.createGain();silence.gain.value=0;const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...args){if(target===destination){if(mode==='silent'){connect.call(this,silence);connect.call(silence,destination);}return target;}return connect.call(this,target,...args);};return destination;}};
 },mode);
 await openRecord(page);await page.locator('#enhance-voice').check();await page.evaluate(()=>window.checkCapture=true);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await page.waitForTimeout(750);await page.locator('#stop-take').click();
 await expect(diagnostic(page)).toContainText(expected);await expect(page.locator('#listen-take')).toBeDisabled();await expect(page.locator('#accept-take')).toBeDisabled();expect(await page.evaluate(()=>window.captureSpeakerConnections)).toBe(0);
});
test('a late resume from a cancelled session cannot close the replacement session',async({page})=>{
 await page.addInitScript(()=>{
  const Context=window.AudioContext;window.AudioContext=class extends Context{async resume(){await super.resume();if(window.holdNextResume){window.holdNextResume=false;await new Promise(resolve=>window.releaseResume=resolve);}}};
 });
 await openRecord(page);await page.evaluate(()=>window.holdNextResume=true);await page.locator('#record-take').click();await expect.poll(()=>page.evaluate(()=>!!window.releaseResume)).toBe(true);
 await page.locator('#change-voice').click();await page.locator('[data-voice="goat"]').click();await acceptSpoilers(page);await page.locator('#record-take').click();await expect(page.locator('#stop-take')).toBeEnabled();await page.evaluate(()=>window.releaseResume());
 await expect(diagnostic(page)).toContainText('Track: live; enabled=true');await expect(diagnostic(page)).toContainText('AudioContext: running');await page.locator('#stop-take').click();await expect(page.locator('#listen-take')).toBeEnabled();
});
test('disabled tracks are reported accurately and rejected',async({page})=>{
 await page.addInitScript(()=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async opts=>{const stream=await get(opts);window.track=stream.getAudioTracks()[0];window.track.enabled=false;return stream;};});
 await openRecord(page);await page.locator('#record-take').click();await expect(diagnostic(page)).toContainText('TrackDisabledError');await expect(page.locator('#retry-take')).toBeEnabled();
});
test('microphone Permissions Policy denial is explicit and does not attempt acquisition',async({page})=>{
 await page.route('**/?test-profile=mic-errors',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'permissions-policy':'microphone=()'}});});
 await openRecord(page);await page.locator('#record-take').click();await expect(diagnostic(page)).toContainText('microphone policy: false');await expect(diagnostic(page)).toContainText('PermissionsPolicyError at environment');await expect(page.locator('#stop-take')).toBeDisabled();
});
test('never-returning browser acquisition times out with a retry action',async({page})=>{
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(()=>{});});
 await openRecord(page);await page.locator('#record-take').click();await expect(diagnostic(page)).toContainText('CaptureTimeoutError at acquisition',{timeout:23000});await expect(page.locator('#retry-take')).toBeEnabled();await expect(page.locator('#stop-take')).toBeDisabled();
});
