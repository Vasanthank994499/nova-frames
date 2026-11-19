import {validSignature} from '../../../../lib/meta-leads';
import {waConfig,applyStatus} from '../../../../lib/whatsapp';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const p=new URL(req.url).searchParams,cfg=waConfig(new URL(req.url).origin);
 if(p.get('hub.mode')==='subscribe'&&cfg.verify&&p.get('hub.verify_token')===cfg.verify)return new Response(p.get('hub.challenge')||'',{status:200,headers:{'Content-Type':'text/plain'}});
 return new Response('Forbidden',{status:403});
}
// Delivery statuses (sent / delivered / read / failed) for messages from Nova Frames' number.
export async function POST(req:Request){
 const raw=await req.text(),cfg=waConfig(new URL(req.url).origin);
 if(!validSignature(raw,req.headers.get('x-hub-signature-256'),cfg.secret))return new Response('Invalid signature',{status:401});
 let body:any;try{body=JSON.parse(raw);}catch{return new Response('Bad request',{status:400});}
 if(body?.object!=='whatsapp_business_account')return new Response('OK');
 try{for(const e of body.entry||[])for(const ch of e.changes||[])if(ch.field==='messages')for(const st of ch.value?.statuses||[])await applyStatus(st);}
 catch{return new Response('Retry',{status:500});}
 return new Response('OK');
}
