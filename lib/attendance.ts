import {getDb} from '../db';
import {attendance} from '../db/schema';
import {eq} from 'drizzle-orm';
export const TARGET_MS=8*3600000;
export const localDay=(at=Date.now())=>new Date(at+19800000).toISOString().slice(0,10);
export const isHoliday=(day:string)=>new Date(day+'T00:00:00Z').getUTCDay()===0;
export const dayEnd=(day:string)=>Date.parse(day+'T23:59:59.999+05:30');
export function totalMs(row:any,now=Date.now()){let total=0,start:number|null=null;for(const e of row?.events||[]){if(e.type==='in'||e.type==='resume')start=e.at;else if(['break','out'].includes(e.type)&&start!==null){total+=Math.max(0,e.at-start);start=null;}}if(start!==null)total+=Math.max(0,Math.min(now,dayEnd(row.day))-start);return row?.overrideMs??total;}
export function attendanceView(row:any,day:string,now=Date.now()){
 const holiday=isHoliday(day),targetHours=holiday?0:8;const workedMs=totalMs(row,now),past=day<localDay(now);let status=row?.state||'Not marked';
 if(row?.manualStatus)status=row.manualStatus;
 else if(!row)status=past?'Leave':'Not marked';
 else if(row.state==='Ended'||past)status=workedMs>=TARGET_MS?'Present':workedMs>0?'Short day':'Leave';
 if(holiday)status='Holiday';return {...row,day,workedMs,remainingMs:Math.max(0,targetHours*3600000-workedMs),targetHours,status,events:row?.events||[],reason:row?.reason||''};
}
export async function ensureClockedOut(req:Request,u:any){if(u.admin)return;const row=await getDb().select().from(attendance).where(eq(attendance.id,u.id+':'+localDay())).get();if(row&&['Working','Permission break'].includes(JSON.parse(row.payload).state))throw Error('End your attendance shift before signing out. An early departure requires a reason.');}
export async function pauseAccountAttendance(workerId:string,reason:string){const db=getDb(),id=workerId+':'+localDay();const existing=await db.select().from(attendance).where(eq(attendance.id,id)).get();if(!existing)return;const row=JSON.parse(existing.payload);if(row.state!=='Working')return;row.state='Permission break';row.reason=reason;row.events.push({type:'break',at:Date.now(),reason,by:'Administrator'});await db.update(attendance).set({payload:JSON.stringify(row),updated:crypto.randomUUID()}).where(eq(attendance.id,id));}
