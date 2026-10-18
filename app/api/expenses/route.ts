import {getDb} from '../../../db';
import {expenses,workers} from '../../../db/schema';
import {principal,requireOrigin,workerRoles} from '../../../lib/auth';
import {ensureExpenseStorage,expenseCents} from '../../../lib/expenses';
import {normalizeExpenseProof,MAX_EXPENSE_PROOF_BYTES} from '../../../lib/expense-proof-image';
import {productionDate} from '../../../lib/production-batches';
import {localDay} from '../../../lib/attendance';
import {and,eq,like,or,sql} from 'drizzle-orm';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const clean=(value:unknown,max=2000)=>String(value||'').trim().slice(0,max);

export async function GET(req:Request){
 try{
  const u=await principal(req);await ensureExpenseStorage();const db=getDb(),month=new URL(req.url).searchParams.get('month')||localDay().slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose a valid month.');
  const [people,rows]=await Promise.all([db.select({id:workers.id,name:workers.name,permissions:workers.permissions,role:workers.role,active:workers.active,removed:workers.removed}).from(workers),u.admin?db.select({payload:expenses.payload}).from(expenses).where(like(expenses.day,month+'-%')):db.select({payload:expenses.payload}).from(expenses).where(and(like(expenses.day,month+'-%'),u.roles.includes('manager')?or(eq(expenses.workerId,u.id),eq(expenses.managerId,u.id)):eq(expenses.workerId,u.id)))]);
  const active=people.filter(w=>!!w.active&&!w.removed),inactive=new Set(people.filter(w=>!w.active||w.removed).map(w=>w.id)),entries=rows.map(r=>JSON.parse(r.payload)).filter(e=>!inactive.has(e.workerId)&&!inactive.has(e.managerId)).sort((a,b)=>b.day.localeCompare(a.day)||b.created.localeCompare(a.created));
  let proofIds=new Set<string>();
  if(u.admin&&entries.length){const ids=entries.map(e=>sql`${e.id}`),proofRows=await db.execute(sql`SELECT expense_id FROM expense_proofs WHERE expense_id IN (${sql.join(ids,sql`,`)})`);proofIds=new Set(proofRows.rows.map(row=>String(row.expense_id)));}
  const visibleEntries=u.admin?entries.map(e=>({...e,hasProofPhoto:proofIds.has(e.id)})):entries;
  return Response.json({entries:visibleEntries,totalCents:entries.reduce((sum,e)=>sum+e.amountCents,0),people:active.filter(w=>u.admin||u.roles.includes('manager')||w.id===u.id).map(w=>({id:w.id,name:w.name})),managers:active.filter(w=>workerRoles(w).includes('manager')).map(w=>({id:w.id,name:w.name}))},{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:401,headers});}
}

export async function POST(req:Request){
 let u;try{requireOrigin(req);u=await principal(req);}catch(e){return Response.json({error:(e as Error).message},{status:401,headers});}
 const contentType=req.headers.get('content-type')||'',multipart=contentType.startsWith('multipart/form-data');
 if(!multipart&&!contentType.startsWith('application/json'))return Response.json({error:'Submit the expense form with an optional receipt photo.'},{status:400,headers});
 if(multipart&&Number(req.headers.get('content-length')||0)>MAX_EXPENSE_PROOF_BYTES+65536)return Response.json({error:'Choose a photo smaller than 6 MB.'},{status:413,headers});
 let id='';
 try{
  const form=multipart?await req.formData():undefined,legacy=multipart?undefined:await req.json(),value=(key:string)=>form?form.get(key):legacy[key],employeeId=clean(value('workerId'),100);
  if(employeeId!==u.id&&!u.admin&&!u.roles.includes('manager'))throw Error('You can record expenses only for yourself.');
  const db=getDb();await ensureExpenseStorage();
  const [employee,manager]=await Promise.all([db.select().from(workers).where(eq(workers.id,employeeId)).then(rows=>rows[0]),db.select().from(workers).where(eq(workers.id,clean(value('managerId'),100))).then(rows=>rows[0])]);
  if(!employee||!employee.active||employee.removed)throw Error('Select an active employee.');
  if(!manager||!manager.active||manager.removed||!workerRoles(manager).includes('manager'))throw Error('Select an active manager to submit the expense to.');
  const day=productionDate(value('day'));if(day>localDay())throw Error('Choose today or a past expense date.');
  const purpose=clean(value('purpose'));if(!purpose)throw Error('Enter what the expense was for.');
  const amountCents=expenseCents(value('amount'));
  const proofLink=clean(value('proofLink'),2000);if(proofLink){const link=new URL(proofLink);if(link.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(link.hostname))throw Error('Use an HTTPS Google Drive or Google Docs proof link.');}
  id=clean(value('entryId'),100);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Refresh the expense form and try again.');
  const file=value('proofPhoto');let proof:Buffer|undefined;
  if(file instanceof File&&file.size){
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG or WebP receipt photo.');
   if(file.size>MAX_EXPENSE_PROOF_BYTES)throw Error('Choose a photo smaller than 6 MB.');
   proof=await normalizeExpenseProof(Buffer.from(await file.arrayBuffer()));
  }
  const expense={id,workerId:employee.id,workerName:employee.name,roles:workerRoles(employee),branchId:employee.branchId||'',day,amountCents,purpose,managerId:manager.id,managerName:manager.name,proofSubmitted:value('proofSubmitted')===true||value('proofSubmitted')==='true'||value('proofSubmitted')==='on',proofNotes:clean(value('proofNotes')),proofLink,created:new Date().toISOString(),createdBy:u.id,createdByName:u.name};
  const saved=await db.insert(expenses).values({id,workerId:employee.id,managerId:manager.id,day,amountCents,payload:JSON.stringify(expense),updated:crypto.randomUUID()}).onConflictDoNothing().returning();
  if(!saved.length)throw Error('This expense was already submitted. Refresh to view it.');
  if(proof){
   try{
    const attached=await db.execute(sql`INSERT INTO expense_proofs(expense_id,image_base64,content_type,updated_at) VALUES (${id},${proof.toString('base64')},'image/webp',${Date.now()}) ON CONFLICT(expense_id) DO NOTHING RETURNING expense_id`);
    if(!attached.rows.length)throw Error('Receipt could not be attached.');
   }catch{
    await db.delete(expenses).where(eq(expenses.id,id));
    throw Error('Could not save the receipt photo. Please try again.');
   }
  }
  return Response.json({ok:true},{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}
