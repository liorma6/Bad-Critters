// Deterministic content identity, not a security hash. Version AND text/context must match.
export function recordingFingerprint(text,performanceKey){
 let hash=2166136261;for(const ch of `${performanceKey}\n${text}`){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619);}
 return `text-${(hash>>>0).toString(16).padStart(8,'0')}`;
}
