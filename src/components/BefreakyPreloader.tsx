import {useEffect,useState} from 'react';
export default function BefreakyPreloader(){
 const [hidden,setHidden]=useState(()=>{try{return sessionStorage.getItem('aquarelay_first_open_done')==='true';}catch{return false;}});
 const [percent,setPercent]=useState(0),[leaving,setLeaving]=useState(false);
 useEffect(()=>{
  if(hidden)return;
  const remember=()=>{try{sessionStorage.setItem('aquarelay_first_open_done','true');}catch{}};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){remember();setHidden(true);return;}
  let frame=0,hold:ReturnType<typeof setTimeout>|undefined,exit:ReturnType<typeof setTimeout>|undefined;
  const start=performance.now();
  const tick=(now:number)=>{const value=Math.min(100,Math.floor((now-start)/1600*100));setPercent(value);if(value<100)frame=requestAnimationFrame(tick);else{remember();hold=setTimeout(()=>{setLeaving(true);exit=setTimeout(()=>setHidden(true),240);},450);}};
  frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);clearTimeout(hold);clearTimeout(exit);};
 },[hidden]);
 if(hidden)return null;
 return <div className={`classic-intro ${leaving?'classic-intro-exit':''}`} aria-label="Opening AquaRelay" role="status"><div className="classic-intro-counter" aria-hidden="true">{percent}</div><div className="classic-intro-brand"><img src="/favicon.svg" width="72" height="72" alt=""/><h2>AquaRelay<span>.</span></h2><p>Every water body has a history.</p></div></div>;
}
