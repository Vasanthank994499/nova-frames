import {requireOrigin} from '../../../lib/auth';
import {viewer} from '../../../lib/clients';
import {startConnect,finishConnect,syncInstagram,disconnect} from '../../../lib/instagram';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const STATE_COOKIE='nf_ig_state';
const back=(req:Request,q:Record<string,string>)=>{const u=new URL('/',req.url);for(const [k,v] of Object.entries(q))u.searchParams.set(k,v.slice(0,200));return u.toString();};
// Clients may only act on their own brand; admins and managers on the brand they name.
async function brandFor(req:Request,requested:unknown){const v=await viewer(req);if(v.client)return v.client.brandId;const id=String(requested||'').slice(0,100);if(!id)throw Error('Choose a brand.');return id;}
export async function GET(req:Request){
 const url=new URL(req.url),p=url.searchParams;
 if(p.has('code')||p.has('error')){
  const cookieState=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(STATE_COOKIE+'='))?.slice(STATE_COOKIE.length+1)||'';
  const clear=`${STATE_COOKIE}=; Path=/api/instagram; HttpOnly; SameSite=Lax; Max-Age=0`;
  try{
   if(p.has('error'))throw Error(p.get('error_description')||'Instagram connection was cancelled.');
   const state=p.get('state')||'';if(!state||state!==cookieState)throw Error('This Instagram connection could not be verified. Please start again from the dashboard.');
   await finishConnect(p.get('code')||'',state,url.origin);
   return new Response(null,{status:302,headers:{Location:back(req,{instagram:'connected'}),'Set-Cookie':clear}});
  }catch(e){return new Response(null,{status:302,headers:{Location:back(req,{instagram:'error',message:(e as Error).message}),'Set-Cookie':clear}});}
 }
 try{
  const brandId=await brandFor(req,p.get('brand'));const {url:authorize,state}=await startConnect(brandId,url.origin);
  const secure=url.protocol==='https:'?'; Secure':'';
  return new Response(null,{status:302,headers:{Location:authorize,'Set-Cookie':`${STATE_COOKIE}=${state}; Path=/api/instagram; HttpOnly; SameSite=Lax; Max-Age=600${secure}`}});
 }catch(e){return new Response(null,{status:302,headers:{Location:back(req,{instagram:'error',message:(e as Error).message})}});}
}
export async function POST(req:Request){
 try{
  requireOrigin(req);const b:any=await req.json();const brandId=await brandFor(req,b?.brandId);
  if(b?.type==='sync'){await syncInstagram(brandId,new URL(req.url).origin);return Response.json({ok:true},{headers:noStore});}
  if(b?.type==='disconnect'){await disconnect(brandId);return Response.json({ok:true},{headers:noStore});}
  throw Error('Invalid request.');
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers:noStore});}
}
