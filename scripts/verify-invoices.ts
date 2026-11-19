// Self-check: status rules (paid / overdue by IST due date / pending), balances, reminder channel config.
import assert from 'node:assert';
import {invoiceStatus,withStatus,reminderChannels} from '../lib/invoices';
const inv={totalPaise:5000000,dueDate:'2026-11-18',payments:[] as any[]};
assert.equal(invoiceStatus(inv,'2026-11-18'),'Pending');
assert.equal(invoiceStatus(inv,'2026-11-19'),'Overdue');
assert.equal(invoiceStatus({...inv,payments:[{amountPaise:2000000}]},'2026-11-19'),'Overdue');
assert.equal(withStatus({...inv,payments:[{amountPaise:2000000}]},'2026-11-17').balancePaise,3000000);
assert.equal(invoiceStatus({...inv,payments:[{amountPaise:2000000},{amountPaise:3000000}]},'2027-01-01'),'Paid');
assert.equal(invoiceStatus({...inv,void:true},'2027-01-01'),'Void');
for(const k of ['GMAIL_USER','GMAIL_APP_PASSWORD','RESEND_API_KEY','INVOICE_FROM_EMAIL','WHATSAPP_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_REMINDER_TEMPLATE'])delete process.env[k];
const c=reminderChannels();assert(!c.email.configured&&!c.whatsapp.configured);assert.deepEqual(c.email.missing,['GMAIL_USER','GMAIL_APP_PASSWORD']); // Gmail is the suggested setup; Resend still works when set
console.log('invoices self-check ok');
// Delivery adapters against stubbed providers: correct endpoints, auth, recipients and template params.
(async()=>{
 const {sendEmailReminder,sendWhatsAppReminder,invoiceText,invoiceStatus:st}=await import('../lib/invoices');
 assert.equal(st({totalPaise:1,dueDate:'2000-01-01',payments:[],draft:true}),'Draft');
 Object.assign(process.env,{RESEND_API_KEY:'re_test',INVOICE_FROM_EMAIL:'billing@example.test',WHATSAPP_TOKEN:'wa_test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_INVOICE_TEMPLATE:'invoice_issued'});
 const calls:any[]=[];const real=globalThis.fetch;
 globalThis.fetch=(async(u:any,init:any)=>{calls.push({u:String(u),auth:init.headers.Authorization,body:JSON.parse(init.body)});return new Response(JSON.stringify(String(u).includes('resend')?{id:'em_1'}:{messages:[{id:'wamid.1'}]}),{status:200});}) as any;
 const inv={number:'NF-2026-0009',totalPaise:4500000,dueDate:'2026-12-01',issueDate:'2026-11-19',period:'2026-11',description:'Retainer',payments:[]};
 const t=invoiceText(inv,'Bean There');assert.match(t.body,/₹45,000/);assert.match(t.subject,/NF-2026-0009/);
 assert.equal(await sendEmailReminder('a@b.test',t.subject,t.body),'em_1');
 assert.equal(await sendWhatsAppReminder('+91 98000 11111',inv,'Bean There',process.env.WHATSAPP_INVOICE_TEMPLATE),'wamid.1');
 assert.equal(calls[0].u,'https://api.resend.com/emails');assert.equal(calls[0].auth,'Bearer re_test');assert.deepEqual(calls[0].body.to,['a@b.test']);
 assert.equal(calls[1].u,'https://graph.facebook.com/v27.0/123/messages');assert.equal(calls[1].body.to,'919800011111');assert.equal(calls[1].body.template.name,'invoice_issued');
 assert.deepEqual(calls[1].body.template.components[0].parameters.map((p:any)=>p.text),['Bean There','NF-2026-0009','₹45,000','2026-12-01']);
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{message:'Template not approved'}}),{status:400})) as any;
 await assert.rejects(sendWhatsAppReminder('+919800011111',inv,'X','invoice_issued'),/Template not approved/);
 globalThis.fetch=real;console.log('invoice delivery self-check ok');
})();
