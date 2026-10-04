// These are deployment addresses, not switches supplied by the browser or query string.
export const SANDBOX_ORIGIN='https://zoobluff-sandbox.board-experience-engine.workers.dev';
export const SANDBOX_LOCAL_ORIGIN='http://127.0.0.1:4175';
export const isSandboxOrigin=origin=>[SANDBOX_ORIGIN,SANDBOX_LOCAL_ORIGIN].includes(origin);
export const checkoutOrigin=origin=>isSandboxOrigin(origin)?'https://sandbox.payme.io':'https://live.payme.io';
export function validCheckoutUrl(value,origin){
 if(typeof value!=='string')return false;
 const prefix=checkoutOrigin(origin)+'/sale/generate/';
 return value.startsWith(prefix)&&/^SALE[A-Z0-9-]{20,60}$/.test(value.slice(prefix.length));
}
