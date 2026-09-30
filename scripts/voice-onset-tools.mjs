// PCM-only experiment helpers. Input buffers are never mutated.
export function readPcm16(bytes){
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Expected WAV');
 let format,data;
 for(let offset=12;offset+8<=bytes.length;){
  const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),chunk=bytes.subarray(offset+8,offset+8+size);
  if(chunk.length!==size)throw Error('Truncated WAV');
  if(id==='fmt ')format=chunk;if(id==='data')data=chunk;offset+=8+size+(size%2);
 }
 if(!format||!data||format.readUInt16LE(0)!==1||format.readUInt16LE(14)!==16)throw Error('Expected 16-bit PCM');
 const channels=format.readUInt16LE(2),sampleRate=format.readUInt32LE(4),blockAlign=format.readUInt16LE(12);
 if(!channels||!sampleRate||blockAlign!==channels*2||data.length%blockAlign)throw Error('Invalid PCM format');
 return {format,data,channels,sampleRate,blockAlign,samples:data.length/blockAlign,duration:data.length/blockAlign/sampleRate};
}
export function detectOnset(pcm,{thresholdDb=-55,paddingSeconds=.1}={}){
 const step=Math.round(pcm.sampleRate*.01),threshold=10**(thresholdDb/20),frames=[];
 for(let i=0;i<pcm.samples;i+=step){let sum=0,n=0;for(let j=i;j<Math.min(pcm.samples,i+step);j++)for(let c=0;c<pcm.channels;c++){const v=pcm.data.readInt16LE(j*pcm.blockAlign+c*2)/32768;sum+=v*v;n++;}frames.push(Math.sqrt(sum/n));}
 // Require four audible 10 ms windows within 60 ms; a lone click isn't speech.
 const at=frames.findIndex((rms,i)=>rms>=threshold&&frames.slice(i,i+6).filter(v=>v>=threshold).length>=4);
 if(at<0)return {onsetSeconds:null,cutSamples:0,cutSeconds:0,thresholdDb,paddingSeconds,reason:'no-sustained-signal'};
 const desired=Math.max(0,Math.floor(at*step-paddingSeconds*pcm.sampleRate));let cut=desired;
 // Move only earlier, at most 5 ms, to a quiet boundary; retained audio is bit exact.
 let minimum=Infinity;
 for(let i=Math.max(0,desired-Math.ceil(pcm.sampleRate*.005));i<=desired;i++){let energy=0;for(let c=0;c<pcm.channels;c++)energy+=Math.abs(pcm.data.readInt16LE(i*pcm.blockAlign+c*2));if(energy<minimum){minimum=energy;cut=i;}}
 if(cut/pcm.sampleRate<.02)cut=0;
 return {onsetSeconds:at*step/pcm.sampleRate,cutSamples:cut,cutSeconds:cut/pcm.sampleRate,thresholdDb,paddingSeconds,reason:cut?'trimmed-copy':'already-short'};
}
export function trimPcm16(bytes,cutSamples){
 if(!cutSamples)return Buffer.from(bytes);
 const pcm=readPcm16(bytes);if(!Number.isInteger(cutSamples)||cutSamples<0||cutSamples>=pcm.samples)throw Error('Invalid cut');
 const data=pcm.data.subarray(cutSamples*pcm.blockAlign),fmtLength=pcm.format.length,pad=fmtLength%2;
 const out=Buffer.alloc(12+8+fmtLength+pad+8+data.length);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVE',8);out.write('fmt ',12);out.writeUInt32LE(fmtLength,16);pcm.format.copy(out,20);
 const offset=20+fmtLength+pad;out.write('data',offset);out.writeUInt32LE(data.length,offset+4);data.copy(out,offset+8);return out;
}
