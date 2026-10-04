from test_foundation import client


def sample_directory():
    return [{'id':'authority-field','name':'Regional Water Contact','description':'Public office for regional environmental enquiries.','email':'office@example.org','address':'Public office, Potheri, Tamil Nadu','phone':'044-12345678','kind':'Pollution control','service_regions':['potheri'],'places':['Potheri','Chengalpattu','Chennai'],'checked_at':'2026-10-04','sources':[{'title':'Official contact directory','url':'https://example.org/contact'}]}]


def test_authority_import_is_idempotent_searchable_and_does_not_assign_cases(client):
    from app.authority_directory import import_directory
    from app.db import SessionLocal
    from app.models import WaterBody,Case
    from sqlalchemy import select,func
    with SessionLocal() as db:
        before=db.scalar(select(func.count()).select_from(Case))
        assert import_directory(db,sample_directory())==1
        assert import_directory(db,sample_directory())==0
        db.add(WaterBody(id='authority-water',name='Field lake',type='lake',locality='Potheri',latitude=12.82,longitude=80.04,synthetic=False,data={'region':'potheri'}));db.commit()
        assert db.scalar(select(func.count()).select_from(Case))==before
    result=client.get('/api/v1/organisations?q=potheri').json()
    assert [o['id'] for o in result['items']]==['authority-field']
    contact=result['items'][0]
    assert contact['address']=='Public office, Potheri, Tamil Nadu'
    assert contact['email']=='office@example.org' and contact['checked_at']=='2026-10-04'
    assert contact['contact_sources'][0]['url']=='https://example.org/contact'
    assert client.get('/api/v1/organisations?q=unmatchedplace').json()['items']==[]
    passport=client.get('/api/v1/waterbodies/authority-water').json()
    assert passport['authorities'][0]['id']=='authority-field'
    assert passport['authorities'][0]['match_kind']=='regional_contact'
    assert passport['organisations']==[]


def test_regional_contacts_use_existing_bengaluru_coordinates_without_explicit_region(client):
    from app.authority_directory import import_directory
    from app.db import SessionLocal
    from app.models import WaterBody
    entry={**sample_directory()[0],'id':'authority-bengaluru','service_regions':['bengaluru'],'places':['Bengaluru']}
    with SessionLocal() as db:
        import_directory(db,[entry]);db.add(WaterBody(id='authority-bengaluru-water',name='Lake',type='lake',locality='Bengaluru region',latitude=12.97,longitude=77.59));db.commit()
    assert client.get('/api/v1/waterbodies/authority-bengaluru-water').json()['authorities'][0]['id']=='authority-bengaluru'
    assert client.get('/api/v1/waterbodies/wb-reedwater').json()['authorities']==[]
