const maps=new Map<string,Promise<HTMLCanvasElement>>();
/** Small, on-demand map image; reused across all three card formats. */
export function loadShareMap(latitude:number,longitude:number):Promise<HTMLCanvasElement>{
 const key=`${latitude},${longitude}`;
 const existing=maps.get(key);if(existing)return existing;
 const promise=(async()=>{
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))throw new Error('Lake coordinates are unavailable.');
  const z=15,n=2**z,lat=Math.max(-85,Math.min(85,latitude))*Math.PI/180;
  const cx=(longitude+180)/360*n*256,cy=(1-Math.asinh(Math.tan(lat))/Math.PI)/2*n*256;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;
  const context=canvas.getContext('2d');if(!context)throw new Error('Map image could not be drawn.');
  const left=cx-384,top=cy-256;
  const requests:Promise<void>[]=[];
  for(let x=Math.floor(left/256);x<=Math.floor((left+767)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+511)/256);y++){
   requests.push(new Promise((resolve,reject)=>{
    const tile=new Image();tile.crossOrigin='anonymous';
    const timer=window.setTimeout(()=>{tile.onload=null;tile.onerror=null;reject(new Error('Location map timed out. Please retry.'));},12000);
    tile.onload=()=>{window.clearTimeout(timer);context.drawImage(tile,x*256-left,y*256-top,256,256);resolve();};
    tile.onerror=()=>{window.clearTimeout(timer);reject(new Error('Location map could not load. Check your connection and retry.'));};
    tile.src=`https://tile.openstreetmap.org/${z}/${((x%n)+n)%n}/${y}.png`;
   }));
  }
  await Promise.all(requests);return canvas;
 })();
 maps.set(key,promise);void promise.catch(()=>maps.delete(key));
 if(maps.size>10)maps.delete(maps.keys().next().value!);
 return promise;
}
