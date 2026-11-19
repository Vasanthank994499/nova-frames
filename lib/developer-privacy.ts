import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {isDeveloperEmail} from './auth';
// Developer accounts (NOVA_DEVELOPER_EMAILS) never appear to anyone: every JSON response and export is scrubbed here.
// Stored records keep the real actor (the internal audit trail); only what leaves the server is replaced.
export const DEVELOPER_LABEL='Nova Frames team';
const rows=(r:any)=>(r?.rows||[]) as any[];
export type DevIdentity={ids:Set<string>,emails:Set<string>,names:Set<string>};
export async function developerIdentity():Promise<DevIdentity|null>{
 if(!(process.env.NOVA_DEVELOPER_EMAILS||'').trim())return null;
 const all=rows(await getDb().execute(sql`SELECT id,name,email FROM workers`));
 const dev=all.filter(w=>isDeveloperEmail(w.email));if(!dev.length)return null;
 const others=new Set(all.filter(w=>!isDeveloperEmail(w.email)).map(w=>String(w.name).trim().toLowerCase()));
 // A bare name is only hidden when no other worker shares it, so real people are never masked by accident.
 return {ids:new Set(dev.map(w=>String(w.id))),emails:new Set(dev.map(w=>String(w.email).toLowerCase())),names:new Set(dev.map(w=>String(w.name).trim()).filter(n=>n&&!others.has(n.toLowerCase())))};
}
export function scrubDeveloper<T>(value:T,d:DevIdentity|null):T{
 if(!d)return value;
 const isDevStr=(s:string)=>d.ids.has(s)||d.emails.has(s.toLowerCase())||d.names.has(s.trim());
 const walk=(v:any):any=>{
  if(typeof v==='string')return isDevStr(v)?DEVELOPER_LABEL:v;
  if(Array.isArray(v))return v.map(walk);
  if(v&&typeof v==='object'){
   const linked=Object.values(v).some(x=>typeof x==='string'&&(d.ids.has(x)||d.emails.has(x.toLowerCase())));
   const out:any={};for(const [k,x] of Object.entries(v))out[k]=linked&&typeof x==='string'&&/name|by|email/i.test(k)?DEVELOPER_LABEL:walk(x);
   return out;
  }
  return v;
 };
 return walk(value);
}
// Wraps a route handler: JSON responses are scrubbed; other responses (files, redirects, HTML) pass through untouched.
export function developerPrivate<A extends any[]>(handler:(...a:A)=>Promise<Response>|Response){
 return async(...a:A)=>{
  const res=await handler(...a);
  if(!(res.headers.get('content-type')||'').includes('application/json'))return res;
  const d=await developerIdentity().catch(()=>null);if(!d)return res;
  const body=await res.clone().json().catch(()=>undefined);if(body===undefined)return res;
  const headers=new Headers(res.headers);headers.delete('content-length');
  return new Response(JSON.stringify(scrubDeveloper(body,d)),{status:res.status,statusText:res.statusText,headers});
 };
}
