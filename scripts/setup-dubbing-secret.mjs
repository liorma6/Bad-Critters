import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const list=spawnSync(process.execPath,[wrangler,'secret','list'],{encoding:'utf8'});
if(list.status!==0)throw Error('Unable to list Worker secret names; no change made.');
if(JSON.parse(list.stdout).some(item=>item.name==='DUBBING_SESSION_SECRET')){
 console.log('DUBBING_SESSION_SECRET already exists; preserved.');
}else{
 // The value is sent over stdin only: never printed, put in arguments or saved.
 const created=spawnSync(process.execPath,[wrangler,'secret','put','DUBBING_SESSION_SECRET'],{input:randomBytes(32).toString('hex')+'\n',encoding:'utf8'});
 if(created.status!==0)throw Error('Secret setup failed; inspect Wrangler status before retrying.');
 console.log('Created the Worker session secret. Its value was not saved locally.');
}
