import {getDb} from '../db';
import {sql} from 'drizzle-orm';
import {assignmentIds} from './shoot-assignments';
const rows=(r:any)=>(r?.rows||[]) as any[];
// Client-facing status for a video, from the existing job stages (Editing → Client approval → Ready to post → Posted/Completed).
export function reviewStatus(j:any){
 if(j.stage==='Client approval')return 'Awaiting approval';
 if(j.stage==='Editing')return j.approval==='Changes requested'?'Rejected':'Editing';
 if(j.stage==='Ready to post')return 'Approved';
 if(['Posted','Completed'].includes(j.stage))return 'Posted';
 return '';
}
// Only what the client needs: never assignees, internal notes or other brands.
export function clientContent(rowsIn:{payload:string,updated:string}[]){
 return rowsIn.map(r=>({j:JSON.parse(r.payload),version:String(r.updated)})).map(({j,version})=>({j,version,status:reviewStatus(j)})).filter(x=>x.status)
  .map(({j,version,status})=>({id:j.id,title:j.title||'Untitled video',status,version:status==='Awaiting approval'?version:'',reviewLink:status==='Awaiting approval'?j.editLink||'':'',postLink:status==='Posted'?j.instagramLink||'':'',feedback:status==='Rejected'?j.reviewNotes||'':'',revision:j.revisionCount||0,due:j.due||''}))
  .sort((a,b)=>['Awaiting approval','Rejected','Editing','Approved','Posted'].indexOf(a.status)-['Awaiting approval','Rejected','Editing','Approved','Posted'].indexOf(b.status));
}
// The client decides on their own video: same transition and event as the staff review, scoped to the client's brand in SQL.
export async function clientReview(client:{id:string,name:string,email:string,brandId:string},jobId:string,decision:string,feedback:string,version:string){
 if(!['Approved','Rejected'].includes(decision))throw Error('Choose approve or reject.');
 const notes=feedback.trim().slice(0,2000);if(decision==='Rejected'&&!notes)throw Error('Tell the team what to change.');
 const db=getDb(),row=rows(await db.execute(sql`SELECT payload,updated FROM jobs WHERE id=${jobId} AND payload::jsonb->>'brandId'=${client.brandId}`))[0];
 if(!row)throw Error('Video not found.');const prev=JSON.parse(row.payload);
 if(prev.stage!=='Client approval')throw Error('This video is no longer waiting for your approval.');
 if(!prev.editLink)throw Error('There is nothing to review yet.');
 const at=new Date().toISOString(),j={...prev,reviewNotes:notes,approval:decision==='Approved'?'Approved':'Changes requested',reviewedBy:'client',reviewedAt:at};
 let detail;if(decision==='Approved'){j.stage='Ready to post';detail='Client approved in the client dashboard · Ready to post';}
 else{j.stage='Editing';j.editingCompleted=false;j.instagramLink='';j.revisionCount=(j.revisionCount||0)+1;detail='Client rejected in the client dashboard · Returned to the same editor';}
 j.history=[...(prev.history||[]),{at,by:client.email,actorId:'client:'+client.id,actorName:client.name+' (client)',detail:detail+(notes?` · “${notes.slice(0,300)}”`:'')}];
 const newVersion=crypto.randomUUID();
 const saved=rows(await db.execute(sql`UPDATE jobs SET payload=${JSON.stringify(j)},updated=${newVersion} WHERE id=${jobId} AND updated=${version||row.updated} RETURNING id`));
 if(!saved.length)throw Error('This video changed. Refresh and try again.');
 // Same event shape as staff reviews so the editor's "returned for re-edit" alert and the activity log keep working.
 const event={id:crypto.randomUUID(),at,actorId:'client:'+client.id,actorName:client.name+' (client)',actorEmail:client.email,actorRole:'client',assignedId:j.editorAssignee||'',assignedName:'',jobId:j.id,title:j.title,brandId:j.brandId,brandName:j.brandName,branchId:j.branchId||'',branchName:j.branchName||'Unassigned',action:'review',stage:j.stage,revisionCount:j.revisionCount||0,contentCount:j.contentCount||1,contentDate:j.contentDate||'',snapshot:{stage:j.stage,contentLink:j.contentLink,shootLink:j.shootLink,editLink:j.editLink,instagramLink:j.instagramLink,contentAssignee:j.contentAssignee,cameraAssignee:j.cameraAssignee,cameraAssignees:assignmentIds(j,'camera'),editorAssignee:j.editorAssignee,publisherAssignee:j.publisherAssignee},link:j.editLink};
 await db.execute(sql`INSERT INTO work_events (id,at,actor_id,job_id,payload) VALUES (${event.id},${event.at},${event.actorId},${j.id},${JSON.stringify(event)})`);
 return {status:decision==='Approved'?'Approved':'Rejected'};
}
