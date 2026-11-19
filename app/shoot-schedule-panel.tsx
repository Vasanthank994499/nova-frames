'use client';
import {useCallback,useEffect,useState} from 'react';
import {useDialog} from './use-dialog';
import {CalendarPlus,Loader2,MapPin,Users,Clock,X} from 'lucide-react';
const ZONES=['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','America/New_York','UTC'];
const fmt=(iso:string,tz:string)=>new Intl.DateTimeFormat('en-IN',{timeZone:tz,weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));
const viewerTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone;}catch{return 'Asia/Kolkata';}};
const blank={title:'',brandId:'',date:'',time:'10:00',timeZone:'Asia/Kolkata',durationMins:120,location:'',details:'',crewIds:[] as string[]};
export function ShootSchedulePanel(){
 const [data,setData]=useState<any>(null),[form,setForm]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[showPast,setShowPast]=useState(false);
 const dialogRef=useDialog<HTMLFormElement>(!!form,()=>setForm(null));
 const load=useCallback(async()=>{try{const r=await fetch('/api/shoots',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{load();},[load]);
 async function post(body:any,key:string){setBusy(key);setError('');try{const r=await fetch('/api/shoots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);setForm(null);await load();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 if(!data)return <section className="report-panel">{error?<p className="form-error" role="alert">{error}</p>:<Loader2 className="spin"/>}</section>;
 const tz=viewerTz(),now=Date.now(),name=(id:string)=>data.team.find((t:any)=>t.id===id)?.name,brand=(id:string)=>data.brands.find((b:any)=>b.id===id)?.name;
 const upcoming=data.shoots.filter((s:any)=>!['Completed','Cancelled'].includes(s.status)),past=data.shoots.filter((s:any)=>['Completed','Cancelled'].includes(s.status)).reverse();
 const card=(s:any)=>{const late=s.status==='Confirmed'&&Date.parse(s.startsAt)<now;return <article className="shoot-card" key={s.id}>
  <div className="shoot-head"><strong>{s.title}</strong><em className={'shoot-status shoot-'+s.status.toLowerCase().replace(' ','-')}>{s.status}</em></div>
  <p><Clock size={13}/>{fmt(s.startsAt,s.timeZone)} · {Math.round(s.durationMins/6)/10} h{fmt(s.startsAt,tz)!==fmt(s.startsAt,s.timeZone)&&<small> ({fmt(s.startsAt,tz)} your time)</small>}</p>
  {data.manager&&brand(s.brandId)&&<p className="shoot-client">{brand(s.brandId)}</p>}
  {s.location&&<p><MapPin size={13}/>{s.location}</p>}
  {data.manager&&<p><Users size={13}/>{s.crewIds.length?s.crewIds.map((id:string)=>name(id)||'Unavailable').join(', '):'No team assigned'}</p>}
  {s.details&&<p className="shoot-details">{s.details}</p>}
  {late&&<p className="form-error">Shoot time has passed. Update its status.</p>}
  {s.cancelReason&&<p className="shoot-details">Reason: {s.cancelReason}</p>}
  <div className="shoot-actions">
   {data.manager&&s.status==='Pending'&&<button className="primary" disabled={!!busy} onClick={()=>post({type:'confirm',id:s.id,version:s.version},'c'+s.id)}>{busy==='c'+s.id&&<Loader2 size={14} className="spin"/>}Confirm & notify</button>}
   {s.canUpdateStatus&&s.status==='Confirmed'&&<button className="secondary" disabled={!!busy} onClick={()=>post({type:'status',status:'In progress',id:s.id,version:s.version},'s'+s.id)}>Start shoot</button>}
   {s.canUpdateStatus&&['Confirmed','In progress'].includes(s.status)&&<button className="primary" disabled={!!busy} onClick={()=>post({type:'status',status:'Completed',id:s.id,version:s.version},'d'+s.id)}>Mark complete</button>}
   {data.manager&&!['Completed','Cancelled'].includes(s.status)&&<><button className="secondary" disabled={!!busy} onClick={()=>setForm({...blank,...s})}>{s.status==='Pending'?'Edit':'Reschedule / edit'}</button><button className="secondary" disabled={!!busy} onClick={()=>{const reason=prompt('Cancel this shoot? Optional reason for the team'+(s.status==='Confirmed'?' and client':'')+':');if(reason!==null)post({type:'cancel',id:s.id,reason,version:s.version},'x'+s.id);}}>Cancel shoot</button></>}
  </div>
 </article>;};
 return <section className="shoot-panel">
  {data.manager&&<div className="leads-toolbar"><p className="ig-note">Confirming sends the details to the client and team. Reminders go out 2 days and 1 day before. Rescheduling or cancelling updates everyone.</p><button className="primary" onClick={()=>setForm({...blank})}><CalendarPlus size={15}/>Schedule shoot</button></div>}
  {error&&!form&&<p className="form-error" role="alert">{error}</p>}
  <div className="shoot-list">{upcoming.length?upcoming.map(card):<p className="client-empty">{data.manager?'No upcoming shoots. Schedule one to get started.':'No upcoming shoots assigned to you.'}</p>}</div>
  {past.length>0&&<details open={showPast} onToggle={e=>setShowPast((e.target as HTMLDetailsElement).open)}><summary className="ig-sub">Completed and cancelled ({past.length})</summary><div className="shoot-list">{past.map(card)}</div></details>}
  {form&&<div className="modal-shade" onClick={()=>setForm(null)}><form ref={dialogRef} role="dialog" aria-modal="true" className="worker-modal lead-form" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();post({type:'save',id:form.id,version:form.version,shoot:form},'save');}} aria-label="Shoot details">
   <div className="lead-form-head"><h2>{form.id?'Edit shoot':'Schedule shoot'}</h2><button type="button" className="iconbutton" onClick={()=>setForm(null)} aria-label="Close"><X size={18}/></button></div>
   {form.id&&form.status!=='Pending'&&<p className="ig-note">Changing the date, time or location notifies the client and team and resets reminders.</p>}
   <div className="lead-grid">
    <label className="wide">Title *<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label>Client *<select required value={form.brandId} onChange={e=>setForm({...form,brandId:e.target.value})}><option value="">Choose…</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>Time zone<select value={form.timeZone} onChange={e=>setForm({...form,timeZone:e.target.value})}>{[...new Set([form.timeZone,...ZONES])].map(z=><option key={z} value={z}>{z.replace('_',' ')}</option>)}</select></label>
    <label>Date *<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
    <label>Start time *<input type="time" required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label>
    <label>Duration (minutes)<input type="number" min={15} max={1440} step={15} value={form.durationMins} onChange={e=>setForm({...form,durationMins:e.target.value})}/></label>
    <label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
    <label className="wide">Details for the team and client<textarea rows={3} value={form.details} onChange={e=>setForm({...form,details:e.target.value})}/></label>
    <fieldset className="wide shoot-crew"><legend>Team</legend>{data.team.length?data.team.map((t:any)=><label key={t.id}><input type="checkbox" checked={form.crewIds.includes(t.id)} onChange={e=>setForm({...form,crewIds:e.target.checked?[...form.crewIds,t.id]:form.crewIds.filter((x:string)=>x!==t.id)})}/>{t.name}{t.roles.includes('camera')&&<small> · Camera</small>}</label>):<p className="client-empty">No active team members.</p>}</fieldset>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="client-form-actions"><button className="primary" disabled={!!busy}>{busy==='save'&&<Loader2 size={15} className="spin"/>}{form.id?'Save changes':'Save as pending'}</button><button type="button" className="secondary" onClick={()=>setForm(null)}>Cancel</button></div>
  </form></div>}
 </section>;
}
