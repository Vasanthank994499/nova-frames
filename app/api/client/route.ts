import {developerPrivate} from '../../../lib/developer-privacy';
import {after} from 'next/server';
import {safelyDispatchPush} from '../../../lib/web-push';
import {clientReview} from '../../../lib/content-review';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {principal,requireOrigin,hashPassword,ADMIN_EMAIL} from '../../../lib/auth';
import {clientPrincipal,viewer,clientDashboard as baseDashboard,ensureClientStorage,CLIENT_PREFIX} from '../../../lib/clients';
import {connectionStatus} from '../../../lib/instagram';
import {clientReschedule} from '../../../lib/shoot-schedule';
async function clientDashboard(brandId:string){const d=await baseDashboard(brandId);return {...d,instagram:{...d.instagram,connection:await connectionStatus(brandId)}};}
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const clean=(s:unknown,max=200)=>String(s||'').trim().slice(0,max);
const rows=(r:any)=>(r?.rows||[]) as any[];
const fail=(e:unknown,status=403)=>Response.json({error:(e as Error).message},{status,headers:noStore});
async function GET_(req:Request){
 let v;try{v=await viewer(req);}catch(e){return fail(e,401);}
 try{
  const params=new URL(req.url).searchParams;await ensureClientStorage();
  if(v.client){const dashboard=await clientDashboard(v.client.brandId);if(!dashboard.brand.active)throw Error('This brand dashboard is paused. Contact Nova Frames.');return Response.json({viewer:v.client,dashboard},{headers:noStore});}
  const brands=rows(await getDb().execute(sql`SELECT id,name FROM brands ORDER BY name`)).map(b=>({id:String(b.id),name:String(b.name)}));
  const accounts=v.staff!.admin?rows(await getDb().execute(sql`SELECT id,brand_id,name,email,active FROM client_accounts ORDER BY name`)).map(a=>({id:String(a.id),brandId:String(a.brand_id),name:String(a.name),email:String(a.email),active:!!Number(a.active)})):[];
  const brandId=clean(params.get('brand'),100);
  return Response.json({viewer:{id:v.staff!.id,name:v.staff!.name,admin:v.staff!.admin},brands,accounts,dashboard:brandId?await clientDashboard(brandId):null},{headers:noStore});
 }catch(e){return fail(e,400);}
}
// Administrator only: create, edit, enable or disable client logins.
async function POST_(req:Request){
 // Clients review their own videos here; everything else in this route is for staff.
 if(!(await principal(req).then(()=>true,()=>false))){try{requireOrigin(req);const c=await clientPrincipal(req),b:any=await req.json();if(b?.type==='shoot-date'){const r=await clientReschedule(c,clean(b.id,100),clean(b.date,10),clean(b.time,5));after(safelyDispatchPush);return Response.json({ok:true,...r},{headers:noStore});}if(b?.type!=='content-review')throw Error('Invalid request.');const r=await clientReview(c,clean(b.jobId,100),clean(b.decision,20),String(b.feedback||''),clean(b.version,100));after(safelyDispatchPush);return Response.json({ok:true,...r},{headers:noStore});}catch(e){return fail(e,400);}}
 try{
  requireOrigin(req);const u=await principal(req);
  const b:any=await req.json(),db=getDb();await ensureClientStorage();
  if(b?.type==='instagram-metrics'){
   if(!u.admin&&!u.roles.includes('manager'))throw Error('Only administrators and managers can enter Instagram metrics.');
   const brandId=clean(b.brandId,100),month=clean(b.month,7),jobId=clean(b.jobId,100);
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose a valid month.');
   if(!rows(await db.execute(sql`SELECT id FROM brands WHERE id=${brandId}`)).length)throw Error('Brand not found.');
   // A post's numbers can only be attached to a video of the same brand.
   if(jobId&&!rows(await db.execute(sql`SELECT id FROM jobs WHERE id=${jobId} AND payload::jsonb->>'brandId'=${brandId}`)).length)throw Error('That video does not belong to this brand.');
   const keys=jobId?['views','reach','likes','comments','saves','shares']:['followers','reach','views','engagement'],values:any={};
   for(const k of keys){const raw=b.metrics?.[k];if(raw===''||raw===null||raw===undefined)continue;const x=Number(raw);if(!Number.isInteger(x)||x<0||x>1e12)throw Error('Enter whole numbers of 0 or more.');values[k]=x;}
   const id=`${brandId}:${month}:${jobId}`,json=JSON.stringify(values),at=new Date().toISOString();
   await db.execute(sql`INSERT INTO instagram_metrics (id,brand_id,month,job_id,payload,updated) VALUES (${id},${brandId},${month},${jobId},${json},${at}) ON CONFLICT (id) DO UPDATE SET payload=${json},updated=${at}`);
   return Response.json({ok:true},{headers:noStore});
  }
  if(!u.admin)throw Error('Administrator access required.');
  if(b?.type==='client-toggle'){const id=clean(b.id,100);await db.execute(sql`UPDATE client_accounts SET active=${b.active?1:0} WHERE id=${id}`);if(!b.active)await db.execute(sql`DELETE FROM sessions WHERE account_id=${CLIENT_PREFIX+id}`);return Response.json({ok:true},{headers:noStore});}
  if(b?.type!=='client')throw Error('Invalid request.');
  const c=b.client||{},id=clean(c.id,100),name=clean(c.name,150),email=clean(c.email).toLowerCase(),brandId=clean(c.brandId,100),password=String(c.password||'');
  if(!name)throw Error('Enter the client name.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
  if(!rows(await db.execute(sql`SELECT id FROM brands WHERE id=${brandId}`)).length)throw Error('Choose the client’s brand.');
  if(email===ADMIN_EMAIL||rows(await db.execute(sql`SELECT id FROM workers WHERE email=${email}`)).length)throw Error('This email already belongs to a team login.');
  if(rows(await db.execute(sql`SELECT id FROM client_accounts WHERE email=${email} AND id<>${id}`)).length)throw Error('Another client already uses this email.');
  if((!id||password)&&(password.length<8||password.length>256))throw Error('Use a password of at least 8 characters.');
  if(!id){await db.execute(sql`INSERT INTO client_accounts (id,brand_id,name,email,password_hash,active) VALUES (${crypto.randomUUID()},${brandId},${name},${email},${await hashPassword(password)},1)`);return Response.json({ok:true},{headers:noStore});}
  if(password)await db.execute(sql`UPDATE client_accounts SET password_hash=${await hashPassword(password)} WHERE id=${id}`);
  await db.execute(sql`UPDATE client_accounts SET name=${name},email=${email},brand_id=${brandId} WHERE id=${id}`);
  // A changed brand or password signs the client out everywhere.
  await db.execute(sql`DELETE FROM sessions WHERE account_id=${CLIENT_PREFIX+id}`);
  return Response.json({ok:true},{headers:noStore});
 }catch(e){return fail(e,400);}
}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);