'use client';
type Person={id?:string,name:string,active:boolean,role?:string,roles?:string[]};
export function ShootCrew({people,value,onChange,disabled=false}:{people:Person[],value:string[],onChange:(ids:string[])=>void,disabled?:boolean}){
 const eligible=people.filter(p=>p.id&&p.active&&(p.roles||[p.role]).includes('camera'));
 const unavailable=value.filter(id=>!eligible.some(p=>p.id===id));
 return <fieldset className="shoot-crew" disabled={disabled}><legend>Shoot crew</legend><p>Select one or more cameramen. Any selected cameraman can submit the shared shoot once.</p><div className="shoot-crew-options">{eligible.map(p=><label key={p.id}><input type="checkbox" checked={value.includes(p.id!)} onChange={e=>onChange(e.target.checked?[...value,p.id!]:value.filter(id=>id!==p.id))}/><span>{p.name}</span></label>)}{unavailable.map(id=><label key={id}><input type="checkbox" checked onChange={()=>onChange(value.filter(v=>v!==id))}/><span>Unavailable worker — uncheck to remove</span></label>)}</div>{!eligible.length&&<p>No active cameramen. Add the Cameraman role in Team first.</p>}<small>{value.length} selected · Leave all unchecked to allocate later.</small></fieldset>;
}
