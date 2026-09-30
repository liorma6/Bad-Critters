import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const folder=resolve('docs/dialogue-review');
await mkdir(`${folder}/round-2-checks`,{recursive:true});
const source=JSON.parse(await readFile(`${folder}/round-2-review-source.json`,'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1250},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(`${folder}/Neighborhood-Animals-Dialogue-Changes-Review-Round-2.html`).href);
 await page.emulateMedia({media:'print'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
 const check=await page.evaluate(()=>({
  pages:document.querySelectorAll('.sheet').length,
  lines:[...document.querySelectorAll('[data-line-id]')].map(el=>({id:el.dataset.lineId,text:el.querySelector('.line-text').textContent})),
  overflow:[...document.querySelectorAll('.sheet')].flatMap((sheet,index)=>{
   const footer=sheet.querySelector('.footer').getBoundingClientRect();
   const content=[...sheet.children].filter(el=>!el.classList.contains('footer'));
   const lastBottom=Math.max(...content.map(el=>el.getBoundingClientRect().bottom));
   return lastBottom>footer.top-5?[{page:index+1,overlapPx:lastBottom-footer.top}]:[];
  }),
  imageCount:document.images.length,
  imagesComplete:[...document.images].every(img=>img.complete&&img.naturalWidth>0),
 }));
 const expected=source.characters.flatMap(c=>c.sections.flatMap(c=>c.lines.map(l=>({id:l.id,text:l.text}))));
 assert.deepEqual(check.lines,expected);assert.equal(check.pages,8);assert.deepEqual(check.overflow,[]);assert(check.imagesComplete);assert.deepEqual(errors,[]);
 const pdf=await page.pdf({path:`${folder}/Neighborhood-Animals-Dialogue-Changes-Review-Round-2.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true,tagged:true,outline:true});
 const counts=[...pdf.toString('latin1').matchAll(/\/Type\s*\/Pages\s*[\s\S]*?\/Count\s+(\d+)/g)].map(m=>Number(m[1]));
 const pdfPages=Math.max(...counts);assert.equal(pdfPages,8);
 for(const [index,label]of [[0,'cover'],[1,'goat'],[2,'pigeon'],[3,'snake-common'],[4,'snake-cases'],[5,'boar'],[6,'turtle'],[7,'badger']])await page.locator('.sheet').nth(index).screenshot({path:`${folder}/round-2-checks/${label}.png`});
 const report=JSON.parse(await readFile(`${folder}/round-2-document-checks.json`,'utf8'));
 Object.assign(report,{pdfPages,htmlPageOverflow:check.overflow.length,allImagesLoaded:check.imagesComplete,exactHtmlDialogue:true,pdfBytes:pdf.length,consoleErrors:errors.length});
 report.files=['Neighborhood-Animals-Dialogue-Changes-Review-Round-2.docx','Neighborhood-Animals-Dialogue-Changes-Review-Round-2.html','Neighborhood-Animals-Dialogue-Changes-Review-Round-2.pdf'];
 await writeFile(`${folder}/round-2-document-checks.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
