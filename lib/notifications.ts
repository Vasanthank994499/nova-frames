import {getDb} from '../db';
import {jobs,workers,brands,workEvents,extraTasks,staffRequests,notificationReads} from '../db/schema';
import {ensureRequestStorage,mayReviewRequest} from './staff-requests';
import {workerRoles} from './auth';
import {notificationItems} from './notification-items';
import {sql,eq} from 'drizzle-orm';
let ready:Promise<void>|undefined;
export function ensureNotificationStorage(){if(!ready)ready=getDb().execute(sql`CREATE TABLE IF NOT EXISTS notification_reads(id text PRIMARY KEY,account_id text NOT NULL,item_id text NOT NULL,read_at bigint NOT NULL)`).then(()=>{}).catch(error=>{ready=undefined;throw error;});return ready;}
export async function notificationsFor(user:{id:string,admin:boolean,roles:string[]}){
 await Promise.all([ensureNotificationStorage(),ensureRequestStorage()]);const db=getDb();
 const [jobRows,people,brandRows,events,extras,requests,reads]=await Promise.all([db.select().from(jobs),db.select().from(workers),db.select().from(brands),db.select().from(workEvents),db.select().from(extraTasks).where(eq(extraTasks.workerId,user.id)),db.select().from(staffRequests),db.select().from(notificationReads).where(eq(notificationReads.accountId,user.id))]);
 const hiddenBrands=new Set(brandRows.filter(b=>JSON.parse(b.payload).active===false).map(b=>b.id)),hiddenWorkers=new Set(people.filter(w=>!w.active||w.removed).map(w=>w.id)),readIds=new Set(reads.map(r=>r.itemId));
 const items=notificationItems(user,{jobs:jobRows.map(j=>JSON.parse(j.payload)),events:events.map(e=>JSON.parse(e.payload)),extraTasks:extras.map(e=>JSON.parse(e.payload)),requests:requests.map(r=>{const value=JSON.parse(r.payload);return {...value,canReview:mayReviewRequest(user,value,workerRoles(people.find(w=>w.id===value.workerId)||{}))};}),hiddenBrands,hiddenWorkers}).map(item=>({...item,read:readIds.has(item.id)}));
 // Keep unread items first. A read call names the exact items opened, so newer alerts stay unread.
 return items.sort((a,b)=>Number(a.read)-Number(b.read)||b.at.localeCompare(a.at)).slice(0,100);
}
