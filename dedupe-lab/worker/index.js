const ACCOUNT='glxxb2xd21.amocrm.ru';
const enc=new TextEncoder();
const b64=v=>btoa(String.fromCharCode(...new Uint8Array(v)));
const nonce=()=>b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{...H,'Content-Type':'application/json; charset=utf-8'}});
const err=(message,status=400)=>Object.assign(new Error(message),{status});
async function vaultKey(env){if(!env.VAULT_KEY)throw err('Не настроено шифрование',503);return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.VAULT_KEY),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);}
async function write(env,path,value){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await vaultKey(env),enc.encode(JSON.stringify(value)));await env.BUCKET.put(path,JSON.stringify({iv:b64(iv),data:b64(data)}));}
async function read(env,path){const o=await env.BUCKET.get(path);if(!o)return null;const v=await o.json();return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(v.iv),c=>c.charCodeAt(0))},await vaultKey(env),Uint8Array.from(atob(v.data),c=>c.charCodeAt(0)))));}
async function admin(req,env){
 if(env.LAB_SERVICE_KEY && req.headers.get('authorization')==='Bearer '+env.LAB_SERVICE_KEY)return;
 const uid=req.headers.get('oai-authenticated-user-id');if(!uid)throw err('Войдите в ChatGPT для доступа к стенду',401);
 let owner=await env.BUCKET.get('owner');
 if(!owner&&env.ALLOW_OWNER_BOOTSTRAP==='1'){await env.BUCKET.put('owner',uid,{onlyIf:{etagDoesNotMatch:'*'}});owner=await env.BUCKET.get('owner');}
 if(!owner||await owner.text()!==uid)throw err('Доступ разрешен только владельцу',403);
}
async function requestBody(req){if(Number(req.headers.get('content-length')||0)>16384)throw err('Большой запрос',413);const s=await req.text();if(s.length>16384)throw err('Большой запрос',413);return req.headers.get('content-type')?.includes('json')?JSON.parse(s):Object.fromEntries(new URLSearchParams(s));}
async function exchange(env,credentials,grant,payload){
 const r=await fetch('https://'+ACCOUNT+'/oauth2/access_token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:credentials.client_id,client_secret:credentials.client_secret,grant_type:grant,...payload})});
 if(!r.ok)throw err('Получение токена amoCRM: HTTP '+r.status,502);const t=await r.json();if(!t.access_token||!t.refresh_token)throw err('Неполный ответ OAuth',502);
 return {...credentials,...t,expires_at:Date.now()+t.expires_in*1000};
}
async function api(env,path){
 if(!path.startsWith('/api/v4/'))throw err('Разрешены только методы API v4',403);
 let c=await read(env,'connection');if(!c)throw err('Тестовый аккаунт еще не подключен',409);
 if(c.expires_at<Date.now()+60000){c=await exchange(env,c,'refresh_token',{refresh_token:c.refresh_token,redirect_uri:c.redirect_uri});await write(env,'connection',c);}
 const r=await fetch('https://'+ACCOUNT+path,{redirect:'error',headers:{Authorization:'Bearer '+c.access_token}});if(!r.ok)throw err('API amoCRM: HTTP '+r.status,502);return r.status===204?{}:r.json();
}
async function list(env,type,query=''){
 const items=[];for(let page=1;page<=20;page++){
  const r=await api(env,'/api/v4/'+type+'?limit=250&page='+page+query);const batch=r._embedded?.[type]||[];items.push(...batch);
  if(batch.length<250||!r._links?.next)return items;
  await new Promise(resolve=>setTimeout(resolve,200));
 }throw err('Лимит 5000 записей: неполный анализ запрещен',422);
}
export function normalizePhone(v){
 let s=String(v||'').trim();if(!s||/(?:ext|доб|[a-zа-я#])/i.test(s))return null;s=s.replace(/[\s().-]/g,'');if(s.startsWith('00'))s='+'+s.slice(2);
 if(/^8\d{10}$/.test(s))s='+7'+s.slice(1);else if(/^7\d{10}$/.test(s))s='+'+s;
 return /^\+[1-9]\d{7,14}$/.test(s)?s:null;
}
function keys(c,instagram){const result=new Set();for(const f of c.custom_fields_values||[])for(const v of f.values||[]){
 if(f.field_code==='PHONE'){const p=normalizePhone(v.value);if(p)result.add('phone:'+p);}
 if(f.field_code==='EMAIL'){const e=String(v.value||'').trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))result.add('email:'+e);}
 if(instagram&&f.field_id===instagram){const id=String(v.value||'').trim();if(id)result.add('instagram_id:'+id);}
 }return [...result];}
export function scan(contacts,leads,pipeline,instagram=0){
 const selected=leads.filter(l=>l.pipeline_id===pipeline),scope=new Map(),index=new Map(),pairs=new Map();
 for(const l of selected)for(const c of l._embedded?.contacts||[])scope.set(c.id,[...(scope.get(c.id)||[]),l.id]);
 for(const c of contacts){if(!scope.has(c.id))continue;for(const k of keys(c,instagram)){if(!index.has(k))index.set(k,[]);index.get(k).push(c.id);}}
 for(const [k,ids]of index)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const sorted=[ids[i],ids[j]].sort((a,b)=>a-b),id=sorted.join(':');
  if(!pairs.has(id))pairs.set(id,{contact_ids:sorted,reasons:[],lead_ids:[...new Set(sorted.flatMap(c=>scope.get(c)||[]))],action:'review_only'});pairs.get(id).reasons.push(k);
 }
 return {pipeline_id:pipeline,scanned_leads:selected.length,scanned_contacts:scope.size,contact_pairs:[...pairs.values()],multiple_leads:[...scope].filter(([,l])=>l.length>1).map(([contact_id,lead_ids])=>({contact_id,lead_ids,action:'review_only'})),automatic_merge:false,warning:'Один клиент может иметь разные заказы. Объединение через внешнюю интеграцию еще не проверено'};
}
function page(content){return new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FLOWBIT · Антидубли</title><style>*{box-sizing:border-box}body{margin:0;background:#101413;color:#eef1ef;font:16px/1.65 system-ui}main{max-width:960px;margin:50px auto;padding:0 24px}header{display:flex;justify-content:space-between;gap:20px;padding-bottom:24px;border-bottom:1px solid #344038}.brand{color:#d4b577;letter-spacing:.18em}h1{font-size:40px;line-height:1.2}section{padding:24px;margin:24px 0;background:#19211d;border:1px solid #344038;border-radius:16px}p{color:#b4bfb8}button,a.button{background:#d4b577;color:#101413;padding:12px 18px;border:0;border-radius:8px;font:600 15px system-ui;cursor:pointer;text-decoration:none;display:inline-block}button:disabled{opacity:.4}a{color:#d4b577}label{display:block;margin:12px 0}input,select{max-width:100%;padding:10px;background:#101413;color:white;border:1px solid #59655e;border-radius:6px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.badge{color:#d4b577}@media(max-width:600px){h1{font-size:28px}header{display:block}main{margin-top:24px}}</style><main><header><b class="brand">FLOWBIT</b><span class="badge">Тестовый стенд · внешняя интеграция</span></header>${content}</main></html>`,{headers:{...H,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://www.amocrm.ru; style-src 'unsafe-inline'; img-src 'self' data: https://www.amocrm.ru; frame-src https://www.amocrm.ru https://*.amocrm.ru; connect-src 'self' https://www.amocrm.ru; base-uri 'none'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com"}});}
export default {async fetch(req,env){try{
 const u=new URL(req.url),path=u.pathname;
 if(path==='/ready'&&req.method==='GET')return json({service:'flowbit-dedupe-lab',status:'running'});
 if(path==='/logo.png')return new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});
 if(path==='/oauth/secrets'){
  if(req.method!=='POST')return json({error:'POST required'},405);const d=await requestBody(req);if(!/^[A-Za-z0-9_-]{43}$/.test(d.state||''))throw err('Invalid state',403);
  const p=await read(env,'pending/'+d.state);if(!p||p.expires<Date.now()||p.client_id)throw err('State expired or already used',403);
  if(typeof d.client_id!=='string'||typeof d.client_secret!=='string'||d.client_secret.length<16)throw err('Invalid credentials');
  await write(env,'pending/'+d.state,{...p,client_id:d.client_id,client_secret:d.client_secret});return json({ok:true});
 }
 if(path==='/oauth/return'){
  const s=u.searchParams.get('state'),cookie=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('fb_state='))?.slice(9);
  if(!s||s!==cookie||!/^[A-Za-z0-9_-]{43}$/.test(s))throw err('OAuth state mismatch',403);
  const p=await read(env,'pending/'+s);if(!p||p.expires<Date.now()||!p.client_id)throw err('Не получен вебхук с ключами интеграции',409);
  if(u.searchParams.get('error'))throw err('Доступ не предоставлен',403);
  if(u.searchParams.get('referer')!==ACCOUNT)throw err('Выберите только тестовый аккаунт '+ACCOUNT,403);
  if(u.searchParams.has('client_id')&&u.searchParams.get('client_id')!==p.client_id)throw err('Client ID mismatch',403);
  const code=u.searchParams.get('code');if(!code)throw err('Нет кода авторизации');
  const c=await exchange(env,p,'authorization_code',{code,redirect_uri:p.redirect_uri});await write(env,'connection',c);await env.BUCKET.delete('pending/'+s);
  return new Response(null,{status:303,headers:{...H,Location:'/', 'Set-Cookie':'fb_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}});
 }
 if(!['/','/begin'].includes(path))await admin(req,env);
 if(req.method!=='GET')throw err('Method not allowed',405);
 if(path==='/health')return json({service:'flowbit-dedupe-lab',crm_connected:!!await read(env,'connection'),merge_tested:false});
 if(path==='/begin'){
  if(env.INSTALL_ENABLED!=='1')throw err('Подключение еще не открыто',403);
  if(await read(env,'connection'))throw err('Аккаунт уже подключен; повторная установка отключена',409);
  const s=nonce(),redirect=u.origin+'/oauth/return';await write(env,'pending/'+s,{expires:Date.now()+900000,redirect_uri:redirect});
  const r=page(`<h1>Подключить тестовый аккаунт</h1><p>Выберите только <strong>${ACCOUNT}</strong>. Интеграция запросит доступ к данным CRM. Изменение и объединение карточек в стенде пока отключены</p><section><script class="amocrm_oauth" charset="utf-8" data-name="FLOWBIT Dedupe Lab" data-description="Проверка поиска дублей на отдельном тестовом аккаунте" data-redirect_uri="${esc(redirect)}" data-secrets_uri="${esc(u.origin+'/oauth/secrets')}" data-logo="${esc(u.origin+'/logo.png')}" data-scopes="crm" data-title="Выбрать тестовый аккаунт amoCRM" data-state="${s}" data-mode="popup" src="https://www.amocrm.ru/auth/button.min.js"></script></section><a href="/">Вернуться на стенд</a>`);
  r.headers.set('Set-Cookie',`fb_state=${s}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`);return r;
 }
 if(path==='/api/pipelines')return json(await api(env,'/api/v4/leads/pipelines'));
 if(path==='/api/scan'){
  const p=Number(u.searchParams.get('pipeline_id')),i=Number(u.searchParams.get('instagram_field_id')||0);if(!Number.isSafeInteger(p)||p<=0||!Number.isSafeInteger(i)||i<0)throw err('Укажите корректные ID');
  const leads=await list(env,'leads','&with=contacts&filter[pipeline_id]='+p);await new Promise(r=>setTimeout(r,200));const contacts=await list(env,'contacts');return json(scan(contacts,leads,p,i));
 }
 if(path==='/'){
  const connected=!!await read(env,'connection');return page(`<h1>Контроль дублей amoCRM</h1><p>Проверка поиска совпадений и возможности объединения на отдельном аккаунте</p><section><strong>Аккаунт:</strong> ${ACCOUNT}<br><strong>OAuth:</strong> ${connected?'подключен':'не подключен'}<br><strong>Объединение:</strong> не проверено, автоматические изменения отключены</section><section><h2>1. Подключение</h2><p>Официальная внешняя интеграция. Приватный виджет не создается</p>${env.INSTALL_ENABLED==='1'?'<a class="button" href="/begin">Подключить тестовый аккаунт</a>':'<strong>OAuth не подключен: серверные запросы к текущему хостингу получают 403. Нужен приемник на другом размещении</strong>'}<p>Для серверного вебхука OAuth нужны публично доступные адреса. Доступ к API защищен серверным ключом</p></section><section><h2>2. Поиск совпадений</h2><label>Воронка <select id="pipeline"><option value="">Сначала подключите аккаунт</option></select></label><label>ID поля Instagram <input id="instagram" inputmode="numeric" placeholder="Необязательно"></label><button id="scan" disabled>Проверить воронку</button><p>Телефон, email и точное значение заданного поля. Результат — отчет без изменения карточек</p></section><section><h2>Результаты</h2><pre id="result">Проверка в реальном API еще не запускалась</pre></section><script>const result=document.getElementById('result');async function load(){try{const r=await fetch('/api/pipelines'),d=await r.json();if(!r.ok)throw Error(d.error);const s=document.getElementById('pipeline');s.replaceChildren();for(const p of d._embedded?.pipelines||[]){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;s.append(o)}document.getElementById('scan').disabled=!s.options.length}catch(e){result.textContent=e.message}}document.getElementById('scan').onclick=async()=>{const b=document.getElementById('scan');b.disabled=true;result.textContent='Проверяю данные…';try{const q=new URLSearchParams({pipeline_id:document.getElementById('pipeline').value,instagram_field_id:document.getElementById('instagram').value});const r=await fetch('/api/scan?'+q),d=await r.json();result.textContent=JSON.stringify(d,null,2)}catch(e){result.textContent=e.message}finally{b.disabled=false}};${connected?'load();':''}</script>`);
 }
 return json({error:'Not found'},404);
}catch(e){return json({error:e.status?e.message:'Внутренняя ошибка; секреты не выводятся в ответ'},e.status||500);}}};
