from test_foundation import client

def test_osm_registry_preserves_identity_provenance_and_does_not_create_conditions(client):
    from app.osm_registry import import_registry
    from app.db import SessionLocal
    from app.models import WaterBody,Source,Case
    from sqlalchemy import select,func
    payload={'osm3s':{'timestamp_osm_base':'2026-10-03T00:00:00Z'},'elements':[{'type':'way','id':123,'center':{'lat':12.97,'lon':77.59},'tags':{'natural':'water','water':'lake','name':'OSM named lake'}}]}
    with SessionLocal() as db:
        count=db.scalar(select(func.count()).select_from(Case))
        assert import_registry(db,payload)==1
        assert import_registry(db,payload)==0
        wb=db.get(WaterBody,'wb-osm-way-123')
        assert wb.name=='OSM named lake' and not wb.synthetic
        source=db.get(Source,'src-osm-way-123')
        assert source.license=='ODbL-1.0'
        assert source.url=='https://www.openstreetmap.org/way/123'
        assert db.scalar(select(func.count()).select_from(Case))==count

def test_osm_registry_skips_outside_region_and_nonwater_records(client):
    from app.osm_registry import candidates
    assert candidates({'elements':[{'type':'way','id':1,'center':{'lat':20,'lon':77},'tags':{'natural':'water'}},{'type':'node','id':2,'lat':12.97,'lon':77.59,'tags':{'amenity':'cafe'}}]})==[]

def test_osm_does_not_guess_unclassified_water_features_are_lakes():
    from app.osm_registry import candidates
    elements=[{'type':'way','id':i,'center':{'lat':12.97,'lon':77.59},'tags':{'natural':'water',**tags}} for i,tags in enumerate([{}, {'water':'drain'}, {'water':'basin'}, {'water':'stream'}, {'water':'pond'}, {'water':'lake'}, {'water':'canal'}],1)]
    rows=candidates({'elements':elements})
    assert [(r['id'],r['type']) for r in rows]==[('way-4','stream'),('way-5','pond'),('way-6','lake'),('way-7','canal')]
