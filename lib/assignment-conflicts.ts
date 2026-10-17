export type AssignmentChange={key:string,from:string,to:string};
export function reassignmentConflict(version:string,previous:Record<string,any>,next:Record<string,any>,keys:string[],confirmation?:string){
 const changes:AssignmentChange[]=keys.filter(key=>!['cameraAssignee','cameraAssignees'].includes(key)).flatMap(key=>previous[key]&&next[key]&&previous[key]!==next[key]?[{key,from:String(previous[key]),to:String(next[key])}]:[]);
 if(!changes.length)return null;
 const confirmationKey=JSON.stringify({version,changes});
 return confirmation===confirmationKey?null:{confirmationKey,changes};
}
