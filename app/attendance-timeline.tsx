'use client';
import {useState,type FormEvent} from 'react';

type EditHistoryEntry={at:number;by:string;reason:string;previousAt:number;previousReason:string;newAt:number;newReason:string};
type ActivityEvent={id?:string;type:string;at:number;reason?:string;by?:string;editHistory?:EditHistoryEntry[]};
type TimelineEvent=ActivityEvent&{_kind:'attendance'|'access';_index:number};
type EditDraft={kind:'attendance'|'access';index:number;id?:string;time:string;reason:string;editReason:string};
type AttendanceLog={worker:{id:string;name:string};events?:ActivityEvent[];accessEvents?:ActivityEvent[]};

const labels:Record<string,string>={login:'Portal sign-in',logout:'Portal sign-out',in:'Attendance check-in',break:'Permission break',resume:'Work resumed',out:'End day',correction:'Administrator correction','approved-leave':'Leave approved','leave-approved':'Leave approved'};
export const attendanceTime=(at?:number)=>at?new Date(at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';

export function AttendanceTimeline({record,day,onSaved}:{record:AttendanceLog;day:string;onSaved?:()=>Promise<void>|void}){
 const [editing,setEditing]=useState<EditDraft|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const events:TimelineEvent[]=[...(record.events||[]).map((event,index)=>({...event,_kind:'attendance' as const,_index:index})),...(record.accessEvents||[]).map((event,index)=>({...event,_kind:'access' as const,_index:index}))].sort((a,b)=>a.at-b.at);
 function startEdit(event:TimelineEvent){setEditing({kind:event._kind,index:event._index,id:event.id,time:new Date(event.at+19800000).toISOString().slice(11,16),reason:event.reason||'',editReason:''});setError('');}
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editing)return;setBusy(true);setError('');
  try{
   const response=await fetch('/api/attendance/log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workerId:record.worker.id,day,kind:editing.kind,eventIndex:editing.index,eventId:editing.id,time:editing.time,reason:editing.reason,editReason:editing.editReason})});
   const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'Could not save this attendance log.');
   setEditing(null);if(onSaved)await onSaved();else window.location.reload();
  }catch(caught){setError((caught as Error).message);}finally{setBusy(false);}
 }
 const editingEvent=editing?events.find(event=>event._kind===editing.kind&&event._index===editing.index):undefined;
 return <section className="admin-time-log">
  <h3>{record.worker.name} · Activity on {day}</h3>
  <p className="muted">Administrator-only activity log. Times are in IST. Portal sign-in/out recording starts with this update. Closing a browser or an expired session is not a recorded sign-out. Edits require a reason and are recorded in this log.</p>
  <div className="table-wrap"><table><thead><tr><th>TIME (IST)</th><th>ACTIVITY</th><th>REASON / DETAILS</th><th>ADMIN</th></tr></thead><tbody>
   {events.map((event,index)=><tr key={event.id||`${event.type}-${event.at}-${index}`}>
    <td><time dateTime={new Date(event.at).toISOString()}>{attendanceTime(event.at)}</time></td>
    <td>{labels[event.type]||event.type}</td>
    <td>{event.reason||'—'}{event.by&&<small className="cell-small">Recorded by {event.by}</small>}{(event.editHistory||[]).map((edit,editIndex)=><small className="cell-small" key={`${edit.at}-${editIndex}`}>Edited by {edit.by} at {attendanceTime(edit.at)} · {attendanceTime(edit.previousAt)} → {attendanceTime(edit.newAt)} IST · {edit.reason}</small>)}</td>
    <td><button type="button" className="secondary" onClick={()=>startEdit(event)}>Edit log</button></td>
   </tr>)}
  </tbody></table>{!events.length&&<p className="muted">No recorded activity for this person on this date.</p>}</div>
  {editing&&<form className="attendance-correction log-editor" onSubmit={save}>
   <h4>Edit {labels[editingEvent?.type||'']||'activity'} log</h4>
   <div className="form-grid">
    <label>Time (IST)<input type="time" required value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})}/></label>
    <label className="full">Reason / details<textarea rows={2} maxLength={2000} value={editing.reason} onChange={e=>setEditing({...editing,reason:e.target.value})}/></label>
    <label className="full">Reason for this admin edit<textarea required rows={2} maxLength={2000} value={editing.editReason} onChange={e=>setEditing({...editing,editReason:e.target.value})} placeholder="Explain why this log entry needs correction"/></label>
   </div>
   <div className="shift-buttons"><button className="secondary" type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button><button className="primary" disabled={busy||!editing.editReason.trim()}>{busy?'Saving…':'Save log edit'}</button></div>
  </form>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
