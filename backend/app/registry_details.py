"""Public mapped identity details. Descriptive labels are never official names."""
import json, math
from pathlib import Path
from sqlalchemy import select
from .models import WaterBody, Source
from .osm_registry import REGIONS
VERSION='2026-10-04-v1'

def mapped_name(tags):
    return next((str(tags[k])[:160] for k in ('name','name:en','official_name','loc_name','name:bn','name:ta','name:kn') if tags.get(k)),None)

def identity_details(tags,region,kind,lat,lon,anchors):
    names=list(dict.fromkeys(str(v)[:160] for k,v in tags.items() if k.startswith('name:') or k in ('name','official_name','loc_name','alt_name')))
    found=[]
    for a in anchors:
        point=a if a.get('type')=='node' else a.get('center',{})
        if not mapped_name(a.get('tags',{})) or 'lat' not in point or 'lon' not in point:continue
        dy=math.radians(point['lat']-lat);dx=math.radians(point['lon']-lon)
        distance=6371000*math.sqrt(dy*dy+(dx*math.cos(math.radians(lat)))**2)
        if distance<=2000:found.append((distance,a))
    nearby=min(found,key=lambda x:x[0]) if found else None
    d={'name_status':'Community-mapped name; local verification pending' if mapped_name(tags) else 'Local name not recorded','mapped_name':mapped_name(tags),'mapped_names':names,'coordinate_notice':'Mapped feature centre; not a surveyed address or boundary','region':REGIONS.get(region,{}).get('label',region),'checked_at':'2026-10-04'}
    for k in ('description','intermittent','seasonal','access','operator','wikidata','wikipedia'):
        if tags.get(k):d[k]=str(tags[k])[:2000]
    if nearby:
        distance,a=nearby;d.update(nearby_place=mapped_name(a['tags']),nearby_place_distance_m=round(distance),nearby_place_url=f"https://www.openstreetmap.org/{a['type']}/{a['id']}")
    return d

def enrich_registry(db,anchors):
    sources={s.waterbody_id:s for s in db.scalars(select(Source).where(Source.id.like('src-osm-%')))}
    changed=0
    for wb in db.scalars(select(WaterBody).where(WaterBody.synthetic.is_(False),WaterBody.id.like('wb-osm-%'))):
        if wb.data.get('identity_details_version')==VERSION:continue
        source=sources.get(wb.id)
        if not source:continue
        region=source.data.get('region') or wb.data.get('region') or 'bengaluru'
        d=identity_details(source.data.get('osm_tags',{}),region,wb.type,wb.latitude,wb.longitude,anchors)
        aliases=list(wb.aliases or [])
        if wb.name.startswith('Unnamed mapped water body (OSM '):
            aliases.append(wb.name)
            place=d.get('nearby_place') or REGIONS.get(region,{}).get('label',wb.locality)
            wb.name=d['mapped_name'] or f'Mapped {wb.type} near {place} ({wb.latitude:.4f}, {wb.longitude:.4f})'
            wb.name=wb.name[:160]
        elif 'provisional identity' in wb.name:d['name_status']='Desk-reviewed identity; local confirmation pending'
        wb.aliases=list(dict.fromkeys(aliases+d['mapped_names']))
        wb.data={**wb.data,'identity_details':d,'identity_details_version':VERSION};changed+=1
    db.commit();return changed

def enrich_bundled_registry(db):
    path=Path(__file__).resolve().parent.parent/'registry'/'place-anchors-osm-2026-10-04.json'
    anchors=json.loads(path.read_text(encoding='utf-8'))['elements'] if path.exists() else []
    return enrich_registry(db,anchors)
