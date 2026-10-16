import {allocationRoleForStage,matchesAllocationStage} from './project-stages';
const keys:Record<string,string>={content:'contentAssignee',camera:'cameraAssignee',editor:'editorAssignee',publisher:'publisherAssignee'};
export function currentAssignee(job:any):string{return job[keys[job.stage==='Completed'?'publisher':allocationRoleForStage(job.stage)||'']]||'';}
export function matchesJobFilters(job:any,stage='All stages',allocation='',priority='All priorities'){
 const person=currentAssignee(job);
 return (stage==='All stages'||job.stage===stage)&&(priority==='All priorities'||job.priority===priority)&&(!allocation||(allocation==='unassigned'?!person:allocation==='assigned'?!!person:person===allocation));
}
export function isUnassignedAtStage(job:any,step:string){return matchesAllocationStage(job.stage,step)&&!job[keys[step]];}

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
