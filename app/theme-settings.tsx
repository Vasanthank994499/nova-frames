'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ProfilePhotoEditor} from './profile-photo';
import {Moon,Settings2,Sun,X} from 'lucide-react';

const THEME_KEY='nova-frames-theme';

export function ThemeSettings({user,onPhotoSaved}:{user?:{id:string,name:string,admin:boolean,photoVersion?:string},onPhotoSaved?:()=>void|Promise<void>}){
 const [open,setOpen]=useState(false);
 const [dark,setDark]=useState(()=>typeof document!=='undefined'&&document.documentElement.dataset.theme==='dark');
 const trigger=useRef<HTMLButtonElement>(null);
 const closeButton=useRef<HTMLButtonElement>(null);

 useEffect(()=>{if(!open)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const returnFocus=trigger.current;closeButton.current?.focus();const onKey=(event:KeyboardEvent)=>{
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}
  if(event.key==='Tab'){event.stopImmediatePropagation();
   const dialog=document.querySelector<HTMLElement>('.theme-settings-dialog');
   const buttons=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')||[]);
   if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus();}
   else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus();}
  }
 };document.addEventListener('keydown',onKey,true);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey,true);returnFocus?.focus();};},[open]);

 function changeTheme(next:boolean){
  setDark(next);
  document.documentElement.dataset.theme=next?'dark':'light';
  try{localStorage.setItem(THEME_KEY,next?'dark':'light');}catch{}
 }

 return <>
  <button ref={trigger} type="button" className="iconbutton settings-trigger" aria-label="Settings" title="Settings" onClick={()=>setOpen(true)}><Settings2 size={17}/></button>
  {open&&createPortal(<div className="theme-settings-shade" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <section className="theme-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-settings-title">
    <header><div><span className="eyebrow">WORKSPACE PREFERENCES</span><h2 id="theme-settings-title">Settings</h2></div><button ref={closeButton} type="button" className="iconbutton" aria-label="Close settings" onClick={()=>setOpen(false)}><X size={18}/></button></header>
    {user&&!user.admin&&<ProfilePhotoEditor key={user.id} workerId={user.id} name={user.name} version={user.photoVersion} onSaved={onPhotoSaved||(()=>{})}/>}
    <div className="theme-settings-body"><div className="theme-settings-icon">{dark?<Moon size={21}/>:<Sun size={21}/>}</div><div className="theme-settings-copy"><strong>Dark mode</strong><span>Use a darker look throughout Nova Frames.</span></div><button type="button" className={'theme-settings-switch'+(dark?' on':'')} role="switch" aria-label="Dark mode" aria-checked={dark} onClick={()=>changeTheme(!dark)}><span/></button></div>
    <p className="theme-settings-hint">Your choice is saved on this device and works on mobile, tablet and desktop.</p>
   </section>
  </div>,document.body)}
 </>;
}
