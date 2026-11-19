'use client';
import {useCallback,useEffect,useState} from 'react';
import {useDialog} from './use-dialog';
import {Loader2,X,Play} from 'lucide-react';
const KINDS=['booking','shoot','payment','approval','report'];
// Only delivered/read are confirmed deliveries (Meta status webhook); email shows as handed to the provider.
const STATE:Record<string,[string,string]>={accepted:['Accepted by Meta · awaiting delivery','inv-pending'],sent:['Sent · not yet delivered','inv-pending'],delivered:['Delivered','inv-paid'],read:['Delivered · read','inv-paid'],failed:['Failed','inv-overdue'],'not sent':['Not sent','inv-void'],sending:['Sending…','inv-pending'],'sent to email provider':['Handed to email provider','inv-pending']};
const at=(iso:string)=>new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'});
export function RemindersPanel(){
 const [data,setData]=useState<any>(null),[edit,setEdit]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[kind,setKind]=useState('');
 const dialogRef=useDialog<HTMLFormElement>(!!edit,()=>setEdit(null));
 const load=useCallback(async()=>{try{const r=await fetch('/api/reminders',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{load();},[load]);
 async function post(body:any,key:string){setBusy(key);setError('');setNotice('');try{const r=await fetch('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);await load();return d;}catch(e){setError((e as Error).message);return null;}finally{setBusy('');}}
 if(!data)return <section className="report-panel">{error?<p className="form-error" role="alert">{error}</p>:<Loader2 className="spin"/>}</section>;
 const s=data.setup,wa=s.whatsapp,name=(id:string)=>data.brands.find((b:any)=>b.id===id)?.name||'Removed client';
 const approved=(wa.templates||[]).filter((t:any)=>t.status==='APPROVED'&&t.category==='UTILITY'),tkey=(t:any)=>t?t.name+'|'+t.language:'';
 const log=data.log.filter((l:any)=>!kind||l.kind===kind);
 return <section className="leads-panel">
  <div className="client-section"><h2 className="ig-sub">Channels</h2>
   <ul className="client-list">
    <li><span><strong>Email</strong> · Resend</span><em className={'shoot-status '+(s.email.configured?'inv-paid':'inv-void')}>{s.email.configured?'Ready':'Not set up'}</em>{!s.email.configured&&<small>Missing: {s.email.missing.join(', ')}</small>}</li>
    <li><span><strong>WhatsApp</strong> · {wa.step==='ready'?`${wa.displayPhone} (${wa.verifiedName})`:'Nova Frames number not connected'}</span><em className={'shoot-status '+(wa.step==='ready'?'inv-paid':'inv-void')}>{wa.step==='ready'?'Ready':'Setup incomplete'}</em>{wa.step!=='ready'&&<small>Finish Invoices → WhatsApp setup first.</small>}</li>
    <li><span><strong>Schedule</strong> · runs every hour</span><em className={'shoot-status '+(s.cron?'inv-paid':'inv-void')}>{s.cron?'Ready':'Not set up'}</em>{!s.cron&&<small>Set CRON_SECRET on the server; Vercel calls /api/reminders/cron hourly.</small>}</li>
   </ul>
   {wa.step==='ready'&&<><h3 className="ig-sub">WhatsApp templates (approved Utility)</h3><ul className="client-list">
    <li><span><strong>Payment reminder</strong> · uses the invoice reminder template</span><em>{wa.reminderTemplate?wa.reminderTemplate.name:'Not chosen'}</em></li>
    {Object.entries(s.templates).map(([k,t]:any)=><li key={k}><span><strong>{t.label}</strong><br/><small>{t.params.map((p:string,i:number)=>`{{${i+1}}} ${p}`).join(' · ')}</small></span>
     {data.admin?<select className="leads-search" aria-label={`WhatsApp template for ${t.label}`} value={tkey(wa.extraTemplates?.[k])} disabled={!!busy} onChange={e=>{const [n,l]=e.target.value.split('|');post({type:'template',kind:k,template:e.target.value?{name:n,language:l}:null},'t'+k);}}><option value="">Not chosen</option>{approved.filter((x:any)=>x.vars===t.params.length).map((x:any)=><option key={tkey(x)} value={tkey(x)}>{x.name} ({x.language})</option>)}</select>:<em>{wa.extraTemplates?.[k]?.name||'Not chosen'}</em>}</li>)}
   </ul></>}
  </div>
  {error&&!edit&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="ig-ok">{notice}</p>}
  <div className="client-section"><h2 className="ig-sub">Client contacts</h2><p className="ig-note">WhatsApp reminders go only to numbers whose owner agreed to receive messages from Nova Frames on WhatsApp (Meta requirement). Payment reminders use the invoice’s billing email when set.</p>
   {data.brands.length?<ul className="client-list">{data.brands.map((b:any)=>{const c=b.contact;return <li key={b.id}><span><strong>{b.name}</strong><br/><small>{c?.email||'No email'} · {c?.whatsapp?`${c.whatsapp}${c.optIn?` · opted in ${at(c.optIn.at)}`:' · no opt-in'}`:'No WhatsApp'}</small></span>
    {c&&<em>{KINDS.filter(k=>c.enabled?.[k]===false).length?`Off: ${KINDS.filter(k=>c.enabled?.[k]===false).map(k=>data.kinds[k]).join(', ')}`:'All reminders on'}</em>}
    <button className="secondary" onClick={()=>setEdit({brandId:b.id,email:c?.email||'',whatsapp:c?.whatsapp||'',whatsappOptIn:!!c?.optIn,enabled:c?.enabled||{}})}>Edit</button></li>;})}</ul>:<p className="client-empty">No clients yet.</p>}
  </div>
  <div className="client-section"><div className="leads-toolbar"><h2 className="ig-sub">Due now ({data.upcoming.length})</h2>{data.admin&&<button className="primary" disabled={!!busy} onClick={async()=>{const r=await post({type:'run'},'run');if(r)setNotice(`Checked ${r.due} due reminder${r.due===1?'':'s'}: ${r.sent} sent, ${r.notSent} not sent (setup needed), ${r.failed} failed. Already-handled reminders are skipped.`);}}>{busy==='run'?<Loader2 size={14} className="spin"/>:<Play size={14}/>}Run now</button>}</div>
   {data.upcoming.length?<ul className="client-list">{data.upcoming.map((u:any)=><li key={u.key}><span><strong>{data.kinds[u.kind]}</strong> · {name(u.brandId)}<br/><small>{u.summary}</small></span></li>)}</ul>:<p className="client-empty">Nothing due right now. Shoot reminders go 2 days and 1 day before; payment reminders 3 days and 1 day before the due date; approval reminders after 2, 5 and 9 days; report reminders in the first week of the month (9 am–8 pm IST except shoots).</p>}
  </div>
  <div className="client-section"><div className="leads-toolbar"><h2 className="ig-sub">Delivery log</h2><label className="log-filter">Show<select className="leads-search leads-client" id="reminder-log-filter" value={kind} onChange={e=>setKind(e.target.value)}><option value="">All reminders</option>{KINDS.map(k=><option key={k} value={k}>{data.kinds[k]}</option>)}</select></label></div>
   {log.length?<div className="ig-table-wrap"><table className="ig-table"><thead><tr><th>When</th><th>Reminder</th><th>Client</th><th>Channel</th><th>Status</th></tr></thead><tbody>{log.map((l:any)=><tr key={l.key}><td>{at(l.updated)}</td><td>{data.kinds[l.kind]}<small>{l.summary}</small></td><td>{name(l.brandId)}</td><td>{l.channel==='none'?'—':l.channel}{l.to&&<small>{l.to}</small>}</td><td><em className={'shoot-status '+(STATE[l.state]||[l.state,'inv-void'])[1]}>{(STATE[l.state]||[l.state])[0]}</em>{l.error&&<small>{l.error}</small>}{l.attempts>1&&<small>{l.attempts} attempts</small>}</td></tr>)}</tbody></table></div>:<p className="client-empty">No reminders sent yet.</p>}
  </div>
  {edit&&<div className="modal-shade" onClick={()=>setEdit(null)}><form ref={dialogRef} role="dialog" aria-modal="true" aria-label="Reminder contact" className="worker-modal lead-form" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();if(await post({type:'contact',brandId:edit.brandId,contact:edit},'save'))setEdit(null);}}>
   <div className="lead-form-head"><h2>Reminder contact · {name(edit.brandId)}</h2><button type="button" className="iconbutton" onClick={()=>setEdit(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="lead-grid">
    <label>Email<input type="email" value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></label>
    <label>WhatsApp number<input type="tel" placeholder="+91 98765 43210" value={edit.whatsapp} onChange={e=>setEdit({...edit,whatsapp:e.target.value,whatsappOptIn:false})}/></label>
    <label className="wide lead-check"><input type="checkbox" checked={edit.whatsappOptIn} disabled={!edit.whatsapp} onChange={e=>setEdit({...edit,whatsappOptIn:e.target.checked})}/>The client agreed to receive reminders from Nova Frames on WhatsApp at this number</label>
    <fieldset className="wide shoot-crew"><legend>Send these reminders</legend>{KINDS.map(k=><label key={k}><input type="checkbox" checked={edit.enabled?.[k]!==false} onChange={e=>setEdit({...edit,enabled:{...edit.enabled,[k]:e.target.checked}})}/>{data.kinds[k]}</label>)}</fieldset>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="client-form-actions"><button className="primary" disabled={!!busy}>{busy==='save'&&<Loader2 size={15} className="spin"/>}Save</button><button type="button" className="secondary" onClick={()=>setEdit(null)}>Cancel</button></div>
  </form></div>}
 </section>;
}
