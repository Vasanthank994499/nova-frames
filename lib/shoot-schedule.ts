import {isValidDay,isValidTime} from './dates';
import {getDb} from '../db';
import {sql} from 'drizzle-orm';
// Scheduled shoots: stored with an absolute UTC start plus the IANA zone they were booked in, so reminders and display never drift.
export const SHOOT_STATUSES=['Pending','Confirmed','In progress','Completed','Cancelled'] as const;
export const STUDIO_TZ='Asia/Kolkata';
const rows=(r:any)=>(r?.rows||[]) as any[];
let ready:Promise<void>|undefined;
export function ensureShootStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS shoot_schedules (id text PRIMARY KEY, brand_id text NOT NULL, status text NOT NULL, starts_at text NOT NULL, payload text NOT NULL, updated text NOT NULL)`)).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
export const mayManageShoots=(u:{admin:boolean,roles:string[]})=>u.admin||u.roles.includes('manager');
export function validZone(tz:string){try{new Intl.DateTimeFormat('en',{timeZone:tz});return true;}catch{return false;}}
// Offset (minutes) of a zone at a given instant, from Intl, so DST zones work too.
function offsetAt(tz:string,utcMs:number){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(utcMs)).map(x=>[x.type,x.value]));return (Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-utcMs)/60000;}
// Local wall time in a zone → UTC instant (two passes settle DST edges).
export function zonedToUtc(date:string,time:string,tz:string){
 // Strict before any time-zone math, so 25:99 or 2026-02-30 never reach the DST check below.
 if(!isValidDay(date)||!isValidTime(time))throw Error('Choose a valid date and time.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),guess=Date.UTC(y,m-1,d,h,min);
 let utc=guess-offsetAt(tz,guess)*60000;utc=guess-offsetAt(tz,utc)*60000;
 const back=new Date(utc+offsetAt(tz,utc)*60000);if(back.getUTCHours()!==h||back.getUTCMinutes()!==min)throw Error('That time does not exist in this time zone (clock change). Pick another time.');
 return new Date(utc).toISOString();
}
export function formatInZone(iso:string,tz:string){return new Intl.DateTimeFormat('en-IN',{timeZone:tz,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));}
export async function allShoots(){await ensureShootStorage();return rows(await getDb().execute(sql`SELECT payload,updated FROM shoot_schedules ORDER BY starts_at`)).map(r=>({...JSON.parse(r.payload),version:String(r.updated)}));}
export async function brandShoots(brandId:string){await ensureShootStorage();return rows(await getDb().execute(sql`SELECT payload FROM shoot_schedules WHERE brand_id=${brandId} ORDER BY starts_at`)).map(r=>JSON.parse(r.payload));}
export const isCrew=(s:any,id:string)=>(s.crewIds||[]).includes(id);
// Who sees a shoot: managers/admin all, crew their own (clients are handled per brand in the client dashboard).
export const staffMaySee=(s:any,u:{id:string,admin:boolean,roles:string[]})=>mayManageShoots(u)||isCrew(s,u.id);
const REMINDERS=[{hours:48,label:'in 2 days'},{hours:24,label:'tomorrow'}];
// Notices and due reminders for one audience. Reminder ids carry the shoot revision, so a reschedule replaces them and a cancel removes them.
export function shootNotices(s:any,audience:'crew'|'client'|'manager',viewerId='',now=Date.now()){
 if(s.hidden)return [];const out:{id:string,title:string,body:string,at:string}[]=[],when=formatInZone(s.startsAt,s.timeZone),where=s.location?` · ${s.location}`:'';
 for(const n of s.notices||[])if(n.audience.includes(audience)&&(audience!=='crew'||(n.only?n.only.includes(viewerId):isCrew(s,viewerId))))out.push({id:`shoot:${s.id}:${n.id}`,title:n.title,body:`${s.title} · ${n.when||when}${n.when?(n.where?` · ${n.where}`:''):where}`,at:n.at});
 if(s.status==='Confirmed'&&audience!=='manager'&&(audience==='client'||isCrew(s,viewerId))){const start=Date.parse(s.startsAt);for(const r of REMINDERS){const due=start-r.hours*3600000;if(now>=due&&now<start)out.push({id:`shoot-reminder:${s.id}:${s.rev}:${r.hours}`,title:`Shoot reminder: ${r.label}`,body:`${s.title} · ${when}${where}`,at:new Date(due).toISOString()});}}
 return out;
}
// Bell items for a staff account (Web Push sends any bell item a device has not received yet).
export async function shootBellItems(user:{id:string,admin:boolean,roles:string[]},now=Date.now()){
 const manager=mayManageShoots(user),out:any[]=[];
 for(const s of await allShoots()){for(const n of shootNotices(s,'crew',user.id,now))out.push({...n,page:'Shoot schedule'});if(manager)for(const n of shootNotices(s,'manager',user.id,now))out.push({...n,id:n.id+':m',page:'Shoot schedule'});}
 return out;
}
