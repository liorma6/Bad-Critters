// Shared by the voice-only audio graph, canvas residents and dialogue portraits.
export const speech = {resident:null,mouth:0,level:0};
export function mouthState(rms){return rms<.012?0:rms<.045?1:rms<.105?2:3;}
export function resetSpeech(){speech.resident=null;speech.mouth=0;speech.level=0;}
