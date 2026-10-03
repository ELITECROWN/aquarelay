"""Idempotent Bengaluru-region OSM starter identities, never environmental observations."""
import argparse
import json
from pathlib import Path
import httpx
from .models import WaterBody,Source,utcnow
from .db import SessionLocal

BBOX=(12.8,77.4,13.2,77.85)
QUERY='[out:json][timeout:60];nwr["natural"="water"]["water"!~"wastewater|salt|bay|sea"](12.8,77.4,13.2,77.85);out center tags;'

def fetch_snapshot(path):
    with httpx.Client(timeout=httpx.Timeout(90,connect=10),headers={'User-Agent':'AquaRelay/1.0 BengaluruRegistry (+https://github.com; one-time reviewed OSM starter import)'}) as client:
        response=client.post('https://maps.mail.ru/osm/tools/overpass/api/interpreter',data={'data':QUERY})
        response.raise_for_status()
        if len(response.content)>25*1024*1024:raise ValueError('Registry response exceeds 25 MB')
        payload=response.json()
    if payload.get('remark'):raise ValueError('Overpass returned an incomplete result; retry later.')
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    return payload

def candidates(payload):
    results=[]
    for item in payload.get('elements',[]):
        tags=item.get('tags',{})
        # Unspecified water polygons, drains and engineered basins need review;
        # they must not silently become lakes in the public registry.
        water_type=tags.get('water')
        if tags.get('natural')!='water' or water_type not in {'lake','pond','stream','canal'}:continue
        kind=item.get('type');identity=item.get('id')
        if kind not in {'node','way','relation'} or not isinstance(identity,int):continue
        point=item if kind=='node' else item.get('center',{})
        lat,lon=point.get('lat'),point.get('lon')
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not BBOX[0]<=lat<=BBOX[2] or not BBOX[1]<=lon<=BBOX[3]:continue
        results.append({'id':f'{kind}-{identity}','name':str(tags.get('name') or tags.get('name:en') or f'Unnamed mapped water body (OSM {kind} {identity})')[:160],'type':water_type,'latitude':lat,'longitude':lon,'aliases':[str(v)[:160] for k,v in tags.items() if k.startswith('name:')],'tags':tags,'osm_type':kind,'osm_id':identity})
    return results

def import_registry(db,payload):
    added=0
    for row in candidates(payload):
        wb_id='wb-osm-'+row['id'];source_id='src-osm-'+row['id']
        if db.get(WaterBody,wb_id):continue
        wb=WaterBody(id=wb_id,name=row['name'],type=row['type'],latitude=row['latitude'],longitude=row['longitude'],locality='Bengaluru region',aliases=row['aliases'],synthetic=False,geometry={'type':'Point','coordinates':[row['longitude'],row['latitude']]},summary='OpenStreetMap starter identity. Position is the mapped feature centre; extent, water-body classification and institutional responsibility need local review. Environmental condition is not assessed.',data={'osm_type':row['osm_type'],'osm_id':row['osm_id'],'registry_review_state':'community_mapped_starter','responsible_organisation_id':None})
        db.add(wb);db.flush()
        db.add(Source(id=source_id,waterbody_id=wb.id,name='OpenStreetMap contributors · Bengaluru starter',kind='registry',url=f"https://www.openstreetmap.org/{row['osm_type']}/{row['osm_id']}",license='ODbL-1.0',attribution='© OpenStreetMap contributors',synthetic=False,data={'osm_tags':row['tags'],'osm_snapshot_at':payload.get('osm3s',{}).get('timestamp_osm_base'),'imported_at':utcnow(),'bounding_box':BBOX,'notice':'Community mapping; not an official municipal registry or water-condition assessment.'}))
        added+=1
    db.commit();return added

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--file',type=Path,required=True);parser.add_argument('--fetch',action='store_true');parser.add_argument('--commit',action='store_true');args=parser.parse_args()
    payload=fetch_snapshot(args.file) if args.fetch else json.loads(args.file.read_text(encoding='utf-8'))
    rows=candidates(payload);print(f'{len(rows)} community-mapped water-body identities in the Bengaluru-region bounding box. Licence: ODbL-1.0. No incidents, measurements or authority assignments imported.')
    if args.commit:
        with SessionLocal() as db:print(f'Added {import_registry(db,payload)} new identities. Existing records preserved.')

if __name__=='__main__':main()
