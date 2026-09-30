export const RECORDING_TYPES=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm'];
export function recordingType(Recorder=globalThis.MediaRecorder){return RECORDING_TYPES.find(type=>Recorder?.isTypeSupported?.(type))||'';}
export function microphoneMessage(error){
 return ({
  NotAllowedError:'הגישה למיקרופון נדחתה בדפדפן הזה. אפשר לשנות את הרשאת האתר וללחוץ ניסיון נוסף.',
  NotFoundError:'הדפדפן לא מצא כניסת מיקרופון. אפשר לבחור כניסה אחרת או לנסות שוב.',
  NotReadableError:'הדפדפן לא הצליח לפתוח את המיקרופון. בחרו כניסה אחרת או לחצו ניסיון נוסף.',
  OverconstrainedError:'כניסת המיקרופון שנבחרה אינה זמינה. בחרו ברירת מחדל ונסו שוב.',
  NotSupportedError:'הדפדפן אינו תומך בהקלטה כאן. אפשר לפתוח את אותה כתובת ב־Chrome או לשחק עם כתוביות.',
  PermissionsPolicyError:'החלון המשובץ חוסם גישה למיקרופון. פתחו את כתובת המשחק בחלון דפדפן רגיל.',
  CaptureTimeoutError:'הדפדפן עדיין לא החזיר זרם מיקרופון. לחצו ניסיון נוסף; אם זה חוזר בחלון המשובץ, פתחו את אותה כתובת ב־Chrome.',
  AudioContextError:'מנוע הקול של הדפדפן לא התחיל. לחצו ניסיון נוסף להפעלה בלחיצה חדשה.',
  TrackEndedError:'המיקרופון נותק בזמן ההקלטה. בחרו כניסה אחרת או לחצו ניסיון נוסף.',
  TrackDisabledError:'הדפדפן החזיר ערוץ מיקרופון כבוי. בחרו כניסה אחרת או לחצו ניסיון נוסף.',
  SilentInputError:'המיקרופון פתוח, אבל לא זוהה קול. אפשר לדבר בשקט; אם המד נשאר ריק, בחרו מיקרופון אחר או לחצו ניסיון נוסף.',
  SilentOutputError:'זוהה קול בכניסה, אבל ההקלטה יצאה שקטה. כבו את העיבוד ואת צמצום הרעשים ונסו שוב.',
  DecodeError:'הדפדפן לא הצליח לפענח את ההקלטה. הטייק לא נשמר. לחצו ניסיון נוסף או פתחו את המשחק ב־Chrome.',
  RecordingError:'שמירת הצליל בהקלטה נכשלה. הטייק לא נשמר. כבו את העיבוד ונסו שוב.',
  PageHiddenError:'הדף הוסתר וההקלטה נעצרה. הטייק לא נשמר. לחצו ניסיון נוסף.',
 })[error?.name]||'פתיחת המיקרופון או ההקלטה נכשלה. אפשר לבחור כניסה אחרת או ללחוץ ניסיון נוסף.';
}
const failure=(name,stage,cause)=>Object.assign(new Error(name),{name,stage,causeName:cause?.name});
const bounded=(promise,ms,error)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(error),ms);
 Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},cause=>{clearTimeout(timer);reject(cause);});
});
// AC energy rejects digital silence/DC. Short windows retain quiet speech amid pauses.
export function signalStats(channels,sampleRate){
 let peak=0,maxRms=0,activeSamples=0;
 const windowSize=Math.max(1,Math.round(sampleRate*.02));
 for(const data of channels){
  for(let offset=0;offset<data.length;offset+=windowSize){
   const end=Math.min(data.length,offset+windowSize),length=end-offset;
   let sum=0,squares=0,lo=Infinity,hi=-Infinity;
   for(let i=offset;i<end;i++){const v=Number.isFinite(data[i])?data[i]:0;sum+=v;squares+=v*v;lo=Math.min(lo,v);hi=Math.max(hi,v);}
   const rms=Math.sqrt(Math.max(0,squares/length-(sum/length)**2)),amplitude=(hi-lo)/2;
   maxRms=Math.max(maxRms,rms);peak=Math.max(peak,amplitude);
   if(rms>1e-6&&amplitude>1e-5)activeSamples+=length;
  }
 }
 return {peak,maxRms,hasSignal:activeSamples>=sampleRate*.02};
}
export function meterLevel(rms){return rms>0?Math.max(0,Math.min(1,(20*Math.log10(rms)+100)/90)):0;}
export function connectVoiceEnhancement(context,source,destination){
 const highpass=context.createBiquadFilter(),compressor=context.createDynamicsCompressor();
 highpass.type='highpass';highpass.frequency.value=85;compressor.threshold.value=-22;compressor.knee.value=20;compressor.ratio.value=2;compressor.attack.value=.015;compressor.release.value=.2;
 source.connect(highpass);highpass.connect(compressor);compressor.connect(destination);
 return [highpass,compressor];
}
export function captureEnvironment(){
 const policy=document.permissionsPolicy||document.featurePolicy;
 return {secure:globalThis.isSecureContext,mediaDevices:!!navigator.mediaDevices?.getUserMedia,
  embedded:window.self!==window.top,microphonePolicy:policy?.allowsFeature?policy.allowsFeature('microphone'):'unknown'};
}
export class QuickRecorder {
 constructor({onLevel=()=>{},onInterrupted=()=>{},onDiagnostic=()=>{},onSignal=()=>{},onDevices=()=>{}}={}){
  Object.assign(this,{onLevel,onInterrupted,onDiagnostic,onSignal,onDevices});
  this.diagnostics={state:'idle',stage:'idle',bytes:0,rms:0,peakRms:0,error:null};
 }
 get recording(){return this.session?.state==='recording';}
 get busy(){return ['starting','finalizing'].includes(this.session?.state);}
 publish(session,patch={}){
  if(session&&this.session!==session)return;
  const track=session?.stream?.getAudioTracks()[0];
  this.diagnostics={...this.diagnostics,...patch,
   track:track?{readyState:track.readyState,enabled:track.enabled,muted:track.muted}:null,
   context:session?.context?.state||'none',recorder:session?.recorder?.state||'inactive'};
  this.onDiagnostic(this.diagnostics);
 }
 async start(options={}){
  if(typeof options==='boolean')options={enhance:options};
  const {enhance=false,noiseReduction=false,autoGainControl=noiseReduction,deviceId=''}=options;
  this.cancel();
  const s={state:'starting',stage:'environment',nodes:[],chunks:[],bytes:0,peakRms:0,signal:false};
  this.session=s;this.diagnostics={state:s.state,stage:s.stage,bytes:0,rms:0,peakRms:0,error:null,mimeType:''};
  try{
   const environment=captureEnvironment();this.publish(s,{environment});
   if(!environment.secure||!environment.mediaDevices||!globalThis.MediaRecorder||!(window.AudioContext||window.webkitAudioContext))throw failure('NotSupportedError',s.stage);
   if(environment.microphonePolicy===false)throw failure('PermissionsPolicyError',s.stage);
   // Resume within the Record gesture BEFORE awaiting the permission prompt.
   s.stage='context';s.context=new (window.AudioContext||window.webkitAudioContext)();
   const contextReady=bounded(s.context.resume(),4000,failure('AudioContextError','context')).then(()=>null,error=>error.name==='AudioContextError'?error:failure('AudioContextError','context',error));
   s.context.onstatechange=()=>{
    this.publish(s);
    if(this.session===s&&s.state==='recording'&&s.context.state!=='running')this.interrupt(failure('AudioContextError','context'));
   };
   const supported=navigator.mediaDevices.getSupportedConstraints?.()||{},constraints={};
   // No sample rate/channel requirements; browser processing is opt-in.
   for(const key of ['echoCancellation','noiseSuppression','autoGainControl'])if(supported[key])constraints[key]=key==='autoGainControl'?!!autoGainControl:!!noiseReduction;
   if(deviceId)constraints.deviceId={ideal:deviceId};
   s.stage='acquisition';this.publish(s,{stage:s.stage});
   const acquisition=navigator.mediaDevices.getUserMedia({audio:Object.keys(constraints).length?constraints:true,video:false}).then(stream=>{
    if(this.session!==s||s.state!=='starting'){stream.getTracks().forEach(track=>track.stop());return null;}
    s.stream=stream;return stream;
   });
   const stream=await bounded(acquisition,20000,failure('CaptureTimeoutError','acquisition'));
   if(this.session!==s||s.state!=='starting')return false;
   s.stage='tracks';const track=stream?.getAudioTracks()[0];
   if(!track)throw failure('NotFoundError',s.stage);
   if(track.readyState!=='live')throw failure('TrackEndedError',s.stage);
   if(!track.enabled)throw failure('TrackDisabledError',s.stage);
   track.onended=()=>{if(this.session===s)this.interrupt(failure('TrackEndedError','tracks'));};
   track.onmute=track.onunmute=()=>this.publish(s);
   // Enumerate after permission; device identifiers never enter diagnostics/logs.
   navigator.mediaDevices.enumerateDevices?.().then(devices=>{
    if(this.session===s)this.onDevices(devices.filter(d=>d.kind==='audioinput'),track.label,track.getSettings?.().deviceId);
   }).catch(()=>{});
   this.publish(s,{stage:s.stage});
   const contextError=await contextReady;
   if(this.session!==s||s.state!=='starting')return false;
   if(contextError||s.context.state!=='running')throw contextError||failure('AudioContextError','context');
   s.stage='analysis';s.source=s.context.createMediaStreamSource(stream);s.analyser=s.context.createAnalyser();s.analyser.fftSize=2048;
   s.source.connect(s.analyser);s.nodes.push(s.source,s.analyser);
   let output=stream;
   if(enhance){
    const destination=s.context.createMediaStreamDestination();
    s.nodes.push(...connectVoiceEnhancement(s.context,s.source,destination),destination);s.processed=destination.stream;output=s.processed;
   }
   // Analyser output can stay unconnected. NEVER connect live input to speakers.
   s.stage='recorder';const mimeType=recordingType();s.recorder=new MediaRecorder(output,mimeType?{mimeType}:undefined);
   s.processing={enhance,highpassHz:enhance?85:0,compressorRatio:enhance?2:1,...Object.fromEntries(['echoCancellation','noiseSuppression','autoGainControl'].map(key=>[key,track.getSettings?.()[key]??false]))};
   s.recorder.ondataavailable=event=>{if(this.session!==s||!event.data.size)return;s.chunks.push(event.data);s.bytes+=event.data.size;this.publish(s,{bytes:s.bytes});};
   s.recorder.onerror=event=>{if(this.session===s)this.interrupt(failure('RecordingError','recorder',event.error));};
   s.recorder.onstop=()=>{if(this.session===s&&s.state==='recording')this.interrupt(failure('RecordingError','recorder'));};
   s.recorder.start(200);s.state='recording';s.started=s.lastSignal=performance.now();s.stage='recording';
   this.publish(s,{state:s.state,stage:s.stage,mimeType:s.recorder.mimeType||mimeType});
   const data=new Float32Array(s.analyser.fftSize);
   const measure=()=>{
    if(this.session!==s||s.state!=='recording')return;
    if(!track.enabled){this.interrupt(failure('TrackDisabledError','tracks'));return;}
    if(track.readyState!=='live'){this.interrupt(failure('TrackEndedError','tracks'));return;}
    s.analyser.getFloatTimeDomainData(data);
    const stats=signalStats([data],s.context.sampleRate),rms=stats.maxRms;s.peakRms=Math.max(s.peakRms,rms);
    if(rms>1e-6&&stats.peak>1e-5){s.signal=true;s.lastSignal=performance.now();if(s.silent){s.silent=false;this.onSignal(true);}}
    else if(!s.silent&&performance.now()-s.lastSignal>3000){s.silent=true;this.onSignal(false);}
    this.onLevel(meterLevel(rms));this.publish(s,{rms,peakRms:s.peakRms,noSignal:!!s.silent});
   };
   // Embedded previews may stop animation frames; sampling must remain independent.
   s.meterTimer=setInterval(measure,80);measure();return true;
  }catch(error){if(this.session!==s)return false;this.fail(s,error);throw error;}
 }
 stop(){
  const s=this.session;
  if(s?.state==='finalizing')return s.stopPromise;
  if(!this.recording)return Promise.resolve(null);
  s.state='finalizing';s.stage='finalizing';clearInterval(s.meterTimer);this.onLevel(0);this.publish(s,{state:s.state,stage:s.stage,rms:0});
  s.stopPromise=new Promise((resolve,reject)=>{
   s.resolve=resolve;s.reject=reject;
   s.stopTimer=setTimeout(()=>{if(this.session===s)this.interrupt(failure('RecordingError','finalizing'));},10000);
   s.recorder.onstop=async()=>{
    clearTimeout(s.stopTimer);
    if(this.session!==s){resolve(null);return;}
    try{
     const blob=new Blob(s.chunks,{type:s.recorder.mimeType||s.chunks[0]?.type||'application/octet-stream'});
     if(!blob.size)throw failure('RecordingError','finalizing');
     s.stage='decoding';this.publish(s,{stage:s.stage,bytes:blob.size});this.releaseTracks(s);
     let decoded;
     try{decoded=await bounded(s.context.decodeAudioData(await blob.arrayBuffer()),8000,failure('DecodeError','decoding'));}catch(error){throw failure('DecodeError','decoding',error);}
     if(this.session!==s){resolve(null);return;}
     const validation={...signalStats(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),decoded.sampleRate),duration:decoded.duration};
     if(!validation.hasSignal)throw failure(s.signal?'SilentOutputError':'SilentInputError','decoding');
     const take={blob,mimeType:blob.type,duration:decoded.duration,processing:s.processing,validation};
     s.state='ready';this.release(s);this.publish(s,{state:s.state,stage:'validated',validation,noSignal:false});s.resolve=s.reject=null;resolve(take);
    }catch(error){if(this.session!==s){resolve(null);return;}this.fail(s,error);s.resolve=s.reject=null;reject(error);}
   };
   try{s.recorder.stop();}catch(error){const problem=failure('RecordingError','finalizing',error);this.fail(s,problem);s.resolve=s.reject=null;reject(problem);}
  });
  return s.stopPromise;
 }
 fail(s,error){
  const diagnosticError={name:error.name||'Error',stage:error.stage||s.stage,causeName:error.causeName||null,message:microphoneMessage(error)};
  s.state='error';this.release(s);this.publish(s,{state:'error',stage:diagnosticError.stage,error:diagnosticError,rms:0});
 }
 interrupt(error=failure('TrackEndedError','tracks')){
  const s=this.session;if(!s)return;this.fail(s,error);s.reject?.(error);s.resolve=s.reject=null;this.onInterrupted(error);
 }
 releaseTracks(s){for(const stream of [s.stream,s.processed])stream?.getTracks().forEach(track=>{track.onended=track.onmute=track.onunmute=null;track.stop();});}
 release(s){
  clearInterval(s.meterTimer);clearTimeout(s.stopTimer);
  if(s.recorder){s.recorder.ondataavailable=s.recorder.onstop=s.recorder.onerror=null;try{if(s.recorder.state!=='inactive')s.recorder.stop();}catch{}}
  this.releaseTracks(s);s.nodes.forEach(node=>{try{node.disconnect();}catch{}});s.nodes=[];s.chunks=[];
  if(s.context){s.context.onstatechange=null;if(s.context.state!=='closed')s.context.close().catch(()=>{});}
  if(this.session===s)this.onLevel(0);
 }
 cancel(){const old=this.session;this.session=null;if(old){old.state='cancelled';this.release(old);old.resolve?.(null);old.resolve=old.reject=null;}this.onLevel(0);this.publish(null,{state:'idle',stage:'idle',rms:0});}
}
