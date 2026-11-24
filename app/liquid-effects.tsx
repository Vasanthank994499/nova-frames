'use client';
import {useEffect} from 'react';
import Nv3D from './nv-3d';
// Decorative 3D scene + motion (styles in liquid.css). Presentation only: no data, no app state.
// Tilt/spotlight need a hover pointer; everything motion-related is skipped for prefers-reduced-motion.
const CARDS='.stat,.job-card,.person-card,.cp-quick-card,.lead-card,.add-card,.shoot-card,.request-card,.shift-card,.owner-card,.brief-card';
const REVEAL=CARDS+',.client-section,.report-panel,.projects,.leads-column';
export default function LiquidEffects(){
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,hover=matchMedia('(hover: hover)').matches;
  const off:(()=>void)[]=[];
  // Soften any sharp-cornered box the stylesheet doesn't cover (circles/pills and table cells are left alone).
  let soft=0;const SKIP=/^(TH|TD|TR|TBODY|THEAD|TABLE|HTML|BODY|SVG|PATH|OPTION)$/;
  const soften=()=>{soft=0;document.querySelectorAll<HTMLElement>('.shell *,.client-shell *,.login-shell *,main *').forEach(el=>{
   if(el.dataset.nvSoft||SKIP.test(el.tagName)||el.closest('.nv-scene'))return;const r=el.getBoundingClientRect();if(r.width<20||r.height<14)return;
   const cs=getComputedStyle(el);if(cs.backgroundClip==='text'||(cs as unknown as {webkitBackgroundClip?:string}).webkitBackgroundClip==='text')return;
   const box=(cs.backgroundColor!=='rgba(0, 0, 0, 0)')||cs.backgroundImage!=='none'||parseFloat(cs.borderTopWidth)>0||cs.boxShadow!=='none'||/^(IMG|VIDEO|IFRAME)$/.test(el.tagName);
   if(box&&parseFloat(cs.borderTopLeftRadius)<8){el.style.borderRadius=Math.min(18,Math.round(r.height/2))+'px';el.dataset.nvSoft='1';}});};
  const queueSoft=()=>{clearTimeout(soft);soft=window.setTimeout(soften,150);};
  queueSoft();const smo=new MutationObserver(queueSoft);smo.observe(document.body,{childList:true,subtree:true});off.push(()=>smo.disconnect());
  // Check-in celebration: when a Check in click succeeds (its button leaves the shift card), cheer the worker on.
  const LINES=['Great frames start with showing up. Have a brilliant day!','You are on the clock. Let us make something beautiful.','Welcome in! Today is a good day to create.','Checked in. Every shot counts, make it shine.','Here we go. Your best work starts now.'];
  const cheer=()=>{const name=(document.querySelector('.account strong')?.textContent||'').trim().split(' ')[0];
   const box=document.createElement('div');box.className='nv-cheer';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
   box.innerHTML='<div class="nv-cheer-card"><span class="nv-cheer-badge" aria-hidden="true">✓</span><div><strong></strong><p></p></div></div>';
   box.querySelector('strong')!.textContent=name?`You're checked in, ${name}!`:"You're checked in!";box.querySelector('p')!.textContent=LINES[Math.floor(Math.random()*LINES.length)];
   if(!reduce){const cols=['#e3c27c','#f0d79c','#7c5cff','#3f3bd1','#a9a6ff','#ffffff'];for(let i=0;i<70;i++){const c=document.createElement('i');c.className='nv-confetti';const a=Math.random()*Math.PI*2,d=140+Math.random()*260;
    c.style.cssText=`--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-180}px;--r:${Math.random()*720-360}deg;background:${cols[i%cols.length]};animation-delay:${Math.random()*120}ms;width:${6+Math.random()*6}px;height:${4+Math.random()*8}px`;box.appendChild(c);}}
   document.body.appendChild(box);setTimeout(()=>box.classList.add('out'),3800);setTimeout(()=>box.remove(),4400);};
  const onCheck=(ev:MouseEvent)=>{const b=(ev.target as Element)?.closest?.('.shift-card .primary') as HTMLElement|null;if(!b||!b.querySelector('.lucide-play'))return;
   const card=b.closest('.shift-card');const t0=Date.now();const iv=setInterval(()=>{if(!card?.isConnected||!card.querySelector('.primary .lucide-play')){clearInterval(iv);cheer();}else if(Date.now()-t0>10000)clearInterval(iv);},200);};
  document.addEventListener('click',onCheck);off.push(()=>document.removeEventListener('click',onCheck));
  // Theme switch: replay the toggle's own click inside a View Transition so the new theme grows as a circle from the button.
  const THEME='.cp-theme,.cp-theme-top,.theme-settings-switch';let replay=false;
  const onTheme=(ev:MouseEvent)=>{const b=(ev.target as Element)?.closest?.(THEME) as HTMLElement|null;
   const doc=document as Document&{startViewTransition?:(cb:()=>void)=>unknown};
   if(!b||replay||reduce||!doc.startViewTransition)return;
   ev.stopPropagation();ev.preventDefault();
   const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
   const root=document.documentElement;root.style.setProperty('--vt-x',x+'px');root.style.setProperty('--vt-y',y+'px');
   root.style.setProperty('--vt-r',Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+'px');
   doc.startViewTransition(()=>{replay=true;b.click();replay=false;});};
  document.addEventListener('click',onTheme,true);off.push(()=>document.removeEventListener('click',onTheme,true));
  if(!reduce){
   // scroll reveal for cards entering the viewport
   const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('nv-in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -6% 0px'});
   const scan=()=>document.querySelectorAll<HTMLElement>(REVEAL).forEach(el=>{if(!el.dataset.nvR){el.dataset.nvR='1';if(el.getBoundingClientRect().top>innerHeight){el.classList.add('nv-reveal');io.observe(el);}}});
   scan();const mo=new MutationObserver(scan);mo.observe(document.body,{childList:true,subtree:true});
   off.push(()=>{io.disconnect();mo.disconnect();});
   // ripple on buttons
   const ripple=(ev:PointerEvent)=>{const b=(ev.target as Element)?.closest?.('.primary,.secondary,.iconbutton') as HTMLElement|null;if(!b)return;const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),d=document.createElement('span');d.className='nv-ripple';d.style.cssText=`width:${s}px;height:${s}px;left:${ev.clientX-r.left-s/2}px;top:${ev.clientY-r.top-s/2}px`;b.appendChild(d);setTimeout(()=>d.remove(),700);};
   document.addEventListener('pointerdown',ripple);off.push(()=>document.removeEventListener('pointerdown',ripple));
  }
  if(!reduce&&hover){
   // 3D cards: tilt + content parallax + cursor spotlight + counter shadow. Magnetic buttons.
   let el:HTMLElement|null=null,mag:HTMLElement|null=null,raf=0;
   const reset=(e:HTMLElement)=>{['--rx','--ry'].forEach(k=>e.style.setProperty(k,'0deg'));['--tx','--ty','--sx','--sy'].forEach(k=>e.style.setProperty(k,'0px'));e.classList.remove('nv-hot');};
   const unmag=(b:HTMLElement)=>{b.style.setProperty('--bx','0px');b.style.setProperty('--by','0px');};
   const move=(ev:PointerEvent)=>{
    document.documentElement.style.setProperty('--cx',ev.clientX+'px');document.documentElement.style.setProperty('--cy',ev.clientY+'px');
    cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
        const target=ev.target as Element;
    const b=target?.closest?.('.primary,.secondary,.iconbutton') as HTMLElement|null;
    if(mag&&mag!==b)unmag(mag);mag=b;
    if(b){const r=b.getBoundingClientRect();b.style.setProperty('--bx',`${((ev.clientX-r.left)/r.width-.5)*6}px`);b.style.setProperty('--by',`${((ev.clientY-r.top)/r.height-.5)*5}px`);}
    const t=target?.closest?.(CARDS) as HTMLElement|null;
    if(el&&el!==t)reset(el);el=t;if(!t)return;
    t.classList.add('lq-tilt','nv-hot');
    const r=t.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height,max=r.width>420?2.5:7;
    t.style.setProperty('--ry',`${(x-.5)*max*2}deg`);t.style.setProperty('--rx',`${(.5-y)*max*2}deg`);
    t.style.setProperty('--mx',`${x*100}%`);t.style.setProperty('--my',`${y*100}%`);
    t.style.setProperty('--tx',`${(x-.5)*6}px`);t.style.setProperty('--ty',`${(y-.5)*6}px`);
    t.style.setProperty('--sx',`${(.5-x)*18}px`);t.style.setProperty('--sy',`${(.5-y)*14+18}px`);
   });};
   const out=()=>{if(el)reset(el);el=null;if(mag)unmag(mag);mag=null;};
   document.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',out);
   off.push(()=>{document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',out);});
  }
  return()=>off.forEach(f=>f());
 },[]);
 return <><div className="nv-scene" aria-hidden="true"><div className="nv-aurora"/><div className="nv-stars a"/><div className="nv-stars b"/><div className="nv-stars c"/><Nv3D/><div className="nv-spot"/><div className="nv-grain"/></div></>;
}
