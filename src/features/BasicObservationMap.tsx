type Position={latitude:number;longitude:number};
export default function BasicObservationMap({position}:{position:Position}) {
 const {latitude,longitude}=position;
 const query=new URLSearchParams({bbox:[Math.max(-180,longitude-.012),Math.max(-85,latitude-.008),Math.min(180,longitude+.012),Math.min(85,latitude+.008)].join(','),layer:'mapnik',marker:`${latitude},${longitude}`});
 return <section className="observation-map" aria-label="Basic observation location map"><iframe title="Selected observation region" src={`https://www.openstreetmap.org/export/embed.html?${query}`} loading="lazy" style={{width:'100%',height:300,border:'1px solid #a6adb7',borderRadius:12}}/><p>The marker shows your observation coordinates. Adjust the latitude and longitude fields below to change the recorded position; moving this basic map only changes its view.</p><a target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}>Open this location in OpenStreetMap</a></section>;
}
