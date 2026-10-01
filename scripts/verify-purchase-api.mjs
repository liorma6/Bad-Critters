import assert from 'node:assert/strict';
const base=new URL(process.argv[2]||'https://zoobluff.com').origin;
const status=await fetch(`${base}/api/dubbing/access`);
assert.equal(status.status,200);const access=await status.json();assert.equal(access.unlocked,false);assert.match(status.headers.get('Cache-Control'),/no-store/);
const session=await fetch(`${base}/api/dubbing/auth/session`);assert.equal(session.status,200);const account=await session.json();assert.equal(account.authenticated,false);
if(account.enabled){assert.equal(access.loginRequired,true);assert.equal(access.accountBased,true);}
const rejected=await fetch(`${base}/api/dubbing/activate`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({licenseKey:'INVALID-DEPLOYMENT-CHECK-KEY'})});
assert.equal(rejected.status,account.enabled?401:403);assert.equal((await rejected.json()).unlocked,false);
const foreign=await fetch(`${base}/api/dubbing/activate`,{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({licenseKey:'NOT-A-LICENSE'})});assert.equal(foreign.status,403);
const wrongMethod=await fetch(`${base}/api/dubbing/activate`);assert.equal(wrongMethod.status,405);
for(const path of ['/worker/dubbing.js','/worker/accounts.js','/migrations/0001_accounts.sql','/.dev.vars','/.env','/scripts/setup-dubbing-secret.mjs'])assert.equal((await fetch(base+path)).status,404,path);
console.log(JSON.stringify({base,accountsEnabled:account.enabled,anonymousAccessLocked:true,invalidLicenseRejected:true,crossOriginRejected:true,privateFilesUnavailable:true,status:'passed'},null,2));
