import {ensureAccessStorage,accessEvent} from './access-log';
import { getDb } from '../db';
import { workers, sessions, loginAttempts } from '../db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import {clientByEmail,CLIENT_PREFIX} from './clients';
export const ADMIN_EMAIL='novaframes02@gmail.com';
export const ROLES=['content','camera','editor','publisher','manager'] as const;
export type Role=typeof ROLES[number];
// Admin is granted per worker by an administrator (stored in permissions, like Manager). It is not a production role.
export const ADMIN_ROLE='admin';
export const GRANTABLE_ROLES:string[]=[...ROLES,ADMIN_ROLE];
export function hasAdminGrant(w:any){try{const p=JSON.parse(w.permissions||'[]');return Array.isArray(p)&&p.includes(ADMIN_ROLE);}catch{return false;}}
// Developer comes only from server configuration (NOVA_DEVELOPER_EMAILS). No UI or API can grant or revoke it.
export function isDeveloperEmail(email:unknown){const list=(process.env.NOVA_DEVELOPER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);return list.includes(String(email||'').trim().toLowerCase());}
export const PASSWORD_CHANGE_REQUIRED='Please set a new password to continue.';
let resetReady:Promise<void>|undefined;
function ensurePasswordResetStorage(){if(!resetReady)resetReady=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS password_change_required (account_id text PRIMARY KEY, created bigint NOT NULL)`)).then(()=>{}).catch((e:unknown)=>{resetReady=undefined;throw e;});return resetReady;}
async function mustChangePassword(id:string){await ensurePasswordResetStorage();return rows(await getDb().execute(sql`SELECT 1 FROM password_change_required WHERE account_id=${id}`)).length>0;}
const rows=(r:any)=>(r?.rows||[]) as any[];
export function workerRoles(w:any):string[]{try{const stored=JSON.parse(w.permissions||'[]');const roles=Array.isArray(stored)?stored.filter(r=>ROLES.includes(r)):[];return roles.length?roles:[w.role];}catch{return [w.role];}}
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
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
// Same-origin check for every write. Accepts only: the request's own origin; origins listed exactly in APP_ORIGINS
// (e.g. local dev at both http://localhost:3100 and http://127.0.0.1:3100, which Next dev reports as localhost);
// and, only when TRUST_PROXY_HEADERS=1, the origin rebuilt from X-Forwarded-Proto/Host. No wildcards, no "null".
export function allowedOrigins(req:Request){
 const own=new URL(req.url).origin,list=new Set([own]);
 for(const raw of (process.env.APP_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)){try{const u=new URL(raw);if(['http:','https:'].includes(u.protocol)&&u.origin===raw.replace(/\/$/,''))list.add(u.origin);}catch{}}
 if(process.env.TRUST_PROXY_HEADERS==='1'){const host=(req.headers.get('x-forwarded-host')||'').split(',')[0].trim(),proto=(req.headers.get('x-forwarded-proto')||'').split(',')[0].trim();if(host&&['http','https'].includes(proto)){try{list.add(new URL(`${proto}://${host}`).origin);}catch{}}}
 return list;
}
export function requireOrigin(req:Request){const o=req.headers.get('origin');if(!o||o==='null'||!allowedOrigins(req).has(o))throw Error('Invalid request origin.');}
export function sessionCookie(token:string,req:Request,remove=false){const u=new URL(req.url);const secure= !['localhost','127.0.0.1','[::1]'].includes(u.hostname);return `nf_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remove?0:86400}${secure?'; Secure':''}`;}
async function currentSession(req:Request){
 const token=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nf_session='))?.slice(11);
 if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Please sign in with your email and password.');
 const session=await getDb().select().from(sessions).where(eq(sessions.tokenHash,await digest(token))).then(rows=>rows[0]);
 if(!session||session.expires<=Date.now())throw Error('Your session expired. Please sign in again.');
 return session;
}
export async function principal(req:Request){
 const session=await currentSession(req);
 if(session.accountId.startsWith('client:'))throw Error('Client accounts can only open the client dashboard.');
 if(session.accountId==='admin')return {id:'admin',name:'Nova Frames Admin',email:ADMIN_EMAIL,roles:[...ROLES],role:'admin',admin:true,branchId:''};
 const w=await getDb().select().from(workers).where(eq(workers.id,session.accountId)).then(rows=>rows[0]);
 if(!w||!w.active||!ROLES.includes(w.role as Role))throw Error('This worker account is disabled. Contact your administrator.');
 if(await mustChangePassword(w.id))throw Error(PASSWORD_CHANGE_REQUIRED);
 const developer=isDeveloperEmail(w.email),admin=developer||hasAdminGrant(w);
 return {id:w.id,name:w.name,email:w.email,roles:admin?[...ROLES]:workerRoles(w),role:w.role,admin,developer,branchId:w.branchId||''};
}
// Signed-in worker sets a new password; clears the first-login requirement. Other sessions of the account are ended.
export async function changePassword(req:Request,current:string,next:string){
 requireOrigin(req);const session=await currentSession(req);if(session.accountId==='admin'||session.accountId.startsWith('client:'))throw Error('This account’s password is managed elsewhere.');
 const db=getDb(),w=await db.select().from(workers).where(eq(workers.id,session.accountId)).then(rows=>rows[0]);
 if(!w||!w.active||!w.passwordHash||!await checkPassword(current,w.passwordHash))throw Error('Your current password is incorrect.');
 if(next.length<10||next.length>256)throw Error('Choose a new password with at least 10 characters.');if(next===current)throw Error('Choose a password different from the current one.');
 await db.update(workers).set({passwordHash:await hashPassword(next)}).where(eq(workers.id,w.id));
 await ensurePasswordResetStorage();await db.execute(sql`DELETE FROM password_change_required WHERE account_id=${w.id}`);
 await db.execute(sql`DELETE FROM sessions WHERE account_id=${w.id} AND token_hash<>${session.tokenHash}`);
}
export async function login(req:Request,email:string,password:string){
 requireOrigin(req);const db=getDb(),now=Date.now();
 const keys=[await digest('email:'+email),await digest('ip:'+(req.headers.get('x-vercel-forwarded-for')||req.headers.get('cf-connecting-ip')||'local'))];
 for(let i=0;i<keys.length;i++){const row=await db.select().from(loginAttempts).where(eq(loginAttempts.key,keys[i])).then(rows=>rows[0]);if(row&&row.expires>now&&row.attempts>=(i===0?8:40))throw Error('Too many login attempts. Try again in 15 minutes.');}
 if(email!==ADMIN_EMAIL)await bootstrapDeveloper(email);
 const w=email===ADMIN_EMAIL?null:await db.select().from(workers).where(eq(workers.email,email)).then(rows=>rows[0]);
 const c=!w&&email!==ADMIN_EMAIL?await clientByEmail(email):null;
 const stored=email===ADMIN_EMAIL?process.env.NOVA_ADMIN_PASSWORD_HASH:w?w.passwordHash:c?.password_hash;
 if(email===ADMIN_EMAIL&&!stored)throw Error('Administrator password setup is not configured yet.');
 const valid=await checkPassword(password,stored||'pbkdf2:100000:invalid-login-salt:0000000000000000000000000000000000000000000000000000000000000000');
 if(!valid||(email!==ADMIN_EMAIL&&!(w?w.active:Number(c?.active)))){for(const key of keys)await db.insert(loginAttempts).values({key,attempts:1,expires:now+900000}).onConflictDoUpdate({target:loginAttempts.key,set:{attempts:sql`CASE WHEN ${loginAttempts.expires} <= ${now} THEN 1 ELSE ${loginAttempts.attempts}+1 END`,expires:sql`CASE WHEN ${loginAttempts.expires} <= ${now} THEN ${now+900000} ELSE ${loginAttempts.expires} END`}});throw Error('Incorrect email or password.');}
 const token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer),tokenHash=await digest(token),accountId=email===ADMIN_EMAIL?'admin':w?w.id:CLIENT_PREFIX+c.id;
 if(accountId==='admin'||!w)await db.insert(sessions).values({tokenHash,accountId,expires:now+86400000});
 else {await ensureAccessStorage();const event=accessEvent(accountId,'login',now);await db.execute(sql`WITH signed_in AS (INSERT INTO sessions (token_hash,account_id,expires) VALUES (${tokenHash},${accountId},${now+86400000}) RETURNING account_id) INSERT INTO access_events (id,worker_id,day,payload) SELECT ${event.id},account_id,${event.day},${JSON.stringify(event)} FROM signed_in`);}
 await db.delete(loginAttempts).where(eq(loginAttempts.key,keys[0]));await db.delete(loginAttempts).where(lt(loginAttempts.expires,now));await db.delete(sessions).where(lt(sessions.expires,now));return token;
}

// One-time: NOVA_DEVELOPER_BOOTSTRAP_PASSWORD (a local/hosting secret, never in code) seeds a configured developer who has no account.
// Once the account exists the secret is ignored; remove it after the first sign-in.
async function bootstrapDeveloper(email:string){
 const secret=process.env.NOVA_DEVELOPER_BOOTSTRAP_PASSWORD||'';if(!secret||!isDeveloperEmail(email))return;
 const db=getDb();if(await db.select().from(workers).where(eq(workers.email,email)).then(rows=>rows[0]))return;
 const id=crypto.randomUUID();await ensurePasswordResetStorage();
 const created=await db.insert(workers).values({id,name:'Developer',email,specialty:'Developer',permissions:JSON.stringify(['manager']),role:'manager',active:1,removed:0,startDate:new Date(Date.now()+19800000).toISOString().slice(0,10),passwordHash:await hashPassword(secret)}).onConflictDoNothing().returning({id:workers.id});
 if(created.length)await db.execute(sql`INSERT INTO password_change_required (account_id,created) VALUES (${id},${Date.now()}) ON CONFLICT (account_id) DO NOTHING`);
}
