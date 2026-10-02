# AquaRelay verification ledger

Date: 2 October 2026. The workspace began empty. Checks use real SQL-backed routes and the running application; every seed/test record and generated evidence illustration is synthetic.

## Verified

| Check | Observed result |
|---|---|
| Complete backend `backend/.venv/Scripts/python.exe -m pytest -q` | 68 passed, 2 explicit PostgreSQL skips; one upstream Starlette/AnyIO deprecation warning. |
| Integration-owned API/transport/mapping/standards suite | 41 passed, including seven configured institutional delivery regressions. |
| Frontend `npm test` | 12 passed: workflow labels, account-scoped offline storage/replay, partial-media retry and canonical share review labels. |
| Frontend `npm run build` | Final TypeScript and production Vite bundle passed. |
| Isolated Playwright browser suite | All 6 journeys passed in 2.9 minutes using Microsoft Edge, an isolated SQL database and the real server request limit. |
| Production frontend/service worker | Interactive map/passport and compiled assets passed; the active service worker cached the shell/assets without API responses, and offline navigation showed the honest unavailable-records state. |
| Alembic/seed/process persistence | Fresh SQLite migrations, real report/image creation, new-process SQL/private/public file retrieval passed. |
| Existing-schema migration adoption | Actual demo schema matched immutable baseline, adopted without deleting records, upgraded to head. Empty version table and incompatible-schema regressions passed. |
| PostgreSQL/PostGIS migration SQL | Offline SQL rendering passed, including nullable empty/JSON-null geometry guard. |
| `docker compose config --quiet` | Passed. |
| Review | Independent review findings repaired; scoped rereview includes account privacy, event order design, historical closure replacement, provenance, mapping reuse, labels and metadata contrast. |

Backend coverage includes mapping approval, missing units/timezones, ambiguity quarantine, source/import/webhook replay, permission denial, CSRF, restricted public data, closure categories/support, historical closures/merges, duplicate correction, report/evidence replay, notification preferences/dedup/daily grouping, freshness, source failure/recovery, safe transport, upload validation, EXIF/audio removal and public embed privacy. See `BACKEND_REPORT.md` and `INTEGRATION_REPORT.md` for precise scope.

## Browser and visual evidence

Playwright uses installed Microsoft Edge on this Windows host. Chromium's bundled headless executable could not be used in this environment; TLS verification was not disabled to work around its download failure.

The root browser suite covers map zoom/list selection, older case/actions, source inspection, 390/768/1440 screenshots, mobile navigation, reviewed XLSX correction, real report/evidence IDs, another session's committed flag, additional related evidence without another case, citizen denial, manager response, closure/support, stored follower notification, PNG download, persisted standards handoff, connector failure/recovery, global offline retries and account switching during a failing personal-data request. Two additional regressions cover 1,000-event replay with an older in-flight snapshot and a failed map chunk with working public records/navigation.

Latest final complete browser-suite result: **6 passed in 2.9 minutes**, with no failed journeys. Each independent journey was paced to respect the server's 240-request/minute per-IP limit; fixture pacing preserves the full journey time budget. The golden journey used real uploads, committed events, notifications, additional related evidence, the delivered local receipt and connector recovery. The independent workflow script additionally verified square/story files, canonical review decisions, import template reuse, duplicate correction, reopening requests and configured-capability guards.

Actual screenshots are in `docs/screenshots` and `docs/qa-workflow`. Rendered 390/768/1440 screens and generated PNGs are visually inspected. Fixes include readable muted colours, overflow/scrolling in short-height navigation, map CSS specificity after lazy loading, responsive fit padding, cluster/name labels, and Radix portal canvas lifetime. These are scoped accessibility checks, not a claim of a complete independent WCAG certification.

The final visual pass removed the decorative district caption overlapping map markers. Individual synthetic record names, the demo-layer badge and persistent demonstration banner remain visible. A fresh-build offline check then exposed an application-shell precache race: the first page's main JS/CSS loaded before the service worker controlled it. Installation now precaches the actual same-origin bootstrap assets, and fetched asset writes finish within the fetch lifetime. The strengthened check explicitly requires each entry asset from the built HTML in CacheStorage, excludes API responses and navigates offline. It passed in two fresh browser contexts after the final build. These final adjustments passed production verification; the six core browser journeys had already passed.

The final independent normal-server workflow script passed all 14 verification groups against the accumulated main demo database with real SSE. It verified approved template reuse, canonical review labels, square/story/accepted-review PNG files, merge/unmerge/reopening and the inspected delivered FHIR receipt with `acknowledged:false`. The stream quota regression was fixed by coalescing replay batches and resuming per-tab public cursors; a trailing refresh also prevents older requests clearing a newer event. Narrow independent query-race checks confirmed exactly two requests/current data and no refresh after teardown. Failed-map browser cases intentionally log React's caught error-boundary diagnostic; the application remains usable.

After the execution environment restarted, the sequential backend rerun passed **68 tests, 2 PostgreSQL skips in 22.10 seconds**, with the original migration subprocess timeout. The same 12-test frontend Vitest suite passed. An earlier concurrent migration timeout did not reproduce individually or in the final complete run. The already-recorded main case `case-1d83d4adeba34d709ccc326a8bbf66d5`, its original report ID and its public evidence file were retrieved successfully after restart, with the evidence returning HTTP 200.

`node scripts/verify-production-shell.mjs` also passed on the actual compiled application served at port 8000, including its MapLibre worker, source tab and offline application shell. `production-passport-1440.png` records the production view. Development watchers now exclude backend/runtime/report trees, and Tailwind scans only frontend source, preventing generated browser reports from reloading the application.

## Explicitly unverified or configuration-dependent

- Docker Desktop failed to initialise its Ingest Unix socket with a system file-access error; the Linux-engine API pipe never became available. Image build, PostgreSQL runtime migrations and application/database-container restart checks therefore did not run. Compose named volumes and commands are supplied. Local database/file process-restart checks did run.
- The two opt-in PostgreSQL tests require a dedicated `POSTGRES_TEST_URL`: event transaction commit ordering and missing/provided PostGIS geometry insertion. Both were explicitly skipped. Offline SQL checks do not replace runtime PostgreSQL checks.
- No production institutional/source credentials, external recipient, official partnership, paid AI, email or push service was configured or contacted. Institutional delivery tests replace the remote transport boundary and verify real local jobs/receipts; a live endpoint must honour the documented idempotency contract.
- FHIR R4, SensorThings and STAplus checks are the documented structural/relationship subsets. Full profile, terminology and standards conformance were not tested or claimed.
- Native share destinations, user posting and public QR delivery are not claimed. The app generates actual PNGs and opens user-initiated sharing mechanisms; localhost never becomes a public QR destination.

## Reproduce

```powershell
npm ci
npm test
npm run build
Set-Location backend
.venv/Scripts/python.exe -m pytest -q
Set-Location ..
# Starts dedicated API/Vite servers and an isolated SQL database:
npm run test:browser:isolated
# Alternatively, start API and Vite using README instructions, then:
npm run test:browser
node scripts/verify-workflow-ui.mjs
# With the compiled frontend served by the API, as described in README:
node scripts/verify-production-shell.mjs
docker compose config --quiet
```

The restarted host's default command-shell path was unavailable. For the final npm browser script, the available shell was selected for that process with `$env:ComSpec='C:\Windows\SysWOW64\cmd.exe'`. The final frontend unit rerun invoked the identical Vitest executable directly with `node node_modules/vitest/vitest.mjs run`.

For Docker runtime proof once the engine works, run `docker compose up --build -d`, execute the browser suite against `http://localhost:8000` using `PLAYWRIGHT_BASE_URL`, create a report with evidence, and restart `app worker db` with volumes intact. Verify the original IDs/files/receipts afterward. Use a dedicated PostgreSQL test database for the opt-in regressions; no test reset operates on the application database.
