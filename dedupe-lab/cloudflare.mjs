import worker from './worker/index.js';

export function databaseBucket(db){
 return {
  async get(key){const row=await db.prepare('SELECT value FROM vault WHERE key = ?').bind(key).first();return row?{text:async()=>row.value,json:async()=>JSON.parse(row.value)}:null},
  async put(key,value,options){
   if(options?.onlyIf?.etagDoesNotMatch==='*'){
    const r=await db.prepare('INSERT OR IGNORE INTO vault (key,value) VALUES (?,?)').bind(key,value).run();return r.meta.changes?{}:null;
   }
   await db.prepare('INSERT INTO vault (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run();return {};
  },
  async delete(key){await db.prepare('DELETE FROM vault WHERE key = ?').bind(key).run()}
 };
}
export default {fetch(request,env,ctx){return worker.fetch(request,{...env,BUCKET:databaseBucket(env.DB)},ctx)}};
