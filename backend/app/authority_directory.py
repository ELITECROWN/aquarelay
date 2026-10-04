"""Source-linked public office contacts; directory inclusion never assigns a case."""
import json
from pathlib import Path
from sqlalchemy import select
from .models import Organisation
from .osm_registry import REGIONS

DIRECTORY=Path(__file__).resolve().parent.parent/'registry'/'authority-directory-2026-10-04.json'


def import_directory(db,entries):
    added=0
    for entry in entries:
        if db.get(Organisation,entry['id']):continue
        data={k:entry.get(k) for k in ('address','email','phone','kind','service_regions','places','checked_at','contact_note')}
        data.update(contact_sources=entry['sources'],directory_contact=True,verification='Public contact details checked against cited sources; institutional account is not verified.')
        db.add(Organisation(id=entry['id'],name=entry['name'],description=entry['description'],contact=entry['email'],synthetic=False,data=data));added+=1
    db.commit()
    return added


def seed_directory(db):
    return import_directory(db,json.loads(DIRECTORY.read_text(encoding='utf-8')))


def regional_contacts(db,waterbody):
    if waterbody.synthetic:return []
    from .core import organisation_json
    region=waterbody.data.get('region')
    if region not in REGIONS:
        region=next((key for key,value in REGIONS.items() if value['bbox'][0]<=waterbody.latitude<=value['bbox'][2] and value['bbox'][1]<=waterbody.longitude<=value['bbox'][3]),None)
    if not region:return []
    contacts=[]
    for org in db.scalars(select(Organisation).where(Organisation.synthetic.is_(False)).order_by(Organisation.name)):
        if org.data.get('directory_contact') and region in (org.data.get('service_regions') or []):
            contacts.append({**organisation_json(org),'match_kind':'regional_contact'})
    return contacts
