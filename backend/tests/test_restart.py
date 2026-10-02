"""Process-boundary proof of SQL/file durability; never touches the application database."""
import json
import os
from pathlib import Path
import subprocess
import sys
from conftest import TEST_ROOT

def test_migrations_seed_report_and_files_survive_new_process():
    runtime=TEST_ROOT/"restart-runtime"
    runtime.mkdir(exist_ok=True)
    env={**os.environ,"DATABASE_URL":"sqlite:///"+str(runtime/"durable.sqlite").replace("\\","/"),"STORAGE_PATH":str(runtime/"files"),"EMBEDDED_WORKER":"false","DEMO_MODE":"true"}
    cwd=Path(__file__).resolve().parents[1]
    migration=subprocess.run([sys.executable,"-m","alembic","upgrade","head"],cwd=cwd,env=env,capture_output=True,text=True,timeout=30)
    assert migration.returncode==0,migration.stderr
    script="""
import io,json
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.db import SessionLocal
from app.models import Evidence
from sqlalchemy import select
with TestClient(app) as c:
 csrf=c.get('/api/v1/auth/session').json()['csrf_token']
 user=c.post('/api/v1/auth/login',json={'email':'citizen@demo.aquarelay.local','password':'DemoPass123!'},headers={'X-CSRF-Token':csrf}).json()['user']
 headers={'X-CSRF-Token':user['csrf_token']}
 image=io.BytesIO();Image.new('RGB',(20,20),'blue').save(image,'PNG')
 e=c.post('/api/v1/evidence',files={'file':('demo.png',image.getvalue(),'image/png')},data={'synthetic':'true'},headers=headers).json()
 r=c.post('/api/v1/reports',json={'client_id':'restart-client-report','waterbody_id':'wb-reedwater','observation_type':'unsure','description':'Synthetic persisted observation, cause unknown.','observed_at':'2026-09-30T10:00:00Z','synthetic':True,'evidence_ids':[e['id']]},headers=headers)
 assert r.status_code==201,r.text
 print(json.dumps({'case_id':r.json()['case_id'],'evidence_id':e['id']}))
"""
    created=subprocess.run([sys.executable,"-c",script],cwd=cwd,env=env,capture_output=True,text=True,timeout=30)
    assert created.returncode==0,created.stderr
    ids=json.loads(created.stdout.strip())
    check="""
import json,sys
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models import Evidence
ids=json.loads(sys.argv[1])
with TestClient(app) as c:
 detail=c.get('/api/v1/cases/'+ids['case_id']).json()
 assert detail['reports'][0]['description']=='Synthetic persisted observation, cause unknown.'
 assert c.get('/api/v1/evidence/'+ids['evidence_id']+'/file').status_code==200
 with SessionLocal() as db:
  row=db.get(Evidence,ids['evidence_id'])
  assert Path(row.original_path).is_file() and Path(row.public_path).is_file()
 print('Persisted report and both stored media files verified in new process')
"""
    restarted=subprocess.run([sys.executable,"-c",check,json.dumps(ids)],cwd=cwd,env=env,capture_output=True,text=True,timeout=30)
    assert restarted.returncode==0,restarted.stderr
    assert "verified in new process" in restarted.stdout


def test_unversioned_demo_schema_adoption_checks_match_and_keeps_records():
    from sqlalchemy import create_engine,text,select,func
    from sqlalchemy.orm import Session
    from app.db import Base
    from app.seed import seed
    from app.models import WaterBody
    candidate=create_engine("sqlite:///"+str(TEST_ROOT/"adoption.sqlite").replace("\\","/"))
    Base.metadata.create_all(candidate)
    with Session(candidate) as db: seed(db)
    from app.migrate import verify_baseline
    assert verify_baseline(candidate)==[]
    with candidate.begin() as connection: connection.execute(text("ALTER TABLE waterbodies ADD COLUMN unapproved TEXT"))
    mismatches=verify_baseline(candidate)
    assert any("waterbodies" in item and "columns" in item for item in mismatches)
    with Session(candidate) as db:
        assert db.scalar(select(func.count()).select_from(WaterBody))==7


def test_interrupted_empty_version_table_is_adopted_only_after_baseline_check():
    from sqlalchemy import create_engine,text,select,func
    from sqlalchemy.orm import Session
    from app.db import Base
    from app.seed import seed
    from app.models import WaterBody
    path=TEST_ROOT/"interrupted-adoption.sqlite"
    database_url="sqlite:///"+str(path).replace("\\","/")
    candidate=create_engine(database_url)
    Base.metadata.create_all(candidate)
    with Session(candidate) as db: seed(db)
    with candidate.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))
    env={**os.environ,"DATABASE_URL":database_url,"EMBEDDED_WORKER":"false"}
    result=subprocess.run([sys.executable,"-m","app.migrate","--adopt-existing"],cwd=Path(__file__).resolve().parents[1],env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr+result.stdout
    with candidate.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar()=="002_postgis_spatial"
    with Session(candidate) as db:
        assert db.scalar(select(func.count()).select_from(WaterBody))==7
