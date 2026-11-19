import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {createHash} from 'node:crypto';
import {sealToken,openToken} from './instagram';
// Nova Frames' own WhatsApp Business account on Meta's Cloud API (Graph v27.0, checked Nov 2026).
export const WA_VERSION=process.env.WHATSAPP_GRAPH_VERSION||'v27.0';
export const WA_SCOPES=['business_management','whatsapp_business_management','whatsapp_business_messaging'];
// Invoice and reminder templates must be APPROVED and take these 5 body values in order.
export const TEMPLATE_PARAMS=['Client name','Invoice number','Amount due','Due date','Secure invoice link'];
// Automated client reminders: one approved Utility template each, with these body values in order. Payment reminders use the invoice reminder template above.
export const REMINDER_TEMPLATES:Record<string,{label:string,params:string[]}>={booking:{label:'Shoot booking confirmation',params:['Client name','Shoot title','Date and time','Location']},shoot:{label:'Shoot reminder',params:['Client name','Shoot title','Date and time','Location']},approval:{label:'Content approval reminder',params:['Client name','Videos waiting','Dashboard link']},report:{label:'Monthly report ready',params:['Client name','Month','Dashboard link']}};
const GRAPH='https://graph.facebook.com';
const rows=(r:any)=>(r?.rows||[]) as any[];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function waConfig(origin:string){
 const appId=process.env.META_APP_ID||'',secret=process.env.META_APP_SECRET||'',verify=process.env.META_WEBHOOK_VERIFY_TOKEN||'',key=process.env.META_TOKEN_KEY||process.env.INSTAGRAM_TOKEN_KEY||'';
 const missing=[!appId&&'META_APP_ID',!secret&&'META_APP_SECRET',!verify&&'META_WEBHOOK_VERIFY_TOKEN',Buffer.from(key,'base64').length!==32&&'META_TOKEN_KEY'].filter(Boolean) as string[];
 return {appId,secret,verify,key,redirectUri:process.env.WHATSAPP_REDIRECT_URI||origin+'/api/whatsapp',missing};
}
let ready:Promise<void>|undefined;
export function ensureWhatsAppStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS whatsapp_connection (id text PRIMARY KEY, payload text NOT NULL, token_enc text, updated text NOT NULL)`)).then(()=>getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS whatsapp_messages (wamid text PRIMARY KEY, invoice_id text NOT NULL, delivery_id text NOT NULL, created text NOT NULL)`))).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
async function graph(path:string,params:Record<string,string>,token:string,method='GET',body?:any){
 const u=new URL(`${GRAPH}/${WA_VERSION}/${path}`);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d:any=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw Error(d.error?.error_user_msg||d.error?.message||`Meta request failed (${r.status}).`);return d;
}
async function readConn(){await ensureWhatsAppStorage();const r=rows(await getDb().execute(sql`SELECT payload,token_enc FROM whatsapp_connection WHERE id='nova'`))[0];return r?{...JSON.parse(r.payload),tokenEnc:r.token_enc?String(r.token_enc):''}:null;}
async function writeConn(v:any,tokenEnc?:string|null){const {tokenEnc:_,...payload}=v,json=JSON.stringify(payload),at=new Date().toISOString();await getDb().execute(sql`INSERT INTO whatsapp_connection (id,payload,token_enc,updated) VALUES ('nova',${json},${tokenEnc??null},${at}) ON CONFLICT (id) DO UPDATE SET payload=${json},updated=${at}${tokenEnc!==undefined?sql`,token_enc=${tokenEnc}`:sql``}`);}
// Public status for the admin page: never the token.
export async function whatsappStatus(origin:string){
 const cfg=waConfig(origin),c=await readConn();
 const step=cfg.missing.length?'server':!c?.tokenEnc?'connect':!c.phoneNumberId?'choose':!c.invoiceTemplate||!c.reminderTemplate?'templates':'ready';
 return {step,missing:cfg.missing,webhookUrl:origin+'/api/whatsapp/webhook',businessName:c?.businessName||'',wabaId:c?.wabaId||'',wabaName:c?.wabaName||'',phoneNumberId:c?.phoneNumberId||'',displayPhone:c?.displayPhone||'',verifiedName:c?.verifiedName||'',qualityRating:c?.qualityRating||'',tokenExpires:c?.tokenExpires||0,invoiceTemplate:c?.invoiceTemplate||null,reminderTemplate:c?.reminderTemplate||null,extraTemplates:c?.extraTemplates||{},accounts:c?.accounts||[],templates:c?.templates||[],connectedAt:c?.connectedAt||'',connectedBy:c?.connectedBy||'',lastError:c?.lastError||''};
}
export async function startWhatsAppConnect(origin:string){
 const cfg=waConfig(origin);if(cfg.missing.length)throw Error('WhatsApp setup needs server settings first: '+cfg.missing.join(', ')+'.');
 await ensureWhatsAppStorage();const state=Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex'),c=await readConn();
 await writeConn({...(c||{}),stateHash:hash(state),stateExpires:Date.now()+900000});
 const u=new URL(`https://www.facebook.com/${WA_VERSION}/dialog/oauth`);u.search=new URLSearchParams({client_id:cfg.appId,redirect_uri:cfg.redirectUri,state,response_type:'code',scope:WA_SCOPES.join(',')}).toString();
 return {url:u.toString(),state};
}
// Exchange the code for a long-lived token, then find the WhatsApp Business accounts it can manage and their numbers.
export async function finishWhatsAppConnect(code:string,state:string,origin:string,by:string){
 const cfg=waConfig(origin),c=await readConn();
 if(!c||c.stateHash!==hash(state)||Number(c.stateExpires)<Date.now())throw Error('This connection link expired. Please start again.');
 const short:any=await fetch(`${GRAPH}/${WA_VERSION}/oauth/access_token?`+new URLSearchParams({client_id:cfg.appId,client_secret:cfg.secret,redirect_uri:cfg.redirectUri,code}),{cache:'no-store'}).then(r=>r.json());
 if(!short?.access_token)throw Error(short?.error?.message||'Meta did not approve the connection.');
 const long:any=await fetch(`${GRAPH}/${WA_VERSION}/oauth/access_token?`+new URLSearchParams({grant_type:'fb_exchange_token',client_id:cfg.appId,client_secret:cfg.secret,fb_exchange_token:short.access_token}),{cache:'no-store'}).then(r=>r.json());
 const token=long?.access_token||short.access_token,expires=long?.expires_in?Date.now()+Number(long.expires_in)*1000:0;
 const dbg=(await graph('debug_token',{input_token:token},`${cfg.appId}|${cfg.secret}`)).data||{};
 const scopes:any[]=dbg.granular_scopes||[],missing=WA_SCOPES.filter(s=>!(dbg.scopes||[]).includes(s));if(missing.length)throw Error('Please allow these permissions: '+missing.join(', ')+'.');
 const wabaIds:string[]=[...new Set((scopes.find(s=>s.scope==='whatsapp_business_management')?.target_ids||[]).map(String))] as string[];
 if(!wabaIds.length)throw Error('No WhatsApp Business account was shared. Reconnect and select Nova Frames’ WhatsApp account.');
 const accounts=[];for(const id of wabaIds){try{const w=await graph(id,{fields:'id,name'},token),p=await graph(`${id}/phone_numbers`,{fields:'id,display_phone_number,verified_name,quality_rating,code_verification_status,status'},token);accounts.push({id,name:String(w.name||id),phones:(p.data||[]).map((x:any)=>({id:String(x.id),display:String(x.display_phone_number||''),name:String(x.verified_name||''),quality:String(x.quality_rating||''),status:String(x.status||''),verification:String(x.code_verification_status||'')}))});}catch(e){accounts.push({id,name:id,phones:[],error:(e as Error).message});}}
 await writeConn({accounts,tokenExpires:expires,connectedAt:new Date().toISOString(),connectedBy:by,lastError:''},await sealToken(token,cfg.key));
}
// Choose the WABA + number, subscribe the app to its webhooks, and load approved templates.
export async function chooseNumber(wabaId:string,phoneId:string,origin:string){
 const cfg=waConfig(origin),c=await readConn();if(!c?.tokenEnc)throw Error('Connect the Meta account first.');
 const acct=(c.accounts||[]).find((a:any)=>a.id===wabaId),phone=acct?.phones.find((p:any)=>p.id===phoneId);if(!phone)throw Error('Choose one of the listed numbers.');
 const token=await openToken(c.tokenEnc,cfg.key),live=await graph(phoneId,{fields:'status,display_phone_number,verified_name,quality_rating'},token);
 if(String(live.status||'').toUpperCase()!=='CONNECTED')throw Error(`This number is ${String(live.status||'not connected').toLowerCase()} on WhatsApp. Finish registering it in WhatsApp Manager first.`);
 await graph(`${wabaId}/subscribed_apps`,{},token,'POST');
 await writeConn({...c,wabaId,wabaName:acct.name,phoneNumberId:phoneId,displayPhone:String(live.display_phone_number||phone.display),verifiedName:String(live.verified_name||phone.name),qualityRating:String(live.quality_rating||''),invoiceTemplate:null,reminderTemplate:null});
 return refreshTemplates(origin);
}
export async function refreshTemplates(origin:string){
 const cfg=waConfig(origin),c=await readConn();if(!c?.wabaId)throw Error('Choose the WhatsApp number first.');
 const d=await graph(`${c.wabaId}/message_templates`,{fields:'name,status,language,category,components',limit:'200'},await openToken(c.tokenEnc,cfg.key));
 const templates=(d.data||[]).map((t:any)=>{const bodyText=String((t.components||[]).find((x:any)=>x.type==='BODY')?.text||'');const vars=new Set(bodyText.match(/\{\{\s*\d+\s*\}\}/g)||[]).size;return {name:String(t.name),language:String(t.language),status:String(t.status),category:String(t.category),vars,body:bodyText.slice(0,400)};});
 await writeConn({...c,templates});return templates;
}
// A template is usable only if Meta approved it, it is a UTILITY template (invoices and reminders), and it takes exactly the 5 values we send.
export function templateProblem(t:any,params:string[]=TEMPLATE_PARAMS){if(!t)return 'Template not found.';if(t.status!=='APPROVED')return `Template is ${t.status.toLowerCase()}, not approved.`;if(t.category!=='UTILITY')return 'Use a Utility template for invoices and payment reminders.';if(t.vars!==params.length)return `Template must use exactly ${params.length} variables ({{1}}–{{${params.length}}}): ${params.join(', ')}.`;return '';}
export async function chooseTemplates(invoice:{name:string,language:string},reminder:{name:string,language:string}){
 const c=await readConn();if(!c?.templates)throw Error('Load the templates first.');
 const pick=(x:any)=>c.templates.find((t:any)=>t.name===x?.name&&t.language===x?.language);
 for(const [label,x] of [['Invoice',invoice],['Reminder',reminder]] as const){const p=templateProblem(pick(x));if(p)throw Error(`${label} template: ${p}`);}
 await writeConn({...c,invoiceTemplate:{name:invoice.name,language:invoice.language},reminderTemplate:{name:reminder.name,language:reminder.language}});
}
export async function chooseReminderTemplate(kind:string,t:{name:string,language:string}|null){
 const spec=REMINDER_TEMPLATES[kind];if(!spec)throw Error('Unknown reminder type.');const c=await readConn();if(!c?.templates)throw Error('Load the templates first.');
 if(t){const found=c.templates.find((x:any)=>x.name===t.name&&x.language===t.language),p=templateProblem(found,spec.params);if(p)throw Error(`${spec.label}: ${p}`);}
 await writeConn({...c,extraTemplates:{...(c.extraTemplates||{}),[kind]:t?{name:t.name,language:t.language}:null}});
}
export async function disconnectWhatsApp(){await ensureWhatsAppStorage();await getDb().execute(sql`DELETE FROM whatsapp_connection WHERE id='nova'`);}
// Send one template from the connected number. Returns Meta's message id; a successful call only means "accepted" — delivery comes by webhook.
export async function sendTemplate(kind:string,to:string,values:string[],origin:string){
 const cfg=waConfig(origin),c=await readConn(),tpl=kind==='invoice'?c?.invoiceTemplate:kind==='reminder'?c?.reminderTemplate:c?.extraTemplates?.[kind];
 if(cfg.missing.length||!c?.tokenEnc||!c.phoneNumberId||!tpl)throw Error('WhatsApp is not fully set up yet (Invoices → WhatsApp setup).');
 if(c.tokenExpires&&c.tokenExpires<Date.now())throw Error('The Meta connection expired. Reconnect WhatsApp in setup.');
 const digits=to.replace(/[^\d]/g,'');if(digits.length<8)throw Error('The client’s WhatsApp number is not valid.');
 const d=await graph(`${c.phoneNumberId}/messages`,{},await openToken(c.tokenEnc,cfg.key),'POST',{messaging_product:'whatsapp',recipient_type:'individual',to:'+'+digits,type:'template',template:{name:tpl.name,language:{code:tpl.language},components:[{type:'body',parameters:values.map(text=>({type:'text',text}))}]}});
 const id=String(d.messages?.[0]?.id||'');if(!id)throw Error('Meta did not return a message id.');return {id,messageStatus:String(d.messages?.[0]?.message_status||'accepted')};
}
export async function trackMessage(wamid:string,invoiceId:string,deliveryId:string){await ensureWhatsAppStorage();await getDb().execute(sql`INSERT INTO whatsapp_messages (wamid,invoice_id,delivery_id,created) VALUES (${wamid},${invoiceId},${deliveryId},${new Date().toISOString()}) ON CONFLICT (wamid) DO NOTHING`);}
const RANK:Record<string,number>={accepted:0,sent:1,delivered:2,read:3,failed:4};
// Apply a status webhook to the invoice delivery it belongs to. Statuses can arrive out of order, so never step backwards (except to failed).
export async function applyStatus(st:any){
 await ensureWhatsAppStorage();const db=getDb(),m=rows(await db.execute(sql`SELECT invoice_id,delivery_id FROM whatsapp_messages WHERE wamid=${String(st.id||'')}`))[0];if(!m)return applyReminderStatus(st);
 const r=rows(await db.execute(sql`SELECT payload,updated FROM invoices WHERE id=${m.invoice_id}`))[0];if(!r)return false;
 const inv=JSON.parse(r.payload),status=String(st.status||''),err=(st.errors||[])[0],at=st.timestamp?new Date(Number(st.timestamp)*1000).toISOString():new Date().toISOString();
 const update=(d:any)=>d.id!==m.delivery_id||(RANK[status]??-1)<=(RANK[d.state]??-1)&&status!=='failed'?d:{...d,state:status,stateAt:at,...(status==='delivered'||status==='read'?{deliveredAt:d.deliveredAt||at}:{}),...(err?{error:[err.code,err.title,err.message,err.error_data?.details].filter(Boolean).join(' · ').slice(0,300)}:{})};
 const next={...inv,deliveries:(inv.deliveries||[]).map(update),reminders:(inv.reminders||[]).map(update)};
 await db.execute(sql`UPDATE invoices SET payload=${JSON.stringify(next)},updated=${crypto.randomUUID()} WHERE id=${m.invoice_id} AND updated=${r.updated}`);return true;
}
// Secure invoice links: a random token per invoice, stored only as a hash.
export const newShareToken=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
export const shareHash=(t:string)=>hash('invoice-link:'+t);
// Automated reminders keep their own log; same forward-only status rule as invoices.
async function applyReminderStatus(st:any){
 const db=getDb(),id=String(st.id||'');const r=rows(await db.execute(sql`SELECT state FROM reminder_log WHERE message_id=${id}`).catch(()=>({rows:[]})))[0];if(!r)return false;
 const status=String(st.status||''),err=(st.errors||[])[0];if(status!=='failed'&&(RANK[status]??-1)<=(RANK[String(r.state)]??-1))return true;
 await db.execute(sql`UPDATE reminder_log SET state=${status},error=${err?[err.code,err.title,err.message,err.error_data?.details].filter(Boolean).join(' · ').slice(0,300):null},updated=${new Date().toISOString()} WHERE message_id=${id}`);return true;
}
