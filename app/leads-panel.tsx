'use client';
import {useCallback,useEffect,useState} from 'react';
import {useDialog} from './use-dialog';
import {Plus,Loader2,Phone,Mail,CalendarClock,X,Link2} from 'lucide-react';
const COLUMNS=[{status:'New',label:'New leads'},{status:'Qualified',label:'Qualified leads'},{status:'In progress',label:'In progress'},{status:'Closed',label:'Converted / Closed'}];
const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const blank={brandId:'',name:'',company:'',phone:'',email:'',requirements:'',budget:'',followUp:'',source:'',status:'New',outcome:'Converted',notes:''};
const money=(v:number|null)=>v===null||v===undefined?'':'₹'+v.toLocaleString('en-IN');
const fmtDay=(d:string)=>{const t=new Date(d+'T00:00:00');return isNaN(+t)?d:t.toLocaleDateString('en-IN',{day:'numeric',month:'short'});};
export function LeadsPanel(){
 const [data,setData]=useState<any>(null),[form,setForm]=useState<any>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[search,setSearch]=useState(''),[client,setClient]=useState('');
 const dialogRef=useDialog<HTMLFormElement>(!!form,()=>setForm(null));
 const load=useCallback(async()=>{try{const r=await fetch('/api/leads',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{load();},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');try{const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead:form,version:form.version})}),d=await r.json();if(!r.ok)throw Error(d.error);setForm(null);await load();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
 async function move(lead:any,status:string){setError('');try{const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead:{...lead,status,budget:lead.budget??''},version:lead.version})}),d=await r.json();if(!r.ok)throw Error(d.error);await load();}catch(e){setError((e as Error).message);}}
 if(!data)return <section className="report-panel">{error?<p className="form-error" role="alert">{error}</p>:<Loader2 className="spin"/>}</section>;
 const q=search.trim().toLowerCase(),brandName=(id:string)=>data.brands.find((b:any)=>b.id===id)?.name||'',shown=data.leads.filter((l:any)=>(!client||(client==='none'?!l.brandId:l.brandId===client))&&(!q||[l.name,l.company,l.email,l.phone,l.requirements,brandName(l.brandId)].join(' ').toLowerCase().includes(q)));
 return <section className="leads-panel">
  <div className="leads-toolbar"><input className="leads-search" placeholder="Search leads" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search leads"/><select className="leads-search leads-client" value={client} onChange={e=>setClient(e.target.value)} aria-label="Filter by client"><option value="">All clients</option><option value="none">No client yet</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="primary" onClick={()=>setForm({...blank})}><Plus size={15}/>New lead</button></div>
  {error&&!form&&<p className="form-error" role="alert">{error}</p>}
  <MetaConnections meta={data.meta} brands={data.brands} brandName={brandName} onChanged={load}/>
  <div className="leads-board">{COLUMNS.map(col=>{const items=shown.filter((l:any)=>l.status===col.status).sort((a:any,b:any)=>(a.followUp||'9999').localeCompare(b.followUp||'9999'));return <div className="leads-column" key={col.status}><h3>{col.label}<span className="count">{items.length}</span></h3>
   {items.length?items.map((l:any)=>{const overdue=l.status!=='Closed'&&l.followUp&&l.followUp<today(),due=l.status!=='Closed'&&l.followUp===today();return <article className="lead-card" key={l.id}>
    <button className="lead-open" onClick={()=>setForm({...blank,...l,budget:l.budget??'',outcome:l.outcome||'Converted'})}><strong>{l.name}</strong>{(l.company||l.brandId)&&<span>{[brandName(l.brandId),l.company].filter(Boolean).join(' · ')}</span>}</button>
    {l.requirements&&<p>{l.requirements.length>110?l.requirements.slice(0,110)+'…':l.requirements}</p>}
    <div className="lead-meta">{l.budget!==null&&<span>{money(l.budget)}</span>}<span className={l.meta?'lead-meta-badge':''}>{l.source}</span>{l.outcome&&<span className={l.outcome==='Lost'?'lead-lost':'lead-won'}>{l.outcome}</span>}</div>
    <div className="lead-meta">{l.phone&&<a href={'tel:'+l.phone}><Phone size={13}/>{l.phone}</a>}{l.email&&<a href={'mailto:'+l.email}><Mail size={13}/>Email</a>}</div>
    {l.followUp&&<p className={overdue?'lead-due overdue':due?'lead-due today':'lead-due'}><CalendarClock size={13}/>{overdue?'Overdue · ':due?'Today · ':'Follow up '}{fmtDay(l.followUp)}</p>}
    <label className="lead-move">Status<select value={l.status} onChange={e=>move(l,e.target.value)}>{COLUMNS.map(c=><option key={c.status} value={c.status}>{c.label}</option>)}</select></label>
   </article>;}):<p className="client-empty">{q?'No matching leads.':'No leads here yet.'}</p>}
  </div>;})}</div>
  {form&&<div className="modal-shade" onClick={()=>setForm(null)}><form ref={dialogRef} role="dialog" aria-modal="true" className="worker-modal lead-form" onClick={e=>e.stopPropagation()} onSubmit={save} aria-label={form.id?'Edit lead':'New lead'}>
   <div className="lead-form-head"><h2>{form.id?'Edit lead':'New lead'}</h2><button type="button" className="iconbutton" onClick={()=>setForm(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="lead-grid">
    <label>Client<select value={form.brandId||''} onChange={e=>setForm({...form,brandId:e.target.value})}><option value="">No client yet</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>Name *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Company / brand<input value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></label>
    <label>Phone<input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>Budget (₹)<input inputMode="numeric" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></label>
    <label>Follow-up date<input type="date" value={form.followUp} onChange={e=>setForm({...form,followUp:e.target.value})}/></label>
    <label>Lead source *<select required value={form.source} onChange={e=>setForm({...form,source:e.target.value})}><option value="">Choose…</option>{data.sources.map((s:string)=><option key={s}>{s}</option>)}</select></label>
    <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{COLUMNS.map(c=><option key={c.status} value={c.status}>{c.label}</option>)}</select></label>
    {form.status==='Closed'&&<label>Outcome<select value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}><option>Converted</option><option>Lost</option></select></label>}
    <label className="wide">Requirements<textarea rows={3} value={form.requirements} onChange={e=>setForm({...form,requirements:e.target.value})}/></label>
    <label className="wide">Notes<textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div>
   {form.history?.length>0&&<details className="lead-history"><summary>History</summary><ul>{[...form.history].reverse().map((h:any,i:number)=><li key={i}>{new Date(h.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'})} · {h.by} · {h.detail}</li>)}</ul></details>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="client-form-actions"><button className="primary" disabled={saving}>{saving&&<Loader2 size={15} className="spin"/>}{form.id?'Save changes':'Create lead'}</button><button type="button" className="secondary" onClick={()=>setForm(null)}>Cancel</button></div>
  </form></div>}
 </section>;
}
// Meta Lead Ads: which Facebook Page feeds which client. Tokens stay on the server; only names and status come here.
function MetaConnections({meta,brands,brandName,onChanged}:{meta:any,brands:any[],brandName:(id:string)=>string,onChanged:()=>void}){
 const [brand,setBrand]=useState(''),[pending,setPending]=useState<any>(null),[busy,setBusy]=useState(''),[err,setErr]=useState('');
 const [flash]=useState(()=>{if(typeof window==='undefined')return '';const q=new URLSearchParams(window.location.search);return q.get('meta')==='connected'?`Connected ${q.get('name')||'the Page'}. New leads will arrive automatically.`:q.get('meta')==='error'?(q.get('message')||'Facebook connection failed.'):'';});
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('meta')!=='choose')return;fetch('/api/meta-leads?pending=1',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setPending(d);}).catch(e=>setErr(e.message));},[]);
 async function post(body:any){setBusy(body.type+body.pageId);setErr('');try{const r=await fetch('/api/meta-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);setPending(null);onChanged();}catch(e){setErr((e as Error).message);}finally{setBusy('');}}
 return <details className="client-section meta-leads" open={!!pending||!!flash||undefined}><summary><Link2 size={16}/>Meta Lead Ads · {meta.pages.length?`${meta.pages.length} Page${meta.pages.length===1?'':'s'} connected`:'not connected'}</summary>
  {meta.missing.length>0&&<p className="ig-note">Server setup needed before connecting: {meta.missing.join(', ')}. Webhook callback URL for the Meta app: <code>{meta.webhookUrl}</code></p>}
  {flash&&<p className={flash.startsWith('Connected')?'ig-ok':'form-error'}>{flash}</p>}{err&&<p className="form-error" role="alert">{err}</p>}
  {pending&&<div className="meta-choose"><strong>Choose the Page for {brandName(pending.brandId)}</strong>{pending.pages.map((p:any)=><button key={p.id} className="secondary" disabled={!!busy} onClick={()=>post({type:'link',pageId:p.id})}>{busy==='link'+p.id&&<Loader2 size={14} className="spin"/>}{p.name}</button>)}</div>}
  {meta.pages.length?<ul className="client-list">{meta.pages.map((p:any)=><li key={p.pageId}><span><strong>{p.pageName}</strong> → {brandName(p.brandId)||'Removed client'}</span><em>{p.lastLeadAt?'Last lead '+new Date(p.lastLeadAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}):'No leads received yet'}</em>{p.lastError&&<em className="form-error">Last error: {p.lastError}</em>}<button className="secondary" disabled={!!busy} onClick={()=>confirm(`Stop capturing leads from ${p.pageName}? Existing leads stay.`)&&post({type:'unlink',pageId:p.pageId})}>Disconnect</button></li>)}</ul>:<p className="client-empty">No Facebook Pages connected. Connect a client’s Page to capture its Lead Ads automatically.</p>}
  <div className="meta-connect"><select value={brand} onChange={e=>setBrand(e.target.value)} aria-label="Client for the Page"><option value="">Choose client…</option>{brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>{brand&&!meta.missing.length?<a className="primary" href={'/api/meta-leads?brand='+encodeURIComponent(brand)}>Connect Facebook Page</a>:<button className="primary" disabled>Connect Facebook Page</button>}</div>
 </details>;
}
