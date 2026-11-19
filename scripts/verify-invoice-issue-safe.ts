// Self-check on a throwaway DB: issue a synthetic invoice (no channel configured, any network call fails the test),
// then verify payment-date validation and the secure invoice link page (valid, invalid, draft, void).
import assert from 'node:assert';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-invsafe-'));process.env.APP_ORIGINS='http://localhost:3100';
for(const k of ['RESEND_API_KEY','INVOICE_FROM_EMAIL','WHATSAPP_TOKEN','WHATSAPP_PHONE_NUMBER_ID','META_APP_ID','META_APP_SECRET'])delete process.env[k];
globalThis.fetch=(async(u:any)=>{throw Error('NETWORK CALL ATTEMPTED: '+u);}) as any;
(async()=>{
 const {getDb}=await import('../db');const {sessions,brands}=await import('../db/schema');const {digest}=await import('../lib/auth');
 const db=getDb();await db.insert(brands).values({id:'b1',name:'Synthetic Brand',payload:JSON.stringify({id:'b1',name:'Synthetic Brand'})});
 const t=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');await db.insert(sessions).values({tokenHash:await digest(t),accountId:'admin',expires:Date.now()+3600000});
 const {POST,GET}=await import('../app/api/invoices/route');
 const post=async(body:any)=>{const r=await POST(new Request('http://localhost:3100/api/invoices',{method:'POST',headers:{cookie:'nf_session='+t,origin:'http://localhost:3100','content-type':'application/json'},body:JSON.stringify(body)}));return {s:r.status,d:await r.json()};};
 const list=async()=>(await (await GET(new Request('http://localhost:3100/api/invoices',{headers:{cookie:'nf_session='+t}}))).json()).invoices;
 let r=await post({type:'invoice',invoice:{brandId:'b1',issueDate:'2026-11-19',dueDate:'2026-12-19',amount:'10000',description:'Synthetic QA invoice',billingEmail:'nobody@example.test',billingPhone:'+91 90000 00000'}});assert.equal(r.s,200);let inv=r.d.invoice;
 const draftToken=null;void draftToken;
 r=await post({type:'issue',id:inv.id,version:inv.version});assert.equal(r.s,200,JSON.stringify(r.d));inv=r.d.invoice;
 assert(inv.deliveries.every((d:any)=>d.state==='not sent'),'nothing delivered: '+JSON.stringify(inv.deliveries.map((d:any)=>d.state)));
 // Payment dates
 const pay=async(date:string,amount='100')=>{const cur=(await list()).find((i:any)=>i.id===inv.id);return post({type:'payment',id:inv.id,version:cur.version,payment:{amount,date,method:'UPI'}});};
 for(const bad of ['2026-02-30','2026-02-29','2026-04-31','2026-13-01','2026-11-1','19-11-2026',''])assert.match((await pay(bad)).d.error||'',/Choose a valid payment date/,'rejects '+JSON.stringify(bad));
 for(const good of ['2026-11-19','2028-02-29'])assert.equal((await pay(good)).s,200,'accepts '+good);
 const paid=(await list()).find((i:any)=>i.id===inv.id);assert.deepEqual(paid.payments.map((p:any)=>p.date),['2026-11-19','2028-02-29']);
 // Secure link page
 const {default:Page}=await import('../app/invoice/[token]/page');
 const render=async(token:string)=>renderToStaticMarkup(await Page({params:Promise.resolve({token})}) as React.ReactElement);
 const token=new URL(paid.link).pathname.split('/').pop()!;
 const ok=await render(token);assert(ok.includes(paid.number)&&ok.includes('₹10,000')&&ok.includes('₹9,800'),'valid link shows invoice: '+ok.replace(/<[^>]+>/g,' ').slice(0,300));
 assert(!ok.includes('nobody@example.test')&&!ok.includes('+91 90000'),'link page does not expose billing contacts');
 for(const bad of ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','short','../../etc','x'.repeat(65),token.slice(0,-1)+(token.endsWith('A')?'B':'A')])assert((await render(bad)).includes('Invoice not available'),'invalid token: '+bad.slice(0,20));
 r=await post({type:'invoice',invoice:{brandId:'b1',issueDate:'2026-11-19',dueDate:'2026-12-19',amount:'50'}});assert.equal(r.d.invoice.link||'','', 'drafts have no link');
 r=await post({type:'void',id:inv.id,version:(await list()).find((i:any)=>i.id===inv.id).version,reason:'QA'});assert.equal(r.s,200);
 assert((await render(token)).includes('Invoice not available'),'void invoice link stops working');
 console.log('invoice issue/payment/link self-check ok (no network calls made)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
