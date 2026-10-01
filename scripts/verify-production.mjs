import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.argv[2]||'http://127.0.0.1:4174';
const root=await fetch(base),html=await root.text();assert(root.ok);assert.match(root.headers.get('content-type'),/text\/html/);assert.match(root.headers.get('cache-control'),/no-cache|must-revalidate/);
const release=html.match(/<base href="([^"]+)"/)[1];
for(const [path,type]of [['src/main.js',/javascript/],['src/dubbing.css',/text\/css/],['assets/art/goat-dark.webp',/image\/webp/],['assets/voices/available.json',/application\/json/]]){
 const r=await fetch(new URL(release+path,base));assert(r.ok,path);assert.match(r.headers.get('content-type'),type,path);assert.match(r.headers.get('cache-control'),/immutable/,path);
}
for(const path of ['/not-a-game-route',`${release}assets/voices/missing.mp3`,'/creator/','/creator/api/catalogue','/creator/api/takes','/creator/api/source/goat.greet',`${release}creator/`,`${release}tools/creator/server.mjs`,`${release}assets/voices/.creator-studio/library.json`]){const r=await fetch(new URL(path,base));assert.equal(r.status,404,path);}
for(const path of ['/creator/api/takes','/creator/api/progress']){const r=await fetch(new URL(path,base),{method:'POST',body:'test'});assert([404,405].includes(r.status),path+' exposes a write route');}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[],audioRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});page.on('request',r=>{if(/\.(mp3|m4a|ogg|webm|wav)(\?|$)/.test(r.url()))audioRequests.push(r.url());});
 await page.goto(`${base}/?test-profile=production-check`);assert.deepEqual(audioRequests,[]);await page.locator('#start').click();await page.locator('#choose-voice').click();await page.locator('[data-voice=goat]').waitFor();assert.equal(await page.locator('[data-voice]').count(),6);assert.equal(await page.locator('#buy-dubbing').count(),0);await page.screenshot({path:'docs/screenshots/quick-dubbing-production.png'});await page.locator('#play-now').click();await page.locator('#skip-intro').click();assert.equal(await page.locator('#overlay').isVisible(),false);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(JSON.stringify({base,release,checks:'HTML revalidation; immutable JS/CSS/WebP/JSON; correct MIME types; 404 routing; recording before payment; immediate free creator play; zero game/asset failures; no audio prefetch before interaction',status:'passed'},null,2));
}finally{await browser.close();}
