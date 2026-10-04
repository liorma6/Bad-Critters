import {LINE} from './content.js';
import {speech,mouthState,resetSpeech} from './speech-animation.js';
import {CASE_RECORDING_MANIFEST,dialogueLine,roleManifest,requiredLines} from './dialogue-manifest.js';
import {VoiceBufferCache} from './voice-buffer-cache.js';
export class AudioManager {
 constructor(onSubtitle){this.onSubtitle=onSubtitle;this.context=null;this.current=null;this.available=new Set();this.creatorFiles={};this.settings={sound:true,music:true,subtitles:true};this.timer=null;this.musicTime=0;this.generation=0;this.busy=false;this.personalCharacter=null;this.store=null;this.cooldowns=new Map();this.buffers=new VoiceBufferCache();this.warmGeneration=0;this.frozenCatalog=/\/releases\/[a-f0-9]{16}\//.test(globalThis.document?.baseURI||'');this.ready=this.refreshCreator();}
 refreshCreator(){
  if(this.refreshing)return this.refreshing;
  this.refreshedAt=Date.now();
  this.refreshing=fetch('assets/voices/available.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Audio manifest unavailable');return r.json();}).then(files=>{if(Array.isArray(files)){this.available=new Set(files);this.creatorFiles={};}else{this.creatorFiles=files;this.available=new Set(Object.keys(files));}}).catch(()=>{}).finally(()=>{this.refreshing=null;});
  return this.refreshing;
 }
 unlock(){try{if(!this.context||this.context.state==='closed')this.context=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});if(this.context.state!=='running')this.resuming=this.context.resume().catch(()=>{});}catch{} }
 tone(freq=440,duration=.15,volume=.04,type='sine'){if(!this.context||!this.settings.sound)return;const o=this.context.createOscillator(),g=this.context.createGain(),now=this.context.currentTime;o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.02);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(this.context.destination);o.start();o.stop(now+duration+.01);}
 bell(){[523,659,784].forEach((f,i)=>setTimeout(()=>this.tone(f,.9,.035),i*130));}
 incident(kind){if(!this.context||!this.settings.sound)return;const duration=kind==='courtyard'?.45:1.5,ctx=this.context,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='fire'?700:180;gain.gain.value=.14;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();this.tone(kind==='fire'?174:64,duration,.025,'triangle');}
 tick(dt){this.musicTime+=dt;if(this.musicTime>5&&this.settings.music&&this.settings.sound){this.musicTime=0;const notes=[196,246.94,293.66,329.63];this.tone(notes[Math.floor(Math.random()*notes.length)],2,.012);}}
 hasCreator(id){const entry=this.creatorFiles[id],line=LINE[id];return this.available.has(id)&&(!entry||entry.scriptVersion===line?.scriptVersion&&(!entry.fingerprint||entry.fingerprint===line.fingerprint)&&(!entry.performanceKey||entry.performanceKey===line.performanceKey));}
 configureCase(caseId,selection=null,{resume=false,phase='observe'}={}){
  const characterIds=[...new Set(Array.isArray(selection)?selection:selection?[selection]:[])];
  for(const id of characterIds)if(!roleManifest(caseId,id)?.eligible||(!resume&&!this.store?.coverage(caseId,id).complete))throw Error('Incomplete personal role');
  this.stop();if(this.caseId!==caseId)this.buffers.clear();this.warmGeneration++;this.caseId=caseId;this.personalCharacters=new Set(characterIds);this.personalCharacter=characterIds.length===1?characterIds[0]:null;this.repairNeeded=new Set();
  const characterId=this.personalCharacter;
  this.casting={caseId,characterId,characterIds,mode:characterIds.length?'personal':'creator',setId:characterId?`${caseId}:${characterId}`:null,requirements:characterIds.flatMap(id=>requiredLines(caseId,id).map(l=>({lineId:l.id,fingerprint:l.fingerprint}))),confirmedAt:new Date().toISOString()};
  this.prepareCase(phase);return this.casting;
 }
 async prepareLines(ids){
  if(!this.settings.sound||!this.context?.decodeAudioData)return;
  const version=this.warmGeneration;
  await Promise.all(ids.filter(Boolean).map(async id=>{
   const line=LINE[id];if(!line)return;const personal=this.isPersonal(line.resident);
   if(personal)await this.store?.ready;else await this.ready;
   if(version!==this.warmGeneration||!this.settings.sound)return;
   const source=personal?this.store?.get(line)?.blob:this.hasCreator(id)?this.creatorFiles[id]?.file||line.file:null;
   if(source)await this.buffers.load(source,this.context);
  }));
 }
 prepareCase(phase='observe'){const roles=Object.values(CASE_RECORDING_MANIFEST[this.caseId]?.characters||{}),guide=roleManifest(this.caseId,'guide');return this.prepareLines(phase==='observe'?[guide?.events.role,...roles.map(r=>r.events.intro),guide?.events.watch,guide?.events.observed]:[guide?.events.night,guide?.events.discovery,...roles.map(r=>r.events.aftermath||r.events.intro)]);}
 isPersonal(id){return this.personalCharacters?.has(id)||this.personalCharacter===id;}
 speak(event,characterId='guide',forceSubtitle=true){const line=this.say(dialogueLine(this.caseId,characterId,event).id,forceSubtitle);this.prepareLines(roleManifest(this.caseId,characterId)?.lineIds||[]);return line;}
 ambientEvent(event,characterId){return this.ambient(dialogueLine(this.caseId,characterId,event).id);}
 ambient(id){if(this.busy||Date.now()-(this.cooldowns.get(id)||0)<45000)return false;this.cooldowns.set(id,Date.now());this.say(id,false);return true;}
 say(id,forceSubtitle=false,options={}){
  const line=LINE[id];if(!line)return;
  if(this.caseId&&!options.preview&&!roleManifest(this.caseId,line.resident)?.lineIds.includes(id))throw Error('Dialogue is outside the current case manifest');
  this.stop();if(this.settings.sound||options.preview)this.unlock();const generation=this.generation;this.busy=true;this.line=line;
  this.finished=new Promise(resolve=>this.resolveFinished=resolve);
  const finish=(played=false)=>{if(generation!==this.generation)return;this.clearMedia();clearTimeout(this.timer);this.busy=false;this.onSubtitle(null);this.resolveFinished?.();this.resolveFinished=null;options.onEnded?.(played);};
  const textOnly=()=>{if(generation!==this.generation)return;this.clearMedia();this.onSubtitle(line);this.timer=setTimeout(finish,Math.max(4000,line.text.length*85));};
  if(this.settings.subtitles||forceSubtitle)this.onSubtitle(line);
  const announce=source=>{this.voiceSourceKind=source;globalThis.window?.dispatchEvent?.(new CustomEvent('neighborhood-speech',{detail:{lineId:line.id,characterId:line.resident,source}}));};
  const personalFailure=()=>{if(generation!==this.generation)return;this.repairNeeded??=new Set();this.repairNeeded.add(line.id);this.store?.markPlaybackFailure?.(line)?.catch(()=>{});this.onPersonalFailure?.(line);announce('personal-subtitles');textOnly();};
  const creator=()=>{if(generation!==this.generation)return;if(this.hasCreator(id)){announce('creator');this.playMedia(this.creatorFiles[id]?.file||line.file,line,generation,finish,textOnly);}else{announce('creator-subtitles');textOnly();}};
  const resolve=async()=>{
   if(!this.settings.sound&&!options.preview){if(this.settings.subtitles||forceSubtitle)textOnly();else finish();return;}
   const personal=!options.preview&&this.isPersonal(line.resident);
   // Local recordings never depend on the creator catalogue. Published catalogues
   // belong to an immutable release; editor refreshes run without delaying speech.
   if(personal)await this.store?.ready;else if(!options.preview){await this.ready;if(!this.frozenCatalog&&Date.now()-this.refreshedAt>2000)this.refreshCreator();}
   if(generation!==this.generation)return;
   const take=options.preview?options.take:personal?this.store?.get(line):null;
   if(take){this.clearMedia();this.objectURL=URL.createObjectURL(take.blob);announce(options.preview?'preview':'personal');this.playMedia(this.objectURL,line,generation,finish,personal?personalFailure:textOnly,take.blob,!!options.preview);}
   else if(personal)personalFailure();else creator();
  };resolve().catch(()=>{if(!options.preview&&this.isPersonal(line.resident))personalFailure();else textOnly();});return line;
 }
 playMedia(url,line,generation,finish,fallback,key=url,streamOnly=false){
  if(generation!==this.generation)return;
  const stream=()=>{if(generation!==this.generation)return;if(typeof key!=='string'&&!this.objectURL)url=this.objectURL=URL.createObjectURL(key);this.playElement(url,line,generation,finish,fallback);};
  if(streamOnly||!this.context?.decodeAudioData){stream();return;}
  const start=buffer=>{if(generation!==this.generation)return;if(!buffer||this.context?.state!=='running'){stream();return;}try{this.playBuffer(buffer,line,generation,finish);}catch{stream();}};
  const buffer=this.buffers.get(key);
  if(buffer&&this.context.state==='running'){start(buffer);return;}
  // Resume was requested inside the user's click, before any asynchronous work.
  let timer;const resumed=Promise.race([this.resuming||Promise.resolve(),new Promise(r=>timer=setTimeout(r,300))]).finally(()=>clearTimeout(timer));
  Promise.all([buffer||this.buffers.load(key,this.context,{priority:true}),resumed]).then(([value])=>start(value)).catch(stream);
 }
 playBuffer(buffer,line,generation,finish){
  this.clearMedia();const ctx=this.context,source=ctx.createBufferSource(),gain=ctx.createGain(),analyser=ctx.createAnalyser();
  source.buffer=buffer;gain.gain.value=.85;analyser.fftSize=512;source.connect(gain);gain.connect(analyser);analyser.connect(ctx.destination);
  this.bufferSource=source;this.voiceSource=source;this.voiceGain=gain;this.voiceAnalyser=analyser;this.samples=new Float32Array(analyser.fftSize);
  source.onended=()=>{if(this.bufferSource===source&&generation===this.generation)finish(true);};source.start();
  const measure=()=>{if(this.bufferSource!==source||generation!==this.generation)return;if(ctx.state==='running'){analyser.getFloatTimeDomainData(this.samples);const rms=Math.sqrt(this.samples.reduce((sum,v)=>sum+v*v,0)/this.samples.length);speech.resident=line.resident;speech.level=rms;speech.mouth=mouthState(rms);}else resetSpeech();this.animation=globalThis.requestAnimationFrame?.(measure);};measure();
 }
 playElement(url,line,generation,finish,fallback){
  if(generation!==this.generation)return;
  // Preserve the new object URL while releasing the preceding media graph.
  const objectURL=this.objectURL;this.objectURL=null;this.clearMedia();this.objectURL=objectURL;
  const media=this.current=new Audio(url);media.preload='auto';media.volume=.85;let failed=false;
  const fail=()=>{if(failed||generation!==this.generation||this.current!==media)return;failed=true;this.clearMedia();fallback();};
  media.addEventListener('ended',()=>{if(this.current===media)finish(true);},{once:true});media.addEventListener('error',fail,{once:true});
  const silence=()=>{if(this.current===media)resetSpeech();};
  const buffering=()=>{silence();clearTimeout(this.bufferTimer);this.bufferTimer=setTimeout(fail,15000);};
  media.addEventListener('waiting',buffering);media.addEventListener('stalled',buffering);media.addEventListener('pause',silence);buffering();
  media.addEventListener('playing',()=>{if(this.current===media){clearTimeout(this.bufferTimer);speech.resident=line.resident;}});
  try{
   this.unlock();if(this.context?.state==='running'){const source=this.context.createMediaElementSource(media),analyser=this.context.createAnalyser();analyser.fftSize=512;source.connect(analyser);analyser.connect(this.context.destination);this.voiceSource=source;this.voiceAnalyser=analyser;this.samples=new Float32Array(analyser.fftSize);}
  }catch{ /* Audio still plays if this browser cannot analyse it. */ }
  const measure=()=>{if(generation!==this.generation||this.current!==media)return;
   if(this.voiceAnalyser&&!media.paused&&!media.ended&&media.readyState>=3){this.voiceAnalyser.getFloatTimeDomainData(this.samples);const rms=Math.sqrt(this.samples.reduce((sum,v)=>sum+v*v,0)/this.samples.length);speech.resident=line.resident;speech.level=rms;speech.mouth=mouthState(rms);}else resetSpeech();
   this.animation=globalThis.requestAnimationFrame?.(measure);
  };measure();
  media.play().catch(fail);
 }
 clearMedia(){clearTimeout(this.bufferTimer);if(this.bufferSource){this.bufferSource.onended=null;try{this.bufferSource.stop();}catch{}this.bufferSource=null;}if(this.current){this.current.pause();this.current.removeAttribute?.('src');this.current.load?.();this.current=null;}this.voiceSource?.disconnect();this.voiceGain?.disconnect();this.voiceAnalyser?.disconnect();this.voiceSource=null;this.voiceGain=null;this.voiceAnalyser=null;globalThis.cancelAnimationFrame?.(this.animation);if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=null;resetSpeech();}
 stop(){this.generation++;this.clearMedia();clearTimeout(this.timer);this.busy=false;this.line=null;this.resolveFinished?.();this.resolveFinished=null;this.onSubtitle(null);}
}
