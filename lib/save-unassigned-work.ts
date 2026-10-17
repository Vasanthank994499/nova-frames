import {sql} from 'drizzle-orm';
import {getDb} from '../db';

// Insert the task and its report events together; retries cannot duplicate either.
export async function saveUnassignedWork(kind:'content'|'extra',record:any,events:any[]){
 const table=sql.raw(kind==='content'?'jobs':'extra_tasks'),ownerColumn=sql.raw(kind==='content'?'assignee':'worker_id'),owner=kind==='content'?'':record.workerId;
 const rows=events.map(e=>({id:e.id,at:e.at,actor_id:e.actorId,job_id:e.jobId,payload:JSON.stringify(e)}));
 const result=await getDb().execute(sql`WITH saved AS (INSERT INTO ${table}(id,${ownerColumn},payload,updated) VALUES(${record.id},${owner},${JSON.stringify(record)},${crypto.randomUUID()}) ON CONFLICT(id) DO NOTHING RETURNING id), audit AS (INSERT INTO work_events(id,at,actor_id,job_id,payload) SELECT id,at,actor_id,job_id,payload FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(id text,at text,actor_id text,job_id text,payload text) WHERE EXISTS(SELECT 1 FROM saved) RETURNING id) SELECT COUNT(*) AS saved FROM saved`);
 if(Number(result.rows[0]?.saved)!==1)throw Error('This task was already submitted. Refresh your workspace to view it.');
}
