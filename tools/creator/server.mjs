import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CreatorLibrary,StudioError,compatible,publicMapping} from './storage.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const run=promisify(execFile);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.webm':'audio/webm','.wav':'audio/wav','.webp':'image/webp'};
// Reload the catalogue in a fresh module graph whenever source content changes.
export function liveCatalogue(root=project){
 let previous='',value,pending;
 return async()=>{
  if(pending)return pending;
  pending=(async()=>{
   const files=(await readdir(path.join(root,'src'))).filter(f=>f.endsWith('.js')).sort();
   const hash=createHash('sha256');for(const file of files)hash.update(await readFile(path.join(root,'src',file)));
   const signature=hash.digest('hex');
   if(signature!==previous){const {stdout}=await run(process.execPath,[path.join(root,'tools/creator/catalogue.mjs'),'--json'],{cwd:root,maxBuffer:2*1024*1024,windowsHide:true});value=JSON.parse(stdout);previous=signature;}
   return value;
  })();try{return await pending;}finally{pending=null;}
 };
}
const reject=(status,message)=>{throw new StudioError(status,message);};
async function body(req,limit){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>limit)reject(413,'ההקלטה גדולה מדי. הקליטו עד שלוש דקות למשפט.');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
export async function startCreatorServer({root=project,voiceRoot=path.join(root,'assets/voices'),port=4175,catalogue=liveCatalogue(root),beforeCommit}={}){
 const library=new CreatorLibrary({voiceRoot,catalogue,beforeCommit}),token=randomBytes(32).toString('hex');
 let origin;
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Referrer-Policy','same-origin');
  const send=(value,status=200,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
  try{
   if(req.headers.host!==new URL(origin).host)reject(403,'כתובת השירות אינה תקינה.');
   if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==origin))reject(403,'הבקשה אינה מהאולפן המקומי.');
   const requestUrl=new URL(req.url,origin),pathname=requestUrl.pathname;
   if(req.method==='POST'){
    if(req.headers.origin!==origin||req.headers['x-creator-token']!==token)reject(403,'החיבור לאולפן התחדש. רעננו ונסו שוב; הטייק נשאר בדפדפן.');
    if(pathname==='/creator/api/progress'){
     const value=JSON.parse((await body(req,8192)).toString('utf8'));return send({progress:await library.saveProgress(value)});
    }
    if(pathname==='/creator/api/takes'){
     if(!req.headers['content-type']?.startsWith('multipart/form-data;'))reject(415,'נדרש קובץ הקלטה.');
     const bytes=await body(req,34*1024*1024),form=await new Request(origin,{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:bytes}).formData();
     const metadata=form.get('metadata'),playback=form.get('playback'),source=form.get('source');
     if(typeof metadata!=='string'||metadata.length>12000||!playback?.arrayBuffer||!source?.arrayBuffer)reject(400,'חסרים פרטי הטייק או קובצי הקול.');
     const entry=await library.save(JSON.parse(metadata),{type:playback.type,bytes:Buffer.from(await playback.arrayBuffer())},{type:source.type,bytes:Buffer.from(await source.arrayBuffer())});
     return send({entry,saved:true});
    }
    reject(404,'הנתיב אינו קיים.');
   }
   if(req.method!=='GET'&&req.method!=='HEAD')reject(405,'הפעולה אינה נתמכת.');
   if(pathname==='/creator/api/catalogue'){
    const c=await catalogue(),state=await library.state();
    return send({...c,token,progress:state.progress,lines:c.lines.map(line=>{const entry=state.entries[line.id];return {...line,status:entry?compatible(entry,line)?'recorded':'stale':'missing',entry:entry?{takeId:entry.takeId,duration:entry.duration,savedAt:entry.savedAt,scriptVersion:entry.scriptVersion,recordedText:entry.recordedText,processing:entry.processing}:null};})});
   }
   if(pathname.startsWith('/creator/api/audio/')){
    const id=decodeURIComponent(pathname.slice('/creator/api/audio/'.length));if(!(await catalogue()).lines.some(l=>l.id===id))reject(404,'המשפט אינו קיים.');
    const {entry,bytes}=await library.playback(id);return send(bytes,200,entry.mimeType);
   }
   if(pathname.startsWith('/creator/api/source/')){
    const id=decodeURIComponent(pathname.slice('/creator/api/source/'.length));if(!(await catalogue()).lines.some(l=>l.id===id))reject(404,'המשפט אינו קיים.');
    const {entry,bytes}=await library.source(id,requestUrl.searchParams.get('take'));return send(bytes,200,entry.sourceMimeType);
   }
   const mapping=async()=>publicMapping(await library.state(),(await catalogue()).lines);
   if(pathname==='/assets/voices/available.json')return send(await mapping());
   let file;
   if(pathname==='/'||pathname==='/index.html')file=path.join(root,'index.html');
   else if(pathname==='/creator'||pathname==='/creator/')file=path.join(root,'tools/creator/client/index.html');
   else if(/^\/creator\/[a-z-]+\.(js|css)$/.test(pathname))file=path.join(root,'tools/creator/client',path.basename(pathname));
   else if(/^\/src\/[a-z0-9-]+\.(js|css)$/.test(pathname)||/^\/assets\/art\/[a-z0-9-]+\.webp$/.test(pathname)||pathname==='/assets/icon.svg')file=path.join(root,pathname.slice(1));
   else if(Object.values(await mapping()).some(e=>'/'+e.file===pathname))file=path.join(voiceRoot,pathname.slice('/assets/voices/'.length));
   else if(['/assets/voices/manifest.json','/assets/voices/recording-cases.json'].includes(pathname))file=path.join(root,pathname.slice(1));
   else reject(404,'הנתיב אינו קיים.');
   const bytes=await readFile(file);send(req.method==='HEAD'?Buffer.alloc(0):bytes,200,mime[path.extname(file)]||'application/octet-stream');
  }catch(error){
   if(res.headersSent){res.end();return;}
   const status=error.status||(error.code==='ENOENT'?404:error instanceof SyntaxError?400:500);
   send({error:error.status?error.message:status===404?'הקובץ אינו קיים.':status===400?'פרטי הבקשה אינם תקינים.':'השמירה או הקריאה נכשלה. הטייק הקודם נשמר. אפשר לנסות שוב.'},status);
  }
 });
 server.requestTimeout=30000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 return {server,library,origin,close:()=>new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeIdleConnections();})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await startCreatorServer();console.log(`Creator studio: ${app.origin}/creator/`);
}
