from fastapi.testclient import TestClient
from app.main import app
from app import core
from app.db import engine, SessionLocal
from sqlalchemy import event, select

def test_batched_summaries_preserve_record_values():
    with TestClient(app), SessionLocal() as db:
        rows=list(db.scalars(select(core.WaterBody).order_by(core.WaterBody.name)))
        expected=[core.waterbody_json(db,row) for row in rows]
        assert core.waterbody_page_json(db,rows)==expected

def test_explorer_passport_can_skip_nearby_work(monkeypatch):
    with TestClient(app) as client:
        original=core.waterbody_page_json
        def forbidden(*args,**kwargs):
            raise AssertionError('Explore sidebar must not load nearby summaries')
        monkeypatch.setattr(core,'waterbody_page_json',forbidden)
        response=client.get('/api/v1/waterbodies/wb-reedwater?include_nearby=false')
        assert response.status_code==200
        assert response.json()['nearby']==[]
        assert response.json()['waterbody']['id']=='wb-reedwater'
        monkeypatch.setattr(core,'waterbody_page_json',original)
        full=client.get('/api/v1/waterbodies/wb-reedwater')
        assert full.status_code==200
        assert full.json()['waterbody']==response.json()['waterbody']

def test_registry_page_uses_bounded_selects():
    with TestClient(app) as client:
        selects=[]
        def capture(conn,cursor,statement,parameters,context,executemany):
            if statement.lstrip().upper().startswith('SELECT'):selects.append(statement)
        event.listen(engine,'before_cursor_execute',capture)
        try:
            response=client.get('/api/v1/waterbodies?page_size=100')
        finally:
            event.remove(engine,'before_cursor_execute',capture)
        assert response.status_code==200
        assert len(response.json()['items'])>=7
        assert len(selects)<=12, len(selects)

def test_identity_lookup_skips_expensive_summaries(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('Lookup must not calculate monitoring summaries')
    with TestClient(app) as client:
        monkeypatch.setattr(core,'waterbody_json',forbidden)
        response=client.get('/api/v1/waterbodies?identity_only=true&page_size=20')
        assert response.status_code==200
        records=response.json()['items']
        assert records
        assert {'id','name','locality','latitude','longitude','synthetic'} <= records[0].keys()
        narrowed=client.get('/api/v1/waterbodies',params={'identity_only':'true','q':records[0]['name']}).json()
        assert any(item['id']==records[0]['id'] for item in narrowed['items'])
