import {connectVoiceEnhancement,signalStats} from '/src/recorder.js';
function wav(buffer){
 const channels=buffer.numberOfChannels,length=buffer.length*channels,bytes=new ArrayBuffer(44+length*2),view=new DataView(bytes);
 const text=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
 text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
 for(let i=0;i<buffer.length;i++)for(let c=0;c<channels;c++){const value=Math.max(-1,Math.min(1,data[c][i]));view.setInt16(44+2*(i*channels+c),value*(value<0?32768:32767),true);}
 return new Blob([bytes],{type:'audio/wav'});
}
export async function prepareTake(raw,enhance){
 if(raw.duration>180)throw Error('הטייק ארוך משלוש דקות. הקליטו שוב.');
 if(!enhance)return {...raw,source:raw.blob};
 // Capture stays unprocessed by the app. Render the SAME enhancement once,
 // then both preview and game play these exact bytes without further effects.
 const decoder=new OfflineAudioContext(1,1,48000),decoded=await decoder.decodeAudioData(await raw.blob.arrayBuffer());
 const context=new OfflineAudioContext(1,decoded.length,decoded.sampleRate),source=context.createBufferSource();source.buffer=decoded;
 connectVoiceEnhancement(context,source,context.destination);source.start();
 const rendered=await context.startRendering(),validation={...signalStats([rendered.getChannelData(0)],rendered.sampleRate),duration:rendered.duration};
 if(!validation.hasSignal)throw Error('שיפור הקול הפיק טייק שקט. כבו את השיפור והקליטו שוב.');
 const blob=wav(rendered);
 return {blob,source:raw.blob,mimeType:blob.type,duration:rendered.duration,validation,processing:{...raw.processing,enhance:true,highpassHz:85,compressorRatio:2}};
}

export async function editableSource(blob,processing={}){
 const context=new OfflineAudioContext(1,1,48000),decoded=await context.decodeAudioData(await blob.arrayBuffer());
 const validation={...signalStats(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),decoded.sampleRate),duration:decoded.duration};
 if(!validation.hasSignal)throw Error('קובץ המקור אינו מכיל קול תקין. הטייק השמור לא השתנה.');
 const {trim,...originalProcessing}=processing;
 return prepareTake({blob,mimeType:blob.type,duration:decoded.duration,validation,processing:originalProcessing},!!processing.enhance);
}

export async function trimTake(take,start,end){
 // Every edit starts from the complete, once-processed take. No cumulative
 // trimming or compression; the captured source always stays untouched.
 const base=take.untrimmedBlob||take.blob,baseValidation=take.untrimmedValidation||take.validation;
 const decoder=new OfflineAudioContext(1,1,48000),decoded=await decoder.decodeAudioData(await base.arrayBuffer());
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<0||decoded.duration-start-end<.08)throw Error('החיתוך גדול מדי או אינו תקין. השאירו לפחות 0.08 שניות של הקלטה.');
 const {trim,...processing}=take.processing||{};
 const common={...take,untrimmedBlob:base,untrimmedValidation:baseValidation,untrimmedDuration:decoded.duration,processing};
 if(start===0&&end===0)return {...common,blob:base,mimeType:base.type,duration:decoded.duration,validation:baseValidation};
 const from=Math.round(start*decoded.sampleRate),to=decoded.length-Math.round(end*decoded.sampleRate),length=to-from;
 if(length<Math.ceil(.08*decoded.sampleRate))throw Error('החיתוך קצר מדי. השאירו יותר מהמשפט.');
 const buffer=new AudioBuffer({numberOfChannels:decoded.numberOfChannels,length,sampleRate:decoded.sampleRate});
 const fade=Math.min(Math.round(.005*decoded.sampleRate),Math.floor(length/2));
 for(let c=0;c<decoded.numberOfChannels;c++){
  const channel=buffer.getChannelData(c);channel.set(decoded.getChannelData(c).subarray(from,to));
  // A 5 ms edge fade prevents a new digital click at a cut through a waveform.
  for(let i=0;i<fade;i++){const gain=i/Math.max(1,fade-1);channel[i]*=gain;channel[length-1-i]*=gain;}
 }
 const validation={...signalStats(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),buffer.sampleRate),duration:buffer.duration};
 if(!validation.hasSignal)throw Error('בחלק שנשאר לא זוהה קול. הקטינו את החיתוך.');
 const blob=wav(buffer);
 return {...common,blob,mimeType:blob.type,duration:buffer.duration,validation,processing:{...processing,trim:{start,end,sourceDuration:decoded.duration,fadeSeconds:.005}}};
}
