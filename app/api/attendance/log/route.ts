import {getDb} from '../../../../db';
import {accessEvents,attendance,workers} from '../../../../db/schema';
import {principal,requireOrigin} from '../../../../lib/auth';
import {ensureAccessStorage} from '../../../../lib/access-log';
import {localDay} from '../../../../lib/attendance';
import {and,eq} from 'drizzle-orm';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const attendanceTypes=['in','break','resume','out','correction','leave-approved','approved-leave'];
type EditHistoryEntry={at:number;by:string;reason:string;previousAt:number;previousReason:string;newAt:number;newReason:string};
type ActivityEvent={id?:string;type:string;at:number;reason?:string;editHistory?:EditHistoryEntry[];[key:string]:unknown};
type AttendanceRecord={events?:ActivityEvent[];[key:string]:unknown};

export async function POST(req:Request){
 try{
  requireOrigin(req);
  const user=await principal(req);
  if(!user.admin)return Response.json({error:'Only the administrator can edit activity logs.'},{status:403,headers});
  const body=await req.json() as Record<string,unknown>,db=getDb(),today=localDay(),day=String(body.day||''),workerId=String(body.workerId||''),kind=String(body.kind||''),time=String(body.time||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00.000Z').toISOString().slice(0,10)!==day||day>today)throw Error('Select today or a past date.');
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Enter a valid time in IST.');
  const at=Date.parse(`${day}T${time}:00+05:30`);
  if(!Number.isFinite(at)||localDay(at)!==day)throw Error('The edited time must stay on the selected date.');
  const editReason=String(body.editReason||'').trim().slice(0,2000),reason=String(body.reason||'').trim().slice(0,2000);
  if(!editReason)throw Error('Enter a reason for this administrator edit.');
  const person=await db.select({id:workers.id}).from(workers).where(eq(workers.id,workerId)).then(rows=>rows[0]);
  if(!person)throw Error('Person not found.');
  const now=Date.now(),makeEdit=(original:ActivityEvent):EditHistoryEntry[]=>[...(original.editHistory||[]),{at:now,by:user.email,reason:editReason,previousAt:original.at,previousReason:original.reason||'',newAt:at,newReason:reason}];

  if(kind==='access'){
   await ensureAccessStorage();
   const eventId=String(body.eventId||'');
   if(!eventId)throw Error('Select a valid portal access log.');
   const stored=await db.select().from(accessEvents).where(and(eq(accessEvents.id,eventId),eq(accessEvents.workerId,workerId),eq(accessEvents.day,day))).then(rows=>rows[0]);
   if(!stored)throw Error('This log entry has changed. Refresh and try again.');
   const original=JSON.parse(stored.payload) as ActivityEvent;
   if(!['login','logout'].includes(original.type))throw Error('Only portal sign-in and sign-out entries can be edited here.');
   const updated={...original,at,reason,editHistory:makeEdit(original)};
   const saved=await db.update(accessEvents).set({payload:JSON.stringify(updated)}).where(and(eq(accessEvents.id,eventId),eq(accessEvents.workerId,workerId),eq(accessEvents.day,day),eq(accessEvents.payload,stored.payload))).returning().then(rows=>rows[0]);
   if(!saved)throw Error('This log entry changed. Refresh and try again.');
   return Response.json({ok:true,event:updated},{headers});
  }

  if(kind!=='attendance')throw Error('Choose a valid attendance log.');
  const attendanceId=workerId+':'+day,stored=await db.select().from(attendance).where(eq(attendance.id,attendanceId)).then(rows=>rows[0]);
  if(!stored)throw Error('This attendance log was not found.');
  const record=JSON.parse(stored.payload) as AttendanceRecord,events=Array.isArray(record.events)?record.events:[],eventIndex=Number(body.eventIndex);
  if(!Number.isInteger(eventIndex)||eventIndex<0||eventIndex>=events.length)throw Error('This log entry has changed. Refresh and try again.');
  const original=events[eventIndex];
  if(!original||!attendanceTypes.includes(original.type))throw Error('This activity entry cannot be edited.');
  events[eventIndex]={...original,at,reason,editHistory:makeEdit(original)};
  record.events=events;
  const saved=await db.update(attendance).set({payload:JSON.stringify(record),updated:crypto.randomUUID()}).where(and(eq(attendance.id,attendanceId),eq(attendance.updated,stored.updated))).returning().then(rows=>rows[0]);
  if(!saved)throw Error('This log entry changed. Refresh and try again.');
  return Response.json({ok:true,event:events[eventIndex]},{headers});
 }catch(error){return Response.json({error:(error as Error).message},{status:400,headers});}
}
