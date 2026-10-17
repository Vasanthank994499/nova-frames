import {allocationRoleForStage,matchesAllocationStage} from './project-stages';
import {assignmentIds} from './shoot-assignments';
export function currentAssignees(job:any):string[]{return assignmentIds(job,job.stage==='Completed'?'publisher':allocationRoleForStage(job.stage)||'');}
export function currentAssignee(job:any):string{return currentAssignees(job)[0]||'';}
export function matchesJobFilters(job:any,stage='All stages',allocation='',priority='All priorities'){
 const people=currentAssignees(job);
 return (stage==='All stages'||job.stage===stage)&&(priority==='All priorities'||job.priority===priority)&&(!allocation||(allocation==='unassigned'?!people.length:allocation==='assigned'?!!people.length:people.includes(allocation)));
}
export function isUnassignedAtStage(job:any,step:string){return matchesAllocationStage(job.stage,step)&&!assignmentIds(job,step).length;}

export type JobSort='newest'|'oldest'|'name-asc'|'name-desc'|'deadline';
export function compareJobs(a:any,b:any,order:JobSort){
 const name=()=>String(a.title||'').localeCompare(String(b.title||''),'en',{numeric:true,sensitivity:'base'})||String(a.id||'').localeCompare(String(b.id||''));
 if(order==='name-asc')return name();
 if(order==='name-desc')return -name();
 if(order==='deadline'){if(!a.due&&!b.due)return name();if(!a.due)return 1;if(!b.due)return -1;return a.due.localeCompare(b.due)||name();}
 const time=(job:any)=>{const value=Date.parse(job.created);return Number.isFinite(value)?value:null;},first=time(a),second=time(b);
 if(first===null&&second===null)return name();
 if(first===null)return 1;if(second===null)return -1;
 return (order==='oldest'?first-second:second-first)||name();
}
