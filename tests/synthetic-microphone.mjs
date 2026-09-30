// Explicit synthetic input, not evidence of physical microphone access.
// A repeatable, amplitude-modulated two-tone WAV goes through Chrome's actual
// getUserMedia capture driver, analyser, MediaRecorder, codec, and decoder.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function syntheticMicrophone(){
 const rate=48000,length=rate*8,bytes=Buffer.alloc(44+length*2);
 bytes.write('RIFF');bytes.writeUInt32LE(36+length*2,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(length*2,40);
 for(let i=0;i<length;i++){
  const t=i/rate,envelope=.65+.35*Math.sin(2*Math.PI*3*t);
  bytes.writeInt16LE(Math.round(9000*envelope*(.7*Math.sin(2*Math.PI*220*t)+.3*Math.sin(2*Math.PI*660*t))),44+i*2);
 }
 const directory=resolve('.cache');mkdirSync(directory,{recursive:true});const file=resolve(directory,'synthetic-microphone.wav');writeFileSync(file,bytes);return file;
}
