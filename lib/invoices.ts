import {getDb} from '../db';
import {sql} from 'drizzle-orm';
// Amounts are stored in paise (integers) to avoid rounding errors; dates are IST calendar days.
const rows=(r:any)=>(r?.rows||[]) as any[];
let ready:Promise<void>|undefined;
export function ensureInvoiceStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS invoices (id text PRIMARY KEY, brand_id text NOT NULL, number text NOT NULL UNIQUE, due_date text NOT NULL, payload text NOT NULL, updated text NOT NULL)`)).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
export const mayManageInvoices=(u:{admin:boolean,roles:string[]})=>u.admin||u.roles.includes('manager');
export const istToday=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
export const paid=(inv:any)=>(inv.payments||[]).reduce((a:number,p:any)=>a+p.amountPaise,0);
// Paid when payments cover the total; otherwise Overdue after the due date (IST), else Pending.
export function invoiceStatus(inv:any,today=istToday()){if(inv.void)return 'Void';if(inv.draft)return 'Draft';if(paid(inv)>=inv.totalPaise)return 'Paid';return inv.dueDate<today?'Overdue':'Pending';}
export function withStatus(inv:any,today=istToday()){const p=paid(inv);return {...inv,paidPaise:p,balancePaise:Math.max(0,inv.totalPaise-p),status:invoiceStatus(inv,today)};}
export async function allInvoices(){await ensureInvoiceStorage();return rows(await getDb().execute(sql`SELECT payload,updated FROM invoices ORDER BY due_date DESC`)).map(r=>withStatus({...JSON.parse(r.payload),version:String(r.updated)}));}
export async function nextInvoiceNumber(){const y=istToday().slice(0,4),r=rows(await getDb().execute(sql`SELECT number FROM invoices WHERE number LIKE ${'NF-'+y+'-%'}`));const max=Math.max(0,...r.map(x=>Number(String(x.number).split('-')[2])||0));return `NF-${y}-${String(max+1).padStart(4,'0')}`;}
export const rupees=(p:number)=>'₹'+(p/100).toLocaleString('en-IN',{minimumFractionDigits:p%100?2:0,maximumFractionDigits:2});
// Reminder channels: only real, configured integrations. Nothing is simulated.
export function reminderChannels(){
 // Email: Gmail (GMAIL_USER + GMAIL_APP_PASSWORD) is used when set, otherwise Resend.
 const gmail=!!(process.env.GMAIL_USER&&process.env.GMAIL_APP_PASSWORD),resend=!!(process.env.RESEND_API_KEY&&process.env.INVOICE_FROM_EMAIL);
 const email={configured:gmail||resend,provider:gmail?'Gmail':resend?'Resend':'',from:gmail?process.env.GMAIL_USER:resend?process.env.INVOICE_FROM_EMAIL:'',missing:gmail||resend?[]:['GMAIL_USER','GMAIL_APP_PASSWORD']};
 const waBase=[!process.env.WHATSAPP_TOKEN&&'WHATSAPP_TOKEN',!process.env.WHATSAPP_PHONE_NUMBER_ID&&'WHATSAPP_PHONE_NUMBER_ID'].filter(Boolean) as string[];
 const whatsapp={configured:!waBase.length&&!!process.env.WHATSAPP_REMINDER_TEMPLATE,missing:[...waBase,...(!process.env.WHATSAPP_REMINDER_TEMPLATE?['WHATSAPP_REMINDER_TEMPLATE']:[])]};
 const whatsappInvoice={configured:!waBase.length&&!!process.env.WHATSAPP_INVOICE_TEMPLATE,missing:[...waBase,...(!process.env.WHATSAPP_INVOICE_TEMPLATE?['WHATSAPP_INVOICE_TEMPLATE']:[])]};
 return {email,whatsapp,whatsappInvoice};
}
export function reminderText(inv:any,brandName:string){const s=withStatus(inv);return {subject:`Payment reminder: invoice ${inv.number} (${rupees(s.balancePaise)} ${s.status==='Overdue'?'overdue':'due '+inv.dueDate})`,body:`Hello ${brandName},\n\nThis is a reminder that invoice ${inv.number}${inv.description?` for ${inv.description}`:''} has ${rupees(s.balancePaise)} outstanding, ${s.status==='Overdue'?'which was due on':'due on'} ${inv.dueDate}.\n\nPlease ignore this message if you have already paid.\n\nThank you,\nNova Frames`};}
// Gmail over SMTP (smtp.gmail.com:465, TLS) with a Google app password. Gmail only sends as the signed-in address (or its verified aliases).
export function gmailTransport(){const nodemailer=require('nodemailer');return nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}});}
export let emailTransportForTests:null|(()=>{sendMail:(m:any)=>Promise<any>})=null;
export function setEmailTransportForTests(t:typeof emailTransportForTests){emailTransportForTests=t;}
export async function sendEmailReminder(to:string,subject:string,text:string){
 if(process.env.GMAIL_USER&&process.env.GMAIL_APP_PASSWORD){
  const from=`${process.env.INVOICE_FROM_NAME||'Nova Frames'} <${process.env.GMAIL_USER}>`;
  let info:any;
  try{info=await (emailTransportForTests?emailTransportForTests():gmailTransport()).sendMail({from,to,subject,text,...(process.env.INVOICE_REPLY_TO?{replyTo:process.env.INVOICE_REPLY_TO}:{})});}
  // Never echo the server's full response (it can include account details); keep the reason short.
  catch(e:any){const code=String(e?.responseCode||e?.code||'');throw Error(code==='535'||code==='EAUTH'?'Gmail refused the sign-in. Check GMAIL_USER and the app password.':`Gmail could not send the email${code?` (${code})`:''}.`);}
  if(info?.rejected?.length)throw Error('Gmail rejected the recipient address.');
  return String(info?.messageId||'');
 }
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.INVOICE_FROM_EMAIL,to:[to],subject,text,...(process.env.INVOICE_REPLY_TO?{reply_to:process.env.INVOICE_REPLY_TO}:{})})});
 const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d?.message||`Email provider returned ${r.status}.`);return String(d.id||'');
}
// WhatsApp Cloud API: business-initiated messages must use an approved template. Template body params: {{1}} client, {{2}} invoice no., {{3}} amount, {{4}} due date.
export async function sendWhatsAppReminder(to:string,inv:any,brandName:string,template=process.env.WHATSAPP_REMINDER_TEMPLATE){
 const s=withStatus(inv),version=process.env.WHATSAPP_GRAPH_VERSION||'v27.0';
 const r=await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:'Bearer '+process.env.WHATSAPP_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:to.replace(/[^\d]/g,''),type:'template',template:{name:template,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[brandName,inv.number,rupees(s.balancePaise),inv.dueDate].map(text=>({type:'text',text}))}]}})});
 const d:any=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d?.error?.message||`WhatsApp returned ${r.status}.`);return String(d.messages?.[0]?.id||'');
}
// The invoice itself as plain text (email body); amounts in rupees, dates as IST days.
export function invoiceText(inv:any,brandName:string){return {subject:`Invoice ${inv.number} from Nova Frames: ${rupees(inv.totalPaise)} due ${inv.dueDate}`,body:[`Hello ${brandName},`,'',`Please find your invoice details below.`,'',`Invoice: ${inv.number}`,`Invoice date: ${inv.issueDate}`,inv.period?`Billing month: ${inv.period}`:'',inv.description?`For: ${inv.description}`:'',`Amount due: ${rupees(inv.totalPaise)}`,`Due date: ${inv.dueDate}`,inv.notes?`\n${inv.notes}`:'','',process.env.INVOICE_PAYMENT_DETAILS?`How to pay:\n${process.env.INVOICE_PAYMENT_DETAILS}`:'','','Thank you,','Nova Frames'].filter((l,i,a)=>l!==''||a[i-1]!=='').join('\n')};}
