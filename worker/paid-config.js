import {isSandboxOrigin,SANDBOX_ORIGIN} from '../src/paid-environment.js';
export function paidConfig(env){
 const mode=env.PAID_ENVIRONMENT??'production';
 if(!['production','sandbox'].includes(mode))throw Error('Invalid payment environment');
 const sandbox=mode==='sandbox';
 return {sandbox,origin:sandbox?'https://sandbox.payme.io':'https://live.payme.io',seller:sandbox?env.PAID_SANDBOX_SELLER_ID:env.PAID_SELLER_ID};
}
export function assertPaymentOrigin(origin,env){
 if(paidConfig(env).sandbox!==isSandboxOrigin(origin))throw Error('Payment environment does not match this site');
}
export function paidReturnOrigin(origin,env){
 const {sandbox}=paidConfig(env);
 if(sandbox){
  assertPaymentOrigin(origin,env);
  return origin;
 }
 return ['https://zoobluff.com','https://bad-critters.board-experience-engine.workers.dev'].includes(origin)?origin:'https://zoobluff.com';
}
export {SANDBOX_ORIGIN};
