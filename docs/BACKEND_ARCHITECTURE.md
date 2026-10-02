# AquaRelay backend architecture

The backend is a FastAPI modular monolith with SQLAlchemy 2 persistence. `auth.py` owns opaque cookie sessions and memberships; `core.py` owns public registry/passport records and incident workflows; `integrations.py` owns reviewed imports, safe connectors and handoffs; `standards.py` owns explicit export subsets. `storage.py` separates persistent private originals from sanitised public derivatives. `worker.py` consumes SQL jobs rather than relying on an in-memory queue.

## Persistence and transaction boundaries

PostgreSQL/PostGIS is the Compose database. The two immutable Alembic migrations create canonical relational tables and PostGIS generated point/geometry columns with GiST indexes. Missing or JSON-null source geometry produces a null spatial geometry without invoking the GeoJSON parser. Radius queries use `ST_DWithin` on geography in metres. SQLite is an explicit local development/test fallback using the same relational entities and Haversine distances; it is never browser storage.

Reports use unique `(user_id, client_id)` keys. Imported measurements use `(source_id, external_id, parameter)`. Notification recipients/events and job dedup keys are unique. Approved import batches, report creation, workflow changes, public events and outbox jobs commit together. Observed, received, source-updated and created timestamps remain separate UTC ISO values.

The public event cursor fits JavaScript's safe integer range. PostgreSQL allocates its sequence while holding a transaction-scoped advisory lock through commit, preventing a later committed cursor from overtaking an earlier uncommitted event. SQLite's writer transaction serialisation and maximum committed cursor preserve local ordering. SSE reads only committed database events, accepts Last-Event-ID, and sends reconnect instructions and heartbeats. `/api/v1/events` is the polling alternative.

## Identity, privacy and governance

Argon2 hashes passwords. Random opaque session tokens are stored only as SHA-256 hashes in the database, with expiry and rotation on login. Cookies are HttpOnly/SameSite=Lax; production TLS deployments must set COOKIE_SECURE=true. Session mutations require the session's CSRF token and an approved Origin. The webhook route is the sole session-CSRF exemption and enforces its own HMAC/time checks. Restrictive CORS, sign-in rate limiting, public request limiting and a durable per-account report limit are applied.

Organisation case access requires an active membership with a permitted role and matching case assignment. A researcher account's contributor membership grants no authority to close cases. Public serializers omit reporter IDs, email, exact report coordinates, private notes, original files, credential configuration and restricted species locations. They expose organisation attribution for authorised organisational events. Source URLs redact userinfo and credential query fields.

Evidence accepts JPEG/PNG/WebP up to 10 MB and MP4 up to 20 MB/60 seconds. Images are decoded and re-encoded without EXIF. MP4 public derivatives are decoded and re-encoded with camera/container metadata and audio removed, at a maximum 1280×720. The response explicitly identifies the silent derivative; private originals remain access-controlled. Files persist under STORAGE_PATH. Governed redaction blocks public access. Governed deletion blocks access, records an audit reason, removes originals and derivatives, and has a durable retry job if filesystem removal fails. File hashes establish integrity, not truth.

## History and workflow meaning

Report review, case work and delivery state are separate. Every manager transition records actor, organisation, reason and a public event. Closure requires a supported outcome category, explanation, completion date and an existing case-owned attachment or action. A closed case records completed documentation, without implying environmental recovery.

Historical passports filter records by recorded/observation time and reconstruct workflow state, review state and merge status from dated events/history. Historical closure details come from the original event; absent legacy details are marked unavailable, never replaced with a later live conclusion. Source health is a current operational context; historical status is not reconstructed from an invented health history.

Duplicate candidates apply water identity, observation type, a seven-day time window and a one-kilometre limit when report positions exist, with explicit comparison reasons. They never merge automatically. An authorised merge links cases while preserving original report/case IDs and authorship. Correction unlinks the records and appends an audit/public trail. Citizen reopening requests are stored while the case remains closed until authorised review.

## Durable delivery and assistance

Workers claim jobs with conditional updates, recover leases after five minutes, retry with bounded exponential backoff, and keep failure details. PostgreSQL uses row-lock skipping for competing workers. Connector polling is scheduled from approved mappings. Notification preferences support category selection, daily batching and quiet hours using an explicit timezone. In-app notifications are real stored records; email/push adapters are unavailable. Delivery receipts never imply recipient acknowledgement.

The default assistance is explicitly rules-based. Report-draft assistance preserves original text, does not infer relative dates or scientific causes, validates provider output, enforces confirmation, uses a bounded timeout/retry wrapper and falls back to manual drafts. No external model/network adapter is configured or claimed. "What changed" entries cite existing internal event IDs.

## Run and migrate

From `backend/` with Python 3.12:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m app.seed
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
.venv/Scripts/python -m pytest -q
```

For the durable worker in its own process, set EMBEDDED_WORKER=false on the API and run `.venv/Scripts/python -m app.worker`. Development may use the embedded consumer; its jobs remain SQL-persisted across restarts. A worker can process once with `--once`.

For a pre-migration demo database created by development startup, run `python -m app.migrate --adopt-existing`. It verifies the entire schema against the immutable baseline before stamping and upgrading; mismatches refuse adoption without deleting records. The seed command is repeat-safe and disabled when DEMO_MODE=false. No destructive demo reset or role-switching endpoint is shipped.

FastAPI serves `/api/docs`, `/api/redoc` and `/api/openapi.json`. When STATIC_PATH points to a frontend build, the same server serves SPA routes while preserving API 404s. Production requires migrations, configured TLS/cookie settings and managed worker processes.

## References consulted

[SQLAlchemy 2 ORM](https://docs.sqlalchemy.org/en/20/orm/quickstart.html), [FastAPI security](https://fastapi.tiangolo.com/tutorial/security/first-steps/), [PostGIS ST_DWithin](https://postgis.net/documentation/tips/st-dwithin/), and [PyAV package/installation](https://pypi.org/project/av/). Connector and standards references/check limits are documented separately.
