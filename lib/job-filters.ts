import {allocationRoleForStage,matchesAllocationStage} from './project-stages';
const keys:Record<string,string>={content:'contentAssignee',camera:'cameraAssignee',editor:'editorAssignee',publisher:'publisherAssignee'};
export function currentAssignee(job:any):string{return job[keys[job.stage==='Completed'?'publisher':allocationRoleForStage(job.stage)||'']]||'';}
export function matchesJobFilters(job:any,stage='All stages',allocation='',priority='All priorities'){
 const person=currentAssignee(job);
 return (stage==='All stages'||job.stage===stage)&&(priority==='All priorities'||job.priority===priority)&&(!allocation||(allocation==='unassigned'?!person:allocation==='assigned'?!!person:person===allocation));
}
export function isUnassignedAtStage(job:any,step:string){return matchesAllocationStage(job.stage,step)&&!job[keys[step]];}
