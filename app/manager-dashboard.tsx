'use client';
import {useEffect,useState} from 'react';
import {Briefcase,CalendarDays,Target,Receipt,Users,ArrowRight} from 'lucide-react';
import {currentAssignees} from '../lib/job-filters';

// Reads the same manager/admin-only APIs the other pages use; each source fails on its own so one outage never blanks the page.
async function get(url:string){const r=await fetch(url,{cache:'no-store'});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Could not load this data.');return d;}
const istDay=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
const rupees=(paise:number)=>'₹'+(paise/100).toLocaleString('en-IN',{maximumFractionDigits:0});
type Src={data?:any,error?:string};

function Card({title,icon:Icon,to,go,children}:{title:string,icon:any,to:string,go:(p:string)=>void,children:any}){
 return <section className="client-section"><div className="section-title"><h2><Icon size={16}/>{title}</h2><button type="button" className="textbutton" onClick={()=>go(to)}>Open {to}<ArrowRight size={13}/></button></div>{children}</section>;
}
const Empty=({children}:{children:any})=><p className="client-empty">{children}</p>;
function Body({src,children}:{src:Src,children:(d:any)=>any}){return src.error?<Empty>{src.error}</Empty>:!src.data?<Empty>Loading…</Empty>:children(src.data);}

export function ManagerDashboard({go}:{go:(p:string)=>void}){
 const [ws,setWs]=useState<Src>({}),[shoots,setShoots]=useState<Src>({}),[inv,setInv]=useState<Src>({}),[leads,setLeads]=useState<Src>({});
 useEffect(()=>{const load=(url:string,set:(s:Src)=>void)=>get(url).then(data=>set({data}),e=>set({error:(e as Error).message}));
  load('/api/workspace',setWs);load('/api/shoots',setShoots);load('/api/invoices',setInv);load('/api/leads',setLeads);},[]);
 const today=istDay(),month=today.slice(0,7),now=new Date().toISOString();
 const jobs:any[]=ws.data?.jobs||[],brands:any[]=ws.data?.brands||[];
 const upcoming=(shoots.data?.shoots||[]).filter((s:any)=>s.startsAt>=now&&!['Cancelled','Completed'].includes(s.status)).sort((a:any,b:any)=>a.startsAt.localeCompare(b.startsAt));
 const shootBrand=new Map((shoots.data?.brands||[]).map((b:any)=>[b.id,b.name]));
 const dueThisMonth=jobs.filter(j=>(j.due||'').startsWith(month)),doneThisMonth=dueThisMonth.filter(j=>['Completed'].includes(j.stage));
 const invoices=(inv.data?.invoices||[]).filter((i:any)=>!['Void','Draft'].includes(i.status));
 const byStatus=(s:string)=>invoices.filter((i:any)=>i.status===s);
 const leadList:any[]=leads.data?.leads||[],closed=leadList.filter(l=>l.status==='Closed').length;
 const workload=(ws.data?.workers||[]).map((w:any)=>({id:w.id,name:w.name,count:jobs.filter(j=>j.stage!=='Completed'&&currentAssignees(j).includes(w.id)).length})).sort((a:any,b:any)=>b.count-a.count);
 return <section className="studio-snapshot" aria-labelledby="snapshot-title"><div className="section-title"><h2 id="snapshot-title">Studio snapshot</h2><span>Clients, shoots, payments, leads and team load</span></div>
  <div className="stats">
   <div className="stat"><div>Active clients<Briefcase size={15}/></div><strong>{ws.data?brands.length:'—'}</strong><small>Enabled brands</small></div>
   <div className="stat"><div>Upcoming shoots<CalendarDays size={15}/></div><strong>{shoots.data?upcoming.length:'—'}</strong><small>Pending, confirmed or in progress</small></div>
   <div className="stat"><div>Lead conversion<Target size={15}/></div><strong>{leads.data?(leadList.length?Math.round(closed/leadList.length*100)+'%':'—'):'—'}</strong><small>Closed of all leads</small></div>
   <div className="stat"><div>Outstanding<Receipt size={15}/></div><strong>{inv.data?rupees(invoices.reduce((t:number,i:any)=>t+(i.balancePaise||0),0)):'—'}</strong><small>Unpaid invoice balance</small></div>
  </div>
  <div className="snapshot-grid">
  <Card title="Active clients" icon={Briefcase} to="Clients" go={go}><Body src={ws}>{()=>brands.length?<ul className="client-list">{brands.map(b=><li key={b.id}><span>{b.name}</span><em>{b.industry||''}</em></li>)}</ul>:<Empty>No active clients yet.</Empty>}</Body></Card>
  <Card title="Upcoming shoots" icon={CalendarDays} to="Shoot schedule" go={go}><Body src={shoots}>{()=>upcoming.length?<ul className="client-list">{upcoming.slice(0,8).map((s:any)=><li key={s.id}><time>{new Date(s.startsAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:shoots.data.studioTimeZone})}</time><span>{s.title||'Shoot'} · {String(shootBrand.get(s.brandId)||'')}</span><em>{s.status}</em></li>)}</ul>:<Empty>No upcoming shoots scheduled.</Empty>}</Body></Card>
  <Card title="Monthly video targets" icon={Target} to="Projects" go={go}><Body src={ws}>{()=><><Empty>No monthly video targets are set in the system yet, so progress against a target can’t be shown.</Empty>{dueThisMonth.length?<p className="muted">This month: {doneThisMonth.length} of {dueThisMonth.length} videos due in {month} are posted or completed.</p>:<p className="muted">No videos are due in {month}.</p>}</>}</Body></Card>
  <Card title="Payment status" icon={Receipt} to="Invoices" go={go}><Body src={inv}>{()=>invoices.length?<ul className="client-list">{['Pending','Overdue','Paid'].map(s=><li key={s}><span>{s}</span><em>{byStatus(s).length} invoices · {rupees(byStatus(s).reduce((t:number,i:any)=>t+((s==='Paid'?i.totalPaise:i.balancePaise)||0),0))}</em></li>)}</ul>:<Empty>No issued invoices yet.</Empty>}</Body></Card>
  <Card title="Lead conversion" icon={Target} to="Leads" go={go}><Body src={leads}>{()=>leadList.length?<><p><strong>{Math.round(closed/leadList.length*100)}%</strong> <span className="muted">closed ({closed} of {leadList.length} leads)</span></p><ul className="client-list">{(leads.data.statuses||[]).map((s:string)=><li key={s}><span>{s}</span><em>{leadList.filter(l=>l.status===s).length}</em></li>)}</ul></>:<Empty>No leads recorded yet.</Empty>}</Body></Card>
  <Card title="Team workload" icon={Users} to="Work allocation" go={go}><Body src={ws}>{()=>workload.length?<ul className="client-list">{workload.map((w:any)=><li key={w.id}><span>{w.name}</span><em>{w.count} active {w.count===1?'video':'videos'}</em></li>)}</ul>:<Empty>No active team members.</Empty>}</Body></Card>
  </div>
 </section>;
}
