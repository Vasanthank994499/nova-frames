import {sql} from 'drizzle-orm';
import {getDb} from '../db';
// One PostgreSQL statement saves the parent, all editing tasks, and audit rows atomically.
// Child inserts depend on the parent write, so a stale/retried submission cannot duplicate tasks.
export async function saveShootBatch(videos:any[],events:any[],previousVersion?:string){
 const records=videos.map(j=>({id:j.id,assignee:j.editorAssignee||'',payload:JSON.stringify(j),updated:crypto.randomUUID()})),first=records[0];
 const root=previousVersion!==undefined?sql`UPDATE jobs SET assignee=${first.assignee},payload=${first.payload},updated=${first.updated} WHERE id=${first.id} AND updated=${previousVersion} RETURNING id`:sql`INSERT INTO jobs(id,assignee,payload,updated) VALUES(${first.id},${first.assignee},${first.payload},${first.updated}) ON CONFLICT(id) DO NOTHING RETURNING id`;
 const audit=events.map(e=>({id:e.id,at:e.at,actor_id:e.actorId,job_id:e.jobId,payload:JSON.stringify(e)}));
 const result=await getDb().execute(sql`WITH saved AS (${root}), children AS (INSERT INTO jobs(id,assignee,payload,updated) SELECT item.id,item.assignee,item.payload,item.updated FROM jsonb_to_recordset(${JSON.stringify(records.slice(1))}::jsonb) AS item(id text,assignee text,payload text,updated text) WHERE EXISTS(SELECT 1 FROM saved) RETURNING id), audit AS (INSERT INTO work_events(id,at,actor_id,job_id,payload) SELECT item.id,item.at,item.actor_id,item.job_id,item.payload FROM jsonb_to_recordset(${JSON.stringify(audit)}::jsonb) AS item(id text,at text,actor_id text,job_id text,payload text) WHERE EXISTS(SELECT 1 FROM saved) RETURNING id) SELECT COUNT(*) AS saved FROM saved`);
 if(Number(result.rows[0]?.saved)!==1)throw Error('This shoot was already submitted or changed. Refresh to see the saved editing tasks.');
}
