# AquaRelay

**Every water body has a history.** A working freshwater registry, public map, incident/evidence workflow, organisation workspace, reviewed data imports, and scoped interoperability demonstration.

The workspace began empty. The application uses React 19, TypeScript, Vite 8, Tailwind 4, Lucide, Radix Dialog, TanStack Query and MapLibre 6; a FastAPI/Pydantic/SQLAlchemy modular monolith; PostgreSQL 16/PostGIS in Docker; Alembic migrations; persistent file storage; and a SQL-backed outbox worker. SQLite is an explicitly labelled server-side development/test fallback. Authoritative records never live in frontend arrays or browser local storage.

## Run with Docker

Requirements: Docker Desktop with its Linux engine running and Docker Compose v2.

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose logs -f app worker
```

Open http://localhost:8000/explore. Compose waits for database health, runs migrations, runs the repeat-safe synthetic seed, then starts the application and worker. The frontend is served by FastAPI in this mode. PostgreSQL and uploads use named volumes.

Explicit commands:

```powershell
docker compose run --rm migrate
docker compose run --rm seed
docker compose exec app pytest -q
docker compose restart app worker db
```

Restarting with volumes intact retains records, receipts, notifications and files. Do not use `down -v` if you want to retain them. Database-container restart verification depends on a running Docker engine; see the test report for the actual checks performed in this session.

## Run directly on Windows

Requirements: Node 24+, Python 3.12. From the repository root:

```powershell
npm ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
.venv/Scripts/python.exe -m app.migrate
.venv/Scripts/python.exe -m app.seed
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal at the repository root:

```powershell
npm run dev
```

Open http://localhost:5173/explore. The API stores SQLite at `backend/data/aquarelay.sqlite` and files at `backend/data/files`. Demo mode automatically ensures a repeat-safe seed on startup. An embedded consumer processes the durable SQL outbox locally. Compose disables the embedded consumer and runs a separate worker.

For a single-port local production preview, run `npm run build`, then start the API from `backend` with:

```powershell
$env:STATIC_PATH='../dist'
$env:CORS_ORIGINS='http://localhost:8000,http://127.0.0.1:8000'
$env:PUBLIC_URL='http://localhost:8000'
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://localhost:8000/explore. This serves the real production bundle and enables its application-shell service worker on localhost.

If development startup already created an unversioned demo database, use `.venv/Scripts/python.exe -m app.migrate --adopt-existing` before seeding. It checks the actual schema against the immutable baseline and preserves records; incompatible schemas are refused. Ordinary fresh installs use `app.migrate` without adoption.

To run a separate worker locally:

```powershell
# Set EMBEDDED_WORKER=false before starting the API.
Set-Location backend
.venv/Scripts/python.exe -m app.worker
# Bounded manual outbox processing:
.venv/Scripts/python.exe -m app.worker --once
```

Linux equivalents use `backend/.venv/bin/python`. Configuration names and local defaults are in `.env.example`; shell environment values configure direct Python execution. A frontend `.env` supplies Vite variables during build.

## Demo identities

All accounts and organisations below are synthetic. Password: `DemoPass123!`.

| Email | Scoped role |
|---|---|
| citizen@demo.aquarelay.local | Report, follow and contribute evidence |
| manager@demo.aquarelay.local | Demo Reedwatch assigned cases and imports |
| other@demo.aquarelay.local | Demo District assigned cases; cannot act on Reedwatch cases |
| researcher@demo.aquarelay.local | Contributor; no case-manager authority |

There is no client-side role impersonation. Each identity logs in through the real session API. Outside DEMO_MODE, seed/receiving/scenario facilities are disabled. Use non-demo accounts, HTTPS, secure cookies, configured CORS origins, a database password and an allowed tile style for production configuration.

## Check and build

```powershell
npm test
npm run build
Set-Location backend
.venv/Scripts/python.exe -m pytest -q
Set-Location ..
# Start fresh isolated API + Vite servers and run all browser journeys:
npm run test:browser:isolated
# Or use the existing application servers on 8000 / 5173:
npm run test:browser
# Additional connected workflow verification against those existing servers:
node scripts/verify-workflow-ui.mjs
```

Windows defaults to the installed Microsoft Edge browser; override with `$env:AQUARELAY_BROWSER_CHANNEL='chromium'`. Other platforms default to Chromium; install it with `npx playwright install chromium` if needed. The isolated command starts both servers on 8001 / 5174 with a new SQL database and evidence directory, then stops them. It preserves the main application database. The existing-server command requires the frontend and API running. Journeys are paced for the real per-IP request limit and include map/history, imports, uploads, organisation permissions, live sessions, closure, stored notifications, share PNGs, offline retries, event replay/races and unavailable map chunks. Screenshots are written under `docs/screenshots`.

## Connected product surfaces

`/` concise landing with a real interactive map preview; `/explore` map/search/filter/list; `/waterbodies/:id` passport with dated history; `/report` guided contribution and offline drafts; `/incidents/:id` evidence and documented response; `/following`; `/notifications`; `/organisations`; `/workspace`; `/integrations`; `/integrations/import`; `/integrations/:id`; `/developers`; `/login`; `/settings`.

## Capability boundaries

- Working locally: SQL persistence, session/CSRF/organisation enforcement, synthetic registry, interactive MapLibre geometry/clustering, public history, report/evidence/action/closure, reviewed CSV/XLSX/JSON import, source mapping templates and replay protection, follows/notifications, committed-event SSE and polling fallback, account-scoped IndexedDB drafts, generated PNG square/story cards, public API and live embeds.
- Configuration-dependent: licensed external basemap, public origin, public HTTPS JSON/SensorThings endpoints, and institutional FHIR delivery through a server-configured organisation recipient directory. Its durable adapter requires a recipient that honours idempotency keys; credentials remain server-side. No live institutional recipient was configured or contacted. No official partnerships are implied.
- Rules-based assistance: exact-field mapping suggestions, related-case candidates and summaries of recorded changes. Manual decisions remain authoritative. No paid AI credentials are needed; no external AI inference is claimed.
- Demo-only: fictional district, observations and organisations; local standards receiver; explicitly labelled connector failure/recovery scenarios. Exports/cards retain synthetic labels.
- Unavailable until configured: email and browser push; institutional delivery requires `HANDOFF_RECIPIENTS_JSON` on both API and worker. See the connector contract for its supported payload and receipt semantics. Share-sheet invocation is not publication. No SMS or automatic social posting is claimed.
- Standards: versioned SensorThings/STAplus subset and narrow FHIR R4 4.0.1 example, with structural checks. Full conformance, profile and terminology validation are not claimed.

The application never derives water safety, pollution causation or ecosystem restoration from photographs, incident closure, report counts or missing records. Reporting review, case work and recipient delivery are separate dimensions.

Read [implementation decisions](docs/IMPLEMENTATION_PLAN.md), [connector contracts](docs/CONNECTOR_CONTRACTS.md), [supported standards](docs/SUPPORTED_STANDARDS.md), [demo runbook](docs/DEMO_RUNBOOK.md), [media/source register](docs/SOURCE_REGISTER.md), and [verification results](docs/TEST_RESULTS.md). Backend architecture and data dictionary are in `docs`.

API documentation: `/api/docs`; OpenAPI JSON: `/api/openapi.json`. API namespace: `/api/v1`.
