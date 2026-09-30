import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
const config=JSON.parse(await readFile('.cache/voice-onset-review.json','utf8')),root=await realpath(config.directory),allowedRoot=resolve('audio-review');
if(!root.startsWith(allowedRoot+sep))throw Error('Review must be inside audio-review');
const report=JSON.parse(await readFile(join(root,'review.json'),'utf8')),allowed=new Set(['index.html','review.json','onset-analysis.json',...report.entries.flatMap(e=>[e.original,e.copy])]);
http.createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method))throw Error('Read only');
 if(!['127.0.0.1:4177','localhost:4177'].includes(req.headers.host))throw Error('Local only');
 const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1)||'index.html';if(!allowed.has(relative))throw Error('Private file');
 const data=await readFile(join(root,relative)),type=relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.json')?'application/json':'audio/wav';
 res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(4177,'127.0.0.1',()=>console.log('Voice comparison: http://127.0.0.1:4177/'));
