const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export const randomToken=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
export async function keyedDigest(value,env){
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.DUBBING_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));
}
async function encryptionKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.DUBBING_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function encrypt(value,purpose,env){
 const iv=crypto.getRandomValues(new Uint8Array(12)),additionalData=encoder.encode(`zoobluff-account-v1|${purpose}`);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},await encryptionKey(env),encoder.encode(value));
 return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}
export async function decrypt(value,purpose,env){
 const [iv,data,...extra]=value.split('.');if(extra.length)throw Error('Invalid encrypted value');
 const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:encoder.encode(`zoobluff-account-v1|${purpose}`)},await encryptionKey(env),bytes(data));
 return new TextDecoder().decode(result);
}
