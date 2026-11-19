import {developerPrivate} from '../../../lib/developer-privacy';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {principal,requireOrigin} from '../../../lib/auth';
import {ensureLeadStorage,mayManageLeads,LEAD_STATUSES,LEAD_SOURCES} from '../../../lib/leads';
import {connectedPages,metaConfig} from '../../../lib/meta-leads';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const clean=(v:unknown,max=2000)=>String(v||'').trim().slice(0,max);
const rows=(r:any)=>(r?.rows||[]) as any[];
// Leads are visible to administrators and managers only; clients and other staff are refused by principal()/mayManageLeads.
async function staff(req:Request){const u=await principal(req);if(!mayManageLeads(u))throw Error('Only administrators and managers can manage leads.');return u;}
async function GET_(req:Request){try{await staff(req);await ensureLeadStorage();const leads=rows(await getDb().execute(sql`SELECT payload,updated FROM leads`)).map(r=>({...JSON.parse(r.payload),version:String(r.updated)}));const brands=rows(await getDb().execute(sql`SELECT id,name FROM brands ORDER BY name`)).map(b=>({id:String(b.id),name:String(b.name)}));const cfg=metaConfig(new URL(req.url).origin);return Response.json({leads,statuses:LEAD_STATUSES,sources:LEAD_SOURCES,brands,meta:{pages:await connectedPages(),missing:cfg.missing,webhookUrl:new URL('/api/meta-leads/webhook',req.url).toString()}},{headers});}catch(e){return Response.json({error:(e as Error).message},{status:403,headers});}}
async function POST_(req:Request){try{
 requireOrigin(req);const u=await staff(req);await ensureLeadStorage();const db=getDb(),b:any=await req.json(),v=b?.lead||{};
 const id=clean(v.id,100),prev=id?rows(await db.execute(sql`SELECT payload,updated FROM leads WHERE id=${id}`))[0]:null;
 if(id&&!prev)throw Error('Lead not found.');const old=prev?JSON.parse(prev.payload):null;
 const name=clean(v.name,150),email=clean(v.email,200).toLowerCase(),phone=clean(v.phone,30),status=clean(v.status,20)||'New',source=clean(v.source,40),followUp=clean(v.followUp,10),budgetRaw=clean(v.budget,20);
 if(!name)throw Error('Enter the lead’s name.');
 if(!email&&!phone)throw Error('Add a phone number or email.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
 if(phone&&!/^[0-9+()\-\s]{6,30}$/.test(phone))throw Error('Enter a valid phone number.');
 if(!(LEAD_STATUSES as readonly string[]).includes(status))throw Error('Choose a valid status.');
 if(!(LEAD_SOURCES as readonly string[]).includes(source))throw Error('Choose where the lead came from.');
 if(followUp&&!/^\d{4}-\d{2}-\d{2}$/.test(followUp))throw Error('Choose a valid follow-up date.');
 const budget=budgetRaw?Number(budgetRaw.replace(/[,\s₹]/g,'')):null;if(budget!==null&&(!Number.isFinite(budget)||budget<0||budget>1e10))throw Error('Enter the budget as a number in rupees.');
 const brandId=clean(v.brandId,100);if(brandId&&!rows(await db.execute(sql`SELECT id FROM brands WHERE id=${brandId}`)).length)throw Error('Choose a valid client.');
 const outcome=status==='Closed'?(clean(v.outcome,20)==='Lost'?'Lost':'Converted'):'';
 const at=new Date().toISOString();
 const lead={...(old?.meta?{meta:old.meta}:{}),id:id||crypto.randomUUID(),brandId,name,company:clean(v.company,150),email,phone,requirements:clean(v.requirements,3000),budget,followUp,source,status,outcome,notes:clean(v.notes,3000),createdAt:old?.createdAt||at,createdBy:old?.createdBy||u.name,updatedAt:at,updatedBy:u.name,
  history:[...(old?.history||[]),...(!old?[{at,by:u.name,detail:'Lead created'}]:old.status!==status||old.outcome!==outcome?[{at,by:u.name,detail:`Status: ${old.status}${old.outcome?' ('+old.outcome+')':''} → ${status}${outcome?' ('+outcome+')':''}`}]:[])].slice(-50)};
 const json=JSON.stringify(lead),version=crypto.randomUUID();
 if(old){const saved=rows(await db.execute(sql`UPDATE leads SET status=${status},payload=${json},updated=${version} WHERE id=${id} AND updated=${clean(b.version,100)||prev.updated} RETURNING id`));if(!saved.length)throw Error('Someone else updated this lead. Reload and try again.');}
 else await db.execute(sql`INSERT INTO leads (id,status,payload,updated) VALUES (${lead.id},${status},${json},${version})`);
 return Response.json({ok:true,lead:{...lead,version}},{headers});
}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);