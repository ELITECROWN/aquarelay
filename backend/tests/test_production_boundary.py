from test_foundation import client, login


def test_production_rejects_demo_login_and_existing_session(client, monkeypatch):
    login(client)
    monkeypatch.setenv('DEMO_MODE', 'false')
    assert client.get('/api/v1/auth/session').json()['user'] is None
    csrf = client.get('/api/v1/auth/session').json()['csrf_token']
    result = client.post('/api/v1/auth/login', json={'email': 'citizen@demo.aquarelay.local', 'password': 'DemoPass123!'}, headers={'X-CSRF-Token': csrf})
    assert result.status_code == 401


def test_production_hides_synthetic_registry_and_cases_without_deleting(client, monkeypatch):
    from app import core
    from app.db import SessionLocal
    from app.models import WaterBody
    monkeypatch.setattr(core, 'DEMO_MODE', False)
    assert client.get('/api/v1/waterbodies').json()['total'] == 0
    assert client.get('/api/v1/cases').json()['total'] == 0
    assert client.get('/api/v1/waterbodies/wb-reedwater').status_code == 404
    assert client.get('/api/v1/cases/case-current').status_code == 404
    with SessionLocal() as db:
        assert db.get(WaterBody, 'wb-reedwater') is not None


def test_production_keeps_real_accounts_available(client, monkeypatch):
    csrf = client.get('/api/v1/auth/session').json()['csrf_token']
    result = client.post('/api/v1/auth/register', json={'email': 'real@example.org', 'name': 'Real Citizen', 'password': 'ARealStrongPassword123!'}, headers={'X-CSRF-Token': csrf})
    assert result.status_code == 201
    monkeypatch.setenv('DEMO_MODE', 'false')
    assert client.get('/api/v1/auth/session').json()['user']['email'] == 'real@example.org'


def test_production_cannot_register_reserved_demo_email(client, monkeypatch):
    monkeypatch.setenv('DEMO_MODE', 'false')
    csrf = client.get('/api/v1/auth/session').json()['csrf_token']
    result = client.post('/api/v1/auth/register', json={'email': 'new@demo.aquarelay.local', 'name': 'Demo imposter', 'password': 'ARealStrongPassword123!'}, headers={'X-CSRF-Token': csrf})
    assert result.status_code == 422


def test_large_registry_only_builds_records_for_requested_page(client, monkeypatch):
    from app import core
    from app.db import SessionLocal
    from app.models import WaterBody
    with SessionLocal() as db:
        db.add_all([WaterBody(id=f'wb-real-{i}',name=f'Real lake {i:03}',type='lake',locality='Bengaluru',latitude=12.97,longitude=77.59,synthetic=False) for i in range(150)])
        db.commit()
    original=core.waterbody_json
    built=[]
    def record(db,row,*args,**kwargs):
        built.append(row.id)
        return original(db,row,*args,**kwargs)
    monkeypatch.setattr(core,'waterbody_json',record)
    result=client.get('/api/v1/waterbodies?q=Real&page=2&page_size=10').json()
    assert result['total']==150
    assert len(result['items'])==10
    assert len(built)==10


def test_production_excludes_synthetic_children_from_real_passport(client, monkeypatch):
    from app import core
    from app.db import SessionLocal
    from app.models import WaterBody,Source,Observation
    with SessionLocal() as db:
        db.add(WaterBody(id='wb-real',name='Real lake',type='lake',locality='Bengaluru',latitude=12.97,longitude=77.59,synthetic=False))
        db.flush()
        db.add(Source(id='src-test-only',waterbody_id='wb-real',name='Synthetic source',kind='registry',synthetic=True))
        db.flush()
        db.add(Observation(id='obs-test-only',waterbody_id='wb-real',source_id='src-test-only',parameter='ph',value=7,unit='1',observed_at='2026-10-03T00:00:00Z',synthetic=True))
        db.commit()
    monkeypatch.setenv('DEMO_MODE','false')
    monkeypatch.setattr(core,'DEMO_MODE',False)
    result=client.get('/api/v1/waterbodies/wb-real').json()
    assert result['sources']==[]
    assert result['observations']==[]


def test_map_includes_registry_beyond_list_page_and_actual_open_case_counts(client):
    from app.db import SessionLocal
    from app.models import WaterBody,Case
    with SessionLocal() as db:
        db.add_all([WaterBody(id=f'map-lake-{i}',name=f'Map lake {i}',type='lake',locality='Bengaluru',latitude=12.97,longitude=77.59) for i in range(120)])
        db.flush()
        db.add_all([Case(id='map-open',waterbody_id='map-lake-110',title='Observation',description='Observed',observed_at='2026-10-03T00:00:00Z',state='investigating'),Case(id='map-closed',waterbody_id='map-lake-110',title='Previous',description='Documented',observed_at='2026-10-03T00:00:00Z',state='closed')])
        db.commit()
    response=client.get('/api/v1/waterbodies/map?q=Map lake')
    assert response.status_code==200,response.text
    result=response.json()
    assert result['total']==120 and len(result['items'])==120
    assert next(x for x in result['items'] if x['id']=='map-lake-110')['case_count']==1
    assert result['truncated'] is False


def test_real_account_following_demo_before_launch_does_not_fail_after_launch(client,monkeypatch):
    from app import core
    csrf=client.get('/api/v1/auth/session').json()['csrf_token']
    result=client.post('/api/v1/auth/register',json={'email':'follower@example.org','name':'Real Follower','password':'ARealStrongPassword123!'},headers={'X-CSRF-Token':csrf})
    headers={'X-CSRF-Token':result.json()['csrf_token']}
    assert client.post('/api/v1/following/wb-reedwater',headers=headers).status_code==200
    from app.db import SessionLocal
    from app.models import Notification
    with SessionLocal() as db:
        db.add(Notification(id='old-demo-notice',user_id=result.json()['user']['id'],event_id='event-closure',waterbody_id='wb-reedwater',title='Demo update',description='Synthetic fixture'))
        db.commit()
    monkeypatch.setenv('DEMO_MODE','false')
    monkeypatch.setattr(core,'DEMO_MODE',False)
    response=client.get('/api/v1/following')
    assert response.status_code==200
    assert response.json()['waterbodies']==[]
    notifications=client.get('/api/v1/notifications')
    assert notifications.status_code==200
    assert notifications.json()['items']==[]
