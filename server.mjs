import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {releaseCreatorFiles as creatorPublicFiles} from './tools/creator/release.mjs';
import {liveCatalogue} from './tools/creator/server.mjs';
const root=process.cwd(),port=Number(process.env.PORT||4173);
const catalogue=liveCatalogue(root);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'audio/mp4','.ogg':'audio/ogg','.webm':'audio/webm','.wav':'audio/wav','.png':'image/png','.webp':'image/webp'};
Object.assign(mime,{'.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'});
http.createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method))throw Error('Read-only preview');
 const url=new URL(req.url,'http://localhost'),requested=decodeURIComponent(url.pathname).replace(/^\/+/,''),relative=requested==='favicon.svg'?'assets/icon.svg':requested,file=path.resolve(root,relative||'index.html');
 if(relative==='assets/voices/available.json'){
  const mapping=await creatorPublicFiles(path.join(root,'assets/voices'),(await catalogue()).lines);
  const legacy=JSON.parse(await readFile(path.join(root,relative),'utf8'));for(const [id,entry] of Object.entries(legacy))if(!entry.file?.includes('/creator/'))mapping[id]??=entry;
  res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(mapping));return;
 }
 if(relative.startsWith('assets/voices/creator/')){
  const mapping=await creatorPublicFiles(path.join(root,'assets/voices'),(await catalogue()).lines);if(!Object.values(mapping).some(e=>e.file===relative))throw Error('Unpublished take');
 }else if(!/^(?:index\.html|robots\.txt|sitemap\.xml|src\/[a-z0-9-]+\.(?:js|css)|assets\/art\/[a-z0-9-]+\.webp|assets\/icon\.svg|assets\/voices\/[a-z0-9.-]+\.(?:json|mp3|m4a|ogg|webm|wav))$/.test(relative)&&relative!=='')throw Error('Private file');
 if(!file.startsWith(root+path.sep))throw Error('Outside project');const s=await stat(file);if(!s.isFile())throw Error('Not file');
 const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`זובלוף: http://127.0.0.1:${port}`));
