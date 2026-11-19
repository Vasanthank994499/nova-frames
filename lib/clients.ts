import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {digest,principal} from './auth';
import {overviewTotals} from './overview';
import {brandShoots,shootNotices,formatInZone} from './shoot-schedule';
import {clientContent} from './content-review';
// Client logins are kept apart from workers so no existing staff API (which all use principal()) can ever accept a client session.
let ready:Promise<void>|undefined;
export function ensureClientStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS client_accounts (id text PRIMARY KEY, brand_id text NOT NULL, name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, active integer NOT NULL DEFAULT 1)`)).then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS instagram_metrics (id text PRIMARY KEY, brand_id text NOT NULL, month text NOT NULL, job_id text NOT NULL DEFAULT '', payload text NOT NULL, updated text NOT NULL)`))).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
export const CLIENT_PREFIX='client:';
const rows=(r:any)=>(r?.rows||[]) as any[];
const sessionToken=(req:Request)=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nf_session='))?.slice(11);
export async function clientByEmail(email:string){await ensureClientStorage();return rows(await getDb().execute(sql`SELECT id,brand_id,password_hash,active FROM client_accounts WHERE email=${email}`))[0];}
export async function clientPrincipal(req:Request){
 const token=sessionToken(req);if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Please sign in with your email and password.');
 await ensureClientStorage();
 const row=rows(await getDb().execute(sql`SELECT c.id,c.name,c.email,c.brand_id,c.active,s.expires FROM sessions s JOIN client_accounts c ON s.account_id=${CLIENT_PREFIX}||c.id WHERE s.token_hash=${await digest(token)}`))[0];
 if(!row||Number(row.expires)<=Date.now())throw Error('Your session expired. Please sign in again.');
 if(!Number(row.active))throw Error('This client account is disabled. Contact Nova Frames.');
 return {id:String(row.id),name:String(row.name),email:String(row.email),brandId:String(row.brand_id),client:true as const};
}
export async function endClientSession(req:Request){const token=sessionToken(req);if(!token||!/^[a-f0-9]{64}$/.test(token))return false;const r=await getDb().execute(sql`DELETE FROM sessions WHERE token_hash=${await digest(token)} AND account_id LIKE ${CLIENT_PREFIX+'%'} RETURNING account_id`);return rows(r).length>0;}
const day=(v:unknown)=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10):'';
const localDay=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
// Every query below is filtered by brand id in SQL; callers decide which brand id a viewer may pass.
export async function clientDashboard(brandId:string){
 const db=getDb();
 const brand=rows(await db.execute(sql`SELECT id,name,payload FROM brands WHERE id=${brandId}`))[0];
 if(!brand)throw Error('Brand not found.');
 // jobs.updated is a version id, not a date: the delivery date is the latest Completed stage event for that video.
 const postedAt=new Map(rows(await db.execute(sql`SELECT job_id,MAX(at) AS at FROM work_events WHERE payload::jsonb->>'brandId'=${brandId} AND payload::jsonb->>'stage'='Completed' GROUP BY job_id`)).map(r=>[String(r.job_id),String(r.at)]));
 const jobRows=rows(await db.execute(sql`SELECT payload,updated FROM jobs WHERE payload::jsonb->>'brandId'=${brandId}`)),videos=jobRows.map(r=>{const v=JSON.parse(r.payload);return {...v,postedAt:postedAt.get(v.id)||''};});
 const events=rows(await db.execute(sql`SELECT at,payload FROM work_events WHERE payload::jsonb->>'brandId'=${brandId} ORDER BY at DESC LIMIT 25`)).map(r=>JSON.parse(r.payload));
 const today=localDay(),byMonth=new Map<string,any[]>();
 for(const v of videos)if(v.stage==='Completed'){const m=(day(v.postedAt)||day(v.shootDate)).slice(0,7);if(m)byMonth.set(m,[...(byMonth.get(m)||[]),{id:v.id,title:v.title||'Untitled video',stage:v.stage,link:v.instagramLink||''}]);}
 const schedules=videos.filter(v=>v.stage!=='Completed').flatMap(v=>[day(v.shootDate)>=today&&{id:v.id+':shoot',date:day(v.shootDate),kind:'Shoot',title:v.title||'Untitled video',stage:v.stage},day(v.due)>=today&&{id:v.id+':deadline',date:day(v.due),kind:'Deadline',title:v.title||'Untitled video',stage:v.stage}].filter(Boolean) as any[]).sort((a,b)=>a.date.localeCompare(b.date));
 const payload=JSON.parse(brand.payload||'{}');
 // Clients see shoots once confirmed (never internal drafts), with no team names.
 const shoots=(await brandShoots(brandId)).filter(s=>s.status!=='Pending'&&(s.status!=='Cancelled'||s.confirmedAt));
 const shootList=shoots.filter(s=>s.status!=='Cancelled'||Date.parse(s.startsAt)>Date.now()-7*86400000).map(s=>({id:s.id,title:s.title,when:formatInZone(s.startsAt,s.timeZone),startsAt:s.startsAt,durationMins:s.durationMins,location:s.location,details:s.details,status:s.status,crewCount:s.crewIds.length}));
 const shootUpdates=shoots.flatMap(s=>shootNotices(s,'client')).map(n=>({id:n.id,at:n.at,title:n.body,action:'shoot',stage:n.title}));
 await ensureClientStorage();
 const metricRows=rows(await db.execute(sql`SELECT month,job_id,payload FROM instagram_metrics WHERE brand_id=${brandId} ORDER BY month`)).map(r=>({month:String(r.month),jobId:String(r.job_id||''),...JSON.parse(r.payload)}));
 return {
  brand:{id:String(brand.id),name:String(brand.name),active:payload.active!==false},
  totals:overviewTotals(videos),
  reports:Array.from(byMonth,([month,items])=>({month,count:items.length,items})).sort((a,b)=>b.month.localeCompare(a.month)),
  schedules,
  // Only what a client should see: no worker names, emails or internal notes.
  instagram:instagramStats(videos,metricRows,today.slice(0,7)),
  shoots:shootList,
  content:clientContent(jobRows),
  updates:[...shootUpdates,...events.map(e=>({id:e.id,at:e.at,title:e.title||'Untitled video',action:e.action||'updated',stage:e.stage||''}))].sort((x:any,y:any)=>String(y.at).localeCompare(String(x.at))).slice(0,30)
 };
}
const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)&&v!==null&&v!==''?x:null;};
const rate=(e:number|null,r:number|null)=>e!==null&&r?Math.round(e/r*1000)/10:null;
// Numbers come from Meta sync (source 'meta') or staff entry; missing values stay null so the page explains the gap.
export function instagramStats(videos:any[],metrics:any[],month:string){
 const snaps=metrics.filter(m=>m.jobId==='snap'&&n(m.followers)!==null).map(m=>({date:m.month,followers:n(m.followers) as number,mediaCount:n(m.mediaCount)}));
 const lastOfMonth=new Map<string,number>();for(const s of snaps)lastOfMonth.set(s.date.slice(0,7),s.followers);
 const months=Array.from(new Set([...metrics.filter(m=>!m.jobId).map(m=>m.month),...lastOfMonth.keys()])).sort();
 const accountRow=(m:string)=>metrics.find(x=>!x.jobId&&x.month===m)||{};
 const account=months.map((m,i)=>{const r:any=accountRow(m),followers=lastOfMonth.get(m)??n(r.followers),prevM=months[i-1],prev=prevM?(lastOfMonth.get(prevM)??n(accountRow(prevM).followers)):null,engagement=n(r.engagement),reach=n(r.reach);return {month:m,followers,growth:followers!==null&&prev!==null?followers-prev:null,reach,views:n(r.views),engagement,engagementRate:rate(engagement,reach),source:r.source||(lastOfMonth.has(m)?'meta':'manual'),partial:!!r.partial};});
 const metaPosts=metrics.filter(m=>String(m.jobId).startsWith('ig:'));
 const withRate=(x:any)=>{const parts=['likes','comments','saves','shares'].map(k=>n(x[k])),interactions=parts.every(v=>v===null)?null:parts.reduce((a:number,v)=>a+(v||0),0);return {...x,views:n(x.views),reach:n(x.reach),likes:parts[0],comments:parts[1],saves:parts[2],shares:parts[3],interactions,engagementRate:rate(interactions,n(x.reach))};};
 const posted=videos.filter(v=>v.stage==='Completed'&&v.instagramLink),byJob=new Map(metrics.filter(m=>m.jobId&&m.jobId!=='snap').map(m=>[m.jobId,m]));
 const content=(metaPosts.length?metaPosts.map(m=>withRate({...m,id:m.jobId,month:String(m.postedAt||'').slice(0,7),source:'meta'})):posted.map(v=>withRate({...(byJob.get(v.id)||{}),id:v.id,title:v.title||'Untitled video',link:v.instagramLink,month:day(v.postedAt).slice(0,7),source:'manual'}))).sort((a:any,b:any)=>(b.views??-1)-(a.views??-1));
 const postedThisMonth=metaPosts.length?metaPosts.filter(m=>['REELS','VIDEO'].includes(String(m.kind))&&String(m.postedAt||'').slice(0,7)===month).length:posted.filter(v=>day(v.postedAt).slice(0,7)===month).length;
 const first=snaps[0],last=snaps[snaps.length-1];
 return {month,postedThisMonth,trackingSince:first?.date||'',overallGrowth:first&&last&&last.date!==first.date?last.followers-first.followers:null,totalPosts:last?.mediaCount??null,videosByMonth:Object.fromEntries(account.map(a=>[a.month,a.month<new Date(Date.now()-90*86400000).toISOString().slice(0,7)?null:metaPosts.filter(m=>['REELS','VIDEO'].includes(String(m.kind))&&String(m.postedAt||'').slice(0,7)===a.month).length])),current:account.find(a=>a.month===month)||null,months:account,content,snapshots:snaps,source:metaPosts.length||snaps.length?'meta':'manual'};
}
// Who is asking: a client (locked to one brand), or admin/manager staff (any brand). Other staff are refused.
export async function viewer(req:Request){
 const staff=await principal(req).catch(()=>null);
 if(staff){if(!staff.admin&&!staff.roles.includes('manager'))throw Error('Only administrators and managers can open client dashboards.');return {staff,client:null};}
 return {staff:null,client:await clientPrincipal(req)};
}
