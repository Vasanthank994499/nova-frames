// Self-check with a stubbed Meta API: mapping, signature, capture, duplicate prevention. Uses a throwaway local DB.
import assert from 'node:assert';
import {createHmac} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-meta-'));
process.env.META_APP_ID='test-app';process.env.META_APP_SECRET='test-secret';process.env.META_WEBHOOK_VERIFY_TOKEN='verify';process.env.META_TOKEN_KEY=Buffer.alloc(32,3).toString('base64');
(async()=>{
 const {mapLeadFields,validSignature,captureLead,ensureMetaLeadStorage}=await import('../lib/meta-leads');
 const {sealToken}=await import('../lib/instagram');const {getDb}=await import('../db');const {sql}=await import('drizzle-orm');
 const m=mapLeadFields([{name:'full_name',values:['Asha Rao']},{name:'email',values:['ASHA@Example.com']},{name:'phone_number',values:['+919800000000']},{name:'what_do_you_need',values:['3 reels a month']},{name:'budget',values:['₹25,000']}]);
 assert.deepEqual([m.name,m.email,m.phone,m.budget],['Asha Rao','asha@example.com','+919800000000',25000]);assert.match(m.requirements,/what do you need: 3 reels a month/);
 assert.equal(mapLeadFields([{name:'budget',values:['Not sure']}]).budget,null);
 const raw='{"object":"page"}',sig='sha256='+createHmac('sha256','test-secret').update(raw).digest('hex');
 assert(validSignature(raw,sig,'test-secret'));assert(!validSignature(raw,sig,'other'));assert(!validSignature(raw+' ',sig,'test-secret'));assert(!validSignature(raw,null,'test-secret'));
 await ensureMetaLeadStorage();const db=getDb();
 await db.execute(sql`INSERT INTO brands (id,name,payload) VALUES ('b1','Brand One','{}')`);
 await db.execute(sql`INSERT INTO meta_lead_pages (page_id,brand_id,page_name,token_enc,connected_at) VALUES ('111','b1','Brand One Page',${await sealToken('PAGE-TOKEN','' +process.env.META_TOKEN_KEY)},'now')`);
 let calls=0;const realFetch=globalThis.fetch;
 globalThis.fetch=(async(u:any,init:any)=>{calls++;assert.match(String(u),/graph\.facebook\.com\/v27\.0\/999\?/);assert.equal(init.headers.Authorization,'Bearer PAGE-TOKEN');return new Response(JSON.stringify({id:'999',form_id:'f1',ad_id:'a1',created_time:'2026-11-19T06:00:00+0000',field_data:[{name:'full_name',values:['Asha Rao']},{name:'email',values:['asha@example.com']}]}));}) as any;
 assert.equal(await captureLead('999','111','http://localhost'),'created');
 assert.equal(await captureLead('999','111','http://localhost'),'duplicate');assert.equal(calls,1);
 assert.equal(await captureLead('998','222','http://localhost'),'unknown-page');
 const row:any=((await db.execute(sql`SELECT status,payload FROM leads WHERE id='meta:999'`)) as any).rows[0];const lead=JSON.parse(row.payload);
 assert.equal(row.status,'New');assert.equal(lead.brandId,'b1');assert.equal(lead.source,'Meta Lead Ads');assert.equal(lead.followUp,'');assert.equal(lead.meta.formId,'f1');assert(!row.payload.includes('PAGE-TOKEN'));
 globalThis.fetch=realFetch;console.log('meta leads self-check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
