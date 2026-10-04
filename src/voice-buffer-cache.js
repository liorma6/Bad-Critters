// Decoded speech only: bounded memory, two downloads at a time, and user-requested
// lines ahead of speculative warming. Nothing is written to personal recordings.
export class VoiceBufferCache {
 constructor({maxBytes=32*1024*1024,maxEntries=32,concurrency=2,timeout=12000,fetcher=(...args)=>fetch(...args)}={}){
  Object.assign(this,{maxBytes,maxEntries,concurrency,timeout,fetcher});this.entries=new Map();this.queue=[];this.bytes=0;this.active=0;this.epoch=0;
 }
 get(key){const entry=this.entries.get(key);if(!entry?.buffer)return null;this.entries.delete(key);this.entries.set(key,entry);return entry.buffer;}
 load(key,context,{priority=false}={}){
  if(!context?.decodeAudioData)return Promise.resolve(null);
  let entry=this.entries.get(key);
  if(entry){if(entry.buffer){this.get(key);return Promise.resolve(entry.buffer);}const at=this.queue.indexOf(entry);if(priority&&at>0){this.queue.splice(at,1);this.queue.unshift(entry);}return entry.promise;}
  if(this.queue.length>=24){if(!priority)return Promise.resolve(null);const dropped=this.queue.pop();this.entries.delete(dropped.key);dropped.resolve(null);}
  entry={key,context,epoch:this.epoch,controller:new AbortController()};entry.promise=new Promise(resolve=>entry.resolve=resolve);this.entries.set(key,entry);
  priority?this.queue.unshift(entry):this.queue.push(entry);this.pump();return entry.promise;
 }
 pump(){while(this.active<this.concurrency&&this.queue.length){const entry=this.queue.shift();this.active++;this.read(entry).finally(()=>{this.active--;this.pump();});}}
 async read(entry){
  const timer=setTimeout(()=>entry.controller.abort(),this.timeout);let buffer=null;
  try{
   const data=typeof entry.key==='string'?await this.fetcher(entry.key,{cache:'force-cache',signal:entry.controller.signal}).then(r=>{if(!r.ok)throw Error('Voice unavailable');return r.arrayBuffer();}):await entry.key.arrayBuffer();
   if(entry.epoch===this.epoch&&!entry.controller.signal.aborted)buffer=await entry.context.decodeAudioData(data);
   if(entry.epoch!==this.epoch||entry.controller.signal.aborted)buffer=null;
  }catch{}finally{clearTimeout(timer);}
  if(this.entries.get(entry.key)===entry){
   if(buffer){entry.buffer=buffer;entry.bytes=buffer.length*buffer.numberOfChannels*4;this.bytes+=entry.bytes;
    while(this.bytes>this.maxBytes||[...this.entries.values()].filter(e=>e.buffer).length>this.maxEntries){const oldest=[...this.entries.values()].find(e=>e.buffer);if(!oldest)break;this.entries.delete(oldest.key);this.bytes-=oldest.bytes;}
   }else this.entries.delete(entry.key);
  }
  entry.resolve(buffer);
 }
 clear(){this.epoch++;for(const entry of this.entries.values()){entry.controller?.abort();if(!entry.buffer)entry.resolve(null);}this.entries.clear();this.queue=[];this.bytes=0;}
}
