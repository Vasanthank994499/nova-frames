export const PROJECT_STAGES=[{value:'Content',label:'Content'},{value:'Shoot',label:'Shoot'},{value:'Editing',label:'Video editing'},{value:'Ready to post',label:'Post'}] as const;
export function mayManageStage(user:{id:string;admin:boolean;roles:string[]},job:{cameraAssignee?:string;createdBy?:string}){return user.admin||user.roles.includes('manager')||(user.roles.includes('camera')&&(job.cameraAssignee===user.id||job.createdBy===user.id));}
export function validProjectStage(value:string){return PROJECT_STAGES.some(stage=>stage.value===value);}
