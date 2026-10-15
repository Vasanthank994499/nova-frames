import {sql} from 'drizzle-orm';
import {getDb} from '../db';
import {productionDate} from './production-batches';
let ready:Promise<unknown>|undefined;
export function ensureRequestStorage(){return ready??=getDb().execute(sql`CREATE TABLE IF NOT EXISTS staff_requests (id text PRIMARY KEY, worker_id text NOT NULL, status text NOT NULL, payload text NOT NULL, updated text NOT NULL)`).catch(error=>{ready=undefined;throw error;});}
export function requestDates(from:unknown,to:unknown){const start=productionDate(from),end=productionDate(to||from);if(end<start)throw Error('The end date must be on or after the start date.');const days=(Date.parse(end)-Date.parse(start))/86400000+1;if(days>366)throw Error('Request up to 366 days at a time.');return Array.from({length:days},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));}
export function mayReviewRequest(user:{id:string,admin:boolean,roles:string[]},request:{workerId:string,requestedByManager:boolean},currentRoles:string[]=[]){return user.id!==request.workerId&&(user.admin||(user.roles.includes('manager')&&!request.requestedByManager&&!currentRoles.includes('manager')));}
