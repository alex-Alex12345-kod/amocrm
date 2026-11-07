import http from 'node:http';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import worker from './worker/index.js';

// Alternate deployment for a VPS with HTTPS. No dependencies or Cloudflare APIs.
export function fileBucket(directory){
 const root=resolve(directory);
 const path=key=>{if(!/^[A-Za-z0-9_/-]+$/.test(key)||key.includes('..'))throw Error('Invalid object key');return resolve(root,key+'.json')};
 return {
  async get(key){try{const data=await readFile(path(key),'utf8');return {text:async()=>data,json:async()=>JSON.parse(data)}}catch(e){if(e.code==='ENOENT')return null;throw e}},
  async put(key,value,options){const target=path(key);await mkdir(resolve(target,'..'),{recursive:true,mode:0o700});
   if(options?.onlyIf?.etagDoesNotMatch==='*'){try{await writeFile(target,value,{flag:'wx',mode:0o600});return {}}catch(e){if(e.code==='EEXIST')return null;throw e}}
   const temp=target+'.'+randomUUID()+'.tmp';await writeFile(temp,value,{mode:0o600});await rename(temp,target);return {};
  },
  async delete(key){try{await unlink(path(key))}catch(e){if(e.code!=='ENOENT')throw e}}
 };
}
export function makeServer(env,origin){
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))throw Error('PUBLIC_ORIGIN must be an HTTPS origin');
 if(!env.LAB_SERVICE_KEY||!env.VAULT_KEY)throw Error('Set LAB_SERVICE_KEY and VAULT_KEY');
 return http.createServer(async(incoming,outgoing)=>{
  try{
   const parts=[];let size=0;for await(const part of incoming){size+=part.length;if(size>16384){outgoing.writeHead(413);outgoing.end('Request too large');return}parts.push(part)}
   const headers=new Headers();for(const [name,value]of Object.entries(incoming.headers)){
    // Only Sites dispatch may supply trusted ChatGPT identity headers.
    if(name.startsWith('oai-')||name==='host'||value===undefined)continue;
    headers.set(name,Array.isArray(value)?value.join(', '):value);
   }
   const url=new URL(incoming.url,origin);if(url.origin!==origin){outgoing.writeHead(400);outgoing.end('Invalid origin');return}
   const req=new Request(url,{method:incoming.method,headers,body:['GET','HEAD'].includes(incoming.method)?undefined:Buffer.concat(parts)});
   const response=await worker.fetch(req,env);
   const responseHeaders=Object.fromEntries(response.headers);
   if(response.headers.getSetCookie().length)responseHeaders['set-cookie']=response.headers.getSetCookie();
   outgoing.writeHead(response.status,responseHeaders);outgoing.end(Buffer.from(await response.arrayBuffer()));
  }catch{outgoing.writeHead(500,{'Content-Type':'application/json'});outgoing.end('{"error":"Internal error"}');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const env={...process.env,ALLOW_OWNER_BOOTSTRAP:'0',BUCKET:fileBucket(process.env.DATA_DIR||'./data')};
 makeServer(env,process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL).listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('FLOWBIT Dedupe Lab listening; OAuth/merge not yet verified'));
}
