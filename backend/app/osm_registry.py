"""Idempotent regional OSM starter identities, never environmental observations."""
import argparse
import json
from pathlib import Path
import httpx
from .models import WaterBody,Source,utcnow
from .db import SessionLocal

BBOX=(12.8,77.4,13.2,77.85)
REGIONS={
    'bengaluru':{'bbox':BBOX,'locality':'Bengaluru region','label':'Bengaluru'},
    'sodepur-barrackpore':{'bbox':(22.67,88.36,22.80,88.43),'locality':'Sodepur–Barrackpore region, West Bengal','label':'Sodepur–Barrackpore'},
    'potheri':{'bbox':(12.79,80.00,12.86,80.08),'locality':'Potheri region, Tamil Nadu','label':'Potheri'},
}

def region_config(payload):
    region=payload.get('aquarelay_registry',{}).get('region','bengaluru')
    if region not in REGIONS:raise ValueError('Unknown registry region')
    return region,REGIONS[region]

def query_for(region):
    box=','.join(map(str,REGIONS[region]['bbox']))
    return f'[out:json][timeout:60];(nwr["natural"="water"]["water"!~"wastewater|salt|bay|sea"]({box});way["waterway"~"^(stream|canal)$"]({box}););out center tags;'

QUERY=query_for('bengaluru')

def fetch_snapshot(path,region='bengaluru'):
    query=query_for(region)
    with httpx.Client(timeout=httpx.Timeout(90,connect=10),headers={'User-Agent':'AquaRelay/1.0 Registry (+https://github.com/ELITECROWN/aquarelay; one-time OSM starter import)'}) as client:
        response=client.post('https://maps.mail.ru/osm/tools/overpass/api/interpreter',data={'data':query})
        response.raise_for_status()
        if len(response.content)>25*1024*1024:raise ValueError('Registry response exceeds 25 MB')
        payload=response.json()
    if payload.get('remark'):raise ValueError('Overpass returned an incomplete result; retry later.')
    payload['aquarelay_registry']={'region':region,'query':query}
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    return payload

def candidates(payload):
    _,region=region_config(payload);bbox=region['bbox']
    results=[]
    for item in payload.get('elements',[]):
        tags=item.get('tags',{})
        # Unspecified water polygons, drains and engineered basins need review;
        # they must not silently become lakes in the public registry.
        water_type=tags.get('water')
        if tags.get('natural')=='water' and water_type in {'lake','pond','stream','canal'}:pass
        elif tags.get('waterway') in {'stream','canal'} and water_type not in {'wastewater','salt','bay','sea'}:water_type=tags['waterway']
        else:continue
        kind=item.get('type');identity=item.get('id')
        if kind not in {'node','way','relation'} or not isinstance(identity,int):continue
        point=item if kind=='node' else item.get('center',{})
        lat,lon=point.get('lat'),point.get('lon')
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not bbox[0]<=lat<=bbox[2] or not bbox[1]<=lon<=bbox[3]:continue
        results.append({'id':f'{kind}-{identity}','name':str(tags.get('name') or tags.get('name:en') or f'Unnamed mapped water body (OSM {kind} {identity})')[:160],'type':water_type,'latitude':lat,'longitude':lon,'aliases':[str(v)[:160] for k,v in tags.items() if k.startswith('name:')],'tags':tags,'osm_type':kind,'osm_id':identity})
    return results

def import_registry(db,payload):
    region_id,region=region_config(payload)
    added=0
    for row in candidates(payload):
        details=payload.get('aquarelay_registry',{}).get('identity_details',{}).get(row['id'],{})
        wb_id='wb-osm-'+row['id'];source_id='src-osm-'+row['id']
        if db.get(WaterBody,wb_id):continue
        description=str(row['tags'].get('description') or row['tags'].get('description:en') or '')[:2000]
        summary='OpenStreetMap starter identity. Position is the mapped feature centre; extent, water-body classification and institutional responsibility need local review. Environmental condition is not assessed.'
        if description:summary+=' Mapped description: '+description
        if details.get('summary'):summary+=' Desk-reviewed reference: '+str(details['summary'])[:3000]
        wb=WaterBody(id=wb_id,name=str(details.get('name') or row['name'])[:160],type=row['type'],latitude=row['latitude'],longitude=row['longitude'],locality=region['locality'],aliases=row['aliases'],synthetic=False,geometry={'type':'Point','coordinates':[row['longitude'],row['latitude']]},summary=summary,data={'osm_type':row['osm_type'],'osm_id':row['osm_id'],'region':region_id,'registry_review_state':'desk_reviewed_identity_pending_local_confirmation' if details else 'community_mapped_starter','responsible_organisation_id':None})
        db.add(wb);db.flush()
        db.add(Source(id=source_id,waterbody_id=wb.id,name=f"OpenStreetMap contributors · {region['label']} starter",kind='registry',url=f"https://www.openstreetmap.org/{row['osm_type']}/{row['osm_id']}",license='ODbL-1.0',attribution='© OpenStreetMap contributors',synthetic=False,data={'osm_tags':row['tags'],'region':region_id,'osm_snapshot_at':payload.get('osm3s',{}).get('timestamp_osm_base'),'imported_at':utcnow(),'bounding_box':region['bbox'],'notice':'Community mapping; not an official municipal registry or water-condition assessment.'}))
        for index,reference in enumerate(details.get('sources',[])):
            db.add(Source(id=f"src-reference-{row['id']}-{index}",waterbody_id=wb.id,name=reference['name'][:200],kind='reference',url=reference['url'],license=reference['license'],attribution=reference['attribution'],synthetic=False,data={'region':region_id,'identity_match':'desk review; local confirmation pending','notice':'Historical public-source account; not a current condition assessment or institutional assignment.'}))
        added+=1
    db.commit();return added

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--file',type=Path,required=True);parser.add_argument('--region',choices=REGIONS,default='bengaluru');parser.add_argument('--fetch',action='store_true');parser.add_argument('--commit',action='store_true');args=parser.parse_args()
    payload=fetch_snapshot(args.file,args.region) if args.fetch else json.loads(args.file.read_text(encoding='utf-8'))
    _,region=region_config(payload)
    rows=candidates(payload);print(f"{len(rows)} community-mapped water-body identities in the {region['label']} bounding box. Licence: ODbL-1.0. No incidents, measurements or authority assignments imported.")
    if args.commit:
        with SessionLocal() as db:print(f'Added {import_registry(db,payload)} new identities. Existing records preserved.')

if __name__=='__main__':main()
