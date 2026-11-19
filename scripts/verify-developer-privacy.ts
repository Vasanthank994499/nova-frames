// Self-check: the Developer never appears in any JSON response or export, while stored records keep the real actor.
// Throwaway DB; route handlers called directly (next/server stubbed via scripts/tsconfig.verify.json).
import assert from 'node:assert';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
process.env.DATABASE_URL='pglite:'+mkdtempSync(join(tmpdir(),'nf-devpriv-'));
process.env.NOVA_DEVELOPER_EMAILS='dev.secret@example.test';process.env.APP_ORIGINS='http://localhost:3100';
const DEV={id:'devX',name:'Zed Developer',email:'dev.secret@example.test'};
(async()=>{
 const {getDb}=await import('../db');const {workers,sessions,brands}=await import('../db/schema');const {digest,hashPassword}=await import('../lib/auth');const {sql}=await import('drizzle-orm');
 const db=getDb();
 await db.insert(workers).values({id:DEV.id,name:DEV.name,email:DEV.email,specialty:'x',permissions:'["manager"]',role:'manager',active:1,removed:0,passwordHash:await hashPassword('Password-123')});
 await db.insert(workers).values({id:'w2',name:'Real Editor',email:'editor@example.test',specialty:'x',permissions:'["editor"]',role:'editor',active:1,removed:0,passwordHash:await hashPassword('Password-123')});
 await db.insert(brands).values({id:'b1',name:'Brand One',payload:JSON.stringify({id:'b1',name:'Brand One'})});
 const sess=async(acc:string)=>{const t=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');await db.insert(sessions).values({tokenHash:await digest(t),accountId:acc,expires:Date.now()+3600000});return 'nf_session='+t;};
 const call=async(mod:string,acc:string,method='GET',body?:any,qs='')=>{const m:any=await import('../app/api/'+mod+'/route');const r=new Request('http://localhost:3100/api/'+mod+qs,{method,headers:{cookie:await sess(acc),origin:'http://localhost:3100','content-type':'application/json'},body:body?JSON.stringify(body):undefined});return m[method](r) as Promise<Response>;};
 // Developer acts: creates a video, a lead, an invoice.
 let r=await call('workspace',DEV.id,'POST',{type:'job',job:{title:'Dev reel',brandId:'b1',stage:'Content'}});assert.equal(r.status,200,await r.clone().text());
 r=await call('leads',DEV.id,'POST',{lead:{name:'Lead by dev',email:'l@example.test',source:'Referral',brandId:'b1'}});assert.equal(r.status,200,await r.clone().text());
 const lr=await r.json();assert(!JSON.stringify(lr).includes(DEV.name),'POST response scrubbed too');
 r=await call('invoices',DEV.id,'POST',{type:'invoice',invoice:{brandId:'b1',issueDate:'2026-11-19',dueDate:'2026-12-19',amount:'100'}});assert.equal(r.status,200,await r.clone().text());
 // Audit trail kept in storage.
 const stored=JSON.stringify((await db.execute(sql`SELECT payload FROM jobs UNION ALL SELECT payload FROM leads UNION ALL SELECT payload FROM invoices UNION ALL SELECT payload FROM work_events`) as any).rows);
 assert(stored.includes(DEV.name)||stored.includes(DEV.id),'internal audit record keeps the real actor');
 // Nothing that leaves the server names the developer.
 const leak=(t:string)=>[DEV.id,DEV.name,DEV.email].filter(x=>t.includes(x));
 for(const [mod,acc,qs] of [['workspace','admin',''],['workspace','admin','?view=overview'],['workspace',DEV.id,''],['leads','admin',''],['invoices','admin',''],['notifications','admin',''],['attendance','admin',''],['expenses','admin',''],['requests','admin',''],['shoots','admin',''],['reminders','admin',''],['client','admin','?brand=b1'],['auth',DEV.id,'']] as const){
  const res=await call(mod,acc,'GET',undefined,qs);const t=await res.text();assert.deepEqual(leak(t),[],`${mod}${qs} as ${acc} leaks ${leak(t)}`);
 }
 const ws=await (await call('workspace','admin')).json();const job=ws.jobs.find((j:any)=>j.title==='Dev reel');
 assert(job.history.some((h:any)=>h.actorName==='Nova Frames team'||h.by==='Nova Frames team'),'history shows the neutral label');
 assert(ws.workers.some((w:any)=>w.name==='Real Editor'),'other people still visible');
 // Excel export.
 const xr=await call('reports','admin','GET',undefined,'?month=2026-11');assert.equal(xr.status,200);const buf=Buffer.from(await xr.arrayBuffer());
 let text=buf.toString('latin1');for(let i=0;i<buf.length-30;i++)if(buf.readUInt32LE(i)===0x04034b50){const method=buf.readUInt16LE(i+8),csize=buf.readUInt32LE(i+18),nlen=buf.readUInt16LE(i+26),xlen=buf.readUInt16LE(i+28),start=i+30+nlen+xlen;if(method===8)try{text+=inflateRawSync(buf.subarray(start,start+csize)).toString('utf8');}catch{}}
 assert.deepEqual(leak(text),[],'xlsx export leaks developer');
 // A different worker who happens to share the developer's name is not hidden.
 await db.insert(workers).values({id:'w3',name:DEV.name,email:'namesake@example.test',specialty:'x',permissions:'["editor"]',role:'editor',active:1,removed:0,passwordHash:await hashPassword('Password-123')});
 const ws2=await (await call('workspace','admin')).json();assert(ws2.workers.some((w:any)=>w.id==='w3'&&w.name===DEV.name),'namesake keeps their name');
 const job2=ws2.jobs.find((j:any)=>j.title==='Dev reel');assert(job2.history.every((h:any)=>h.actorId!==DEV.id),'dev-linked history still masked by id');
 console.log('developer privacy self-check ok');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
