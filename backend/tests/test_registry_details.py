from test_foundation import client

def test_enrichment_preserves_reviewed_names_and_reports_unknowns(client):
    from app.registry_details import enrich_registry
    from app.db import SessionLocal
    from app.models import WaterBody, Source
    with SessionLocal() as db:
        wb=WaterBody(id='wb-osm-way-70001',name='Unnamed mapped water body (OSM way 70001)',type='pond',latitude=12.82,longitude=80.04,locality='Potheri region',synthetic=False,data={})
        db.add(wb);db.flush();db.add(Source(id='src-osm-way-70001',waterbody_id=wb.id,name='OSM',kind='registry',synthetic=False,data={'osm_tags':{'intermittent':'yes','alt_name':'Community pond'},'region':'potheri'}));db.commit()
        assert enrich_registry(db,[])==1
        assert wb.name.startswith('Mapped pond') and '12.8200' in wb.name
        assert wb.data['identity_details']['name_status']=='Local name not recorded'
        assert wb.data['identity_details']['intermittent']=='yes'
        assert 'Community pond' in wb.aliases
        wb.name='Field-reviewed pond';db.commit()
        assert enrich_registry(db,[])==0
        assert wb.name=='Field-reviewed pond'

def test_local_language_and_nearby_place_are_sourced():
    from app.registry_details import identity_details
    tags={'name:ta':'Mapped Tamil name','seasonal':'yes'}
    d=identity_details(tags,'potheri','pond',12.82,80.04,[{'type':'node','id':5,'lat':12.82,'lon':80.041,'tags':{'place':'village','name':'Potheri'}}])
    assert d['mapped_name']=='Mapped Tamil name'
    assert d['nearby_place']=='Potheri'
    assert d['nearby_place_url']=='https://www.openstreetmap.org/node/5'
    assert d['seasonal']=='yes'

def test_bundled_localities_have_positions_and_distant_places_are_not_assigned():
    import json
    from pathlib import Path
    from app.registry_details import identity_details
    snapshot=json.loads((Path(__file__).parents[1]/'registry'/'place-anchors-osm-2026-10-04.json').read_text(encoding='utf-8'))
    assert len(snapshot['elements'])>0
    assert all('lat' in point and 'lon' in point for point in snapshot['elements'])
    d=identity_details({},'potheri','pond',12.82,80.04,[{'type':'node','id':9,'lat':13.2,'lon':80.2,'tags':{'place':'town','name':'Far away'}}])
    assert 'nearby_place' not in d
