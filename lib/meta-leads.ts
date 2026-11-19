import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {sealToken,openToken} from './instagram';
import {ensureLeadStorage} from './leads';
// Meta Lead Ads via Page Webhooks + Graph API (checked against Meta docs Nov 2026, v27.0).
export const META_VERSION=process.env.META_GRAPH_VERSION||'v27.0';
export const META_LEAD_SCOPES=['pages_show_list','pages_read_engagement','pages_manage_metadata','pages_manage_ads','leads_retrieval','ads_management','business_management'];
const GRAPH='https://graph.facebook.com';
const rows=(r:any)=>(r?.rows||[]) as any[];
export function metaConfig(origin:string){
 const appId=process.env.META_APP_ID||'',secret=process.env.META_APP_SECRET||'',verify=process.env.META_WEBHOOK_VERIFY_TOKEN||'',key=process.env.META_TOKEN_KEY||process.env.INSTAGRAM_TOKEN_KEY||'';
 const missing=[!appId&&'META_APP_ID',!secret&&'META_APP_SECRET',!verify&&'META_WEBHOOK_VERIFY_TOKEN',Buffer.from(key,'base64').length!==32&&'META_TOKEN_KEY'].filter(Boolean) as string[];
 return {appId,secret,verify,key,redirectUri:process.env.META_REDIRECT_URI||origin+'/api/meta-leads',missing};
}
let ready:Promise<void>|undefined;
export function ensureMetaLeadStorage(){if(!ready)ready=ensureLeadStorage().then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS meta_lead_pages (page_id text PRIMARY KEY, brand_id text NOT NULL, page_name text NOT NULL, token_enc text NOT NULL, connected_at text NOT NULL, last_lead_at text, last_error text)`))).then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS meta_oauth_pending (state_hash text PRIMARY KEY, brand_id text NOT NULL, pages_enc text, expires bigint NOT NULL)`))).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
const hash=(s:string)=>createHmac('sha256','nf-meta-state').update(s).digest('hex');
async function graph(path:string,params:Record<string,string>,token:string,method='GET'){
 const u=new URL(`${GRAPH}/${META_VERSION}/${path}`);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u,{method,headers:{Authorization:'Bearer '+token},cache:'no-store'});const d:any=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error?.message||`Meta request failed (${r.status}).`);return d;
}
// Webhook signature: HMAC-SHA256 of the raw body with the App Secret, header "sha256=<hex>".
export function validSignature(raw:string,header:string|null,secret:string){
 if(!header?.startsWith('sha256=')||!secret)return false;
 const a=Buffer.from(header.slice(7),'hex'),b=createHmac('sha256',secret).update(raw).digest();
 return a.length===b.length&&timingSafeEqual(a,b);
}
// Step 1: Facebook Login for a brand chosen by an admin/manager.
export async function startPageConnect(brandId:string,origin:string){
 const cfg=metaConfig(origin);if(cfg.missing.length)throw Error('Meta Lead Ads is not set up on the server yet. Missing: '+cfg.missing.join(', ')+'.');
 await ensureMetaLeadStorage();const state=Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex');
 await getDb().execute(sql`DELETE FROM meta_oauth_pending WHERE expires<${Date.now()}`);
 await getDb().execute(sql`INSERT INTO meta_oauth_pending (state_hash,brand_id,expires) VALUES (${hash(state)},${brandId},${Date.now()+900000})`);
 const u=new URL(`https://www.facebook.com/${META_VERSION}/dialog/oauth`);u.search=new URLSearchParams({client_id:cfg.appId,redirect_uri:cfg.redirectUri,state,response_type:'code',scope:META_LEAD_SCOPES.join(',')}).toString();
 return {url:u.toString(),state};
}
// Step 2: exchange the code, keep the Pages (with their long-lived Page tokens) encrypted until a Page is chosen.
export async function finishPageConnect(code:string,state:string,origin:string){
 const cfg=metaConfig(origin);if(cfg.missing.length)throw Error('Meta Lead Ads is not set up on the server yet.');
 await ensureMetaLeadStorage();const db=getDb();
 const row=rows(await db.execute(sql`SELECT brand_id,expires FROM meta_oauth_pending WHERE state_hash=${hash(state)} AND pages_enc IS NULL`))[0];
 if(!row||Number(row.expires)<Date.now())throw Error('This Facebook connection link expired. Please start again.');
 const short=await fetch(`${GRAPH}/${META_VERSION}/oauth/access_token?`+new URLSearchParams({client_id:cfg.appId,client_secret:cfg.secret,redirect_uri:cfg.redirectUri,code}),{cache:'no-store'}).then(r=>r.json()) as any;
 if(!short?.access_token)throw Error(short?.error?.message||'Facebook did not approve the connection.');
 const long=await fetch(`${GRAPH}/${META_VERSION}/oauth/access_token?`+new URLSearchParams({grant_type:'fb_exchange_token',client_id:cfg.appId,client_secret:cfg.secret,fb_exchange_token:short.access_token}),{cache:'no-store'}).then(r=>r.json()) as any;
 const userToken=long?.access_token||short.access_token;
 const perms=await graph('me/permissions',{},userToken);const granted=new Set((perms.data||[]).filter((p:any)=>p.status==='granted').map((p:any)=>p.permission));
 const missing=['pages_show_list','pages_manage_metadata','leads_retrieval'].filter(p=>!granted.has(p));if(missing.length)throw Error('Please allow these permissions when connecting: '+missing.join(', ')+'.');
 const pages=(await graph('me/accounts',{fields:'id,name,access_token,tasks',limit:'100'},userToken)).data||[];
 if(!pages.length)throw Error('No Facebook Pages were shared with Nova Frames.');
 await db.execute(sql`UPDATE meta_oauth_pending SET pages_enc=${await sealToken(JSON.stringify(pages.map((p:any)=>({id:String(p.id),name:String(p.name),token:String(p.access_token)}))),cfg.key)},expires=${Date.now()+900000} WHERE state_hash=${hash(state)}`);
 return {brandId:String(row.brand_id),pages:pages.map((p:any)=>({id:String(p.id),name:String(p.name)}))};
}
export async function pendingPages(state:string,origin:string){const cfg=metaConfig(origin);await ensureMetaLeadStorage();const row=rows(await getDb().execute(sql`SELECT brand_id,pages_enc,expires FROM meta_oauth_pending WHERE state_hash=${hash(state)}`))[0];if(!row?.pages_enc||Number(row.expires)<Date.now())throw Error('This Facebook connection expired. Please start again.');return {brandId:String(row.brand_id),pages:JSON.parse(await openToken(String(row.pages_enc),cfg.key)) as {id:string,name:string,token:string}[]};}
// Step 3: link the chosen Page to the brand and subscribe it to leadgen webhooks.
export async function linkPage(state:string,pageId:string,origin:string){
 const cfg=metaConfig(origin),{brandId,pages}=await pendingPages(state,origin),page=pages.find(p=>p.id===pageId);if(!page)throw Error('Choose one of the Pages you shared.');
 await graph(`${page.id}/subscribed_apps`,{subscribed_fields:'leadgen'},page.token,'POST');
 const db=getDb(),sealed=await sealToken(page.token,cfg.key),at=new Date().toISOString();
 await db.execute(sql`INSERT INTO meta_lead_pages (page_id,brand_id,page_name,token_enc,connected_at) VALUES (${page.id},${brandId},${page.name},${sealed},${at}) ON CONFLICT (page_id) DO UPDATE SET brand_id=EXCLUDED.brand_id,page_name=EXCLUDED.page_name,token_enc=EXCLUDED.token_enc,connected_at=EXCLUDED.connected_at,last_error=NULL`);
 await db.execute(sql`DELETE FROM meta_oauth_pending WHERE state_hash=${hash(state)}`);return {brandId,pageName:page.name};
}
export async function unlinkPage(pageId:string,origin:string){const cfg=metaConfig(origin);await ensureMetaLeadStorage();const db=getDb(),row=rows(await db.execute(sql`SELECT token_enc FROM meta_lead_pages WHERE page_id=${pageId}`))[0];if(!row)return;
 if(!cfg.missing.length)await graph(`${pageId}/subscribed_apps`,{},await openToken(String(row.token_enc),cfg.key),'DELETE').catch(()=>{});
 await db.execute(sql`DELETE FROM meta_lead_pages WHERE page_id=${pageId}`);}
// Status only, never tokens.
export async function connectedPages(){await ensureMetaLeadStorage();return rows(await getDb().execute(sql`SELECT page_id,brand_id,page_name,connected_at,last_lead_at,last_error FROM meta_lead_pages ORDER BY page_name`)).map(r=>({pageId:String(r.page_id),brandId:String(r.brand_id),pageName:String(r.page_name),connectedAt:String(r.connected_at),lastLeadAt:r.last_lead_at?String(r.last_lead_at):'',lastError:r.last_error?String(r.last_error):''}));}
// Map Meta form answers onto lead fields; anything not recognised goes into requirements so nothing submitted is lost.
export function mapLeadFields(fieldData:{name:string,values?:string[]}[]){
 const get=(...keys:string[])=>{for(const f of fieldData)if(keys.includes(f.name.toLowerCase()))return (f.values||[]).join(', ').trim();return '';};
 const used=new Set(['full_name','first_name','last_name','email','phone_number','phone','company_name','company','budget','requirements','message']);
 const name=get('full_name')||[get('first_name'),get('last_name')].filter(Boolean).join(' ');
 const budgetText=get('budget')||fieldData.find(f=>/budget/i.test(f.name))?.values?.join(', ')||'';
 const budgetNum=Number(budgetText.replace(/[,\s₹]|inr|rs\.?/gi,''));
 const extras=fieldData.filter(f=>!used.has(f.name.toLowerCase())&&!/budget/i.test(f.name)).map(f=>`${f.name.replace(/_/g,' ')}: ${(f.values||[]).join(', ')}`);
 const requirements=[get('requirements','message'),...extras,budgetText&&!Number.isFinite(budgetNum)?`Budget: ${budgetText}`:''].filter(Boolean).join('\n');
 return {name:name||'Meta lead',email:get('email').toLowerCase(),phone:get('phone_number','phone'),company:get('company_name','company'),budget:budgetText&&Number.isFinite(budgetNum)?budgetNum:null,requirements};
}
// Fetch one lead with the Page token and store it once: the row id is derived from Meta's lead id, so retries and duplicates are ignored.
export async function captureLead(leadgenId:string,pageId:string,origin:string){
 const cfg=metaConfig(origin);await ensureMetaLeadStorage();const db=getDb();
 const page=rows(await db.execute(sql`SELECT brand_id,token_enc FROM meta_lead_pages WHERE page_id=${pageId}`))[0];if(!page)return 'unknown-page';
 const id='meta:'+leadgenId;if(rows(await db.execute(sql`SELECT id FROM leads WHERE id=${id}`)).length)return 'duplicate';
 try{
  const lead=await graph(leadgenId,{fields:'id,created_time,ad_id,form_id,field_data'},await openToken(String(page.token_enc),cfg.key));
  const at=new Date().toISOString(),f=mapLeadFields(lead.field_data||[]);
  const value={id,...f,brandId:String(page.brand_id),followUp:'',source:'Meta Lead Ads',status:'New',outcome:'',notes:'',meta:{leadId:String(lead.id||leadgenId),formId:String(lead.form_id||''),adId:String(lead.ad_id||''),pageId,createdTime:String(lead.created_time||'')},createdAt:at,createdBy:'Meta Lead Ads',updatedAt:at,updatedBy:'Meta Lead Ads',history:[{at,by:'Meta Lead Ads',detail:'Lead captured from Meta Lead Ads'}]};
  const saved=rows(await db.execute(sql`INSERT INTO leads (id,status,payload,updated) VALUES (${id},'New',${JSON.stringify(value)},${crypto.randomUUID()}) ON CONFLICT (id) DO NOTHING RETURNING id`));
  await db.execute(sql`UPDATE meta_lead_pages SET last_lead_at=${at},last_error=NULL WHERE page_id=${pageId}`);
  return saved.length?'created':'duplicate';
 }catch(e){await db.execute(sql`UPDATE meta_lead_pages SET last_error=${(e as Error).message.slice(0,300)} WHERE page_id=${pageId}`);throw e;}
}
