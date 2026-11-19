import {metaConfig,validSignature,captureLead} from '../../../../lib/meta-leads';
export const dynamic='force-dynamic';
// Meta verification handshake: echo hub.challenge only when the verify token matches.
export async function GET(req:Request){
 const p=new URL(req.url).searchParams,cfg=metaConfig(new URL(req.url).origin);
 if(p.get('hub.mode')==='subscribe'&&cfg.verify&&p.get('hub.verify_token')===cfg.verify)return new Response(p.get('hub.challenge')||'',{status:200,headers:{'Content-Type':'text/plain'}});
 return new Response('Forbidden',{status:403});
}
// Lead notifications: signature checked on the raw body; a failed fetch returns 500 so Meta retries (up to 36 hours).
export async function POST(req:Request){
 const raw=await req.text(),cfg=metaConfig(new URL(req.url).origin);
 if(!validSignature(raw,req.headers.get('x-hub-signature-256'),cfg.secret))return new Response('Invalid signature',{status:401});
 let body:any;try{body=JSON.parse(raw);}catch{return new Response('Bad request',{status:400});}
 if(body?.object!=='page')return new Response('OK');
 let failed=false;
 for(const entry of body.entry||[])for(const ch of entry.changes||[]){
  if(ch.field!=='leadgen')continue;const v=ch.value||{},leadId=String(v.leadgen_id||''),pageId=String(v.page_id||entry.id||'');
  if(!/^\d{1,32}$/.test(leadId)||!/^\d{1,32}$/.test(pageId))continue;
  try{await captureLead(leadId,pageId,new URL(req.url).origin);}catch{failed=true;}
 }
 return new Response(failed?'Retry':'OK',{status:failed?500:200});
}
