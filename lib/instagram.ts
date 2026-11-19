import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {ensureClientStorage} from './clients';
// Meta "Instagram API with Instagram Login" (graph.instagram.com). Checked against Meta docs Nov 2026: v27.0, scopes below, 60-day refreshable tokens.
export const IG_VERSION=process.env.INSTAGRAM_GRAPH_VERSION||'v27.0';
export const IG_SCOPES=['instagram_business_basic','instagram_business_manage_insights'];
const GRAPH='https://graph.instagram.com';
const rows=(r:any)=>(r?.rows||[]) as any[];
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=(b:ArrayBuffer|Uint8Array)=>Buffer.from(b instanceof Uint8Array?b:new Uint8Array(b)).toString('base64');
export function igConfig(origin:string){
 const appId=process.env.INSTAGRAM_APP_ID||'',secret=process.env.INSTAGRAM_APP_SECRET||'',key=process.env.INSTAGRAM_TOKEN_KEY||'';
 const missing=[!appId&&'INSTAGRAM_APP_ID',!secret&&'INSTAGRAM_APP_SECRET',Buffer.from(key,'base64').length!==32&&'INSTAGRAM_TOKEN_KEY'].filter(Boolean);
 return {appId,secret,key,redirectUri:process.env.INSTAGRAM_REDIRECT_URI||origin+'/api/instagram',missing:missing as string[]};
}
let ready:Promise<void>|undefined;
export function ensureInstagramStorage(){if(!ready)ready=ensureClientStorage().then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS instagram_connections (brand_id text PRIMARY KEY, ig_user_id text NOT NULL, username text NOT NULL, account_type text NOT NULL, token_enc text NOT NULL, token_expires bigint NOT NULL, token_issued bigint NOT NULL, connected_at text NOT NULL, last_sync_at text, last_error text, notes text NOT NULL DEFAULT '[]')`))).then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS instagram_oauth_states (state_hash text PRIMARY KEY, brand_id text NOT NULL, expires bigint NOT NULL)`))).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
// Tokens are AES-256-GCM encrypted at rest with INSTAGRAM_TOKEN_KEY and never sent to the browser.
async function aesKey(key:string){return crypto.subtle.importKey('raw',Buffer.from(key,'base64'),'AES-GCM',false,['encrypt','decrypt']);}
export async function sealToken(token:string,key:string){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(key),enc.encode(token)));}
export async function openToken(sealed:string,key:string){const [iv,data]=sealed.split('.');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64')},await aesKey(key),Buffer.from(data,'base64')));}
async function ig(path:string,params:Record<string,string>,token:string){
 const u=new URL(`${GRAPH}/${IG_VERSION}/${path}`);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'});const d:any=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error?.message||`Instagram request failed (${r.status}).`);return d;
}
// OAuth: one-time state, hashed in the database and tied to the brand chosen by an authorised viewer.
export async function startConnect(brandId:string,origin:string){
 const cfg=igConfig(origin);if(cfg.missing.length)throw Error('Instagram connection is not set up on the server yet. Missing: '+cfg.missing.join(', ')+'.');
 await ensureInstagramStorage();const state=b64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^A-Za-z0-9]/g,'');
 await getDb().execute(sql`DELETE FROM instagram_oauth_states WHERE expires<${Date.now()}`);
 await getDb().execute(sql`INSERT INTO instagram_oauth_states (state_hash,brand_id,expires) VALUES (${await hash(state)},${brandId},${Date.now()+600000})`);
 const u=new URL('https://www.instagram.com/oauth/authorize');u.search=new URLSearchParams({client_id:cfg.appId,redirect_uri:cfg.redirectUri,response_type:'code',scope:IG_SCOPES.join(','),state}).toString();
 return {url:u.toString(),state};
}
async function hash(s:string){return b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));}
export async function finishConnect(code:string,state:string,origin:string){
 const cfg=igConfig(origin);if(cfg.missing.length)throw Error('Instagram connection is not set up on the server yet.');
 await ensureInstagramStorage();const db=getDb();
 const row=rows(await db.execute(sql`DELETE FROM instagram_oauth_states WHERE state_hash=${await hash(state)} RETURNING brand_id,expires`))[0];
 if(!row||Number(row.expires)<Date.now())throw Error('This Instagram connection link expired. Please start again.');
 const brandId=String(row.brand_id);
 const short=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:cfg.appId,client_secret:cfg.secret,grant_type:'authorization_code',redirect_uri:cfg.redirectUri,code})}).then(r=>r.json()) as any;
 const shortToken=short?.access_token||short?.data?.[0]?.access_token;if(!shortToken)throw Error(short?.error_message||short?.error?.message||'Instagram did not approve the connection.');
 const granted=String(short?.permissions||short?.data?.[0]?.permissions||'');if(granted&&!IG_SCOPES.every(s=>granted.includes(s)))throw Error('Please allow both profile and insights access when connecting Instagram.');
 const lr=await fetch(`${GRAPH}/access_token?`+new URLSearchParams({grant_type:'ig_exchange_token',client_secret:cfg.secret,access_token:shortToken}),{cache:'no-store'}).then(r=>r.json()) as any;
 if(!lr?.access_token)throw Error(lr?.error?.message||'Could not get a long-lived Instagram token.');
 const me=await ig('me',{fields:'user_id,username,account_type'},lr.access_token);
 if(!['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(String(me.account_type||'').toUpperCase()))throw Error('Only Instagram Business or Creator accounts can be connected.');
 const now=Date.now(),sealed=await sealToken(lr.access_token,cfg.key);
 await db.execute(sql`INSERT INTO instagram_connections (brand_id,ig_user_id,username,account_type,token_enc,token_expires,token_issued,connected_at,notes) VALUES (${brandId},${String(me.user_id||me.id)},${String(me.username||'')},${String(me.account_type||'')},${sealed},${now+Number(lr.expires_in||5184000)*1000},${now},${new Date(now).toISOString()},'[]') ON CONFLICT (brand_id) DO UPDATE SET ig_user_id=EXCLUDED.ig_user_id,username=EXCLUDED.username,account_type=EXCLUDED.account_type,token_enc=EXCLUDED.token_enc,token_expires=EXCLUDED.token_expires,token_issued=EXCLUDED.token_issued,connected_at=EXCLUDED.connected_at,last_error=NULL`);
 await syncInstagram(brandId,origin).catch(()=>{});return brandId;
}
// Automatic daily sync, called from the hourly cron. One failing account never stops the others; its error is saved on the connection.
export async function syncDueInstagram(origin:string){
 if(igConfig(origin).missing.length)return {synced:0,failed:0,skipped:'not configured'};
 await ensureInstagramStorage();const cutoff=new Date(Date.now()-20*3600000).toISOString();
 const due=rows(await getDb().execute(sql`SELECT brand_id FROM instagram_connections WHERE last_sync_at IS NULL OR last_sync_at<${cutoff}`)).slice(0,20);
 let synced=0,failed=0;for(const r of due){try{await syncInstagram(String(r.brand_id),origin);synced++;}catch{failed++;}}
 return {synced,failed};
}
export async function disconnect(brandId:string){await ensureInstagramStorage();await getDb().execute(sql`DELETE FROM instagram_connections WHERE brand_id=${brandId}`);}
// Public status only: never the token.
export async function connectionStatus(brandId:string){await ensureInstagramStorage();const r=rows(await getDb().execute(sql`SELECT username,account_type,connected_at,last_sync_at,last_error,token_expires,notes FROM instagram_connections WHERE brand_id=${brandId}`))[0];
 return r?{connected:true,username:String(r.username),accountType:String(r.account_type),connectedAt:String(r.connected_at),lastSyncAt:r.last_sync_at?String(r.last_sync_at):'',lastError:r.last_error?String(r.last_error):'',tokenExpires:Number(r.token_expires),notes:JSON.parse(r.notes||'[]')}:{connected:false};}
const monthStart=(m:string)=>Date.parse(m+'-01T00:00:00+05:30')/1000;
const monthOf=(t:number)=>new Date(t*1000+19800000).toISOString().slice(0,7);
async function upsert(brandId:string,period:string,jobId:string,values:any){const id=`${brandId}:${period}:${jobId}`,json=JSON.stringify(values),at=new Date().toISOString();await getDb().execute(sql`INSERT INTO instagram_metrics (id,brand_id,month,job_id,payload,updated) VALUES (${id},${brandId},${period},${jobId},${json},${at}) ON CONFLICT (id) DO UPDATE SET payload=${json},updated=${at}`);}
// Pull profile, this and last month's account insights, and recent media insights; store snapshots.
export async function syncInstagram(brandId:string,origin:string){
 const cfg=igConfig(origin);if(cfg.missing.length)throw Error('Instagram connection is not set up on the server yet.');
 await ensureInstagramStorage();const db=getDb();
 const c=rows(await db.execute(sql`SELECT ig_user_id,token_enc,token_expires,token_issued FROM instagram_connections WHERE brand_id=${brandId}`))[0];if(!c)throw Error('Instagram is not connected for this brand.');
 const notes:string[]=[];let token='';
 try{
  if(Number(c.token_expires)<=Date.now())throw Error('The Instagram connection expired. Please reconnect.');
  token=await openToken(String(c.token_enc),cfg.key);
  // Refresh once the token is over a day old and within 15 days of expiry (Meta: refreshable after 24h, valid 60 days).
  if(Date.now()-Number(c.token_issued)>86400000&&Number(c.token_expires)-Date.now()<15*86400000){const r=await fetch(`${GRAPH}/refresh_access_token?`+new URLSearchParams({grant_type:'ig_refresh_token',access_token:token}),{cache:'no-store'}).then(x=>x.json()) as any;if(r?.access_token){token=r.access_token;await db.execute(sql`UPDATE instagram_connections SET token_enc=${await sealToken(token,cfg.key)},token_expires=${Date.now()+Number(r.expires_in||5184000)*1000},token_issued=${Date.now()} WHERE brand_id=${brandId}`);}}
  const id=String(c.ig_user_id),me=await ig('me',{fields:'user_id,username,account_type,followers_count,media_count'},token);
  const now=Math.floor(Date.now()/1000),today=new Date(Date.now()+19800000).toISOString().slice(0,10),thisMonth=today.slice(0,7);
  if(typeof me.followers_count==='number')await upsert(brandId,today,'snap',{followers:me.followers_count,mediaCount:typeof me.media_count==='number'?me.media_count:null});else notes.push('Follower count was not returned by Instagram.');
  const prev=new Date(Date.parse(thisMonth+'-01')-86400000).toISOString().slice(0,7);
  for(const m of [prev,thisMonth]){
   const since=Math.max(monthStart(m),now-89*86400),until=Math.min(m===thisMonth?now:monthStart(thisMonth),since+30*86400);
   if(until<=since)continue;
   try{const d=await ig(`${id}/insights`,{metric:'reach,views,total_interactions,accounts_engaged',period:'day',metric_type:'total_value',since:String(since),until:String(until)},token);const v:any={source:'meta',partial:since>monthStart(m)||m===thisMonth};for(const x of d.data||[])v[x.name==='total_interactions'?'engagement':x.name]=x.total_value?.value??null;await upsert(brandId,m,'',{...v,followers:undefined});}
   catch(e){notes.push(`Account insights for ${m} unavailable: ${(e as Error).message}`);}
  }
  const media=await ig('me/media',{fields:'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count',limit:'50'},token);
  const recent=(media.data||[]).filter((x:any)=>x.media_type!=='CAROUSEL_ALBUM'&&Date.parse(x.timestamp)>Date.now()-90*86400000).slice(0,25);
  for(const x of recent){
   const base={source:'meta',title:String(x.caption||'').split('\n')[0].slice(0,80)||'Instagram post',link:x.permalink,postedAt:x.timestamp,kind:x.media_product_type||x.media_type,likes:x.like_count??null,comments:x.comments_count??null};
   try{const d=await ig(`${x.id}/insights`,{metric:'views,reach,likes,comments,saved,shares'},token);const v:any={...base};for(const k of d.data||[])v[k.name==='saved'?'saves':k.name]=k.values?.[0]?.value??k.total_value?.value??null;await upsert(brandId,monthOf(Date.parse(x.timestamp)/1000),'ig:'+x.id,v);}
   catch(e){await upsert(brandId,monthOf(Date.parse(x.timestamp)/1000),'ig:'+x.id,base);notes.push(`Some insights for “${base.title}” unavailable: ${(e as Error).message}`);}
  }
  await db.execute(sql`UPDATE instagram_connections SET username=${String(me.username||'')},last_sync_at=${new Date().toISOString()},last_error=NULL,notes=${JSON.stringify(notes.slice(0,10))} WHERE brand_id=${brandId}`);
 }catch(e){await db.execute(sql`UPDATE instagram_connections SET last_error=${(e as Error).message.slice(0,300)},notes=${JSON.stringify(notes.slice(0,10))} WHERE brand_id=${brandId}`);throw e;}
}
