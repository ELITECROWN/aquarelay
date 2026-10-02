# Backend implementation and verification

The backend foundation implements the persistent registry/passport, secure sessions, organisation scope, report replay, image/video uploads, case review/transitions/actions/notes/evidence requests, duplicate review/correction, reopening requests, follows/areas, stored notifications/preferences, committed-event SSE and polling, sourced relationships, public API/embed and file governance. Integration/standards details and scoped validation claims are in INTEGRATION_REPORT.md, CONNECTOR_CONTRACTS.md and SUPPORTED_STANDARDS.md.

## Checks actually run

- Final full `backend/.venv/Scripts/python -m pytest -q`: **68 passed, 2 skipped**, one upstream Starlette/AnyIO deprecation warning. The skipped checks are the explicitly configured PostgreSQL concurrency and PostGIS geometry regressions.
- `backend/.venv/Scripts/python -m compileall -q app` completed successfully.
- Fresh Alembic SQLite upgrade through both migrations; deterministic seed, real API report/image upload and public access; new Python process verified the report plus private and public file persistence.
- Strict schema-adoption check matched an existing development schema, refused an extra column and preserved its seven water-body records. An interrupted empty Alembic version table was reproduced as a failing regression, then adopted only after baseline verification with all records preserved.
- PostgreSQL/PostGIS migrations generated offline SQL successfully. A failing-then-passing offline regression confirms empty/JSON-null geometry is guarded before calling PostGIS. This is SQL-generation evidence, not runtime PostgreSQL verification.
- JPEG derivative decode confirms empty EXIF; MP4 derivative decode confirms preserved frames, absent private camera tag and no audio stream.
- Real API tests verify CSRF, citizen/other-organisation denial, private-note/contact filtering across passport/case/export/embed, closure supporting-record requirements, report-review separation, replay, merge/correction origin preservation, reopening review requests, category preferences, daily notification batching/deduplication, pagination bounds, historical states/closures and candidate rules.
- Provider draft test confirms original text preservation, manual date confirmation and schema-failure fallback without authoritative mutation.

## Explicit limits and unrun checks

Docker engine/PostgreSQL were unavailable during implementation. Container/database restart, runtime GiST/ST_DWithin queries, PostgreSQL commit-order concurrency and live PostGIS missing-geometry checks were not run. The opt-in `POSTGRES_TEST_URL` regressions use temporary schemas in a dedicated database and are skipped without that configuration. They check transaction cursor commit order and insertion with omitted/JSON-null/provided geometry. Generated geometry is nullable when its source JSON has no type.

No production municipal, hospital, sensor or government credentials were configured. The local receiver and scenario source are explicitly synthetic. Structural standards validation is not full profile/terminology conformance. No external AI, email or push adapter is configured; rules-based assistance and stored in-app notifications are working.

Video derivatives are silent and strip metadata; originals are private. Public photo records lack an invented field-observation date or viewpoint comparison. Retained old media paths identify deleted evidence without restoring its files; governance remains auditable. Source operational health is current; historical source-health snapshots cannot be invented where the original system did not record them.

Browser/map/mobile/share accessibility and visual checks are owned by the frontend verification and are recorded in the root test report. This report does not claim those checks independently.

## Dependencies and commands

Python 3.12 and the fully pinned backend/requirements.txt are used. Install, migrate, seed, start and worker commands are in BACKEND_ARCHITECTURE.md and the root README. Windows sandbox SQLite writes required approved test execution; test databases are isolated beneath backend/aquarelay-tests-* before test module collection and guarded against resetting application databases.

The implementation uses the authored synthetic district only, with separate citizen/manager/researcher demo accounts. DEMO_MODE=false disables seeding and demo endpoints. No role-switching or destructive reset endpoint is implemented.
