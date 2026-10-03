from test_foundation import client


def test_readiness_distinguishes_demo_from_production(client):
    result=client.get('/ready')
    assert result.status_code==200
    assert result.json()=={'status':'ready','production':False}


def test_readiness_hides_database_errors_and_returns_unavailable(client,monkeypatch):
    from app import main
    def unavailable():
        raise RuntimeError('postgres://user:SECRET@example/database')
    monkeypatch.setattr(main,'SessionLocal',unavailable)
    result=client.get('/ready')
    assert result.status_code==503
    assert 'SECRET' not in result.text
