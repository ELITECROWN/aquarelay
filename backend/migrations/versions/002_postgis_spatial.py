"""PostGIS spatial points, geometry and radius-query indexes.

SQLite remains an explicit local fallback using Haversine distance.
"""
from alembic import op

revision="002_postgis_spatial"
down_revision="1f3029b64e19"
branch_labels=None
depends_on=None

def upgrade():
    if op.get_bind().dialect.name!="postgresql": return
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE SEQUENCE public_event_cursor_seq AS bigint START WITH 1")
    op.execute("SELECT setval('public_event_cursor_seq',GREATEST(COALESCE((SELECT MAX(sequence) FROM events),0)+1,(EXTRACT(EPOCH FROM now())*1000000)::bigint),false)")
    op.execute("ALTER TABLE waterbodies ADD COLUMN geog geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography) STORED")
    op.execute("ALTER TABLE waterbodies ADD COLUMN geom geometry(Geometry,4326) GENERATED ALWAYS AS (CASE WHEN geometry->>'type' IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326) ELSE NULL END) STORED")
    op.execute("CREATE INDEX ix_waterbodies_geog ON waterbodies USING GIST (geog)")
    op.execute("CREATE INDEX ix_waterbodies_geom ON waterbodies USING GIST (geom)")
    op.execute("ALTER TABLE monitoring_sites ADD COLUMN geog geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography) STORED")
    op.execute("CREATE INDEX ix_monitoring_sites_geog ON monitoring_sites USING GIST (geog)")

def downgrade():
    if op.get_bind().dialect.name!="postgresql": return
    op.execute("DROP SEQUENCE public_event_cursor_seq")
    op.execute("DROP INDEX ix_monitoring_sites_geog")
    op.execute("ALTER TABLE monitoring_sites DROP COLUMN geog")
    op.execute("DROP INDEX ix_waterbodies_geom")
    op.execute("DROP INDEX ix_waterbodies_geog")
    op.execute("ALTER TABLE waterbodies DROP COLUMN geom")
    op.execute("ALTER TABLE waterbodies DROP COLUMN geog")
