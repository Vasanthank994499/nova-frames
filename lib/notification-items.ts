import {workAvailable} from './allocation-dates';
import {allocationRoleForStage} from './project-stages';
import {assignmentIds,assignedTo} from './shoot-assignments';
const assignments:Record<string,string>={content:'contentAssignee',camera:'cameraAssignee',editor:'editorAssignee',publisher:'publisherAssignee'};
const pages:Record<string,string>={content:'Content',camera:'Shoots',editor:'Editing',publisher:'Ready to post'};
const roleNames:Record<string,string>={content:'Content creation',camera:'Shoot',editor:'Video editing',publisher:'Posting'};
export type NotificationItem={id:string,title:string,body:string,at:string,page:string,jobId?:string,read?:boolean};
// Items are derived from saved assignments and requests. Read receipts are per account.
export function notificationItems(user:{id:string,admin:boolean,roles:string[]},data:{jobs:any[],events:any[],extraTasks:any[],requests:any[],hiddenBrands:Set<string>,hiddenWorkers:Set<string>}):NotificationItem[]{
 const items:NotificationItem[]=[],latestAssignments=new Map<string,Record<string,any>>(),latestStages=new Map<string,string>();
 const sorted=data.events.slice().sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const assignmentEvents=new Map<string,any>();
 for(const event of sorted){const snapshot=event.snapshot;if(!snapshot)continue;const previous=latestAssignments.get(event.jobId)||{},previousStage=latestStages.get(event.jobId);
  for(const role of Object.keys(assignments))for(const recipient of assignmentIds(snapshot,role))if(!assignedTo(previous,role,recipient)||(previousStage!==event.stage&&allocationRoleForStage(event.stage)===role)){assignmentEvents.set(event.jobId+':'+role+':'+recipient,{...event,recipient});}
  latestAssignments.set(event.jobId,snapshot);latestStages.set(event.jobId,event.stage);
 }
 for(const job of data.jobs){if(!workAvailable(job)||data.hiddenBrands.has(job.brandId))continue;const role=allocationRoleForStage(job.stage);if(!role||['Client approval','Posted'].includes(job.stage))continue;const assignee=user.id;if(!assignedTo(job,role,user.id)||(role!=='publisher'&&!user.roles.includes(role)))continue;
  const event=assignmentEvents.get(job.id+':'+role+':'+user.id),source=event?.recipient===user.id?event:null;
  items.push({id:`work:${job.id}:${role}:${source?.id||assignee}`,title:source?.action==='review'?'Video returned for re-edit':'Work assigned to you',body:`${roleNames[role]} · ${job.title} · ${job.brandName||'Brand'}`,at:source?.at||job.created,page:pages[role],jobId:job.id});
 }
 for(const task of data.extraTasks){if(!workAvailable(task)||task.workerId!==user.id||task.status==='Completed'||data.hiddenBrands.has(task.brandId)||data.hiddenWorkers.has(task.workerId))continue;
  // Include assignment history so reassignment back to this worker creates a fresh alert.
  const assigned=(task.history||[]).filter((h:any)=>h.detail==='Task allocated').at(-1);
  items.push({id:`extra:${task.id}:${assigned?.at||task.created}`,title:'Extra task assigned to you',body:`${task.title} · ${task.category||'Extra task'}`,at:assigned?.at||task.created,page:'Extra tasks'});
 }
 for(const request of data.requests){if(data.hiddenWorkers.has(request.workerId))continue;
  if(request.status==='Pending'&&request.canReview)items.push({id:`request:${request.id}`,title:`${request.kind} request needs approval`,body:`${request.workerName} · ${request.from}${request.to!==request.from?' → '+request.to:''}`,at:request.created,page:'Requests'});
  if(request.workerId===user.id&&['Approved','Rejected'].includes(request.status))items.push({id:`decision:${request.id}:${request.reviewedAt}`,title:`Your ${String(request.kind).toLowerCase()} request was ${request.status.toLowerCase()}`,body:`${request.from}${request.to!==request.from?' → '+request.to:''}`,at:request.reviewedAt||request.created,page:'Requests'});
 }
 return items.filter(item=>item.at).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
