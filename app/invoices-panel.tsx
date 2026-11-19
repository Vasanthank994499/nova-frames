'use client';
import {useCallback,useEffect,useState} from 'react';
import {useDialog} from './use-dialog';
import {Plus,Loader2,X,Mail,MessageCircle} from 'lucide-react';
const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const addDays=(d:string,n:number)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);
const rupees=(p:number)=>'₹'+(p/100).toLocaleString('en-IN',{maximumFractionDigits:2});
const fmtDay=(d:string)=>{const t=new Date(d+'T00:00:00');return isNaN(+t)?d:t.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});};
const fmtMonth=(m:string)=>m?new Date(m+'-01T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}):'';
const STATUSES=['All','Draft','Pending','Overdue','Paid'];
// Only "delivered"/"read" (confirmed by Meta's status webhook) count as delivered.
const DELIVERY:Record<string,[string,string]>={accepted:['Accepted by Meta · awaiting delivery','inv-pending'],sent:['Sent · not yet delivered','inv-pending'],delivered:['Delivered','inv-paid'],read:['Delivered · read','inv-paid'],failed:['Failed','inv-overdue'],'not sent':['Not sent','inv-void'],'sent to email provider':['Handed to email provider','inv-pending']};
const dLabel=(st:string)=>DELIVERY[st]||[st,'inv-void'];
export function InvoicesPanel({admin}:{admin:boolean}){
 const [data,setData]=useState<any>(null),[client,setClient]=useState(''),[status,setStatus]=useState('All'),[form,setForm]=useState<any>(null),[open,setOpen]=useState<string>(''),[pay,setPay]=useState<any>({amount:'',date:today(),method:'Bank transfer',reference:''}),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const detailRef=useDialog<HTMLElement>(!!open,()=>setOpen(''));
 const formRef=useDialog<HTMLFormElement>(!!form,()=>setForm(null));
 const load=useCallback(async()=>{try{const r=await fetch('/api/invoices',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{load();},[load]);
 async function post(body:any,key:string){setBusy(key);setError('');try{const r=await fetch('/api/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);await load();return d;}catch(e){setError((e as Error).message);await load();return null;}finally{setBusy('');}}
 if(!data)return <section className="report-panel">{error?<p className="form-error" role="alert">{error}</p>:<Loader2 className="spin"/>}</section>;
 const brand=(id:string)=>data.brands.find((b:any)=>b.id===id),live=data.invoices.filter((i:any)=>i.status!=='Void'),billed=(xs:any[])=>xs.filter((i:any)=>i.status!=='Draft');
 const scoped=live.filter((i:any)=>!client||i.brandId===client),shown=scoped.filter((i:any)=>status==='All'||i.status===status);
 const sum=(xs:any[],k:string)=>xs.reduce((a,i)=>a+i[k],0),month=today().slice(0,7);
 const paidThisMonth=scoped.flatMap((i:any)=>i.payments).filter((p:any)=>p.date.startsWith(month)).reduce((a:number,p:any)=>a+p.amountPaise,0);
 const inv=data.invoices.find((i:any)=>i.id===open);
 const newForm=()=>{const b=brand(client);setForm({brandId:client,period:month,issueDate:today(),dueDate:addDays(today(),15),amount:'',description:'',billingEmail:b?.clientEmail||'',billingPhone:'',notes:''});};
 const ch=data.channels;
 return <section className="leads-panel">
  <div className="client-stats">{[['Outstanding',sum(billed(scoped),'balancePaise')],['Overdue',sum(scoped.filter((i:any)=>i.status==='Overdue'),'balancePaise')],['Received this month',paidThisMonth],['Invoiced (all time)',sum(billed(scoped),'totalPaise')]].map(([l,v])=><div className="stat" key={l as string}><span>{l}</span><strong>{rupees(v as number)}</strong></div>)}</div>
  {admin?<WhatsAppSetup wa={ch.whatsappSetup} onChanged={load}/>:ch.whatsappSetup.step!=='ready'&&<p className="ig-note">WhatsApp invoices are not set up yet. Ask the administrator to finish WhatsApp setup.</p>}
  <div className="leads-toolbar"><select className="leads-search leads-client" value={client} onChange={e=>setClient(e.target.value)} aria-label="Client"><option value="">All clients</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
   <div className="viewtoggle invoice-filter">{STATUSES.map(s=><button key={s} className={status===s?'on':''} onClick={()=>setStatus(s)}>{s}{s!=='All'&&` (${scoped.filter((i:any)=>i.status===s).length})`}</button>)}</div>
   <button className="primary" onClick={newForm}><Plus size={15}/>New invoice</button></div>
  {error&&!form&&<p className="form-error" role="alert">{error}</p>}
  {client&&<h3 className="ig-sub">Invoice history · {brand(client)?.name}</h3>}
  {shown.length?<div className="ig-table-wrap client-section"><table className="ig-table invoice-table"><thead><tr><th>Invoice</th>{!client&&<th>Client</th>}<th>Month</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>{shown.map((i:any)=><tr key={i.id} onClick={()=>setOpen(i.id)} className="invoice-row"><td><button className="lead-open" onClick={()=>setOpen(i.id)}><strong>{i.number}</strong></button>{i.description&&<small>{i.description}</small>}</td>{!client&&<td>{brand(i.brandId)?.name||'Removed client'}</td>}<td>{fmtMonth(i.period)}</td><td>{fmtDay(i.dueDate)}</td><td>{rupees(i.totalPaise)}</td><td>{rupees(i.paidPaise)}</td><td>{rupees(i.balancePaise)}</td><td><em className={'shoot-status inv-'+i.status.toLowerCase()}>{i.status}</em></td></tr>)}</tbody></table></div>:<p className="client-empty">{live.length?'No invoices match these filters.':'No invoices yet. Create the first one.'}</p>}
  {inv&&<div className="modal-shade" onClick={()=>setOpen('')}><section ref={detailRef} role="dialog" aria-modal="true" className="worker-modal lead-form" onClick={e=>e.stopPropagation()} aria-label={'Invoice '+inv.number}>
   <div className="lead-form-head"><h2>{inv.number} <em className={'shoot-status inv-'+inv.status.toLowerCase()}>{inv.status}</em></h2><button className="iconbutton" onClick={()=>setOpen('')} aria-label="Close"><X size={18}/></button></div>
   <p className="ig-note">{brand(inv.brandId)?.name} · {fmtMonth(inv.period)} · issued {fmtDay(inv.issueDate)} · due {fmtDay(inv.dueDate)}{inv.description?` · ${inv.description}`:''}</p>
   <div className="client-stats">{[['Amount',inv.totalPaise],['Paid',inv.paidPaise],['Balance',inv.balancePaise]].map(([l,v])=><div className="stat" key={l as string}><span>{l}</span><strong>{rupees(v as number)}</strong></div>)}</div>
   {inv.link&&<p className="ig-note">Secure invoice link: <a href={inv.link} target="_blank" rel="noopener noreferrer">{inv.link}</a></p>}
   {inv.status==='Draft'&&<div className="ig-connection"><div><strong>Draft · not sent yet</strong>
     <span>{inv.billingEmail?`Email to ${inv.billingEmail}: ${ch.email.configured?'will be sent':'not set up ('+ch.email.missing.join(', ')+')'}`:'No billing email'}</span>
     <span>{inv.billingPhone?`WhatsApp to ${inv.billingPhone}: ${ch.whatsappSetup.step==='ready'?`will be sent from ${ch.whatsappSetup.displayPhone} with a secure link`:'WhatsApp setup not finished'}`:'No WhatsApp number'}</span>
     {!(ch.email.configured&&inv.billingEmail)&&!(ch.whatsappSetup.step==='ready'&&inv.billingPhone)&&<span className="form-error">No configured channel can deliver this invoice yet. Issuing will record it as issued but not sent.</span>}</div>
     <div className="ig-actions"><button className="primary" disabled={!!busy||(!inv.billingEmail&&!inv.billingPhone)} onClick={()=>post({type:'issue',id:inv.id,version:inv.version},'issue')}>{busy==='issue'&&<Loader2 size={14} className="spin"/>}Issue & send</button></div></div>}
   {inv.deliveries?.length>0&&<><h3 className="ig-sub">Delivery</h3><ul className="client-list">{[...inv.deliveries].reverse().map((d:any,i:number)=><li key={i}><time>{new Date(d.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'})}</time><span><strong>{d.channel==='email'?'Email':'WhatsApp'}</strong> · {d.to}{d.error?<><br/><small>{d.error}</small></>:null}</span><em className={'shoot-status '+dLabel(d.state)[1]}>{dLabel(d.state)[0]}</em></li>)}</ul>
    {inv.status!=='Draft'&&inv.status!=='Void'&&<div className="shoot-actions"><button className="secondary" disabled={!!busy} onClick={()=>post({type:'resend',id:inv.id,version:inv.version},'resend')}>{busy==='resend'&&<Loader2 size={14} className="spin"/>}Re-send invoice</button></div>}</>}
   {inv.status!=='Draft'&&<><h3 className="ig-sub">Payments</h3>
   {inv.payments.length?<ul className="client-list">{inv.payments.map((p:any)=><li key={p.id}><time>{fmtDay(p.date)}</time><span><strong>{rupees(p.amountPaise)}</strong> · {p.method}{p.reference?` · ${p.reference}`:''}</span><em>by {p.by}</em><button className="secondary" disabled={!!busy} onClick={()=>confirm('Remove this payment?')&&post({type:'remove-payment',id:inv.id,paymentId:p.id,version:inv.version},'rm')}>Remove</button></li>)}</ul>:<p className="client-empty">No payments recorded yet.</p>}</>}
   {!['Paid','Void','Draft'].includes(inv.status)&&<form className="ig-form" onSubmit={async e=>{e.preventDefault();if(await post({type:'payment',id:inv.id,version:inv.version,payment:pay},'pay'))setPay({amount:'',date:today(),method:'Bank transfer',reference:''});}}><strong>Record a payment</strong>
    <label>Amount (₹)<input required inputMode="decimal" value={pay.amount} placeholder={String(inv.balancePaise/100)} onChange={e=>setPay({...pay,amount:e.target.value})}/></label>
    <label>Date<input type="date" required max={today()} value={pay.date} onChange={e=>setPay({...pay,date:e.target.value})}/></label>
    <label>Method<select value={pay.method} onChange={e=>setPay({...pay,method:e.target.value})}>{['Bank transfer','UPI','Cash','Cheque','Card','Other'].map(m=><option key={m}>{m}</option>)}</select></label>
    <label>Reference<input value={pay.reference} onChange={e=>setPay({...pay,reference:e.target.value})}/></label>
    <button className="primary" disabled={!!busy}>{busy==='pay'&&<Loader2 size={14} className="spin"/>}Save payment</button></form>}
   {!['Paid','Void','Draft'].includes(inv.status)&&<><h3 className="ig-sub">Payment reminder</h3>
    <div className="shoot-actions">
     <button className="secondary" disabled={!!busy||!ch.email.configured||!inv.billingEmail} onClick={()=>post({type:'remind',channel:'email',id:inv.id,version:inv.version},'em')}>{busy==='em'?<Loader2 size={14} className="spin"/>:<Mail size={14}/>}Email{inv.billingEmail?` ${inv.billingEmail}`:''}</button>
     <button className="secondary" disabled={!!busy||ch.whatsappSetup.step!=='ready'||!inv.billingPhone} onClick={()=>post({type:'remind',channel:'whatsapp',id:inv.id,version:inv.version},'wa')}>{busy==='wa'?<Loader2 size={14} className="spin"/>:<MessageCircle size={14}/>}WhatsApp{inv.billingPhone?` ${inv.billingPhone}`:''}</button>
    </div>
    {!ch.email.configured&&<p className="ig-note">Email reminders need setup: {ch.email.missing.join(', ')} (a Resend account with a verified sending domain).</p>}
    {ch.whatsappSetup.step!=='ready'&&<p className="ig-note">WhatsApp reminders need the WhatsApp setup above to be finished.</p>}
    {ch.email.configured&&!inv.billingEmail&&<p className="ig-note">Add a billing email to send email reminders.</p>}
    {ch.whatsappSetup.step==='ready'&&!inv.billingPhone&&<p className="ig-note">Add a WhatsApp number to send WhatsApp reminders.</p>}</>}
   {inv.reminders?.length>0&&<details className="lead-history"><summary>Reminders sent ({inv.reminders.length})</summary><ul>{[...inv.reminders].reverse().map((r:any,i:number)=><li key={i}>{new Date(r.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'})} · {r.channel} to {r.to} · {r.state?dLabel(r.state)[0]+(r.error?': '+r.error:''):r.ok?'sent':'failed: '+r.error} · {r.by}</li>)}</ul></details>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="client-form-actions"><button className="secondary" onClick={()=>{setForm({...inv,amount:inv.totalPaise/100});setOpen('');}}>Edit invoice</button>{admin&&inv.status!=='Void'&&<button className="secondary" disabled={!!busy} onClick={()=>{const reason=prompt('Void this invoice? Optional reason:');if(reason!==null)post({type:'void',id:inv.id,reason,version:inv.version},'void').then(()=>setOpen(''));}}>Void</button>}</div>
  </section></div>}
  {form&&<div className="modal-shade" onClick={()=>setForm(null)}><form ref={formRef} role="dialog" aria-modal="true" className="worker-modal lead-form" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();if(await post({type:'invoice',id:form.id,version:form.version,invoice:form},'save'))setForm(null);}} aria-label="Invoice details">
   <div className="lead-form-head"><h2>{form.id?`Edit ${form.number}`:'New invoice'}</h2><button type="button" className="iconbutton" onClick={()=>setForm(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="lead-grid">
    <label>Client *<select required value={form.brandId} onChange={e=>{const b=brand(e.target.value);setForm({...form,brandId:e.target.value,billingEmail:form.billingEmail||b?.clientEmail||''});}}><option value="">Choose…</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>Billing month<input type="month" value={form.period} onChange={e=>setForm({...form,period:e.target.value})}/></label>
    <label>Invoice date *<input type="date" required value={form.issueDate} onChange={e=>setForm({...form,issueDate:e.target.value})}/></label>
    <label>Due date *<input type="date" required value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
    <label>Amount (₹) *<input required inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
    <label>Description<input value={form.description} placeholder="e.g. Monthly retainer · 12 reels" onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <label>Billing email<input type="email" value={form.billingEmail} onChange={e=>setForm({...form,billingEmail:e.target.value})}/></label>
    <label>WhatsApp number<input type="tel" value={form.billingPhone} placeholder="+91 98765 43210" onChange={e=>setForm({...form,billingPhone:e.target.value})}/></label>
    <label className="wide">Notes<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="client-form-actions"><button className="primary" disabled={!!busy}>{busy==='save'&&<Loader2 size={15} className="spin"/>}{form.id?'Save changes':'Save as draft'}</button><button type="button" className="secondary" onClick={()=>setForm(null)}>Cancel</button></div>
  </form></div>}
 </section>;
}
// Admin setup: connect Nova Frames' Meta account → choose WhatsApp Business account + number → choose approved templates.
function WhatsAppSetup({wa,onChanged}:{wa:any,onChanged:()=>void}){
 const [busy,setBusy]=useState(''),[err,setErr]=useState(''),[pick,setPick]=useState(''),[tpl,setTpl]=useState<any>({invoice:'',reminder:''});
 const [flash]=useState(()=>{if(typeof window==='undefined')return '';const q=new URLSearchParams(window.location.search);return q.get('wa')==='connected'?'Meta account connected. Now choose the WhatsApp number.':q.get('wa')==='error'?(q.get('message')||'Connection failed.'):'';});
 async function post(body:any){setBusy(body.type);setErr('');try{const r=await fetch('/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);onChanged();}catch(e){setErr((e as Error).message);}finally{setBusy('');}}
 const key=(t:any)=>t?t.name+'|'+t.language:'',approved=(wa.templates||[]).filter((t:any)=>t.status==='APPROVED'&&t.category==='UTILITY'&&t.vars===5);
 const steps=[['server','Server settings'],['connect','Connect Meta account'],['choose','Choose number'],['templates','Choose templates'],['ready','Ready']],at=steps.findIndex(x=>x[0]===wa.step);
 return <details className="client-section meta-leads" open={wa.step!=='ready'||!!flash||undefined}><summary>WhatsApp · {wa.step==='ready'?`sending from ${wa.displayPhone} (${wa.verifiedName})`:'setup incomplete'}</summary>
  <ol className="wa-steps">{steps.map(([k,l],i)=><li key={k} className={i<at?'done':i===at?'now':''}>{l}</li>)}</ol>
  {flash&&<p className={flash.startsWith('Meta account')?'ig-ok':'form-error'}>{flash}</p>}{err&&<p className="form-error" role="alert">{err}</p>}
  {wa.step==='server'&&<p className="ig-note">Set these on the server first: {wa.missing.join(', ')}. In the Meta app, add the WhatsApp product and set the webhook callback to <code>{wa.webhookUrl}</code> (field: messages).</p>}
  {at>=1&&<div className="meta-connect"><a className={wa.step==='connect'?'primary':'secondary'} href="/api/whatsapp">{wa.step==='connect'?'Connect Nova Frames’ Meta account':'Reconnect Meta account'}</a>{wa.tokenExpires>0&&<span className="ig-note">Connection valid until {new Date(wa.tokenExpires).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>}</div>}
  {at>=2&&<div className="meta-choose"><strong>WhatsApp Business account and sending number</strong>
   {wa.accounts.length?<select aria-label="WhatsApp number to send from" value={pick||(wa.wabaId?wa.wabaId+'|'+wa.phoneNumberId:'')} onChange={e=>setPick(e.target.value)} className="leads-search"><option value="">Choose…</option>{wa.accounts.flatMap((a:any)=>a.phones.map((p:any)=><option key={p.id} value={a.id+'|'+p.id}>{a.name} · {p.display} ({p.name}{p.status?', '+p.status.toLowerCase():''})</option>))}</select>:<p className="client-empty">No WhatsApp Business accounts were shared. Reconnect and select the account.</p>}
   {wa.accounts.some((a:any)=>a.error)&&<p className="form-error">{wa.accounts.filter((a:any)=>a.error).map((a:any)=>a.id+': '+a.error).join(' · ')}</p>}
   <button className="primary" disabled={!!busy||!pick} onClick={()=>{const [wabaId,phoneId]=pick.split('|');post({type:'number',wabaId,phoneId});}}>{busy==='number'&&<Loader2 size={14} className="spin"/>}Use this number</button></div>}
  {at>=3&&<div className="meta-choose"><strong>Approved templates (Utility, 5 variables: client, invoice no., amount, due date, secure link)</strong>
   {approved.length?<><label>Invoice<select className="leads-search" value={tpl.invoice||key(wa.invoiceTemplate)} onChange={e=>setTpl({...tpl,invoice:e.target.value})}><option value="">Choose…</option>{approved.map((t:any)=><option key={key(t)} value={key(t)}>{t.name} ({t.language})</option>)}</select></label>
    <label>Reminder<select className="leads-search" value={tpl.reminder||key(wa.reminderTemplate)} onChange={e=>setTpl({...tpl,reminder:e.target.value})}><option value="">Choose…</option>{approved.map((t:any)=><option key={key(t)} value={key(t)}>{t.name} ({t.language})</option>)}</select></label>
    <button className="primary" disabled={!!busy} onClick={()=>{const sp=(v:string)=>{const [name,language]=v.split('|');return {name,language};};post({type:'templates',invoice:sp(tpl.invoice||key(wa.invoiceTemplate)),reminder:sp(tpl.reminder||key(wa.reminderTemplate))});}}>Save templates</button></>
   :<p className="client-empty">No usable templates yet. In WhatsApp Manager create Utility templates with body variables {'{{1}}'}–{'{{5}}'} and wait for Meta approval.</p>}
   <button className="secondary" disabled={!!busy} onClick={()=>post({type:'refresh-templates'})}>{busy==='refresh-templates'&&<Loader2 size={14} className="spin"/>}Reload templates from Meta</button>
   {(wa.templates||[]).length>approved.length&&<p className="ig-note">Not usable: {(wa.templates||[]).filter((t:any)=>!approved.includes(t)).map((t:any)=>`${t.name} (${t.status.toLowerCase()}, ${t.category.toLowerCase()}, ${t.vars} vars)`).join(' · ')}</p>}</div>}
  {wa.step==='ready'&&<p className="ig-note">Clients only receive WhatsApp messages if they agreed to hear from Nova Frames on WhatsApp. Statuses update when Meta confirms delivery.</p>}
  {at>=2&&<button className="secondary" disabled={!!busy} onClick={()=>confirm('Disconnect WhatsApp? Invoices will stop sending on WhatsApp.')&&post({type:'disconnect'})}>Disconnect WhatsApp</button>}
 </details>;
}
