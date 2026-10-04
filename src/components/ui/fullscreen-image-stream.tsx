import {useEffect,useRef,useState} from 'react';
import {ImageStreamHero,type StreamImage} from './image-stream-hero';

export function FullscreenImageStream({images}:{images:StreamImage[]}){
 const section=useRef<HTMLDivElement>(null);
 const [progress,setProgress]=useState(0);
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let frame=0;
  const update=()=>{frame=0;const el=section.current;if(!el)return;const travel=el.offsetHeight-window.innerHeight;setProgress(Math.max(0,Math.min(1,-el.getBoundingClientRect().top/Math.max(travel,1)))*2.8);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
 },[]);
 return <div ref={section} className="fullscreen-stream-track"><div className="fullscreen-stream-stage"><ImageStreamHero images={images} cards={10} axis={50} scrollDriven scrollProgress={progress} className="gallery-stream-card"/><span className="fullscreen-stream-hint">Scroll through freshwater stories</span></div></div>;
}
