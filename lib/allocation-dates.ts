import {allocationRoleForStage} from './project-stages';
export const indiaDay=(now=Date.now())=>new Date(now+19800000).toISOString().slice(0,10);
export function allocationDate(value:unknown,fallback=indiaDay()):string {
 const day=String(value||fallback);
 const parsed=new Date(day+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)throw Error('Choose a valid work allocation date.');
 return day;
}
export function workAvailable(task:any,today=indiaDay()):boolean {
 const role=allocationRoleForStage(task.stage||'');
 const day=task.workerId?task.allocationDate:task.allocationDates?.[role||''];
 return !day||day<=today;
}
