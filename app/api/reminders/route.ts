import {developerPrivate} from '../../../lib/developer-privacy';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {principal,requireOrigin} from '../../../lib/auth';
import {contacts,saveContact,reminderLog,upcoming,runReminders,ensureReminderStorage,KIND_LABEL} from '../../../lib/reminders';
import {whatsappStatus,chooseReminderTemplate,REMINDER_TEMPLATES} from '../../../lib/whatsapp';
import {reminderChannels} from '../../../lib/invoices';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const rows=(r:any)=>(r?.rows||[]) as any[];
async function staff(req:Request){const u=await principal(req);if(!u.admin&&!u.roles.includes('manager'))throw Error('Only administrators and managers can manage reminders.');return u;}
async function GET_(req:Request){try{
 const u=await staff(req),origin=new URL(req.url).origin;await ensureReminderStorage();
 const brands=rows(await getDb().execute(sql`SELECT id,name FROM brands ORDER BY name`)).map(b=>({id:String(b.id),name:String(b.name)})),people=await contacts();
 return Response.json({admin:u.admin,brands:brands.map(b=>({...b,contact:people.get(b.id)||null})),log:await reminderLog(),upcoming:await upcoming(origin),kinds:KIND_LABEL,setup:{email:reminderChannels().email,whatsapp:await whatsappStatus(origin),templates:REMINDER_TEMPLATES,cron:!!process.env.CRON_SECRET}},{headers});
}catch(e){return Response.json({error:(e as Error).message},{status:403,headers});}}
async function POST_(req:Request){try{
 requireOrigin(req);const u=await staff(req),b:any=await req.json(),origin=new URL(req.url).origin;
 if(b?.type==='contact'){const id=String(b.brandId||'').slice(0,100);if(!rows(await getDb().execute(sql`SELECT id FROM brands WHERE id=${id}`)).length)throw Error('Client not found.');await saveContact(id,b.contact||{},u.name);return Response.json({ok:true},{headers});}
 if(!u.admin)throw Error('Administrator access required.');
 if(b?.type==='template'){await chooseReminderTemplate(String(b.kind||''),b.template||null);return Response.json({ok:true},{headers});}
 if(b?.type==='run')return Response.json({ok:true,...await runReminders(origin)},{headers});
 throw Error('Invalid request.');
}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);