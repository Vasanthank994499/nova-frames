import {contentCount,productionDate} from './production-batches';

type Actor={id:string,name:string,email:string,admin:boolean,roles:string[],branchId?:string};
const clean=(value:unknown,max=5000)=>String(value||'').trim().slice(0,max);
function submissionId(value:unknown){const id=clean(value,100);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Reopen the unassigned task form and try again.');return id;}
function activeBrand(brand:any){if(!brand||brand.active===false)throw Error('Select an active brand.');return brand;}
function eventFor(record:any,u:Actor,at:string,action:string,link=''){return {id:crypto.randomUUID(),at,actorId:u.id,actorName:u.name,actorEmail:u.email,actorRole:u.admin?'admin':u.roles.join(', '),assignedId:u.id,assignedName:u.name,jobId:record.id,title:record.title,brandId:record.brandId,brandName:record.brandName,branchId:record.branchId,branchName:record.branchName,action,stage:record.stage||record.status,revisionCount:0,link};}

export function unassignedContent(v:any,u:Actor,brand:any,at:string,driveLink:(value:unknown)=>string){
 if(!u.admin&&!u.roles.some(r=>['content','manager'].includes(r)))throw Error('Content creator or manager access required.');
 activeBrand(brand);const id=submissionId(v.submissionId),date=productionDate(v.contentDate),count=contentCount(v.contentCount),contentLink=driveLink(v.contentLink);if(!contentLink)throw Error('Add the content Drive link.');
 const record={id,title:brand.name+' · Content · '+date,brandId:brand.id,brandName:brand.name,branchId:brand.branchId||'',branchName:brand.branchName||'Unassigned',videoType:'Instagram Reel',brief:'',due:'',shootDate:'',priority:'Normal',stage:'Shoot',contentAssignee:u.id,cameraAssignee:'',editorAssignee:'',publisherAssignee:'',contentLink,contentDate:date,contentCount:count,contentNotes:clean(v.notes),shootLink:'',editLink:'',instagramLink:'',shootCompleted:false,driveUploaded:false,systemUpdated:false,editingCompleted:false,approval:'Pending',reviewNotes:'',unassignedSubmission:true,revisionCount:0,created:at,createdBy:u.id,creatorName:u.name,history:[{at,by:u.email,actorId:u.id,actorName:u.name,detail:'Unassigned content submitted · Ready for shoot'}]};
 const events=['created','submit-content'].map(action=>({...eventFor(record,u,at,action,contentLink),contentCount:count,contentDate:date,snapshot:{...record,history:undefined}}));return {record,events};
}

export function unassignedExtra(v:any,u:Actor,brand:any,branch:any,at:string){
 const id=submissionId(v.submissionId),title=clean(v.title,180),category=clean(v.category,80),status=clean(v.status,30),result=clean(v.result,20000);
 if(!title)throw Error('Enter an extra-task title.');if(!['Typing','Research','Administration','Design','Other'].includes(category))throw Error('Select a valid category.');if(!['In progress','Completed'].includes(status))throw Error('Choose In progress or Completed.');if(status==='Completed'&&!result)throw Error('Add your typed output, result notes, or a Drive link.');if(v.brandId)activeBrand(brand);
 const record={id,workerId:u.id,workerName:u.name,title,category,details:clean(v.details),due:'',brandId:brand?.id||'',brandName:brand?.name||'',branchId:branch?.id||'',branchName:branch?.name||'Unassigned',status,result,unassignedSubmission:true,createdBy:u.id,created:at,...(status==='Completed'?{completedAt:at}:{}),history:[{at,by:u.name,detail:'Unassigned extra work recorded'},{at,by:u.name,detail:status}]};
 return {record,events:status==='Completed'?[eventFor(record,u,at,'extra-task-complete')]:[]};
}
