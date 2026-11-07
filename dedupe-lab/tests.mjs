import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{normalizePhone,scan} from './worker/index.js';
const field=(code,value)=>({field_code:code,values:[{value}]});
const contact=(id,phone,email)=>({id,custom_fields_values:[field('PHONE',phone),field('EMAIL',email)]});
const lead=(id,pipeline_id,ids)=>({id,pipeline_id,_embedded:{contacts:ids.map(id=>({id}))}});
function bucket(){const data=new Map();return {async get(k){const v=data.get(k);return v===undefined?null:{text:async()=>v,json:async()=>JSON.parse(v)}},async put(k,v,opts){if(opts?.onlyIf&&data.has(k))return null;data.set(k,v);return {}},async delete(k){data.delete(k)}}}
const env=()=>({BUCKET:bucket(),VAULT_KEY:Buffer.alloc(32,42).toString('base64'),ALLOW_OWNER_BOOTSTRAP:'1',INSTALL_ENABLED:'1'});
const request=(path,uid='owner',options={})=>new Request('https://lab.example'+path,{...options,headers:{...(uid?{'oai-authenticated-user-id':uid}:{}),...options.headers}});
test('Phone formatting; 8/7, international prefix, ambiguity and extensions',()=>{
 assert.equal(normalizePhone('8 (999) 123-45-67'),'+79991234567');assert.equal(normalizePhone('79991234567'),'+79991234567');assert.equal(normalizePhone('00 44 20 7946 0123'),'+442079460123');
 for(const p of ['123','9991234567','+7 999 1234567 доб 1','','+12025550101#3'])assert.equal(normalizePhone(p),null);
});
test('Same identifier matches only contacts linked to selected pipeline',()=>{
 const c=[contact(1,'+12025550101','a@example.com'),contact(2,'+1 (202) 555-0101','b@example.com'),contact(3,'+12025550101','c@example.com')];
 const r=scan(c,[lead(11,7,[1]),lead(12,7,[2]),lead(13,8,[3])],7);assert.equal(r.contact_pairs.length,1);assert.deepEqual(r.contact_pairs[0].contact_ids,[1,2]);assert.deepEqual(r.contact_pairs[0].lead_ids,[11,12]);assert.equal(r.automatic_merge,false);
});
test('No transitive collapsing of A-phone-B-email-C',()=>{
 const r=scan([contact(1,'+12025550101','a@example.com'),contact(2,'+12025550101','b@example.com'),contact(3,'+12025550102','b@example.com')],[lead(11,7,[1]),lead(12,7,[2]),lead(13,7,[3])],7);
 assert.deepEqual(r.contact_pairs.map(p=>p.contact_ids),[[1,2],[2,3]]);
});
test('Duplicate values in one contact cannot duplicate pairs',()=>{
 const a=contact(1,'+12025550101','a@example.com');a.custom_fields_values.push(field('PHONE','+12025550101'));
 assert.equal(scan([a,contact(2,'+12025550101','b@example.com')],[lead(1,7,[1]),lead(2,7,[2])],7).contact_pairs.length,1);
});
test('One contact with two orders is flagged for review, never merged',()=>{
 const r=scan([contact(1,'+12025550101','a@example.com')],[lead(1,7,[1]),lead(2,7,[1])],7);assert.equal(r.contact_pairs.length,0);assert.equal(r.multiple_leads.length,1);
});
test('Instagram matching requires explicit field id',()=>{
 const c=[1,2].map(id=>({id,custom_fields_values:[{field_id:555,values:[{value:'12345'}]}]})),l=[lead(1,7,[1]),lead(2,7,[2])];assert.equal(scan(c,l,7).contact_pairs.length,0);assert.equal(scan(c,l,7,555).contact_pairs.length,1);
});
test('Owner-only access; initialization never grants access to second identity',async()=>{
 const e=env();assert.equal((await worker.fetch(request('/health',null),e)).status,401);assert.equal((await worker.fetch(request('/health'),e)).status,200);assert.equal((await worker.fetch(request('/health','other'),e)).status,403);
});
test('Callback rejects invalid state and foreign account before token request',async()=>{
 const e=env();assert.equal((await worker.fetch(request('/oauth/return?state=x'),e)).status,403);
 const start=await worker.fetch(request('/begin'),e);const html=await start.text(),s=html.match(/data-state="([^"]+)"/)[1];assert.equal(s.length,43);const cookie=start.headers.get('set-cookie').split(';')[0];
 const sent=await worker.fetch(request('/oauth/secrets',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:s,client_id:'test-client',client_secret:'only-test-placeholder-value'})}),e);assert.equal(sent.status,200);
 const again=await worker.fetch(request('/oauth/secrets',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:s,client_id:'test-client',client_secret:'only-test-placeholder-value'})}),e);assert.equal(again.status,403);
 const wrong=await worker.fetch(request('/oauth/return?state='+s+'&referer=other.amocrm.ru&code=test','owner',{headers:{Cookie:cookie}}),e);assert.equal(wrong.status,403);
 const secret=await e.BUCKET.get('pending/'+s);assert.ok(!(await secret.text()).includes('only-test-placeholder-value'));
});
test('No account connection returns honest error, not synthetic CRM results',async()=>{
 const e=env();const r=await worker.fetch(request('/api/scan?pipeline_id=7'),e);assert.equal(r.status,409);assert.match((await r.json()).error,/не подключен/);
});

test('OAuth success creates an authenticated HttpOnly session; tampering is rejected',async()=>{
 const e=env();const begin=await worker.fetch(request('/begin'),e);const state=(await begin.text()).match(/data-state="([^"]+)"/)[1];
 const cookie=begin.headers.get('set-cookie').split(';')[0];
 const posted=await worker.fetch(request('/oauth/secrets',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,client_id:'synthetic-client',client_secret:'synthetic-secret-value'})}),e);assert.equal(posted.status,200);
 const realFetch=globalThis.fetch;
 try{
  globalThis.fetch=async url=>{assert.equal(url,'https://glxxb2xd21.amocrm.ru/oauth2/access_token');return Response.json({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_in:3600})};
  const r=await worker.fetch(request('/oauth/return?state='+state+'&referer=glxxb2xd21.amocrm.ru&code=synthetic',null,{headers:{Cookie:cookie}}),e);
  assert.equal(r.status,303);const cookies=r.headers.getSetCookie();assert.equal(cookies.length,2);
  const session=cookies.find(c=>c.startsWith('fb_session='));assert.match(session,/HttpOnly/);assert.match(session,/Secure/);assert.match(session,/SameSite=Lax/);
  const valid=await worker.fetch(request('/health',null,{headers:{Cookie:session.split(';')[0]}}),e);assert.equal(valid.status,200);assert.equal((await valid.json()).crm_connected,true);
  const invalid=await worker.fetch(request('/health',null,{headers:{Cookie:'fb_session='+('x'.repeat(43))}}),e);assert.equal(invalid.status,401);
 }finally{globalThis.fetch=realFetch}
});
