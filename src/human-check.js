let loading;
function load(){
 if(globalThis.turnstile?.render)return Promise.resolve(globalThis.turnstile);
 return loading??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);if(error){script.remove();loading=null;reject(error);}else resolve(globalThis.turnstile);};
  const timer=setTimeout(()=>finish(Error('Security check timed out')),12000);
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  script.onload=()=>finish(globalThis.turnstile?.render?null:Error('Security check unavailable'));
  script.onerror=()=>finish(Error('Security check unavailable'));document.head.append(script);
 });
}
export function mountHumanCheck(container,key,onChange,{onState=()=>{}}={}){
 let api,id,generation=0,active=false,disposed=false,timer;
 const visible=()=>container.isConnected&&container.getBoundingClientRect().width>0;
 const clear=()=>{generation++;clearTimeout(timer);active=false;onChange('');if(id!==undefined){try{api.remove(id);}catch{}id=undefined;}};
 const start=async()=>{
  if(disposed||active||!visible())return;active=true;const run=++generation;onState('loading');
  const current=()=>!disposed&&run===generation;
  const fail=state=>{if(!current())return;clearTimeout(timer);onChange('');onState(state);};
  try{
   api=await load();if(!current())return;if(!visible()){clear();return;}
   timer=setTimeout(()=>fail('error'),25000);
   id=api.render(container,{sitekey:key,action:'login',language:'he',size:container.clientWidth<300?'compact':'flexible',theme:'light',appearance:'always',retry:'never','refresh-expired':'manual',
    callback:token=>{if(current()){clearTimeout(timer);onChange(token);onState('ready');}},
    'expired-callback':()=>fail('expired'),'error-callback':()=>{fail('error');return true;},
    'timeout-callback':()=>fail('error'),'unsupported-callback':()=>fail('unsupported'),
   });
  }catch{fail('error');}
 };
 // The purchase form starts hidden. Mount the provider only after it has layout.
 const resize=new ResizeObserver(()=>{if(!visible()){if(active)clear();}else start();});resize.observe(container);
 const observer=new MutationObserver(()=>{if(!container.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});
 function dispose(){if(disposed)return;disposed=true;clear();resize.disconnect();observer.disconnect();}
 const reset=()=>{clear();start();};start();return {reset,dispose};
}
