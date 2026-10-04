from fastapi.testclient import TestClient
from app.main import app
from app import core

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
