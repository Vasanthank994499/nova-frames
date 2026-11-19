'use client';
import {useEffect,useRef} from 'react';
// Keyboard behaviour for modal forms: focus moves in on open, Tab stays inside, Escape closes, focus returns to the opener.
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
export function useDialog<T extends HTMLElement>(open:boolean,onClose:()=>void){
 const ref=useRef<T>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  if(!open)return;const opener=document.activeElement as HTMLElement|null,el=ref.current;if(!el)return;
  const items=()=>[...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x=>x.offsetParent!==null||x===document.activeElement);
  (items().find(x=>!x.matches('[aria-label^="Close"]'))||items()[0]||el).focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close.current();return;}
   if(e.key!=='Tab')return;const list=items();if(!list.length)return;const first=list[0],last=list[list.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   else if(!el.contains(document.activeElement)){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',onKey,true);
  return ()=>{document.removeEventListener('keydown',onKey,true);if(opener&&document.contains(opener))opener.focus();};
 },[open]);
 return ref;
}
