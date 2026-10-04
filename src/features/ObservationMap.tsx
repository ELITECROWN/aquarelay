import {useEffect,useRef,useState} from 'react';
import {Map,NavigationControl,setWorkerUrl} from 'maplibre-gl';
import {MapPin} from 'lucide-react';
import {realMap} from '../mapStyle';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
setWorkerUrl(workerUrl);
type Position={latitude:number;longitude:number};
export default function ObservationMap({position,onChange}:{position:Position;onChange:(position:Position)=>void}){
 const container=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),change=useRef(onChange);change.current=onChange;
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!container.current)return;
  let instance:Map;
  try{
   instance=new Map({container:container.current,style:import.meta.env.VITE_MAP_STYLE_URL||realMap,center:[position.longitude,position.latitude],zoom:16,renderWorldCopies:false,attributionControl:{compact:false}});map.current=instance;
   instance.addControl(new NavigationControl({showCompass:false}),'bottom-right');
   instance.on('moveend',()=>{const c=instance.getCenter();change.current({latitude:Number(c.lat.toFixed(6)),longitude:Number(c.lng.toFixed(6))});});
   instance.on('click',e=>instance.easeTo({center:e.lngLat,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180}));
   instance.on('error',()=>setError('Map tiles could not be loaded. Check your connection or enter coordinates below.'));
   instance.on('idle',()=>{if(instance.areTilesLoaded())setError('');});
  }catch{setError('The interactive map is unavailable. Enter the observation coordinates below.');}
  return()=>{map.current=null;instance?.remove();};
 },[]);
 useEffect(()=>{const m=map.current;if(!m||!Number.isFinite(position.latitude)||!Number.isFinite(position.longitude)||Math.abs(position.latitude)>90||Math.abs(position.longitude)>180)return;const c=m.getCenter();if(Math.abs(c.lat-position.latitude)>0.00001||Math.abs(c.lng-position.longitude)>0.00001)m.jumpTo({center:[position.longitude,position.latitude]});},[position.latitude,position.longitude]);
 return <section className="observation-map" aria-label="Observation location picker"><p>Drag the map under the pin, or tap the exact spot where you observed the event. Keyboard users can focus the map and use arrow keys.</p><div className="observation-map-frame" aria-label="Choose observation location"><div ref={container} className="observation-map-canvas" aria-label="Choose observation location"/><MapPin className="observation-location-pin" size={42} fill="#fef3c7" stroke="#991b1b" aria-hidden="true"/></div><p role="status">Selected observation position: {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p>{error&&<p role="alert">{error}</p>}</section>;
}
