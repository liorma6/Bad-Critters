import {captureEnvironment} from './recorder.js';
const $=id=>document.getElementById(id);
const preferenceKey='neighborhood-microphone-choice';
export const microphonePanelMarkup=`<div id="microphone-input" hidden><label id="microphone-choice-label" for="microphone-choice">מיקרופון</label><select id="microphone-choice" aria-label="מיקרופון"></select><p id="microphone-selected" class="microcopy"></p></div><details class="microphone-diagnostics"><summary>פרטי בדיקת המיקרופון</summary><pre id="microphone-diagnostics" dir="ltr"></pre><p class="microcopy">הפרטים נשארים כאן. אין בהם הקלטות או מזהי מכשירים.</p></details>`;

export class MicrophonePanel {
 constructor(){
  try{this.deviceId=localStorage.getItem(preferenceKey)||'';}catch{this.deviceId='';}this.devices=[];
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{
   if(!this.devices.length||!$('microphone-choice'))return;
   navigator.mediaDevices.enumerateDevices().then(devices=>this.setDevices(devices.filter(d=>d.kind==='audioinput'))).catch(()=>{});
  });
 }
 mount(onChange){
  this.onChange=onChange;
  $('microphone-choice').onchange=event=>{
   this.deviceId=event.target.value;this.persist();this.selectedLabel=this.devices.find(d=>d.deviceId===this.deviceId)?.label||'ברירת המחדל של המערכת';this.renderDevices();onChange();
  };
  this.renderDevices();this.update({state:'idle',stage:'idle',environment:captureEnvironment()});
  // Previously granted permission may already expose labels. No permission request here.
  navigator.mediaDevices?.enumerateDevices?.().then(devices=>{
   if(!$('microphone-choice'))return;
   const inputs=devices.filter(d=>d.kind==='audioinput');
   if(inputs.some(d=>d.label))this.setDevices(inputs);
  }).catch(()=>{});
 }
 persist(){try{if(this.deviceId)localStorage.setItem(preferenceKey,this.deviceId);else localStorage.removeItem(preferenceKey);}catch{}}
 setDevices(devices,label,actualId){
  this.devices=devices;
  if(this.deviceId&&!devices.some(d=>d.deviceId===this.deviceId)){this.deviceId='';this.persist();}
  // If a browser falls back from an unavailable ideal choice, show the input actually used.
  if(this.deviceId&&actualId&&this.deviceId!==actualId){this.deviceId=devices.some(d=>d.deviceId===actualId)?actualId:'';this.persist();}
  this.selectedLabel=label||devices.find(d=>d.deviceId===(this.deviceId||'default'))?.label||'ברירת המחדל של המערכת';
  this.renderDevices();
 }
 renderDevices(){
  const select=$('microphone-choice');if(!select)return;
  select.replaceChildren(new Option('ברירת המחדל של המערכת',''));
  this.devices.filter(d=>d.deviceId&&d.deviceId!=='default'&&d.deviceId!=='communications').forEach((d,i)=>select.add(new Option(d.label||`מיקרופון ${i+1}`,d.deviceId)));
  select.value=this.deviceId;
  const multiple=select.options.length>2;
  select.hidden=!multiple;$('microphone-choice-label').hidden=!multiple;
  $('microphone-input').hidden=!this.devices.length;
  $('microphone-selected').textContent=`כניסה: ${this.selectedLabel||'ברירת המחדל של המערכת'}`;
 }
 update(d){
  const output=$('microphone-diagnostics');if(!output)return;
  const env=d.environment||{},track=d.track;
  output.textContent=[
   `Capture: ${d.state} / ${d.stage}`,
   `Track: ${track?`${track.readyState}; enabled=${track.enabled}; muted=${track.muted}`:'none'}`,
   `AudioContext: ${d.context||'none'}`,
   `Input RMS: ${(d.rms||0).toExponential(2)}; peak RMS: ${(d.peakRms||0).toExponential(2)}`,
   `Recorder: ${d.recorder||'inactive'}; MIME: ${d.mimeType||'none'}`,
   `Captured bytes: ${d.bytes||0}`,
   `Secure: ${env.secure??'?'}; mediaDevices: ${env.mediaDevices??'?'}; iframe: ${env.embedded??'?'}; microphone policy: ${env.microphonePolicy??'?'}`,
   d.validation?`Decoded signal: ${d.validation.hasSignal}; RMS: ${d.validation.maxRms.toExponential(2)}; seconds: ${d.validation.duration.toFixed(2)}`:'',
   d.noSignal?'Input: no measurable signal yet':'',
   d.error?`Error: ${d.error.name} at ${d.error.stage}${d.error.causeName?` (${d.error.causeName})`:''}\n${d.error.message}`:'Error: none',
  ].filter(Boolean).join('\n');
 }
}
