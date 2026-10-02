"""Adopt a matching unversioned demo schema, then run ordinary immutable migrations."""
import argparse
import importlib.util
from pathlib import Path
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine,inspect
from .db import engine

BASELINE="1f3029b64e19"
ROOT=Path(__file__).resolve().parents[1]

def signature(inspector,table):
    columns={c["name"]:(c["type"]._type_affinity.__name__,c["nullable"],bool(c.get("primary_key"))) for c in inspector.get_columns(table)}
    pk=tuple(inspector.get_pk_constraint(table)["constrained_columns"])
    unique={tuple(c["column_names"]) for c in inspector.get_unique_constraints(table)}
    fks={(tuple(c["constrained_columns"]),c["referred_table"],tuple(c["referred_columns"])) for c in inspector.get_foreign_keys(table)}
    indexes={(i["name"],tuple(i["column_names"]),bool(i["unique"])) for i in inspector.get_indexes(table)}
    return {"columns":columns,"primary_key":pk,"unique_constraints":unique,"foreign_keys":fks,"indexes":indexes}

def verify_baseline(candidate):
    scratch=create_engine("sqlite:///:memory:")
    spec=importlib.util.spec_from_file_location("immutable_baseline",ROOT/"migrations"/"versions"/"1f3029b64e19_canonical_relational_baseline.py")
    baseline=importlib.util.module_from_spec(spec); spec.loader.exec_module(baseline)
    with scratch.begin() as connection:
        baseline.op=Operations(MigrationContext.configure(connection))
        baseline.upgrade()
    expected,actual=inspect(scratch),inspect(candidate)
    expected_tables=set(expected.get_table_names())
    actual_tables=set(actual.get_table_names())-{"alembic_version"}
    mismatches=[]
    if expected_tables!=actual_tables:
        mismatches.append("table set differs from immutable baseline")
    for table in sorted(expected_tables & actual_tables):
        wanted,got=signature(expected,table),signature(actual,table)
        for part in wanted:
            if wanted[part]!=got[part]: mismatches.append(f"{table}: {part} differs from immutable baseline")
    scratch.dispose()
    return mismatches

def migrate(adopt_existing=False):
    cfg=Config(str(ROOT/"alembic.ini")); cfg.set_main_option("script_location",str(ROOT/"migrations")); cfg.set_main_option("prepend_sys_path",str(ROOT))
    tables=set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        current_revision=MigrationContext.configure(connection).get_current_revision()
    if tables-{"alembic_version"} and not current_revision:
        if not adopt_existing:
            raise SystemExit("Existing unversioned schema detected. Run --adopt-existing for strict baseline validation; no records changed.")
        mismatches=verify_baseline(engine)
        if mismatches:
            raise SystemExit("Schema adoption refused; no records changed:\n"+"\n".join(mismatches))
        command.stamp(cfg,BASELINE)
        print("Existing schema matched immutable baseline. Adopted version without deleting records.")
    command.upgrade(cfg,"head")

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--adopt-existing",action="store_true");args=parser.parse_args()
    migrate(args.adopt_existing)
