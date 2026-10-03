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


def test_regional_registry_imports_requested_locations_and_keeps_source_details(client):
    from app.osm_registry import import_registry
    from app.db import SessionLocal
    from app.models import WaterBody,Source
    regions=[('sodepur-barrackpore',22.74,88.38,'Sodepur–Barrackpore region, West Bengal'),('potheri',12.82,80.04,'Potheri region, Tamil Nadu')]
    with SessionLocal() as db:
        for i,(region,lat,lon,locality) in enumerate(regions,900):
            payload={'aquarelay_registry':{'region':region},'elements':[{'type':'way','id':i,'center':{'lat':lat,'lon':lon},'tags':{'natural':'water','water':'pond','name':'Mapped field pond','name:ta':'குளம்','description':'Community-mapped pond beside the village'}}]}
            assert import_registry(db,payload)==1
            assert import_registry(db,payload)==0
            wb=db.get(WaterBody,f'wb-osm-way-{i}')
            assert wb.locality==locality
            assert 'Community-mapped pond beside the village' in wb.summary
            source=db.get(Source,f'src-osm-way-{i}')
            assert source.data['region']==region and source.data['osm_tags']['name:ta']=='குளம்'
            assert source.license=='ODbL-1.0'


def test_regional_registry_filters_to_its_own_box_and_rejects_unknown_region():
    import pytest
    from app.osm_registry import candidates
    p={'aquarelay_registry':{'region':'potheri'},'elements':[{'type':'way','id':991,'center':{'lat':22.74,'lon':88.38},'tags':{'natural':'water','water':'pond'}}]}
    assert candidates(p)==[]
    p['aquarelay_registry']['region']='unknown-region'
    with pytest.raises(ValueError,match='region'):candidates(p)


def test_registry_includes_explicit_streams_and_canals_without_guessing_drains():
    from app.osm_registry import candidates
    p={'aquarelay_registry':{'region':'potheri'},'elements':[{'type':'way','id':i,'center':{'lat':12.82,'lon':80.04},'tags':{'waterway':kind}} for i,kind in enumerate(['stream','canal','drain','ditch','river'],980)]}
    assert [(r['id'],r['type']) for r in candidates(p)]==[('way-980','stream'),('way-981','canal')]


def test_desk_review_details_keep_original_osm_tags_and_separate_reference_source(client):
    from app.osm_registry import import_registry
    from app.db import SessionLocal
    from app.models import WaterBody,Source
    payload={'aquarelay_registry':{'region':'potheri','identity_details':{'way-997':{'name':'Documented lake (provisional identity)','summary':'Historical publication documents a cleanup. Local identity confirmation remains pending.','sources':[{'name':'Published field account','url':'https://example.org/field-report','license':'Public factual citation; document rights retained by publisher','attribution':'Field publisher'}]}}},'elements':[{'type':'way','id':997,'center':{'lat':12.82,'lon':80.04},'tags':{'natural':'water','water':'lake'}}]}
    with SessionLocal() as db:
        assert import_registry(db,payload)==1
        wb=db.get(WaterBody,'wb-osm-way-997')
        assert wb.name=='Documented lake (provisional identity)'
        assert 'Local identity confirmation remains pending' in wb.summary
        assert wb.data['registry_review_state']=='desk_reviewed_identity_pending_local_confirmation'
        osm=db.get(Source,'src-osm-way-997')
        assert 'name' not in osm.data['osm_tags']
        ref=db.get(Source,'src-reference-way-997-0')
        assert ref.url=='https://example.org/field-report' and ref.kind=='reference'
