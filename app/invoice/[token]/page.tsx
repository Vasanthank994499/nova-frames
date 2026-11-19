import {getDb} from '../../../db';
import {sql} from 'drizzle-orm';
import {shareHash} from '../../../lib/whatsapp';
import {withStatus,rupees,ensureInvoiceStorage} from '../../../lib/invoices';
export const dynamic='force-dynamic';
export const metadata={title:'Invoice · Nova Frames',robots:{index:false,follow:false}};
const fmt=(d:string)=>new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
// Secure invoice link sent to the client: only the holder of the random token can open it; drafts and void invoices are not shown.
export default async function InvoicePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;await ensureInvoiceStorage();
 const row=/^[A-Za-z0-9_-]{20,64}$/.test(token)?((await getDb().execute(sql`SELECT i.payload,b.name FROM invoices i LEFT JOIN brands b ON b.id=i.brand_id WHERE i.payload::jsonb->>'shareHash'=${shareHash(token)}`)) as any).rows[0]:null;
 const inv=row?withStatus(JSON.parse(row.payload)):null;
 if(!inv||inv.status==='Draft'||inv.status==='Void')return <main className="client-main"><h1>Invoice not available</h1><p className="client-lead">This link is not valid. Please contact Nova Frames.</p></main>;
 return <main className="client-main invoice-public">
  <p className="eyebrow">NOVA FRAMES · INVOICE</p><h1>{inv.number}</h1><p className="client-lead">For {String(row.name||'')}{inv.description?` · ${inv.description}`:''}</p>
  <div className="client-stats">{[['Amount',rupees(inv.totalPaise)],['Paid',rupees(inv.paidPaise)],['Balance due',rupees(inv.balancePaise)],['Status',inv.status]].map(([l,v])=><div className="stat" key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>
  <section className="client-section"><ul className="client-list"><li><span>Invoice date</span><em>{fmt(inv.issueDate)}</em></li>{inv.period&&<li><span>Billing month</span><em>{new Date(inv.period+'-01T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</em></li>}<li><span>Due date</span><em>{fmt(inv.dueDate)}</em></li></ul>
  {inv.notes&&<p className="shoot-details">{inv.notes}</p>}
  {process.env.INVOICE_PAYMENT_DETAILS&&inv.status!=='Paid'&&<><h2>How to pay</h2><p className="shoot-details">{process.env.INVOICE_PAYMENT_DETAILS}</p></>}</section>
 </main>;
}
