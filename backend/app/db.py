"""Durable SQL storage; SQLite is explicitly a local development fallback."""
import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, with_loader_criteria

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/aquarelay.sqlite")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
if DATABASE_URL.startswith("sqlite:///"):
    Path(DATABASE_URL.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {}, pool_pre_ping=True)
if engine.dialect.name=='postgresql':
    @event.listens_for(engine,'connect')
    def postgres_search_path(connection,_):
        with connection.cursor() as cursor:cursor.execute('SET search_path TO public, extensions')
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")

class Base(DeclarativeBase):
    pass

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

@event.listens_for(SessionLocal, 'do_orm_execute')
def exclude_demonstration_records(execution):
    """Keep fixtures for audit, but never mix them into production ORM reads."""
    if execution.is_select and os.getenv('DEMO_MODE','true').lower()!='true':
        for mapper in Base.registry.mappers:
            model=mapper.class_
            if hasattr(model,'synthetic'):
                execution.statement=execution.statement.options(with_loader_criteria(model,model.synthetic.is_(False),include_aliases=True))

def get_db():
    with SessionLocal() as db:
        yield db
