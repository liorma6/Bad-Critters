import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=process.argv[2]||'http://127.0.0.1:4182';
const canonical='https://zoobluff.com/';
const root=await fetch(base);
assert.equal(root.status,200);
assert(!/noindex/i.test(root.headers.get('x-robots-tag')||''));
const html=await root.text();
const release=html.match(/<base href="([^"]+)"/)?.[1]||'/';
const discovered={};
for(const [path,type]of [['robots.txt',/text\/plain/],['sitemap.xml',/(application|text)\/xml/],['favicon.svg',/image\/svg\+xml/]]){
  const response=await fetch(new URL('/'+path,base));
  assert.equal(response.status,200,path);
  assert.match(response.headers.get('content-type')||'',type,path);
  discovered[path]=await response.text();
}
assert.match(discovered['robots.txt'],/^Sitemap:\s*https:\/\/zoobluff\.com\/sitemap\.xml\s*$/m);
assert(!/^Disallow:\s*\/\s*$/m.test(discovered['robots.txt']));
const published=JSON.parse(await readFile('assets/voices/published.json','utf8'));
const voices=await (await fetch(new URL(release+'assets/voices/available.json',base))).json();
assert.deepEqual(voices,published,'All approved creator voices must survive deployment');

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  // Verify actual served HTML is readable without running the Canvas game.
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(base);
  assert.equal(await page.title(),'זובלוף — משחק תעלומות ודיבוב בעברית');
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),canonical);
  assert.match(await page.locator('meta[name=description]').getAttribute('content'),/זובלוף.*בעברית/);
  assert(!/noindex/i.test(await page.locator('meta[name=robots]').getAttribute('content')));
  assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute('content'),'זובלוף');
  const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.equal(schema['@type'],'WebSite');assert.equal(schema.name,'זובלוף');assert.equal(schema.url,canonical);
  assert(await page.locator('.about-game').isVisible());
  assert.match(await page.locator('.about-game').innerText(),/ללא התקנה/);
  const urls=await page.evaluate(xml=>{
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('Invalid sitemap XML');
    return Array.from(doc.querySelectorAll('loc'),e=>e.textContent);
  },discovered['sitemap.xml']);
  assert.deepEqual(urls,[canonical]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
  const interactive=await browser.newPage({viewport:{width:390,height:844}}),errors=[],providerWarnings=[];
  interactive.on('pageerror',e=>errors.push(e.message));
  interactive.on('console',m=>{
    if(m.type()!=='error')return;
    const message=m.text();
    // Report the provider's optional injected analytics separately; keep the site's CSP intact.
    if(message.includes("Loading the script 'https://static.cloudflareinsights.com/beacon.min.js/")&&message.includes('violates the following Content Security Policy directive'))providerWarnings.push(message);
    else errors.push(message);
  });
  await interactive.goto(base);
  await interactive.locator('#start').click();
  await interactive.locator('#creator-start').click();
  await interactive.locator('#skip-intro').click();
  assert(await interactive.locator('.about-game').isVisible());
  await interactive.locator('.about-game').scrollIntoViewIfNeeded();
  await interactive.screenshot({path:'.cache/seo-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({base,canonical,crawlableWithoutJavaScript:true,sitemapUrls:urls,creatorRecordings:Object.keys(voices).length,mobileFits:true,errors,providerWarnings,status:'passed'},null,2));
}finally{await browser.close();}
