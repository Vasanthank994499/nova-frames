// Self-check with a stubbed Meta Graph API: connect → choose number → templates → send → status webhooks.
import assert from 'node:assert';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-wa-'));
Object.assign(process.env,{META_APP_ID:'app1',META_APP_SECRET:'sec',META_WEBHOOK_VERIFY_TOKEN:'v',META_TOKEN_KEY:Buffer.alloc(32,5).toString('base64')});
(async()=>{
 const wa=await import('../lib/whatsapp');const {getDb}=await import('../db');const {sql}=await import('drizzle-orm');const {ensureInvoiceStorage}=await import('../lib/invoices');
 const O='https://nova.example';let phoneStatus='CONNECTED';const sent:any[]=[];
 globalThis.fetch=(async(u:any,init:any={})=>{const url=new URL(String(u)),p=url.pathname,auth=init.headers?.Authorization;const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s});
  if(p.endsWith('/oauth/access_token'))return J(url.searchParams.get('grant_type')==='fb_exchange_token'?{access_token:'LONG',expires_in:5184000}:{access_token:'SHORT'});
  if(p.endsWith('/debug_token')){assert.equal(auth,'Bearer app1|sec');return J({data:{scopes:wa.WA_SCOPES,granular_scopes:[{scope:'whatsapp_business_management',target_ids:['W1']}]}});}
  assert.equal(auth,'Bearer LONG');
  if(p.endsWith('/W1/phone_numbers'))return J({data:[{id:'P1',display_phone_number:'+91 80000 00000',verified_name:'Nova Frames',quality_rating:'GREEN',status:'CONNECTED'}]});
  if(p.endsWith('/W1')&&(init.method||'GET')==='GET')return J({id:'W1',name:'Nova Frames WABA'});
  if(p.endsWith('/P1')&&(init.method||'GET')==='GET')return J({status:phoneStatus,display_phone_number:'+91 80000 00000',verified_name:'Nova Frames'});
  if(p.endsWith('/W1/subscribed_apps'))return J({success:true});
  if(p.endsWith('/W1/message_templates'))return J({data:[{name:'invoice_issued',language:'en',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Hi {{1}}, invoice {{2}} for {{3}} is due {{4}}. View: {{5}}'}]},{name:'promo',language:'en',status:'APPROVED',category:'MARKETING',components:[{type:'BODY',text:'{{1}}{{2}}{{3}}{{4}}{{5}}'}]},{name:'short',language:'en',status:'PENDING',category:'UTILITY',components:[{type:'BODY',text:'{{1}}'}]}]});
  if(p.endsWith('/P1/messages')){const b=JSON.parse(init.body);sent.push(b);return J({messaging_product:'whatsapp',contacts:[{wa_id:'919800011111'}],messages:[{id:'wamid.X'+sent.length}]});}
  throw Error('unexpected '+p);}) as any;
 assert.equal((await wa.whatsappStatus(O)).step,'connect');
 const {state}=await wa.startWhatsAppConnect(O);
 await assert.rejects(wa.finishWhatsAppConnect('code','forged',O,'Admin'),/expired/);
 await wa.finishWhatsAppConnect('code',state,O,'Admin');let st=await wa.whatsappStatus(O);assert.equal(st.step,'choose');assert.equal(st.accounts[0].phones[0].id,'P1');
 phoneStatus='PENDING';await assert.rejects(wa.chooseNumber('W1','P1',O),/pending/);phoneStatus='CONNECTED';
 await wa.chooseNumber('W1','P1',O);st=await wa.whatsappStatus(O);assert.equal(st.step,'templates');assert.equal(st.displayPhone,'+91 80000 00000');
 await assert.rejects(wa.chooseTemplates({name:'promo',language:'en'},{name:'invoice_issued',language:'en'}),/Utility/);
 await assert.rejects(wa.chooseTemplates({name:'invoice_issued',language:'en'},{name:'short',language:'en'}),/pending/);
 await wa.chooseTemplates({name:'invoice_issued',language:'en'},{name:'invoice_issued',language:'en'});assert.equal((await wa.whatsappStatus(O)).step,'ready');
 const row:any=((await getDb().execute(sql`SELECT payload,token_enc FROM whatsapp_connection`)) as any).rows[0];assert(!row.payload.includes('LONG')&&!String(row.token_enc).includes('LONG'));
 const r=await wa.sendTemplate('invoice','+91 98000 11111',['Bean There','NF-2026-0001','₹45,000','2026-12-05',O+'/invoice/tok'],O);assert.equal(r.id,'wamid.X1');
 assert.equal(sent[0].to,'+919800011111');assert.equal(sent[0].template.name,'invoice_issued');assert.equal(sent[0].template.components[0].parameters[4].text,O+'/invoice/tok');
 await ensureInvoiceStorage();const inv={id:'i1',brandId:'b',number:'NF-2026-0001',totalPaise:1,dueDate:'2026-12-05',payments:[],deliveries:[{id:'d1',channel:'whatsapp',state:'accepted'}],reminders:[]};
 await getDb().execute(sql`INSERT INTO invoices (id,brand_id,number,due_date,payload,updated) VALUES ('i1','b','NF-2026-0001','2026-12-05',${JSON.stringify(inv)},'v1')`);await wa.trackMessage('wamid.X1','i1','d1');
 const state1=async()=>JSON.parse(((await getDb().execute(sql`SELECT payload FROM invoices WHERE id='i1'`)) as any).rows[0].payload).deliveries[0];
 await wa.applyStatus({id:'wamid.X1',status:'delivered',timestamp:'1795070000'});assert.equal((await state1()).state,'delivered');
 await wa.applyStatus({id:'wamid.X1',status:'sent',timestamp:'1795069990'});assert.equal((await state1()).state,'delivered','late "sent" must not undo delivered');
 await wa.applyStatus({id:'wamid.X1',status:'read',timestamp:'1795070100'});assert.equal((await state1()).state,'read');
 await getDb().execute(sql`UPDATE invoices SET payload=${JSON.stringify(inv)} WHERE id='i1'`);
 await wa.applyStatus({id:'wamid.X1',status:'failed',errors:[{code:131026,title:'Message undeliverable',message:'Receiver incapable',error_data:{details:'Not a WhatsApp user'}}]});
 const f=await state1();assert.equal(f.state,'failed');assert.match(f.error,/131026.*undeliverable/);
 assert.equal(await wa.applyStatus({id:'wamid.unknown',status:'delivered'}),false);
 console.log('whatsapp self-check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
