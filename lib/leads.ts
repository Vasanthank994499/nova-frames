import {getDb} from '../db';
import {sql} from 'drizzle-orm';
export const LEAD_STATUSES=['New','Qualified','In progress','Closed'] as const;
export const LEAD_SOURCES=['Instagram','Website','Referral','Walk-in','Phone call','WhatsApp','Meta Lead Ads','Other'] as const;
let ready:Promise<void>|undefined;
export function ensureLeadStorage(){if(!ready)ready=getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY, status text NOT NULL, payload text NOT NULL, updated text NOT NULL)`)).then(()=>{}).catch((e:unknown)=>{ready=undefined;throw e;});return ready;}
export const mayManageLeads=(u:{admin:boolean,roles:string[]})=>u.admin||u.roles.includes('manager');
