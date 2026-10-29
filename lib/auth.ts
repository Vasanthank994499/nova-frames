import {ensureAccessStorage,accessEvent} from './access-log';
import { getDb } from '../db';
import { workers, sessions, loginAttempts } from '../db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
export const ADMIN_EMAIL='novaframes02@gmail.com';
export const ROLES=['content','camera','editor','publisher','manager'] as const;
export type Role=typeof ROLES[number];
export function workerRoles(w:any):string[]{try{const stored=JSON.parse(w.permissions||'[]');const roles=Array.isArray(stored)?stored.filter(r=>ROLES.includes(r)):[];return roles.length?roles:[w.role];}catch{return [w.role];}}
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
let loginAttemptStorageReady:Promise<unknown>|undefined;
function ensureLoginAttemptStorage(){return loginAttemptStorageReady??=getDb().execute(sql`CREATE TABLE IF NOT EXISTS login_attempts (key text PRIMARY KEY, attempts integer NOT NULL, expires bigint NOT NULL)`).catch(error=>{loginAttemptStorageReady=undefined;throw error;});}
export async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));}
export async function hashPassword(password:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)).buffer)){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
 return `pbkdf2:100000:${salt}:${hash}`;
}
export async function checkPassword(password:string,stored:string){
 const [kind,iterations,salt,expected]=stored.split(':'); if(kind!=='pbkdf2'||iterations!=='100000'||!salt||!expected)return false;
 const actual=(await hashPassword(password,salt)).split(':')[3]; let difference=actual.length^expected.length;
 for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return difference===0;
}
export function requireOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw Error('Invalid request origin.');}
export function sessionCookie(token:string,req:Request,remove=false){const u=new URL(req.url);const secure= !['localhost','127.0.0.1','[::1]'].includes(u.hostname);return `nf_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remove?0:86400}${secure?'; Secure':''}`;}
export async function principal(req:Request){
 const token=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nf_session='))?.slice(11);
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Please sign in with your email and password.');
 const session=await getDb().select().from(sessions).where(eq(sessions.tokenHash,await digest(token))).then(rows=>rows[0]);
 if(!session||session.expires<=Date.now())throw Error('Your session expired. Please sign in again.');
 if(session.accountId==='admin')return {id:'admin',name:'Nova Frames Admin',email:ADMIN_EMAIL,roles:[...ROLES],role:'admin',admin:true,branchId:''};
 const w=await getDb().select().from(workers).where(eq(workers.id,session.accountId)).then(rows=>rows[0]);
 if(!w||!w.active||!ROLES.includes(w.role as Role))throw Error('This worker account is disabled. Contact your administrator.');
 return {id:w.id,name:w.name,email:w.email,roles:workerRoles(w),role:w.role,admin:false,branchId:w.branchId||''};
}
export async function login(req:Request,email:string,password:string){
 requireOrigin(req);const db=getDb(),now=Date.now();await ensureLoginAttemptStorage();
 const keys=[await digest('email:'+email),await digest('ip:'+(req.headers.get('x-vercel-forwarded-for')||req.headers.get('cf-connecting-ip')||'local'))];
 for(let i=0;i<keys.length;i++){const row=await db.select().from(loginAttempts).where(eq(loginAttempts.key,keys[i])).then(rows=>rows[0]);if(row&&row.expires>now&&row.attempts>=(i===0?8:40))throw Error('Too many login attempts. Try again in 15 minutes.');}
 const w=email===ADMIN_EMAIL?null:await db.select().from(workers).where(eq(workers.email,email)).then(rows=>rows[0]);
 const stored=email===ADMIN_EMAIL?process.env.NOVA_ADMIN_PASSWORD_HASH:w?.passwordHash;
 if(email===ADMIN_EMAIL&&!stored)throw Error('Administrator password setup is not configured yet.');
 const valid=await checkPassword(password,stored||'pbkdf2:100000:invalid-login-salt:0000000000000000000000000000000000000000000000000000000000000000');
 if(!valid||(email!==ADMIN_EMAIL&&(!w||!w.active))){for(const key of keys)await db.insert(loginAttempts).values({key,attempts:1,expires:now+900000}).onConflictDoUpdate({target:loginAttempts.key,set:{attempts:sql`CASE WHEN ${loginAttempts.expires} <= ${now} THEN 1 ELSE ${loginAttempts.attempts}+1 END`,expires:sql`CASE WHEN ${loginAttempts.expires} <= ${now} THEN ${now+900000} ELSE ${loginAttempts.expires} END`}});throw Error('Incorrect email or password.');}
 const token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer),tokenHash=await digest(token),accountId=email===ADMIN_EMAIL?'admin':w!.id;
 if(accountId==='admin')await db.insert(sessions).values({tokenHash,accountId,expires:now+86400000});
 else {await ensureAccessStorage();const event=accessEvent(accountId,'login',now);await db.execute(sql`WITH signed_in AS (INSERT INTO sessions (token_hash,account_id,expires) VALUES (${tokenHash},${accountId},${now+86400000}) RETURNING account_id) INSERT INTO access_events (id,worker_id,day,payload) SELECT ${event.id},account_id,${event.day},${JSON.stringify(event)} FROM signed_in`);}
 await db.delete(loginAttempts).where(eq(loginAttempts.key,keys[0]));await db.delete(loginAttempts).where(lt(loginAttempts.expires,now));await db.delete(sessions).where(lt(sessions.expires,now));return token;
}
