export async function readJson(request,limit=4096){
 if(!request.headers.get('Content-Type')?.startsWith('application/json')||Number(request.headers.get('Content-Length'))>limit)throw Error('Invalid body');
 const reader=request.body?.getReader();if(!reader)return {};
 const chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('Body too large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid body');return body;
}
