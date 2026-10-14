import { login, principal, digest, sessionCookie, requireOrigin } from '../../../lib/auth';
import {ensureClockedOut} from '../../../lib/attendance';
import {getDb} from '../../../db';
import {sessions} from '../../../db/schema';
import {eq} from 'drizzle-orm';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){try{return Response.json({user:await principal(req)},{headers});}catch{return Response.json({user:null},{headers});}}
export async function POST(req:Request){try{const b:any=await req.json();const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(password.length>256||email.length>200)throw Error('Incorrect email or password.');const token=await login(req,email,password);return Response.json({ok:true},{headers:{...headers,'Set-Cookie':sessionCookie(token,req)}});}catch(e){return Response.json({error:(e as Error).message},{status:401,headers});}}
export async function DELETE(req:Request){try{requireOrigin(req);const u=await principal(req);await ensureClockedOut(req,u);const token=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nf_session='))?.slice(11);if(token)await getDb().delete(sessions).where(eq(sessions.tokenHash,await digest(token)));return Response.json({ok:true},{headers:{...headers,'Set-Cookie':sessionCookie('',req,true)}});}catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}}
