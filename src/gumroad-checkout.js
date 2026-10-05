export const GUMROAD_PRODUCT_ID='igraNwrit43FLzFkjlV2bw==';
export const GUMROAD_PRODUCT_URL='https://liorma.gumroad.com/l/zoobluff-dubbing';
export function gumroadCheckoutUrl(email){
 const url=new URL(GUMROAD_PRODUCT_URL);
 url.searchParams.set('wanted','true');url.searchParams.set('quantity','1');url.searchParams.set('email',email);
 return url.href;
}
export function validGumroadCheckoutUrl(value){
 try{
  const url=new URL(value);
  return url.origin+url.pathname===GUMROAD_PRODUCT_URL&&!url.username&&!url.password&&!url.hash&&url.searchParams.get('wanted')==='true'&&url.searchParams.get('quantity')==='1'&&[...url.searchParams.keys()].every(key=>['wanted','quantity','email'].includes(key));
 }catch{return false;}
}
