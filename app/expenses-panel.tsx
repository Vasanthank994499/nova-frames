'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

const today=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const money=(cents:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(cents/100);
const MAX_PHOTO_SIZE=6*1024*1024;

export function ExpensesPanel({user}:{user:{id:string,admin:boolean,roles:string[]}}){
 const [month,setMonth]=useState(()=>today().slice(0,7));
 const [data,setData]=useState<any>({entries:[],people:[],managers:[],totalCents:0});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[proofPhoto,setProofPhoto]=useState<{file:File,url:string}|null>(null);
 const form=useRef<HTMLFormElement|null>(null),entry=useRef(''),previewUrl=useRef('');
 const load=useCallback(async()=>{const r=await fetch('/api/expenses?month='+month,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load expenses.');setData(d);},[month]);
 useEffect(()=>{let active=true;setLoading(true);setError('');load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[load]);
 useEffect(()=>()=>{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const body=new FormData(e.currentTarget);entry.current||=crypto.randomUUID();body.set('entryId',entry.current);body.set('proofSubmitted',body.get('proofSubmitted')==='on'?'true':'false');setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/expenses',{method:'POST',body}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not submit expense.');const submittedMonth=String(body.get('day')).slice(0,7);entry.current='';form.current?.reset();clearPhoto();setNotice('Expense recorded and submitted to the selected manager. Receipt photos are visible to administrators only.');if(submittedMonth!==month)setMonth(submittedMonth);else await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function clearPhoto(){if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setProofPhoto(null);}
 function choosePhoto(file?:File){setError('');if(!file){clearPhoto();return false;}if(!['image/jpeg','image/png','image/webp'].includes(file.type)){clearPhoto();setError('Choose a JPG, PNG or WebP receipt photo.');return false;}if(!file.size||file.size>MAX_PHOTO_SIZE){clearPhoto();setError('Choose a photo smaller than 6 MB.');return false;}if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);const url=URL.createObjectURL(file);previewUrl.current=url;setProofPhoto({file,url});return true;}

 return <section className="expenses-panel">
  <div className="section-title"><div><h2>Daily expense tracker</h2><p className="muted">{user.admin?'Company expenses across all employees.':user.roles.includes('manager')?'Your expenses and expenses submitted to you.':'Your submitted daily expenses.'} Amounts are in INR.</p></div><div className="expense-total"><small>{month} total</small><strong>{money(data.totalCents)}</strong></div></div>
  {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="request-notice" role="status">{notice}</p>}
  <form ref={form} onSubmit={submit} className="expense-form" encType="multipart/form-data">
   <h3>Add daily expense</h3><div className="form-grid">
    <label>Employee<select name="workerId" required key={user.id+data.people.length} defaultValue={data.people.some((p:any)=>p.id===user.id)?user.id:''}><option value="">Select employee</option>{data.people.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Expense date<input name="day" type="date" max={today()} defaultValue={today()} required/></label>
    <label>Amount (INR)<input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00"/></label>
    <label>Submitted to manager<select name="managerId" required><option value="">Select manager</option>{data.managers.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="full">What was the expense for?<textarea name="purpose" required maxLength={2000} rows={3}/></label>
    <label className="full">Proof / submission details<textarea name="proofNotes" maxLength={2000} rows={2} placeholder="Receipt details, reference number, or notes…"/></label>
    <label className="full expense-photo-field">Receipt photo (optional)<input name="proofPhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{if(!choosePhoto(e.currentTarget.files?.[0]))e.currentTarget.value='';}}/><small>JPG, PNG or WebP · up to 6 MB. Resized before saving. Only administrators can view uploaded receipt photos.</small></label>
    {proofPhoto&&<div className="expense-photo-preview"><img src={proofPhoto.url} alt="Selected receipt preview"/><span>{proofPhoto.file.name}</span><button type="button" className="textbutton" onClick={()=>{clearPhoto();const input=form.current?.elements.namedItem('proofPhoto');if(input instanceof HTMLInputElement)input.value='';}}>Remove photo</button></div>}
    <label className="checkbox full"><input type="checkbox" name="proofSubmitted"/>Proof submitted to the manager</label>
   </div>
   <button className="primary" disabled={busy||loading||!data.managers.length}>{busy?'Submitting…':'Submit expense'}</button>{!loading&&!data.managers.length&&<p className="muted">An administrator must add an active manager before expenses can be submitted.</p>}
  </form>
  <form className="expense-month" onSubmit={e=>{e.preventDefault();setMonth(String(new FormData(e.currentTarget).get('month')));}}><label>Expense month<input name="month" type="month" required defaultValue={month} key={month}/></label><button className="secondary" disabled={loading}>View month</button></form>
  {loading?<p className="panel-loading">Loading expenses…</p>:data.entries.length?<div className="table-wrap"><table><thead><tr><th>DATE / EMPLOYEE</th><th>AMOUNT</th><th>PURPOSE</th><th>SUBMITTED TO</th><th>PROOF</th></tr></thead><tbody>{data.entries.map((expense:any)=><tr key={expense.id}><td><strong>{expense.workerName}</strong><small className="cell-small">{expense.day}</small></td><td>{money(expense.amountCents)}</td><td className="expense-details">{expense.purpose}</td><td>{expense.managerName}</td><td className="expense-details">{expense.proofSubmitted?'Submitted':'Not yet submitted'}{expense.proofNotes&&<small className="cell-small">{expense.proofNotes}</small>}{user.admin&&expense.hasProofPhoto&&<a className="textbutton" href={'/api/expenses/'+encodeURIComponent(expense.id)+'/proof'} target="_blank" rel="noopener noreferrer">View receipt photo</a>}{user.admin&&expense.proofLink&&<a className="textbutton" href={expense.proofLink} target="_blank" rel="noopener noreferrer">Open saved Drive proof</a>}</td></tr>)}</tbody></table></div>:<p className="muted">No expenses for this month.</p>}
 </section>;
}
