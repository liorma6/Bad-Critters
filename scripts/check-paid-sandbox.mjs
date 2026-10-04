import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
// Fail before any deployment if test resources are missing or point at production.
const config=JSON.parse(readFileSync('wrangler.sandbox.jsonc','utf8'));
const production=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.name!=='zoobluff-sandbox'||config.vars?.PAID_ENVIRONMENT!=='sandbox'||config.routes?.length||config.vars?.ACCOUNTS_ENABLED!=='true')throw Error('Invalid sandbox isolation settings');
const db=config.d1_databases?.find(item=>item.binding==='ACCOUNTS_DB');
if(!db||db.database_name!=='zoobluff-sandbox-accounts'||!/^[-a-f0-9]{36}$/.test(db.database_id)||db.database_id==='00000000-0000-0000-0000-000000000000')throw Error('Sandbox database not provisioned. Create zoobluff-sandbox-accounts and set its ID in wrangler.sandbox.jsonc.');
if(production.d1_databases.some(item=>item.database_id===db.database_id))throw Error('Sandbox must not use the production database');
const result=spawnSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'secret','list','--config','wrangler.sandbox.jsonc'],{encoding:'utf8'});
if(result.status!==0)throw Error('Cannot check sandbox secret names. Complete sandbox provisioning first.');
const names=JSON.parse(result.stdout).map(item=>item.name);
for(const name of ['PAID_SANDBOX_SELLER_ID','DUBBING_SESSION_SECRET','RESEND_API_KEY','TURNSTILE_SECRET_KEY'])if(!names.includes(name))throw Error(`Missing sandbox secret: ${name}`);
if(config.vars.AUTH_TURNSTILE_REQUIRED!=='true'||!config.vars.TURNSTILE_SITE_KEY||config.vars.AUTH_DAILY_LIMIT!=='5'||!config.vars.AUTH_ALLOWED_EMAILS)throw Error('Sandbox login isolation is incomplete');
if(names.includes('PAID_SELLER_ID'))throw Error('Remove the live merchant secret from the sandbox Worker');
console.log('Sandbox resource names and required secret names are configured. Provider credentials still need an end-to-end sandbox test.');
