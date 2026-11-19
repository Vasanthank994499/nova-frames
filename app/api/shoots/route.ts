import {developerPrivate} from '../../../lib/developer-privacy';
import {after} from 'next/server';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {principal,requireOrigin,workerRoles,isDeveloperEmail} from '../../../lib/auth';
import {safelyDispatchPush} from '../../../lib/web-push';
import {ensureShootStorage,allShoots,mayManageShoots,staffMaySee,isCrew,zonedToUtc,validZone,STUDIO_TZ,formatInZone} from '../../../lib/shoot-schedule';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const clean=(v:unknown,max=2000)=>String(v||'').trim().slice(0,max);
const rows=(r:any)=>(r?.rows||[]) as any[];
async function GET_(req:Request){try{
 const u=await principal(req),manager=mayManageShoots(u);
 const shoots=(await allShoots()).filter(s=>staffMaySee(s,u)).map(s=>({...s,canUpdateStatus:isCrew(s,u.id)||manager}));
 const team=manager?rows(await getDb().execute(sql`SELECT id,name,email,role,permissions,active,removed FROM workers`)).filter(w=>!isDeveloperEmail(w.email)&&Number(w.active)&&!Number(w.removed)).map(w=>({id:String(w.id),name:String(w.name),roles:workerRoles(w)})):[];
 const brands=manager?rows(await getDb().execute(sql`SELECT id,name FROM brands ORDER BY name`)).map(b=>({id:String(b.id),name:String(b.name)})):[];
 return Response.json({shoots,team,brands,manager,me:u.id,studioTimeZone:STUDIO_TZ},{headers});
}catch(e){return Response.json({error:(e as Error).message},{status:401,headers});}}
async function handle(req:Request){
 requireOrigin(req);const u=await principal(req),manager=mayManageShoots(u);await ensureShootStorage();const db=getDb(),b:any=await req.json(),at=new Date().toISOString();
 const id=clean(b.id,100),prevRow=id?rows(await db.execute(sql`SELECT payload,updated FROM shoot_schedules WHERE id=${id}`))[0]:null;
 if(id&&!prevRow)throw Error('Shoot not found.');const old=prevRow?JSON.parse(prevRow.payload):null;
 const notice=(title:string,audience:string[])=>({id:crypto.randomUUID(),at,title,audience});
 // Each notice keeps the time and place it announced, so older notices stay accurate after a reschedule.
 const save=async(s:any)=>{s={...s,notices:(s.notices||[]).map((n:any)=>n.when?n:{...n,when:formatInZone(s.startsAt,s.timeZone),where:s.location||''})};const json=JSON.stringify(s),version=crypto.randomUUID();
  if(old){const ok=rows(await db.execute(sql`UPDATE shoot_schedules SET brand_id=${s.brandId},status=${s.status},starts_at=${s.startsAt},payload=${json},updated=${version} WHERE id=${s.id} AND updated=${clean(b.version,100)||prevRow.updated} RETURNING id`));if(!ok.length)throw Error('Someone else changed this shoot. Reload and try again.');}
  else await db.execute(sql`INSERT INTO shoot_schedules (id,brand_id,status,starts_at,payload,updated) VALUES (${s.id},${s.brandId},${s.status},${s.startsAt},${json},${version})`);
  return Response.json({ok:true},{headers});};
 // Crew may move their own confirmed shoot to In progress / Completed; everything else is for managers.
 if(b.type==='status'){
  if(!old)throw Error('Shoot not found.');const status=clean(b.status,20);
  if(!manager&&!isCrew(old,u.id))throw Error('Only the assigned team or a manager can update this shoot.');
  if(!['In progress','Completed'].includes(status))throw Error('Choose In progress or Completed.');
  if(!['Confirmed','In progress'].includes(old.status))throw Error('Only a confirmed shoot can be started or completed.');
  return save({...old,status,completedAt:status==='Completed'?at:old.completedAt,notes:clean(b.notes,2000)||old.notes||'',history:[...old.history,{at,by:u.name,detail:`Status → ${status}`}],notices:[...old.notices,notice(status==='Completed'?'Shoot completed':'Shoot started',['manager','client'])]});
 }
 if(!manager)throw Error('Only administrators and managers can schedule shoots.');
 if(b.type==='confirm'||b.type==='cancel'){
  if(!old)throw Error('Shoot not found.');
  if(b.type==='confirm'){if(old.status!=='Pending')throw Error('Only a pending shoot can be confirmed.');if(!old.crewIds.length)throw Error('Assign at least one team member before confirming.');if(Date.parse(old.startsAt)<=Date.now())throw Error('This shoot time has passed. Reschedule it first.');
   return save({...old,status:'Confirmed',rev:old.rev+1,confirmedAt:at,confirmedBy:u.name,history:[...old.history,{at,by:u.name,detail:'Confirmed'}],notices:[...old.notices,notice('Shoot confirmed',['crew','client'])]});}
  if(['Completed','Cancelled'].includes(old.status))throw Error('This shoot is already closed.');
  const reason=clean(b.reason,300);
  return save({...old,status:'Cancelled',rev:old.rev+1,cancelReason:reason,history:[...old.history,{at,by:u.name,detail:'Cancelled'+(reason?': '+reason:'')}],notices:[...old.notices,notice('Shoot cancelled'+(reason?` (${reason})`:''),old.status==='Confirmed'?['crew','client']:['crew'])]});
 }
 if(b.type!=='save')throw Error('Invalid request.');
 const v=b.shoot||{},title=clean(v.title,150),brandId=clean(v.brandId,100),tz=clean(v.timeZone,60)||STUDIO_TZ,date=clean(v.date,10),time=clean(v.time,5),duration=Math.round(Number(v.durationMins||60));
 if(!title)throw Error('Enter a shoot title.');
 if(!rows(await db.execute(sql`SELECT id FROM brands WHERE id=${brandId}`)).length)throw Error('Choose the client.');
 if(!validZone(tz))throw Error('Choose a valid time zone.');
 const startsAt=zonedToUtc(date,time,tz);if(!old&&Date.parse(startsAt)<=Date.now())throw Error('Choose a date and time in the future.');
 if(!(duration>=15&&duration<=1440))throw Error('Duration must be between 15 minutes and 24 hours.');
 const team=new Set(rows(await db.execute(sql`SELECT id FROM workers WHERE active=1 AND removed=0`)).map(w=>String(w.id)));
 const crewIds=[...new Set((Array.isArray(v.crewIds)?v.crewIds:[]).map((x:unknown)=>clean(x,100)))].filter(x=>team.has(x as string)) as string[];
 const base={title,brandId,timeZone:tz,date,time,startsAt,durationMins:duration,location:clean(v.location,300),details:clean(v.details,3000),crewIds,jobId:clean(v.jobId,100)};
 if(!old)return save({...base,id:crypto.randomUUID(),status:'Pending',rev:0,createdAt:at,createdBy:u.name,history:[{at,by:u.name,detail:'Scheduled'}],notices:[]});
 if(['Completed','Cancelled'].includes(old.status))throw Error('This shoot is closed and can no longer be changed.');
 const moved=old.startsAt!==startsAt||old.location!==base.location,added=crewIds.filter(x=>!old.crewIds.includes(x)),removed=old.crewIds.filter((x:string)=>!crewIds.includes(x));
 if(old.status!=='Pending'&&!crewIds.length)throw Error('A confirmed shoot needs at least one team member.');
 if(moved&&Date.parse(startsAt)<=Date.now())throw Error('Choose a new date and time in the future.');
 const notices=[...old.notices],history=[...old.history];
 if(moved){history.push({at,by:u.name,detail:`Rescheduled from ${formatInZone(old.startsAt,old.timeZone)}${old.location!==base.location?' / location changed':''}`});if(old.status!=='Pending')notices.push(notice('Shoot rescheduled',['crew','client']));}
 if(old.status!=='Pending'&&(added.length||removed.length)){history.push({at,by:u.name,detail:'Team changed'});notices.push({...notice('You were added to a shoot',['crew']),only:added},{...notice('You were removed from a shoot',['crew']),only:removed,keepFor:removed});}
 return save({...old,...base,status:old.status==='In progress'?'Confirmed':old.status,rev:moved?old.rev+1:old.rev,history,notices});
}
async function POST_(req:Request){try{const r=await handle(req);after(safelyDispatchPush);return r;}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);