'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarDays,FileText,Bell,LogOut,Loader2,ArrowUpRight,UserPlus,BarChart3,TrendingUp,Menu,LayoutDashboard,Clapperboard,Camera,Moon,Sun} from 'lucide-react';
const fmtDay=(d:string)=>{const t=new Date(d+'T00:00:00');return isNaN(+t)?d:t.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});};
const fmtMonth=(m:string)=>{const t=new Date(m+'-01T00:00:00');return isNaN(+t)?m:t.toLocaleDateString('en-IN',{month:'long',year:'numeric'});};
const fmtAt=(at:string)=>{const t=new Date(at);return isNaN(+t)?at:t.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'});};
const ACTIONS:Record<string,string>={shoot:'',created:'New video added','submit-shoot':'Shoot delivered to editing',updated:'Video updated',stage:'Moved to a new stage'};
function Empty({text}:{text:string}){return <p className="client-empty">{text}</p>;}
// The dashboard body, shared by the client login and the admin/manager view.
export function ClientDashboard({dashboard,editable=false,onSaved,page}:{dashboard:any,editable?:boolean,onSaved?:()=>void,page?:string}){
 const t=dashboard.totals||{},on=(k:string)=>!page||page===k;
 return <div className="client-dashboard">
  {on('overview')&&<div className="client-stats">{[['Active videos',t.active],['Awaiting your approval',t.awaiting],['Ready to post',t.ready],['Completed',t.completed]].map(([label,n])=><div className="stat" key={label as string}><span>{label}</span><strong>{String(n??0).padStart(2,'0')}</strong></div>)}</div>}
  {on('review')&&<ContentReview items={dashboard.content||[]} canDecide={!editable} onSaved={onSaved}/>}
  {on('instagram')&&<InstagramSection brandId={dashboard.brand.id} ig={dashboard.instagram} editable={editable} onSaved={onSaved}/>}
  {on('reports')&&<section className="client-section" id="cp-reports"><h2><FileText size={18}/>Reports</h2>
   {dashboard.reports.length?dashboard.reports.map((r:any)=><details key={r.month} className="client-report"><summary><strong>{fmtMonth(r.month)}</strong><span>{r.count} video{r.count===1?'':'s'} delivered</span></summary><ul>{r.items.map((v:any)=><li key={v.id}><span>{v.title}</span>{v.link?<a href={v.link} target="_blank" rel="noopener noreferrer">View post<ArrowUpRight size={14}/></a>:<em>{v.stage}</em>}</li>)}</ul></details>):<Empty text="No reports yet. Monthly reports appear here once videos are posted."/>}
  </section>}
  {on('shoots')&&<section className="client-section" id="cp-shoots"><h2><CalendarDays size={18}/>Shoots</h2>
   {dashboard.shoots?.length?<ul className="client-list">{dashboard.shoots.map((s:any)=><ShootRow key={s.id} s={s} canMove={!editable} onSaved={onSaved}/>)}</ul>:<Empty text="No shoots scheduled yet. Confirmed shoots will appear here with their date, time and location."/>}
  </section>}
  {on('schedule')&&<section className="client-section" id="cp-schedule"><h2><CalendarDays size={18}/>Schedule</h2>
   {dashboard.schedules.length?<ul className="client-list">{dashboard.schedules.map((s:any)=><li key={s.id}><time>{fmtDay(s.date)}</time><span><strong>{s.kind}</strong> · {s.title}</span><em>{s.stage}</em></li>)}</ul>:<Empty text="Nothing scheduled. Upcoming shoots and deadlines will show here."/>}
  </section>}
  {on('updates')&&<section className="client-section" id="cp-updates"><h2><Bell size={18}/>Updates</h2>
   {dashboard.updates.length?<ul className="client-list">{dashboard.updates.map((u:any)=><li key={u.id}><time>{fmtAt(u.at)}</time><span><strong>{u.action==='shoot'?u.stage:ACTIONS[u.action]||'Video updated'}</strong> · {u.title}</span>{u.stage&&u.action!=='shoot'&&<em>{u.stage}</em>}</li>)}</ul>:<Empty text="No updates yet."/>}
  </section>}
 </div>;
}
// One shoot; the client may move an upcoming confirmed shoot to a new date and time.
function ShootRow({s,canMove,onSaved}:{s:any,canMove:boolean,onSaved?:()=>void}){
 const [open,setOpen]=useState(false),[date,setDate]=useState(s.date||''),[time,setTime]=useState(s.time||''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[ok,setOk]=useState('');
 const start=Date.parse(s.startsAt),soon=s.status==='Confirmed'&&start-Date.now()<172800000&&start>Date.now(),movable=canMove&&s.status==='Confirmed'&&start>Date.now();
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setErr('');try{const r=await fetch('/api/client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'shoot-date',id:s.id,date,time})}),d=await r.json();if(!r.ok)throw Error(d.error);setOpen(false);setOk(`Shoot moved to ${d.when}. The team has been told.`);onSaved?.();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <li className={soon?'shoot-soon':''}><time>{s.when}</time><span><strong>{s.title}</strong>{s.location?` · ${s.location}`:''}{s.details?<><br/><small>{s.details}</small></>:null}</span><em className={'shoot-status shoot-'+s.status.toLowerCase().replace(' ','-')}>{soon?'Coming up · ':''}{s.status}</em>
  {movable&&!open&&<button className="secondary" onClick={()=>{setOpen(true);setOk('');}}>Change date</button>}
  {ok&&<p className="ig-ok shoot-move-msg">{ok}</p>}
  {open&&<form className="shoot-move" onSubmit={save}><label>New date<input type="date" required min={new Date(Date.now()+19800000).toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label><label>New time<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label><button className="primary" disabled={busy}>{busy&&<Loader2 size={14} className="spin"/>}Save new date</button><button type="button" className="secondary" onClick={()=>{setOpen(false);setErr('');}}>Cancel</button>{err&&<p className="form-error" role="alert">{err}</p>}</form>}
 </li>;
}
// Full-page portal shown when a client account signs in.
export function ClientPortal({initial,onSignedOut}:{initial:any,onSignedOut:()=>void}){
 const [busy,setBusy]=useState(false),[state,setState]=useState(initial);const {viewer,dashboard}=state;
 const reload=async()=>{const r=await fetch('/api/client',{cache:'no-store'});if(r.ok)setState(await r.json());};
 async function signOut(){setBusy(true);try{await fetch('/api/auth',{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'});}finally{onSignedOut();}}
 const awaiting=dashboard.totals?.awaiting||0,hour=new Date().getHours(),greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 const PAGES:[string,string,any][]=[['overview','Overview',LayoutDashboard],['review','Content review',Clapperboard],['shoots','Shoots',Camera],['schedule','Schedule',CalendarDays],['instagram','Instagram',BarChart3],['reports','Reports',FileText],['updates','Updates',Bell]];
 const [page,setPage]=useState('overview'),[menu,setMenu]=useState(false);
 // Same saved theme as the staff workspace (layout.tsx reads it before paint).
 const [dark,setDark]=useState(false);useEffect(()=>setDark(document.documentElement.dataset.theme==='dark'),[]);
 const toggleTheme=()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('nova-frames-theme',next?'dark':'light');}catch{}};
 // Each section is its own page, kept in the URL hash so Back and refresh work.
 useEffect(()=>{const read=()=>{const h=location.hash.slice(1);setPage(PAGES.some(p=>p[0]===h)?h:'overview');setMenu(false);};read();addEventListener('hashchange',read);return ()=>removeEventListener('hashchange',read);},[]);
 useEffect(()=>{if(!menu)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};addEventListener('keydown',k);return ()=>removeEventListener('keydown',k);},[menu]);
 const go=(id:string)=>{if(location.hash.slice(1)===id)setMenu(false);else location.hash=id;scrollTo({top:0});};const title=PAGES.find(p=>p[0]===page)![1];
 return <div className={'client-shell cp-layout'+(menu?' menu-open':'')}>
  <aside className="cp-side" aria-label="Client menu">
   <span className="brand"><span className="brandmark"><img src="/logo.svg" alt="" width={36} height={36}/></span><span>NOVA FRAMES<small>CLIENT DASHBOARD</small></span></span>
   <p className="cp-side-brand">{dashboard.brand.name}</p>
   <nav>{PAGES.map(([id,label,Icon])=><button key={id} className={'cp-nav'+(page===id?' on':'')} aria-current={page===id?'page':undefined} onClick={()=>go(id)}><Icon size={17}/><span>{label}</span>{id==='review'&&awaiting>0&&<b className="cp-badge">{awaiting}</b>}</button>)}</nav>
   <div className="account cp-account"><span className="avatar" aria-hidden="true">{String(viewer.name).split(' ').filter(Boolean).map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}</span><div><strong>{viewer.name}</strong><small>Client · {dashboard.brand.name}</small></div><button className="iconbutton" aria-label="Sign out" onClick={signOut} disabled={busy}>{busy?<Loader2 size={16} className="spin"/>:<LogOut size={16}/>}</button></div>
  </aside>
  <div className="cp-scrim" aria-hidden="true" onClick={()=>setMenu(false)}/>
  <div className="cp-body">
   <header className="client-top cp-top"><button className="cp-menu-btn" aria-label="Open menu" aria-expanded={menu} onClick={()=>setMenu(true)}><Menu size={20}/></button><strong>{title}</strong><button className="cp-theme-top" aria-label={dark?'Switch to light mode':'Switch to dark mode'} onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><span className="cp-top-name">{viewer.name}</span></header>
   <main className="client-main">
    {page==='overview'&&<><section className="client-hero"><div><p className="eyebrow">{dashboard.brand.name.toUpperCase()}</p><h1>{greet}, {viewer.name}.</h1><p className="client-lead">Your videos, shoots and results from Nova Frames, all in one place.</p></div>
     {awaiting>0?<button className="client-hero-cta" onClick={()=>go('review')}><strong>{awaiting}</strong><span>video{awaiting===1?'':'s'} waiting for your approval</span><ArrowUpRight size={16}/></button>:<div className="client-hero-cta calm"><strong>✓</strong><span>You're all caught up</span></div>}
    </section>
    <div className="cp-quick">{PAGES.slice(1).map(([id,label,Icon])=><button key={id} className="cp-quick-card" onClick={()=>go(id)}><Icon size={20}/><span>{label}</span><ArrowUpRight size={15}/></button>)}</div></>}
    <ClientDashboard dashboard={dashboard} onSaved={reload} page={page}/>
   </main>
  </div>
 </div>;
}
// Admin and manager page: pick any brand's dashboard; admins also manage client logins.
export function ClientsPanel(){
 const [data,setData]=useState<any>(null),[brand,setBrand]=useState(''),[error,setError]=useState(''),[form,setForm]=useState<any>({name:'',email:'',brandId:'',password:''}),[saving,setSaving]=useState(false);
 const load=useCallback(async(b:string)=>{try{const r=await fetch('/api/client'+(b?'?brand='+encodeURIComponent(b):''),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{load(brand);},[brand,load]);
 async function post(body:any){setSaving(true);setError('');try{const r=await fetch('/api/client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);await load(brand);return true;}catch(e){setError((e as Error).message);return false;}finally{setSaving(false);}}
 async function save(e:React.FormEvent){e.preventDefault();if(await post({type:'client',client:form}))setForm({name:'',email:'',brandId:'',password:''});}
 if(!data)return <section className="report-panel">{error?<p className="form-error" role="alert">{error}</p>:<Loader2 className="spin"/>}</section>;
 const brandName=(id:string)=>data.brands.find((b:any)=>b.id===id)?.name||'Removed brand';
 return <section className="report-panel client-admin">
  <label className="client-picker">Client dashboard<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">Choose a brand…</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {data.dashboard?<ClientDashboard dashboard={data.dashboard} editable onSaved={()=>load(brand)}/>:<Empty text={data.brands.length?'Choose a brand to see the dashboard its client sees.':'No brands yet. Add a brand first.'}/>}
  {data.viewer.admin&&<><h2 className="client-admin-title">Client logins</h2>
   {data.accounts.length?<ul className="client-list">{data.accounts.map((a:any)=><li key={a.id}><span><strong>{a.name}</strong> · {a.email}</span><em>{brandName(a.brandId)}</em><button className="secondary" disabled={saving} onClick={()=>setForm({id:a.id,name:a.name,email:a.email,brandId:a.brandId,password:''})}>Edit</button><button className="secondary" disabled={saving} onClick={()=>post({type:'client-toggle',id:a.id,active:!a.active})}>{a.active?'Turn off':'Turn on'}</button></li>)}</ul>:<Empty text="No client logins yet."/>}
   <form className="request-form client-form" onSubmit={save}><strong><UserPlus size={16}/>{form.id?'Edit client login':'Add client login'}</strong>
    <label>Name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>Brand<select required value={form.brandId} onChange={e=>setForm({...form,brandId:e.target.value})}><option value="">Choose…</option>{data.brands.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label>{form.id?'New password (optional)':'Password'}<input type="password" autoComplete="new-password" required={!form.id} minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <div className="client-form-actions"><button className="primary" disabled={saving}>{saving?<Loader2 size={15} className="spin"/>:null}{form.id?'Save changes':'Create login'}</button>{form.id&&<button type="button" className="secondary" onClick={()=>setForm({name:'',email:'',brandId:'',password:''})}>Cancel</button>}</div>
   </form></>}
 </section>;
}
const num=(v:number|null|undefined)=>v===null||v===undefined?'—':v.toLocaleString('en-IN');
const signed=(v:number|null)=>v===null?'—':(v>0?'+':'')+v.toLocaleString('en-IN');
// Follower line from stored snapshots (Meta gives no past follower counts) or staff-entered months.
function GrowthGraph({ig}:{ig:any}){
 const snap=(ig.snapshots||[]).map((p:any)=>({key:p.date,label:fmtDay(p.date).replace(/ \d{4}$/,''),title:fmtDay(p.date),followers:p.followers}));
 const pts=snap.length>=2?snap:ig.months.filter((m:any)=>m.followers!==null).map((m:any)=>({key:m.month,label:fmtMonth(m.month).slice(0,3),title:fmtMonth(m.month),followers:m.followers}));
 if(pts.length<2)return <Empty text={ig.connection?.connected?'Growth history starts from the first sync. Meta does not provide past follower counts, so the graph appears after follower snapshots from two different days are saved.':'The account growth graph appears once follower counts exist for two or more points in time.'}/>;
 const W=640,H=180,P=28,vals=pts.map((p:any)=>p.followers),min=Math.min(...vals),max=Math.max(...vals),span=max-min||1,every=Math.ceil(pts.length/8);
 const xy=pts.map((p:any,i:number)=>[P+i*(W-2*P)/(pts.length-1),H-P-(p.followers-min)/span*(H-2*P)]);
 return <svg className="ig-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Followers from ${num(vals[0])} to ${num(vals[vals.length-1])}`}>
  <line x1={P} y1={H-P} x2={W-P} y2={H-P} className="ig-axis"/>
  <polyline points={xy.map((p:number[])=>p.join(',')).join(' ')} className="ig-line"/>
  {xy.map(([x,y]:number[],i:number)=><g key={pts[i].key}><circle cx={x} cy={y} r={4} className="ig-dot"><title>{pts[i].title}: {num(pts[i].followers)} followers</title></circle>{i%every===0&&<text x={x} y={H-8} textAnchor="middle" className="ig-label">{pts[i].label}</text>}</g>)}
 </svg>;
}
function Connection({brandId,c,onSaved}:{brandId:string,c:any,onSaved?:()=>void}){
 const [busy,setBusy]=useState(''),[err,setErr]=useState(''),[flash]=useState(()=>{if(typeof window==='undefined')return '';const q=new URLSearchParams(window.location.search);return q.get('instagram')==='connected'?'Instagram connected.':q.get('instagram')==='error'?(q.get('message')||'Instagram connection failed.'):'';});
 async function act(type:string){if(type==='disconnect'&&!confirm('Disconnect this Instagram account? Saved history stays.'))return;setBusy(type);setErr('');try{const r=await fetch('/api/instagram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,brandId})});const d=await r.json();if(!r.ok)throw Error(d.error);onSaved?.();}catch(e){setErr((e as Error).message);onSaved?.();}finally{setBusy('');}}
 const expiresSoon=c?.connected&&c.tokenExpires-Date.now()<7*86400000;
 return <div className="ig-connection">
  <div><strong>{c?.connected?`Connected · @${c.username}`:'Instagram not connected'}</strong>
   <span>{c?.connected?(c.lastSyncAt?`Last synced ${fmtAt(c.lastSyncAt)}`:'Not synced yet'):'Connect a Business or Creator account to load reach, views, engagement and post insights from Meta.'}</span>
   {expiresSoon&&<span className="form-error">Connection expires {fmtAt(new Date(c.tokenExpires).toISOString())}. Sync or reconnect to keep it active.</span>}
   {c?.lastError&&<span className="form-error">Last sync failed: {c.lastError}</span>}
   {flash&&<span className={flash==='Instagram connected.'?'ig-ok':'form-error'}>{flash}</span>}
   {err&&<span className="form-error" role="alert">{err}</span>}</div>
  <div className="ig-actions">{c?.connected?<><button className="primary" disabled={!!busy} onClick={()=>act('sync')}>{busy==='sync'&&<Loader2 size={15} className="spin"/>}Sync now</button><a className="secondary" href={'/api/instagram?brand='+encodeURIComponent(brandId)}>Reconnect</a><button className="secondary" disabled={!!busy} onClick={()=>act('disconnect')}>Disconnect</button></>:<a className="primary" href={'/api/instagram?brand='+encodeURIComponent(brandId)}>Connect Instagram</a>}</div>
  {c?.notes?.length>0&&<ul className="ig-notes">{c.notes.map((n:string,i:number)=><li key={i}>{n}</li>)}</ul>}
 </div>;
}
function MetricsForm({brandId,jobId,fields,month,onSaved,label}:{brandId:string,jobId?:string,fields:string[],month:string,onSaved?:()=>void,label:string}){
 const [m,setM]=useState(month),[v,setV]=useState<any>({}),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setErr('');try{const r=await fetch('/api/client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'instagram-metrics',brandId,jobId:jobId||'',month:m,metrics:v})});const d=await r.json();if(!r.ok)throw Error(d.error);setV({});onSaved?.();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <form className="ig-form" onSubmit={save}><strong>{label}</strong>{!jobId&&<label>Month<input type="month" required value={m} onChange={e=>setM(e.target.value)}/></label>}{fields.map(f=><label key={f}>{f[0].toUpperCase()+f.slice(1)}<input inputMode="numeric" pattern="[0-9]*" value={v[f]??''} onChange={e=>setV({...v,[f]:e.target.value})}/></label>)}<button className="primary" disabled={busy}>{busy&&<Loader2 size={15} className="spin"/>}Save</button>{err&&<p className="form-error" role="alert">{err}</p>}</form>;
}
function InstagramSection({brandId,ig,editable,onSaved}:{brandId:string,ig:any,editable:boolean,onSaved?:()=>void}){
 if(!ig)return null;const c=ig.current;
 return <section className="client-section" id="cp-instagram"><h2><BarChart3 size={18}/>Instagram performance · {fmtMonth(ig.month)}</h2>
  <Connection brandId={brandId} c={ig.connection} onSaved={onSaved}/>
  <div className="client-stats">{[['Reels posted this month',ig.postedThisMonth,false],['Total posts on account',ig.totalPosts??null,false],['Growth since tracking began',ig.overallGrowth??null,true],['Follower growth',c?.growth??null,true],['Reach',c?.reach??null,false],['Views',c?.views??null,false],['Engagement',c?.engagement??null,false],['Engagement rate',c?.engagementRate??null,'%']].map(([label,val,kind])=><div className="stat" key={label as string}><span>{label}</span><strong>{val===null?'—':kind===true?signed(val as number):kind==='%'?val+'%':num(val as number)}</strong></div>)}</div>
  {!c&&<p className="client-empty">{ig.connection?.connected?'No account insights for this month yet. Sync to load them; Meta can delay data by up to 48 hours.':'No Instagram numbers for this month yet.'}</p>}
  {c?.partial&&<p className="ig-note">This month is still in progress, so its totals cover the days so far. Follower growth compares saved snapshots; Meta does not supply past follower counts.</p>}
  <h3 className="ig-sub"><TrendingUp size={16}/>Account growth</h3><GrowthGraph ig={ig}/>{ig.trackingSince&&<p className="ig-note">Follower history starts from the first successful sync on {fmtDay(ig.trackingSince)}. Meta does not provide follower counts from before then.</p>}
  <h3 className="ig-sub">Monthly performance report</h3>
  {ig.months.length?<div className="ig-table-wrap"><table className="ig-table"><thead><tr><th>Month</th><th>Followers</th><th>Growth</th>{ig.source==='meta'&&<th>Videos</th>}<th>Reach</th><th>Views</th><th>Engagement</th><th>Rate</th></tr></thead><tbody>{[...ig.months].reverse().map((m:any)=><tr key={m.month}><td>{fmtMonth(m.month)}</td><td>{num(m.followers)}</td><td>{signed(m.growth)}</td>{ig.source==='meta'&&<td>{num(ig.videosByMonth?.[m.month]??null)}</td>}<td>{num(m.reach)}</td><td>{num(m.views)}</td><td>{num(m.engagement)}</td><td>{m.engagementRate===null?'—':m.engagementRate+'%'}</td></tr>)}</tbody></table></div>:<Empty text="No monthly Instagram reports yet."/>}
  <h3 className="ig-sub">Best-performing videos <span className="muted">· sorted by views</span></h3>
  {ig.content.length?<div className="ig-table-wrap"><table className="ig-table"><thead><tr><th>Video</th><th>Views</th><th>Reach</th><th>Likes</th><th>Comments</th><th>Saves</th><th>Shares</th><th>Rate</th>{editable&&ig.source!=='meta'&&<th/>}</tr></thead><tbody>{ig.content.map((p:any)=><tr key={p.id}><td><a href={p.link} target="_blank" rel="noopener noreferrer">{p.title}</a></td><td>{num(p.views)}</td><td>{num(p.reach)}</td><td>{num(p.likes)}</td><td>{num(p.comments)}</td><td>{num(p.saves)}</td><td>{num(p.shares)}</td><td>{p.engagementRate===null?'—':p.engagementRate+'%'}</td>{editable&&p.source!=='meta'&&<td><details><summary>Enter</summary><MetricsForm brandId={brandId} jobId={p.id} month={p.month||ig.month} fields={['views','reach','likes','comments','saves','shares']} label="Post numbers" onSaved={onSaved}/></details></td>}</tr>)}</tbody></table></div>:<Empty text={ig.connection?.connected?'No recent posts synced yet. Insights cover posts from the last 90 days (albums are not supported by Meta).':'No posted reels with an Instagram link yet.'}/>}
  {editable&&!ig.connection?.connected&&<details className="ig-entry"><summary>Enter monthly account numbers</summary><MetricsForm brandId={brandId} month={ig.month} fields={['followers','reach','views','engagement']} label="Account totals for the month" onSaved={onSaved}/></details>}
 </section>;
}
// Client review: open the edited video (Google Drive link), approve it, or return it to edit with the correction needed. Staff see the same list read-only.
const REVIEW_CLASS:Record<string,string>={'Awaiting approval':'inv-pending',Rejected:'inv-overdue',Editing:'inv-void',Approved:'inv-paid',Completed:'shoot-confirmed'};
function ContentReview({items,canDecide,onSaved}:{items:any[],canDecide:boolean,onSaved?:()=>void}){
 const [rejecting,setRejecting]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(''),[err,setErr]=useState(''),[done,setDone]=useState('');
 async function decide(item:any,decision:string){setBusy(item.id+decision);setErr('');try{const r=await fetch('/api/client',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'content-review',jobId:item.id,decision,feedback:decision==='Rejected'?feedback:'',version:item.version})}),d=await r.json();if(!r.ok)throw Error(d.error);setRejecting('');setFeedback('');setDone(decision==='Approved'?`Approved “${item.title}”. Thank you!`:`Correction sent for “${item.title}”. The team will share a corrected version.`);onSaved?.();}catch(e){setErr((e as Error).message);}finally{setBusy('');}}
 const waiting=items.filter(i=>i.status==='Awaiting approval').length;
 return <section className="client-section cp-review" id="cp-review"><h2><FileText size={18}/>Content review{waiting>0&&<span className="count">{waiting} waiting</span>}</h2>
  {done&&<p className="ig-ok">{done}</p>}{err&&<p className="form-error" role="alert">{err}</p>}
  {items.length?<ul className="client-list">{items.map(i=><li key={i.id} className={i.status==='Awaiting approval'?'shoot-soon':''}>
   <span><strong>{i.title}</strong>{i.revision>0&&<small> · version {i.revision+1}</small>}{i.feedback&&<><br/><small>Your correction: {i.feedback}</small></>}</span>
   <em className={'shoot-status '+REVIEW_CLASS[i.status]}>{i.status==='Rejected'?'Returned to edit · being corrected':i.status}</em>
   {i.reviewLink&&<a className="secondary review-open" href={i.reviewLink} target="_blank" rel="noopener noreferrer">Open video<ArrowUpRight size={14}/></a>}
   {i.postLink&&<a href={i.postLink} target="_blank" rel="noopener noreferrer">View post<ArrowUpRight size={14}/></a>}
   {canDecide&&i.status==='Awaiting approval'&&<div className="shoot-actions review-actions">
    <button className="primary" disabled={!!busy} onClick={()=>decide(i,'Approved')}>{busy===i.id+'Approved'&&<Loader2 size={14} className="spin"/>}Approve</button>
    <button className="secondary" disabled={!!busy} onClick={()=>{setRejecting(rejecting===i.id?'':i.id);setFeedback('');}}>Return to edit</button>
    {rejecting===i.id&&<form className="review-feedback" onSubmit={e=>{e.preventDefault();decide(i,'Rejected');}}><label>What is the correction?<textarea required rows={3} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="e.g. Use the brighter shot at 0:12, shorten the intro" autoFocus/></label><button className="primary" disabled={!!busy||!feedback.trim()}>{busy===i.id+'Rejected'&&<Loader2 size={14} className="spin"/>}Send correction</button><button type="button" className="secondary" onClick={()=>{setRejecting('');setFeedback('');}}>Cancel</button></form>}
   </div>}
  </li>)}</ul>:<Empty text="Nothing to review yet. Edited videos appear here when they are ready for your approval."/>}
 </section>;
}
