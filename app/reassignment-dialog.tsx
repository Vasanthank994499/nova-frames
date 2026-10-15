'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export type AssignmentWarning={confirmationKey:string,conflicts:{title:string,step:string,currentName:string,nextName:string}[]};
export async function saveWorkspace(body:any,confirm:(warning:AssignmentWarning)=>Promise<boolean>){
 let request=body;
 for(;;){const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}),data=await r.json();
  if(r.status===409&&data.code==='ASSIGNMENT_CONFLICT'){if(!await confirm(data))return false;request={...body,assignmentConfirmation:data.confirmationKey};continue;}
  if(!r.ok)throw Error(data.error||'Could not save changes.');return true;
 }
}
export function useAssignmentConfirmation(){
 const [warning,setWarning]=useState<AssignmentWarning|null>(null),resolve=useRef<((value:boolean)=>void)|null>(null),box=useRef<HTMLElement|null>(null),cancel=useRef<HTMLButtonElement|null>(null),title=useId();
 function finish(value:boolean){const done=resolve.current;resolve.current=null;setWarning(null);done?.(value);}
 function confirm(value:AssignmentWarning){resolve.current?.(false);return new Promise<boolean>(done=>{resolve.current=done;setWarning(value);});}
 useEffect(()=>()=>{resolve.current?.(false);resolve.current=null;},[]);
 useEffect(()=>{if(!warning)return;const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';cancel.current?.focus();
  function key(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}if(e.key==='Tab'){const buttons=Array.from(box.current?.querySelectorAll<HTMLButtonElement>('button')||[]),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}e.stopImmediatePropagation();}}
  document.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
 },[warning]);
 const dialog=warning?createPortal(<div className="reassignment-shade"><section ref={box} className="reassignment-dialog" role="alertdialog" aria-modal="true" aria-labelledby={title} aria-describedby={title+'-description'}><h2 id={title}>This task is already assigned</h2><div id={title+'-description'} className="reassignment-body">{warning.conflicts.map((c,i)=><p key={i}><strong>{c.title} · {c.step}</strong><br/>Already assigned to <strong>{c.currentName}</strong>.<br/>Assign it to <strong>{c.nextName}</strong> instead?</p>)}<p>The new person replaces the current assignee. This task will have only one assignee for this step.</p></div><div className="reassignment-actions"><button ref={cancel} type="button" className="secondary" onClick={()=>finish(false)}>Cancel</button><button type="button" className="primary" onClick={()=>finish(true)}>Assign to another person</button></div></section></div>,document.body):null;
 return {confirm,dialog};
}
