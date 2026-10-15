import {getDb} from '../db';
import {sql} from 'drizzle-orm';
let ready:Promise<void>|undefined;
export function ensureAccessStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS access_events (id text PRIMARY KEY, worker_id text NOT NULL, day text NOT NULL, payload text NOT NULL)`)).then(()=>{}).catch(e=>{ready=undefined;throw e;});return ready;}
export function accessEvent(workerId:string,type:'login'|'logout',at=Date.now()){
 return {id:crypto.randomUUID(),workerId,type,at,day:new Date(at+19800000).toISOString().slice(0,10)};
}
