import {developerPrivate} from '../../../lib/developer-privacy';
import {isValidDay} from '../../../lib/dates';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {principal,requireOrigin} from '../../../lib/auth';
import {ensureInvoiceStorage,allInvoices,mayManageInvoices,nextInvoiceNumber,withStatus,reminderChannels,reminderText,invoiceText,sendEmailReminder,rupees} from '../../../lib/invoices';
import {whatsappStatus,sendTemplate,trackMessage,newShareToken,shareHash} from '../../../lib/whatsapp';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const clean=(v:unknown,max=500)=>String(v||'').trim().slice(0,max);
const rows=(r:any)=>(r?.rows||[]) as any[];
const day=(v:unknown,label:string)=>{const d=clean(v,10);if(!isValidDay(d))throw Error(`Choose a valid ${label}.`);return d;};
const paise=(v:unknown,label:string)=>{const n=Number(String(v??'').replace(/[,\s₹]/g,''));if(!Number.isFinite(n)||n<=0||n>1e9)throw Error(`Enter ${label} in rupees.`);return Math.round(n*100);};
// Invoices are for administrators and managers only; clients and other staff are refused.
// Deliver an invoice or reminder. WhatsApp goes from Nova Frames' connected number with an approved template;
// a successful API call is only "accepted" — the delivery state is updated later by the status webhook.
async function deliver(inv:any,kind:'invoice'|'reminder',link:string,by:string,only?:string){
 const db=getDb(),origin=new URL(link).origin,brandName=String(rows(await db.execute(sql`SELECT name FROM brands WHERE id=${inv.brandId}`))[0]?.name||'there'),at=new Date().toISOString(),out:any[]=[];
 const ch=reminderChannels(),wa=await whatsappStatus(origin),s=withStatus(inv);
 for(const channel of ['email','whatsapp']){
  if(only&&only!==channel)continue;const to=channel==='email'?inv.billingEmail:inv.billingPhone;if(!to)continue;
  const d:any={id:crypto.randomUUID(),at,by,channel,to,kind};
  if(channel==='email'&&!ch.email.configured){out.push({...d,state:'not sent',error:'Email not set up. Missing: '+ch.email.missing.join(', ')});continue;}
  if(channel==='whatsapp'&&wa.step!=='ready'){out.push({...d,state:'not sent',error:'WhatsApp setup incomplete: '+({server:'server settings '+wa.missing.join(', '),connect:'connect Nova Frames’ Meta account',choose:'choose the WhatsApp number',templates:'choose approved invoice and reminder templates'} as any)[wa.step]});continue;}
  try{
   if(channel==='email'){const t=kind==='invoice'?invoiceText(inv,brandName):reminderText(inv,brandName);const id=await sendEmailReminder(to,t.subject,t.body+`\n\nView invoice: ${link}`);out.push({...d,state:'sent to email provider',messageId:id});}
   else{const r=await sendTemplate(kind,to,[brandName,inv.number,rupees(s.balancePaise||inv.totalPaise),inv.dueDate,link],origin);await trackMessage(r.id,inv.id,d.id);out.push({...d,state:'accepted',messageId:r.id,metaStatus:r.messageStatus});}
  }catch(e){out.push({...d,state:'failed',error:(e as Error).message.slice(0,300)});}
 }
 return out;
}
async function staff(req:Request){const u=await principal(req);if(!mayManageInvoices(u))throw Error('Only administrators and managers can manage invoices.');return u;}
async function GET_(req:Request){try{
 await staff(req);const db=getDb();await ensureInvoiceStorage();
 const brands=rows(await db.execute(sql`SELECT id,name FROM brands ORDER BY name`)).map(b=>({id:String(b.id),name:String(b.name)}));
 const contacts=await db.execute(sql`SELECT brand_id,email FROM client_accounts WHERE active=1`).then(rows).catch(()=>[]);
 const channels={...reminderChannels(),whatsappSetup:await whatsappStatus(new URL(req.url).origin)};
 return Response.json({invoices:(await allInvoices()).map(({shareHash:_h,...i}:any)=>({...i,link:i.shareToken?new URL('/invoice/'+i.shareToken,req.url).toString():''})),brands:brands.map(b=>({...b,clientEmail:String(contacts.find((c:any)=>c.brand_id===b.id)?.email||'')})),channels},{headers});
}catch(e){return Response.json({error:(e as Error).message},{status:403,headers});}}
async function POST_(req:Request){try{
 requireOrigin(req);const u=await staff(req);await ensureInvoiceStorage();const db=getDb(),b:any=await req.json(),at=new Date().toISOString(),origin=new URL(req.url).origin;
 const id=clean(b.id,100),row=id?rows(await db.execute(sql`SELECT payload,updated FROM invoices WHERE id=${id}`))[0]:null;
 if(id&&!row)throw Error('Invoice not found.');const old=row?JSON.parse(row.payload):null;
 const save=async(inv:any)=>{const json=JSON.stringify(inv),version=crypto.randomUUID();
  if(old){const ok=rows(await db.execute(sql`UPDATE invoices SET brand_id=${inv.brandId},due_date=${inv.dueDate},payload=${json},updated=${version} WHERE id=${inv.id} AND updated=${clean(b.version,100)||row.updated} RETURNING id`));if(!ok.length)throw Error('Someone else updated this invoice. Reload and try again.');}
  else await db.execute(sql`INSERT INTO invoices (id,brand_id,number,due_date,payload,updated) VALUES (${inv.id},${inv.brandId},${inv.number},${inv.dueDate},${json},${version})`);
  return Response.json({ok:true,invoice:withStatus({...inv,version})},{headers});};
 if(b.type==='invoice'){
  const v=b.invoice||{},brandId=clean(v.brandId,100);
  const brand=rows(await db.execute(sql`SELECT id FROM brands WHERE id=${brandId}`))[0];if(!brand)throw Error('Choose the client.');
  const period=clean(v.period,7);if(period&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Choose a valid billing month.');
  const issueDate=day(v.issueDate,'invoice date'),dueDate=day(v.dueDate,'due date');if(dueDate<issueDate)throw Error('The due date cannot be before the invoice date.');
  const totalPaise=paise(v.amount,'the invoice amount'),email=clean(v.billingEmail,200).toLowerCase(),phone=clean(v.billingPhone,30);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid billing email.');
  if(phone&&!/^\+?[0-9\s-]{8,20}$/.test(phone))throw Error('Enter the WhatsApp number with country code, e.g. +91 98765 43210.');
  if(old&&(old.payments||[]).reduce((a:number,p:any)=>a+p.amountPaise,0)>totalPaise)throw Error('The amount cannot be less than what has already been paid.');
  const base={brandId,period,issueDate,dueDate,totalPaise,description:clean(v.description,300),billingEmail:email,billingPhone:phone,notes:clean(v.notes,2000)};
  if(!old)return await save({...base,id:crypto.randomUUID(),number:await nextInvoiceNumber(),draft:true,payments:[],reminders:[],deliveries:[],createdAt:at,createdBy:u.name,history:[{at,by:u.name,detail:'Invoice created'}]});
  return await save({...old,...base,history:[...old.history,{at,by:u.name,detail:'Invoice updated'}]});
 }
 if(!old)throw Error('Invoice not found.');
 // Issue: mark sent and deliver through every configured channel that has a recipient; each attempt is recorded, nothing is faked.
 if(b.type==='issue'||b.type==='resend'){
  if(old.void)throw Error('This invoice is void.');if(b.type==='issue'&&!old.draft)throw Error('This invoice was already issued.');if(b.type==='resend'&&old.draft)throw Error('Issue the invoice first.');
  if(!old.billingEmail&&!old.billingPhone)throw Error('Add a billing email or WhatsApp number before issuing.');
  const token=old.shareToken||newShareToken(),inv={...old,shareToken:token,shareHash:shareHash(token)},link=origin+'/invoice/'+token;
  const deliveries=await deliver(inv,'invoice',link,u.name);
  return await save({...inv,draft:false,issuedAt:old.issuedAt||at,issuedBy:old.issuedBy||u.name,deliveries:[...(old.deliveries||[]),...deliveries].slice(-50),history:[...old.history,{at,by:u.name,detail:(b.type==='issue'?'Issued':'Re-sent')+` · ${deliveries.map(d=>d.channel+': '+d.state).join(', ')||'no channel'}`}]});
 }
 if(b.type==='payment'){
  if(old.void)throw Error('This invoice is void.');if(old.draft)throw Error('Issue the invoice before recording payments.');const p=b.payment||{},amountPaise=paise(p.amount,'the payment amount'),balance=old.totalPaise-(old.payments||[]).reduce((a:number,x:any)=>a+x.amountPaise,0);
  if(amountPaise>balance)throw Error('The payment is more than the balance due.');
  const date=day(p.date,'payment date');
  return await save({...old,payments:[...old.payments,{id:crypto.randomUUID(),date,amountPaise,method:clean(p.method,40)||'Bank transfer',reference:clean(p.reference,120),by:u.name,at}],history:[...old.history,{at,by:u.name,detail:`Payment recorded: ₹${(amountPaise/100).toLocaleString('en-IN')}`}]});
 }
 if(b.type==='remove-payment'){const pid=clean(b.paymentId,100);if(!old.payments.some((x:any)=>x.id===pid))throw Error('Payment not found.');return await save({...old,payments:old.payments.filter((x:any)=>x.id!==pid),history:[...old.history,{at,by:u.name,detail:'Payment removed'}]});}
 if(b.type==='void'){if(!u.admin)throw Error('Only the administrator can void an invoice.');return await save({...old,void:true,history:[...old.history,{at,by:u.name,detail:'Invoice voided'+(clean(b.reason)?': '+clean(b.reason):'')}]});}
 if(b.type==='remind'){
  const channel=clean(b.channel,20),inv=withStatus(old);if(!['email','whatsapp'].includes(channel))throw Error('Choose email or WhatsApp.');
  if(inv.status==='Paid'||old.void)throw Error('This invoice needs no reminder.');if(old.draft)throw Error('Issue the invoice before sending reminders.');
  const wa=await whatsappStatus(origin);
  if(channel==='email'&&!reminderChannels().email.configured)throw Error('Email reminders are not set up yet. Missing: '+reminderChannels().email.missing.join(', ')+'.');
  if(channel==='whatsapp'&&wa.step!=='ready')throw Error('WhatsApp is not fully set up yet. Finish Invoices → WhatsApp setup.');
  if(!(channel==='email'?old.billingEmail:old.billingPhone))throw Error(channel==='email'?'Add a billing email to this invoice first.':'Add the client’s WhatsApp number to this invoice first.');
  const token=old.shareToken||newShareToken(),withLink={...old,shareToken:token,shareHash:shareHash(token)};
  const [entry]=await deliver(withLink,'reminder',origin+'/invoice/'+token,u.name,channel);
  await save({...withLink,reminders:[...(old.reminders||[]),entry].slice(-50)});
  if(entry.state==='failed')return Response.json({error:'Reminder not sent: '+entry.error},{status:502,headers});
  return Response.json({ok:true,state:entry.state},{headers});
 }
 throw Error('Invalid request.');
}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);