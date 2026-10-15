import {sql} from 'drizzle-orm';
import {getDb} from '../db';
let ready:Promise<unknown>|undefined;
export function ensureExpenseStorage(){return ready??=getDb().execute(sql`CREATE TABLE IF NOT EXISTS expenses(id text PRIMARY KEY,worker_id text NOT NULL,manager_id text NOT NULL,day text NOT NULL,amount_cents bigint NOT NULL,payload text NOT NULL,updated text NOT NULL)`).catch(error=>{ready=undefined;throw error;});}
export function expenseCents(value:unknown){const text=String(value??'').trim();if(!/^\d{1,9}(\.\d{1,2})?$/.test(text))throw Error('Enter a positive expense amount with up to two decimal places.');const [whole,fraction='']=text.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(cents<=0)throw Error('Expense amount must be greater than zero.');return cents;}
export const money=(cents:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(cents/100);
