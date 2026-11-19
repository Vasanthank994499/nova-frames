import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {allShoots,formatInZone} from './shoot-schedule';
import {allInvoices,reminderChannels,reminderText,sendEmailReminder,rupees} from './invoices';
import {whatsappStatus,sendTemplate} from './whatsapp';
// Automated client reminders. What is due is recomputed from live data on every run, so changed dates or statuses
// change the reminders; each reminder+channel has a fixed key that is claimed before sending, so nothing goes twice.
const rows=(r:any)=>(r?.rows||[]) as any[];
const H=3600000,D=24*H;
const istDay=(ms:number)=>new Date(ms+19800000).toISOString().slice(0,10);
const istHour=(ms:number)=>new Date(ms+19800000).getUTCHours();
const istMidnight=(day:string)=>Date.parse(day+'T00:00:00+05:30');
export const KIND_LABEL:Record<string,string>={booking:'Shoot booking confirmation',shoot:'Shoot reminder',payment:'Payment reminder',approval:'Content approval reminder',report:'Monthly report ready'};
let ready:Promise<void>|undefined;
export function ensureReminderStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS reminder_log (key text PRIMARY KEY, kind text NOT NULL, brand_id text NOT NULL, channel text NOT NULL, recipient text NOT NULL, state text NOT NULL, error text, message_id text, attempts integer NOT NULL DEFAULT 0, summary text NOT NULL, created text NOT NULL, updated text NOT NULL)`)).then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS reminder_contacts (brand_id text PRIMARY KEY, payload text NOT NULL, updated text NOT NULL)`))).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
export async function contacts(){await ensureReminderStorage();return new Map(rows(await getDb().execute(sql`SELECT brand_id,payload FROM reminder_contacts`)).map(r=>[String(r.brand_id),JSON.parse(r.payload)]));}
export async function saveContact(brandId:string,v:any,by:string){
 await ensureReminderStorage();const email=String(v.email||'').trim().toLowerCase().slice(0,200),phone=String(v.whatsapp||'').trim().slice(0,30),digits=phone.replace(/[^\d]/g,'');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email.');if(phone&&!/^\+[0-9\s-]{8,20}$/.test(phone))throw Error('Enter the WhatsApp number with + and country code.');
 const old=(await contacts()).get(brandId)||{},at=new Date().toISOString();
 // Opt-in is tied to the exact number: changing the number clears it (Meta requires consent before business-initiated messages).
 const sameNumber=digits&&old.whatsappDigits===digits,optIn=phone&&v.whatsappOptIn?(sameNumber&&old.optIn?old.optIn:{at,by,number:phone}):null;
 const value={email,whatsapp:phone,whatsappDigits:digits,optIn,enabled:{booking:v.enabled?.booking!==false,shoot:v.enabled?.shoot!==false,payment:v.enabled?.payment!==false,approval:v.enabled?.approval!==false,report:v.enabled?.report!==false}};
 await getDb().execute(sql`INSERT INTO reminder_contacts (brand_id,payload,updated) VALUES (${brandId},${JSON.stringify(value)},${at}) ON CONFLICT (brand_id) DO UPDATE SET payload=EXCLUDED.payload,updated=EXCLUDED.updated`);
}
// Pure: which reminders are due right now. Only the latest step of each series is returned, so a missed run never sends a stale 2-day and a 1-day reminder together.
export function dueReminders(d:{now:number,brands:{id:string,name:string}[],shoots:any[],invoices:any[],approvals:{jobId:string,brandId:string,title:string,rev:number,since:number}[],reports:{brandId:string,month:string}[]}){
 const out:any[]=[],now=d.now,today=istDay(now),daytime=istHour(now)>=9&&istHour(now)<20,name=(id:string)=>d.brands.find(b=>b.id===id)?.name||'';
 for(const s of d.shoots){if(s.status!=='Confirmed')continue;const start=Date.parse(s.startsAt);if(start>now)out.push({key:`booking:${s.id}:${s.rev}`,kind:'booking',brandId:s.brandId,summary:`${s.title} · ${formatInZone(s.startsAt,s.timeZone)} (booking confirmed)`,shoot:s});if(start-now<2*H)continue;
  const step=[24,48].find(h=>now>=start-h*H);if(!step)continue;
  out.push({key:`shoot:${s.id}:${s.rev}:${step}`,kind:'shoot',brandId:s.brandId,summary:`${s.title} · ${formatInZone(s.startsAt,s.timeZone)}${step===24?' (tomorrow)':' (in 2 days)'}`,shoot:s});}
 if(daytime){
  for(const i of d.invoices){if(i.status!=='Pending')continue; // issued, unpaid, not yet due (drafts, void and paid are excluded by status)
   const step=[1,3].find(n=>today>=istDay(istMidnight(i.dueDate)-n*D)&&today<i.dueDate);if(!step)continue;
   out.push({key:`payment:${i.id}:${i.dueDate}:${step}`,kind:'payment',brandId:i.brandId,summary:`${i.number} · ${rupees(i.balancePaise)} due ${i.dueDate}`,invoice:i});}
  const byBrand=new Map<string,any[]>();for(const a of d.approvals)byBrand.set(a.brandId,[...(byBrand.get(a.brandId)||[]),a]);
  for(const [brandId,items] of byBrand){const oldest=items.reduce((x,y)=>x.since<=y.since?x:y),days=(now-oldest.since)/D,step=[9,5,2,0].find(n=>days>=n);if(step===undefined)continue;
   out.push({key:`approval:${brandId}:${oldest.jobId}:${oldest.rev}:${step}`,kind:'approval',brandId,summary:`${items.length} video${items.length===1?'':'s'} waiting for approval (oldest ${Math.floor(days)} days)`,count:items.length});}
  if(Number(today.slice(8,10))<=7)for(const r of d.reports)out.push({key:`report:${r.brandId}:${r.month}`,kind:'report',brandId:r.brandId,summary:`Report for ${new Date(r.month+'-01T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'})} is ready`,month:r.month});
 }
 return out.filter(x=>name(x.brandId)).map(x=>({...x,brandName:name(x.brandId)}));
}
async function loadInputs(now:number){
 const db=getDb();
 const brands=rows(await db.execute(sql`SELECT id,name,payload FROM brands`)).filter(b=>JSON.parse(b.payload||'{}').active!==false).map(b=>({id:String(b.id),name:String(b.name)}));
 const approvals=rows(await db.execute(sql`SELECT j.payload,(SELECT MAX(e.at) FROM work_events e WHERE e.job_id=j.id AND e.payload::jsonb->>'stage'='Client approval') AS since FROM jobs j WHERE j.payload::jsonb->>'stage'='Client approval'`)).map(r=>{const j=JSON.parse(r.payload);return {jobId:j.id,brandId:j.brandId,title:j.title,rev:j.revisionCount||0,since:Date.parse(r.since||j.created||'')||now,hasLink:!!j.editLink};}).filter(a=>a.hasLink);
 const prev=new Date(Date.parse(istDay(now).slice(0,7)+'-01')-D).toISOString().slice(0,7);
 // A month's report is "available" once the month is over and something was posted or Instagram numbers exist for it.
 const posted=rows(await db.execute(sql`SELECT DISTINCT payload::jsonb->>'brandId' AS b FROM work_events WHERE payload::jsonb->>'stage'='Completed' AND at LIKE ${prev+'%'}`)).map(r=>String(r.b));
 const metrics=rows(await db.execute(sql`SELECT DISTINCT brand_id AS b FROM instagram_metrics WHERE month LIKE ${prev+'%'}`).catch(()=>({rows:[]}))).map(r=>String(r.b));
 return {now,brands,shoots:await allShoots(),invoices:await allInvoices(),approvals,reports:[...new Set([...posted,...metrics])].map(brandId=>({brandId,month:prev}))};
}
function emailFor(r:any,origin:string){
 const hi=`Hello ${r.brandName},\n\n`,sign='\n\nThank you,\nNova Frames',dash=origin+'/';
 if(r.kind==='booking')return {subject:`Shoot confirmed: ${r.shoot.title}`,body:`${hi}Your shoot with Nova Frames is confirmed:\n\n${r.shoot.title}\nWhen: ${formatInZone(r.shoot.startsAt,r.shoot.timeZone)}${r.shoot.location?`\nWhere: ${r.shoot.location}`:''}${r.shoot.details?`\n\n${r.shoot.details}`:''}${sign}`};
 if(r.kind==='shoot')return {subject:`Shoot reminder: ${r.shoot.title} ${r.key.endsWith(':24')?'tomorrow':'in 2 days'}`,body:`${hi}A reminder of your upcoming shoot with Nova Frames:\n\n${r.shoot.title}\nWhen: ${formatInZone(r.shoot.startsAt,r.shoot.timeZone)}${r.shoot.location?`\nWhere: ${r.shoot.location}`:''}${r.shoot.details?`\n\n${r.shoot.details}`:''}${sign}`};
 if(r.kind==='payment'){const t=reminderText(r.invoice,r.brandName);return {subject:t.subject,body:t.body+(r.invoice.shareToken?`\n\nView invoice: ${origin}/invoice/${r.invoice.shareToken}`:'')};}
 if(r.kind==='approval')return {subject:`${r.count} video${r.count===1?'':'s'} waiting for your approval`,body:`${hi}You have ${r.count} video${r.count===1?'':'s'} ready for review. Please approve or share feedback in your dashboard:\n${dash}${sign}`};
 return {subject:`Your Nova Frames report for ${r.month} is ready`,body:`${hi}Your monthly report is ready in your dashboard:\n${dash}${sign}`};
}
function waValues(r:any,origin:string){
 if(r.kind==='shoot'||r.kind==='booking')return [r.brandName,r.shoot.title,formatInZone(r.shoot.startsAt,r.shoot.timeZone),r.shoot.location||'To be confirmed'];
 if(r.kind==='payment')return [r.brandName,r.invoice.number,rupees(r.invoice.balancePaise),r.invoice.dueDate,r.invoice.shareToken?`${origin}/invoice/${r.invoice.shareToken}`:origin+'/'];
 if(r.kind==='approval')return [r.brandName,String(r.count),origin+'/'];
 return [r.brandName,new Date(r.month+'-01T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}),origin+'/'];
}
// Claim a reminder+channel row; only a new row, or one that was skipped/failed (max 3 tries), may be (re)sent.
async function claim(key:string,r:any,channel:string,to:string,at:string){
 const db=getDb();
 const fresh=rows(await db.execute(sql`INSERT INTO reminder_log (key,kind,brand_id,channel,recipient,state,attempts,summary,created,updated) VALUES (${key},${r.kind},${r.brandId},${channel},${to},'sending',1,${r.summary},${at},${at}) ON CONFLICT (key) DO NOTHING RETURNING key`));
 if(fresh.length)return true;
 return rows(await db.execute(sql`UPDATE reminder_log SET state='sending',attempts=attempts+1,recipient=${to},updated=${at} WHERE key=${key} AND state IN ('not sent','failed') AND attempts<3 RETURNING key`)).length>0;
}
async function record(key:string,state:string,error:string|null,messageId:string|null){await getDb().execute(sql`UPDATE reminder_log SET state=${state},error=${error},message_id=${messageId},updated=${new Date().toISOString()} WHERE key=${key}`);}
export async function runReminders(origin:string,now=Date.now()){
 await ensureReminderStorage();const due=dueReminders(await loadInputs(now)),people=await contacts(),ch=reminderChannels(),wa=await whatsappStatus(origin),at=new Date(now).toISOString(),result={due:due.length,sent:0,notSent:0,failed:0};
 const waTpl=(kind:string)=>kind==='payment'?wa.reminderTemplate:wa.extraTemplates?.[kind];
 for(const r of due){
  const c:any=people.get(r.brandId)||{};if(c.enabled&&c.enabled[r.kind]===false)continue;
  const email=r.kind==='payment'&&r.invoice.billingEmail||c.email,phone=c.whatsapp,optedIn=!!(c.optIn&&c.whatsappDigits&&c.optIn.number?.replace(/[^\d]/g,'')===c.whatsappDigits);
  const targets:[string,string,string|null][]=[];
  if(email)targets.push(['email',email,ch.email.configured?null:'Email not set up. Missing: '+ch.email.missing.join(', ')]);
  if(phone)targets.push(['whatsapp',phone,!optedIn?'No WhatsApp opt-in recorded for this number.':wa.step!=='ready'?'WhatsApp setup incomplete (Invoices → WhatsApp).':!waTpl(r.kind)?`No approved template chosen for “${KIND_LABEL[r.kind]}”.`:null]);
  if(!targets.length){targets.push(['none','',`No email or WhatsApp number saved for ${r.brandName}.`]);}
  for(const [channel,to,blocker] of targets){
   const key=`${r.key}:${channel}`;if(!(await claim(key,r,channel,to,at)))continue;
   if(blocker){await record(key,'not sent',blocker,null);result.notSent++;continue;}
   try{
    if(channel==='email'){const m=emailFor(r,origin);await record(key,'sent to email provider',null,await sendEmailReminder(to,m.subject,m.body));}
    else{const s=await sendTemplate(r.kind==='payment'?'reminder':r.kind,to,waValues(r,origin),origin);await record(key,'accepted',null,s.id);}
    result.sent++;
   }catch(e){await record(key,'failed',(e as Error).message.slice(0,300),null);result.failed++;}
  }
 }
 return result;
}
export async function reminderLog(limit=200){await ensureReminderStorage();return rows(await getDb().execute(sql`SELECT * FROM reminder_log ORDER BY updated DESC LIMIT ${limit}`)).map(r=>({key:String(r.key),kind:String(r.kind),brandId:String(r.brand_id),channel:String(r.channel),to:String(r.recipient),state:String(r.state),error:r.error?String(r.error):'',attempts:Number(r.attempts),summary:String(r.summary),created:String(r.created),updated:String(r.updated)}));}
export async function upcoming(origin:string){await ensureReminderStorage();return dueReminders(await loadInputs(Date.now())).map(r=>({key:r.key,kind:r.kind,brandId:r.brandId,summary:r.summary}));}
