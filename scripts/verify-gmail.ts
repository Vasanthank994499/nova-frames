// Self-check for Gmail sending: config, message shape, safe errors, Resend fallback, and the invoice issue flow.
// No real email: a fake transport captures messages; any network call fails the test. Throwaway DB.
import assert from 'node:assert';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-gmail-'));process.env.APP_ORIGINS='http://localhost:3100';
for(const k of ['GMAIL_USER','GMAIL_APP_PASSWORD','RESEND_API_KEY','INVOICE_FROM_EMAIL','INVOICE_REPLY_TO','INVOICE_FROM_NAME','WHATSAPP_TOKEN','META_APP_ID'])delete process.env[k];
let netCalls=0;globalThis.fetch=(async()=>{netCalls++;return new Response(JSON.stringify({id:'re_1'}),{status:200});}) as any;
(async()=>{
 const inv=await import('../lib/invoices');
 assert.equal(inv.reminderChannels().email.configured,false);assert.deepEqual(inv.reminderChannels().email.missing,['GMAIL_USER','GMAIL_APP_PASSWORD']);
 Object.assign(process.env,{GMAIL_USER:'novaframes.test@gmail.com',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',INVOICE_REPLY_TO:'hello@example.test'});
 const ch=inv.reminderChannels().email;assert.deepEqual([ch.configured,ch.provider,ch.from],[true,'Gmail','novaframes.test@gmail.com']);
 const sent:any[]=[];inv.setEmailTransportForTests(()=>({sendMail:async(m:any)=>{sent.push(m);return {messageId:'<msg-'+sent.length+'@gmail>',rejected:[]};}}));
 assert.equal(await inv.sendEmailReminder('client@example.test','Subj','Body'),'<msg-1@gmail>');
 assert.deepEqual([sent[0].from,sent[0].to,sent[0].replyTo],['Nova Frames <novaframes.test@gmail.com>','client@example.test','hello@example.test']);
 inv.setEmailTransportForTests(()=>({sendMail:async()=>{throw Object.assign(new Error('535-5.7.8 Username and Password not accepted. secret-detail user@x'),{responseCode:535});}}));
 await assert.rejects(inv.sendEmailReminder('a@b.test','s','t'),(e:any)=>e.message==='Gmail refused the sign-in. Check GMAIL_USER and the app password.'&&!/secret-detail|Username/.test(e.message));
 inv.setEmailTransportForTests(()=>({sendMail:async()=>({messageId:'x',rejected:['a@b.test']})}));
 await assert.rejects(inv.sendEmailReminder('a@b.test','s','t'),/rejected the recipient/);
 // Resend fallback still works when Gmail is not set.
 delete process.env.GMAIL_USER;Object.assign(process.env,{RESEND_API_KEY:'re_test',INVOICE_FROM_EMAIL:'billing@example.test'});
 assert.equal(inv.reminderChannels().email.provider,'Resend');assert.equal(await inv.sendEmailReminder('a@b.test','s','t'),'re_1');assert.equal(netCalls,1);
 delete process.env.RESEND_API_KEY;delete process.env.INVOICE_FROM_EMAIL;process.env.GMAIL_USER='novaframes.test@gmail.com';netCalls=0;
 globalThis.fetch=(async(u:any)=>{throw Error('NETWORK CALL ATTEMPTED: '+u);}) as any;
 // Real invoice issue flow through the API handler, Gmail path captured.
 const okSent:any[]=[];inv.setEmailTransportForTests(()=>({sendMail:async(m:any)=>{okSent.push(m);return {messageId:'<inv@gmail>',rejected:[]};}}));
 const {getDb}=await import('../db');const {sessions,brands}=await import('../db/schema');const {digest}=await import('../lib/auth');
 const db=getDb();await db.insert(brands).values({id:'b1',name:'Synthetic Brand',payload:JSON.stringify({id:'b1',name:'Synthetic Brand'})});
 const t=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');await db.insert(sessions).values({tokenHash:await digest(t),accountId:'admin',expires:Date.now()+3600000});
 const {POST}=await import('../app/api/invoices/route');
 const post=async(body:any)=>{const r=await POST(new Request('http://localhost:3100/api/invoices',{method:'POST',headers:{cookie:'nf_session='+t,origin:'http://localhost:3100','content-type':'application/json'},body:JSON.stringify(body)}));return {s:r.status,d:await r.json()};};
 let r=await post({type:'invoice',invoice:{brandId:'b1',issueDate:'2026-11-19',dueDate:'2026-12-19',amount:'2500',description:'Synthetic',billingEmail:'client@example.test'}});assert.equal(r.s,200);
 r=await post({type:'issue',id:r.d.invoice.id,version:r.d.invoice.version});assert.equal(r.s,200,JSON.stringify(r.d));
 const d=r.d.invoice.deliveries.find((x:any)=>x.channel==='email');assert.equal(d.state,'sent to email provider');assert.equal(okSent.length,1);
 assert.match(okSent[0].subject,/Invoice NF-\d{4}-\d{4}/);assert.match(okSent[0].text,/View invoice: http:\/\/localhost:3100\/invoice\//);assert.equal(okSent[0].from,'Nova Frames <novaframes.test@gmail.com>');
 console.log('gmail self-check ok (no real email sent, no network calls)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
