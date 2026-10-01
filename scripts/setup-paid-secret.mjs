import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
// Read the existing merchant credential over stdin. Never log or save it.
let value='';for await(const chunk of process.stdin)value+=chunk;value=value.trim();
if(!/^MPL[A-Z0-9-]{20,60}$/.test(value))throw Error('Provide the existing Paid merchant API credential over stdin.');
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const list=spawnSync(process.execPath,[wrangler,'secret','list'],{encoding:'utf8'});
if(list.status!==0)throw Error('Unable to inspect secret names; no change made.');
if(JSON.parse(list.stdout).some(item=>item.name==='PAID_SELLER_ID')){
 console.log('PAID_SELLER_ID already exists; preserved.');
}else{
 const result=spawnSync(process.execPath,[wrangler,'secret','put','PAID_SELLER_ID'],{input:value+'\n',encoding:'utf8'});
 if(result.status!==0)throw Error('Paid credential setup failed; no credential printed.');
 console.log('Configured PAID_SELLER_ID as a server-only Cloudflare secret.');
}
