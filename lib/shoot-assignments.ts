const keys:Record<string,string>={content:'contentAssignee',camera:'cameraAssignee',editor:'editorAssignee',publisher:'publisherAssignee'};

// Older videos store one cameraman. An explicit crew array is authoritative, even when empty.
export function assignmentIds(job:any,role:string):string[]{
 const value=role==='camera'&&Array.isArray(job?.cameraAssignees)?job.cameraAssignees:[job?.[keys[role]]];
 return [...new Set<string>(value.filter((id:unknown)=>typeof id==='string'&&!!id))];
}
export function assignedTo(job:any,role:string,id?:string){return !!id&&assignmentIds(job,role).includes(id);}
export function cameraFields(ids:string[]){return {cameraAssignee:ids[0]||'',cameraAssignees:ids};}
export function allocationInput(input:any,role:string):string[]{
 const value=role==='camera'&&'cameraAssignees' in input?input.cameraAssignees:input[keys[role]];
 if(role==='camera'&&Array.isArray(value)){
  if(value.length>100||value.some(id=>typeof id!=='string'||!id.trim()||id.length>100))throw Error('Choose valid cameramen for the shoot.');
  return [...new Set<string>(value.map(id=>id.trim()))];
 }
 if(value!==undefined&&typeof value!=='string')throw Error('Only Shoot can be allocated to multiple workers.');
 const id=String(value||'').trim();if(id.length>100)throw Error('Select a valid worker.');return id?[id]:[];
}
