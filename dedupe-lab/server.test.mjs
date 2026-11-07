import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileBucket,makeServer} from './server.mjs';
test('Persistent storage supports encrypted worker records and exclusive create',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dedupe-'));try{
  const b=fileBucket(dir);await b.put('pending/test','one',{onlyIf:{etagDoesNotMatch:'*'}});await b.put('pending/test','two',{onlyIf:{etagDoesNotMatch:'*'}});
  assert.equal(await(await b.get('pending/test')).text(),'one');await b.put('pending/test','three');assert.equal(await(await fileBucket(dir).get('pending/test')).text(),'three');
  await b.delete('pending/test');assert.equal(await b.get('pending/test'),null);await assert.rejects(b.get('../bad'));
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('HTTP adapter protects API and strips forged platform identity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dedupe-http-'));
 const env={BUCKET:fileBucket(dir),VAULT_KEY:Buffer.alloc(32,42).toString('base64'),LAB_SERVICE_KEY:'test-only-local-service-key',ALLOW_OWNER_BOOTSTRAP:'0',INSTALL_ENABLED:'1'};
 const s=makeServer(env,'https://lab.example');await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
 try{
  assert.equal((await fetch(url+'/health')).status,401);
  const auth={Authorization:'Bearer '+env.LAB_SERVICE_KEY};const r=await fetch(url+'/health',{headers:auth});assert.equal(r.status,200);assert.equal((await r.json()).crm_connected,false);
  await env.BUCKET.put('owner','forged');assert.equal((await fetch(url+'/health',{headers:{'oai-authenticated-user-id':'forged'}})).status,401);
  const begin=await fetch(url+'/begin');assert.equal(begin.status,200);assert.match(begin.headers.get('set-cookie'),/HttpOnly/);assert.match(await begin.text(),/data-secrets_uri="https:\/\/lab.example\/oauth\/secrets"/);
 }finally{s.closeAllConnections();await new Promise(r=>s.close(r));await rm(dir,{recursive:true,force:true})}
});
