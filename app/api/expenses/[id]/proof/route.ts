import {getDb} from '../../../../../db';
import {principal} from '../../../../../lib/auth';
import {ensureExpenseStorage} from '../../../../../lib/expenses';
import {sql} from 'drizzle-orm';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'};

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 let user;try{user=await principal(req);}catch{return new Response(null,{status:401,headers});}
 if(!user.admin)return new Response(null,{status:403,headers});
 try{
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:404,headers});
  await ensureExpenseStorage();const result=await getDb().execute(sql`SELECT image_base64 FROM expense_proofs WHERE expense_id=${id}`),row=result.rows[0];
  if(!row)return new Response(null,{status:404,headers});
  return new Response(new Uint8Array(Buffer.from(String(row.image_base64),'base64')),{headers:{...headers,'Content-Type':'image/webp','Content-Disposition':'inline; filename="expense-receipt.webp"'}});
 }catch{return new Response(null,{status:500,headers});}
}
