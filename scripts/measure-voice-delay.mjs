import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const {directory,backup}=JSON.parse(await readFile('.cache/voice-onset-review.json','utf8'));
const library=JSON.parse(await readFile(join(backup,'.creator-studio/library.json'),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4175/?test-profile=voice-delay-diagnosis');await page.locator('#start').click();await page.locator('#creator-start').click();await page.locator('#skip-intro').click();await page.locator('#pause').click();await page.locator('.accessible-map summary').click();
 await page.evaluate(async()=>{
  const {AudioManager}=await import('/src/audio.js');window.timingRows=[];window.longTasks=[];new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  const say=AudioManager.prototype.say,refresh=AudioManager.prototype.refreshCreator,play=HTMLMediaElement.prototype.play,read=AnalyserNode.prototype.getFloatTimeDomainData;
  AudioManager.prototype.say=function(id,...args){const trace=window.currentTiming={lineId:id,clickAt:window.audioClickAt,sayAt:performance.now(),mode:window.timingMode};window.measuredAudio=this;window.timingRows.push(trace);return say.call(this,id,...args);};
  AudioManager.prototype.refreshCreator=function(...args){const trace=window.currentTiming;if(trace)trace.catalogueStart=performance.now();const result=refresh.apply(this,args);result.finally(()=>{if(trace)trace.catalogueEnd=performance.now();});return result;};
  HTMLMediaElement.prototype.play=function(...args){const trace=window.currentTiming;if(trace){trace.playCalledAt=performance.now();trace.src=this.src;trace.contextBaseLatency=window.measuredAudio?.context?.baseLatency;trace.contextOutputLatency=window.measuredAudio?.context?.outputLatency;this.addEventListener('playing',()=>{trace.playingAt=performance.now();trace.mediaPositionAtPlaying=this.currentTime;},{once:true});}return play.apply(this,args);};
  AnalyserNode.prototype.getFloatTimeDomainData=function(data){const result=read.call(this,data),trace=window.currentTiming;if(trace?.playingAt&&!trace.signalAt){const rms=Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);if(rms>10**(-55/20)){trace.signalAt=performance.now();trace.mediaPositionAtSignal=window.measuredAudio.current.currentTime;}}return result;};
  document.addEventListener('click',e=>{if(e.target.closest('[data-resident],[data-flavor]'))window.audioClickAt=performance.now();},true);
 });
 const rows=[],cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
 for(let round=0;round<3;round++)for(const character of ['goat','pigeon','snake'])for(const mode of ['refresh-required','recent-catalogue']){
  await page.evaluate(mode=>{window.timingMode=mode;if(window.measuredAudio)window.measuredAudio.refreshedAt=mode==='refresh-required'?0:Date.now();},mode);
  const profiling=round===0&&character==='snake'&&mode==='refresh-required';if(profiling)await cdp.send('Profiler.start');
  await page.locator(`[data-resident="${character}"]`).click();await page.waitForFunction(()=>window.currentTiming?.signalAt,{},{timeout:10000});
  if(profiling){const {profile}=await cdp.send('Profiler.stop');await writeFile(join(directory,'snake-delay.cpuprofile'),JSON.stringify(profile));}
  rows.push(await page.evaluate(round=>{const t=window.currentTiming;return {round,lineId:t.lineId,mode:t.mode,clickToSayMs:t.sayAt-t.clickAt,clickToPlayMs:t.playCalledAt-t.clickAt,playToPlayingMs:t.playingAt-t.playCalledAt,clickToSignalMs:t.signalAt-t.clickAt,catalogueMs:t.catalogueEnd?t.catalogueEnd-t.catalogueStart:0,filePositionAtSignal:t.mediaPositionAtSignal,contextBaseLatency:t.contextBaseLatency,contextOutputLatency:t.contextOutputLatency,resources:performance.getEntriesByType('resource').filter(r=>r.startTime>=t.clickAt&&r.name===t.src).map(r=>({requestMs:r.requestStart-r.startTime,responseMs:r.responseEnd-r.requestStart,durationMs:r.duration,bytes:r.transferSize})),longTasks:window.longTasks.filter(l=>l.start+l.duration>=t.clickAt&&l.start<t.signalAt)};},round));await page.locator('#leave-person').click();
 }
 const raw=[];
 for(const id of ['goat.greet','pigeon.greet','snake.greet','pigeon.watched','goat.arrival','snake.bell']){
  const entry=library.entries[id],bytes=await readFile(join(backup,entry.sourceFile));
  raw.push(await page.evaluate(async({id,base64})=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),context=new OfflineAudioContext(1,1,48000),audio=await context.decodeAudioData(bytes.buffer),data=audio.getChannelData(0),step=Math.round(audio.sampleRate*.01),frames=[];for(let i=0;i<data.length;i+=step){let sum=0,n=0;for(let j=i;j<Math.min(i+step,data.length);j++){sum+=data[j]*data[j];n++;}frames.push(Math.sqrt(sum/n));}const threshold=10**(-55/20),at=frames.findIndex((v,i)=>v>=threshold&&frames.slice(i,i+6).filter(v=>v>=threshold).length>=4);return {lineId:id,rawCaptureOnsetSeconds:at<0?null:at*.01,rawDuration:audio.duration};},{id,base64:bytes.toString('base64')}));
 }
 const result={base:'http://127.0.0.1:4175/',measuredAt:new Date().toISOString(),method:'Actual resident button clicks in Chrome, unchanged game AudioManager, output analyser at -55 dBFS. No hardware speaker timing measured.',rows,raw,errors};
 await writeFile(join(directory,'game-delay-measurements.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
