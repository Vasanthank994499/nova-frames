export const PROJECT_STAGES=[{value:'Content',label:'Content'},{value:'Shoot',label:'Shoot'},{value:'Editing',label:'Video editing'},{value:'Ready to post',label:'Post'}] as const;
export function mayManageStage(user:{id:string;admin:boolean;roles:string[]},job:{cameraAssignee?:string;createdBy?:string}){return user.admin;}
export function validProjectStage(value:string){return PROJECT_STAGES.some(stage=>stage.value===value);}
export function normalizeProjectStage(value:string){return value==='Posted'?'Ready to post':value;}
export function allocationRoleForStage(stage:string):string|null{return ({Content:'content',Shoot:'camera',Editing:'editor','Client approval':'editor','Ready to post':'publisher'} as Record<string,string>)[stage]||null;}
export function matchesAllocationStage(stage:string,role:string){return stage===({content:'Content',camera:'Shoot',editor:'Editing',publisher:'Ready to post'} as Record<string,string>)[role];}
