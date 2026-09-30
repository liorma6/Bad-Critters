// Opt-in local hardware probe: NO fake media flags, upload, or playback. Any auto-draft is confined to a disposable browser context.
// Run only when microphone testing is authorized. An energy result is not proof
// that a particular person spoke or that their intended physical input was used.
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const url=process.argv[2]||'http://127.0.0.1:4174/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({permissions:['microphone']}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.name));
 const probeURL=new URL(url);probeURL.searchParams.set('test-profile','mic-physical-probe');await page.goto(probeURL.href);await page.locator('#start').click();await page.locator('#choose-voice').click();await page.locator('[data-voice="goat"]').click();if(await page.locator('#edit-complete').isVisible())await page.locator('#edit-complete').click();await page.locator('#spoiler-ack').check();await page.locator('#full-record').click();await page.locator('#record-take').click();
 await page.waitForFunction(()=>!document.getElementById('stop-take').disabled||document.getElementById('microphone-diagnostics').textContent.includes('Capture: error'),{},{timeout:26000});
 const recording=await page.locator('#stop-take').isEnabled();let live=null;
 if(recording){await page.waitForTimeout(4000);live=await page.locator('#microphone-diagnostics').textContent();if(await page.locator('#stop-take').isEnabled())await page.locator('#stop-take').click();await page.waitForFunction(()=>!document.getElementById('record-take').disabled,{},{timeout:15000});}
 const report={date:new Date().toISOString(),browser:'installed Chrome, headless, real getUserMedia (no fake media flags)',live,final:await page.locator('#microphone-diagnostics').textContent(),usableTake:await page.locator('#listen-take').isEnabled(),errors,limitations:'No person was prompted to speak; no listening test or physical-device identity verification. A temporary draft may be created inside this isolated, disposable browser context; none survives closing it.'};
 await page.locator('#change-voice').click();await writeFile('docs/microphone-physical-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
