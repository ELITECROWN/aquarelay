"""Opt-in real PostgreSQL regression; uses a temporary schema in a dedicated test DB."""
import os
import threading
import uuid
import importlib.util
from pathlib import Path
import pytest
from sqlalchemy import create_engine,select,text
from sqlalchemy.orm import Session


def test_postgis_migration_compiles_an_empty_geometry_guard():
    """Exercise the offline migration renderer rather than matching source text."""
    import subprocess,sys
    env={**os.environ,"DATABASE_URL":"postgresql+psycopg://test:test@localhost/test"}
    result=subprocess.run([sys.executable,"-m","alembic","upgrade","head","--sql"],cwd=Path(__file__).resolve().parents[1],env=env,capture_output=True,text=True,timeout=30)
    assert result.returncode==0,result.stderr
    statement=next(part for part in result.stdout.split(";") if "ADD COLUMN geom geometry" in part)
    assert "CASE WHEN geometry->>'type' IS NOT NULL" in statement
    assert "ELSE NULL END" in statement


@pytest.mark.skipif(not os.getenv("POSTGRES_TEST_URL"),reason="POSTGRES_TEST_URL and a running dedicated PostgreSQL test database are required")
def test_postgis_accepts_missing_json_null_and_supplied_geometry():
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.db import Base
    from app.models import WaterBody
    schema="aqgeom_"+uuid.uuid4().hex
    admin=create_engine(os.environ["POSTGRES_TEST_URL"])
    with admin.begin() as connection: connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    candidate=create_engine(os.environ["POSTGRES_TEST_URL"],connect_args={"options":f"-csearch_path={schema},public"})
    try:
        Base.metadata.create_all(candidate)
        path=Path(__file__).resolve().parents[1]/"migrations"/"versions"/"002_postgis_spatial.py"
        spec=importlib.util.spec_from_file_location("spatial_migration",path)
        spatial=importlib.util.module_from_spec(spec);spec.loader.exec_module(spatial)
        with candidate.begin() as connection:
            spatial.op=Operations(MigrationContext.configure(connection));spatial.upgrade()
        with Session(candidate) as db:
            for suffix,geometry in [("empty",{}),("null",None),("point",{"type":"Point","coordinates":[77.587,12.979]})]:
                db.add(WaterBody(id="wb-"+suffix,name="Synthetic missing geometry fixture",type="pond",locality="Test",latitude=12.979,longitude=77.587,geometry=geometry,synthetic=True))
            db.commit()
        with candidate.connect() as connection:
            rows=dict(connection.execute(text("SELECT id,ST_AsText(geom) FROM waterbodies")).all())
            assert rows["wb-empty"] is None
            assert rows["wb-null"] is None
            assert rows["wb-point"]=="POINT(77.587 12.979)"
    finally:
        candidate.dispose()
        with admin.begin() as connection: connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()

@pytest.mark.skipif(not os.getenv("POSTGRES_TEST_URL"),reason="POSTGRES_TEST_URL and a running dedicated PostgreSQL test database are required")
def test_event_cursor_cannot_advance_past_an_uncommitted_prior_event():
    from app.db import Base
    from app.models import Event,WaterBody
    from app.core import emit_event
    schema="aqtest_"+uuid.uuid4().hex
    admin=create_engine(os.environ["POSTGRES_TEST_URL"])
    with admin.begin() as conn: conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    candidate=create_engine(os.environ["POSTGRES_TEST_URL"],connect_args={"options":f"-csearch_path={schema},public"})
    try:
        Base.metadata.create_all(candidate)
        with candidate.begin() as conn: conn.execute(text("CREATE SEQUENCE public_event_cursor_seq AS bigint START WITH 1"))
        with Session(candidate) as db:
            db.add(WaterBody(id="wb-order-test",name="Synthetic event ordering fixture",type="pond",locality="Test",latitude=1,longitude=1,geometry={"type":"Point","coordinates":[1,1]},synthetic=True));db.commit()
        emitted=threading.Event();finished=threading.Event();errors=[]
        first=Session(candidate)
        e1=emit_event(first,"wb-order-test",None,"test","First event","Synthetic transaction ordering test",None)
        def second_transaction():
            try:
                with Session(candidate) as second:
                    emitted.set()
                    emit_event(second,"wb-order-test",None,"test","Second event","Synthetic transaction ordering test",None)
                    second.commit()
            except Exception as exc: errors.append(exc)
            finally: finished.set()
        thread=threading.Thread(target=second_transaction);thread.start()
        assert emitted.wait(5)
        assert not finished.wait(.4),"Second event committed before the earlier event; an SSE cursor could skip it"
        first.commit();first.close()
        assert finished.wait(5)
        thread.join(5)
        assert not errors
        with Session(candidate) as db:
            rows=list(db.scalars(select(Event).order_by(Event.sequence)))
            assert [row.title for row in rows]==["First event","Second event"]
            assert rows[0].sequence<rows[1].sequence
    finally:
        candidate.dispose()
        with admin.begin() as conn: conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
