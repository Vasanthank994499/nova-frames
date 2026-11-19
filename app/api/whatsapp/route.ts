import {developerPrivate} from '../../../lib/developer-privacy';
import {principal,requireOrigin} from '../../../lib/auth';
import {whatsappStatus,startWhatsAppConnect,finishWhatsAppConnect,chooseNumber,refreshTemplates,chooseTemplates,disconnectWhatsApp} from '../../../lib/whatsapp';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const COOKIE='nf_wa_state';
const stateOf=(req:Request)=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const cookie=(v:string,req:Request,age:number)=>`${COOKIE}=${v}; Path=/api/whatsapp; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
const back=(req:Request,q:Record<string,string>)=>{const u=new URL('/',req.url);u.search=new URLSearchParams({notification:'1',page:'Invoices',...Object.fromEntries(Object.entries(q).map(([k,v])=>[k,v.slice(0,200)]))}).toString();return u.toString();};
// Connecting Nova Frames' WhatsApp number is administrator-only.
async function admin(req:Request){const u=await principal(req);if(!u.admin)throw Error('Only the administrator can set up WhatsApp.');return u;}
async function GET_(req:Request){
 const url=new URL(req.url),p=url.searchParams;
 try{
  const u=await admin(req);
  if(p.has('status'))return Response.json(await whatsappStatus(url.origin),{headers});
  if(p.has('code')||p.has('error')){
   if(p.has('error'))throw Error(p.get('error_description')||'Meta connection was cancelled.');
   const state=p.get('state')||'';if(!state||state!==stateOf(req))throw Error('This connection could not be verified. Please start again.');
   await finishWhatsAppConnect(p.get('code')||'',state,url.origin,u.name);
   return new Response(null,{status:302,headers:{Location:back(req,{wa:'connected'}),'Set-Cookie':cookie('',req,0)}});
  }
  const {url:authorize,state}=await startWhatsAppConnect(url.origin);
  return new Response(null,{status:302,headers:{Location:authorize,'Set-Cookie':cookie(state,req,900)}});
 }catch(e){if(p.has('status'))return Response.json({error:(e as Error).message},{status:403,headers});return new Response(null,{status:302,headers:{Location:back(req,{wa:'error',message:(e as Error).message}),'Set-Cookie':cookie('',req,0)}});}
}
async function POST_(req:Request){
 try{requireOrigin(req);await admin(req);const b:any=await req.json(),origin=new URL(req.url).origin;
  if(b?.type==='number')await chooseNumber(String(b.wabaId||''),String(b.phoneId||''),origin);
  else if(b?.type==='refresh-templates')await refreshTemplates(origin);
  else if(b?.type==='templates')await chooseTemplates(b.invoice,b.reminder);
  else if(b?.type==='disconnect')await disconnectWhatsApp();
  else throw Error('Invalid request.');
  return Response.json(await whatsappStatus(origin),{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);