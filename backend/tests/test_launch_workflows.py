from test_foundation import client, login

def admin(client):
    from app.db import SessionLocal
    from app.models import User
    with SessionLocal() as db:
        u=db.get(User,'user-manager');u.role='admin';db.commit()
    return login(client,'manager@demo.aquarelay.local')

def test_registry_requires_admin_and_preserves_provenance(client):
    payload={'name':'Bengaluru field pond','type':'pond','locality':'Bengaluru','latitude':12.97,'longitude':77.59,'source_name':'Reviewed field registry','source_url':'https://example.org/registry','license':'CC0-1.0'}
    assert client.post('/api/v1/admin/waterbodies',json=payload,headers=login(client)).status_code==403
    r=client.post('/api/v1/admin/waterbodies',json=payload,headers=admin(client))
    assert r.status_code==201,r.text
    record=client.get('/api/v1/waterbodies/'+r.json()['id']).json()
    assert record['waterbody']['synthetic'] is False
    assert record['sources'][0]['license']=='CC0-1.0'

def test_organisation_memberships_are_admin_managed(client):
    headers=admin(client)
    r=client.post('/api/v1/admin/organisations',json={'name':'Bengaluru Field Team','description':'Field monitoring organisation'},headers=headers)
    assert r.status_code==201,r.text
    org=r.json()['id']
    r=client.post('/api/v1/admin/memberships',json={'email':'researcher@demo.aquarelay.local','organisation_id':org,'role':'researcher'},headers=headers)
    assert r.status_code==200,r.text
    assert client.get('/api/v1/auth/session').json()['user']['role']=='admin'

def test_researcher_can_add_biodiversity_but_citizen_cannot(client):
    payload={'waterbody_id':'wb-willow','common_name':'Dragonfly observation','scientific_name':'Anisoptera','observed_at':'2026-09-30T08:00:00Z','source_name':'Field notebook','license':'CC0-1.0'}
    assert client.post('/api/v1/biodiversity',json=payload,headers=login(client)).status_code==403
    r=client.post('/api/v1/biodiversity',json=payload,headers=login(client,'researcher@demo.aquarelay.local'))
    assert r.status_code==201,r.text
    assert any(x['id']==r.json()['id'] for x in client.get('/api/v1/waterbodies/wb-willow').json()['biodiversity'])

def test_retrieval_returns_cited_records_and_no_invented_answer(client):
    r=client.get('/api/v1/waterbodies/wb-reedwater/knowledge?q=cleanup')
    assert r.status_code==200,r.text
    assert r.json()['records']
    assert all(x['id'] and x['href'] for x in r.json()['records'])
    r=client.get('/api/v1/waterbodies/wb-reedwater/knowledge?q=unfindablex')
    assert r.json()['records']==[]

def test_comparison_requires_distinct_public_case_evidence(client):
    r=client.put('/api/v1/cases/case-current/comparison',json={'before_id':'missing','after_id':'missing','before_captured_at':'2026-09-29T08:00:00Z','after_captured_at':'2026-09-30T08:00:00Z','description':'Two views from the bank.'},headers=login(client,'manager@demo.aquarelay.local'))
    assert r.status_code==422,r.text

def test_evidence_checklist_is_organisation_scoped_and_record_linked(client):
    assert client.get('/api/v1/cases/case-current/evidence-checklist',headers=login(client)).status_code==403
    response=client.get('/api/v1/cases/case-current/evidence-checklist',headers=login(client,'manager@demo.aquarelay.local'))
    assert response.status_code==200,response.text
    assert response.json()['requires_review'] is True
    assert 'diagnosis' not in response.json()
