import {developerPrivate} from '../../../lib/developer-privacy';
import {principal,requireOrigin} from '../../../lib/auth';
import {mayManageLeads} from '../../../lib/leads';
import {startPageConnect,finishPageConnect,pendingPages,linkPage,unlinkPage} from '../../../lib/meta-leads';
import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const COOKIE='nf_meta_state';
const stateOf=(req:Request)=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const cookie=(v:string,req:Request,age:number)=>`${COOKIE}=${v}; Path=/api/meta-leads; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
// Lands on the Leads page using the workspace's existing ?notification=1&page= deep link.
const back=(req:Request,q:Record<string,string>)=>{const u=new URL('/',req.url);u.search=new URLSearchParams({notification:'1',page:'Leads',...Object.fromEntries(Object.entries(q).map(([k,v])=>[k,v.slice(0,200)]))}).toString();return u.toString();};
async function staff(req:Request){const u=await principal(req);if(!mayManageLeads(u))throw Error('Only administrators and managers can connect Meta Lead Ads.');return u;}
async function GET_(req:Request){
 const url=new URL(req.url),p=url.searchParams;
 try{
  await staff(req);
  if(p.has('pending'))return Response.json(await pendingPages(stateOf(req),url.origin).then(x=>({brandId:x.brandId,pages:x.pages.map(pg=>({id:pg.id,name:pg.name}))})),{headers});
  if(p.has('code')||p.has('error')){
   if(p.has('error'))throw Error(p.get('error_description')||'Facebook connection was cancelled.');
   const state=p.get('state')||'';if(!state||state!==stateOf(req))throw Error('This Facebook connection could not be verified. Please start again.');
   const {pages}=await finishPageConnect(p.get('code')||'',state,url.origin);
   if(pages.length===1){const r=await linkPage(state,pages[0].id,url.origin);return new Response(null,{status:302,headers:{Location:back(req,{meta:'connected',name:r.pageName}),'Set-Cookie':cookie('',req,0)}});}
   return new Response(null,{status:302,headers:{Location:back(req,{meta:'choose'})}});
  }
  const brandId=String(p.get('brand')||'').slice(0,100);
  if(!(await getDb().execute(sql`SELECT id FROM brands WHERE id=${brandId}`) as any).rows?.length)throw Error('Choose the client brand for this Page.');
  const {url:authorize,state}=await startPageConnect(brandId,url.origin);
  return new Response(null,{status:302,headers:{Location:authorize,'Set-Cookie':cookie(state,req,900)}});
 }catch(e){if(p.has('pending'))return Response.json({error:(e as Error).message},{status:400,headers});return new Response(null,{status:302,headers:{Location:back(req,{meta:'error',message:(e as Error).message}),'Set-Cookie':cookie('',req,0)}});}
}
async function POST_(req:Request){
 try{requireOrigin(req);await staff(req);const b:any=await req.json(),origin=new URL(req.url).origin;
  if(b?.type==='link'){const r=await linkPage(stateOf(req),String(b.pageId||''),origin);return Response.json({ok:true,...r},{headers:{...headers,'Set-Cookie':cookie('',req,0)}});}
  if(b?.type==='unlink'){await unlinkPage(String(b.pageId||'').slice(0,100),origin);return Response.json({ok:true},{headers});}
  throw Error('Invalid request.');
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers});}
}

export const GET=developerPrivate(GET_);
export const POST=developerPrivate(POST_);