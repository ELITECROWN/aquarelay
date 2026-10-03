# AquaRelay production execution

The frozen MVP and the feature-by-feature launch roadmap in this chat are the scope. The user authorised implementation on 3 October 2026 and requested free provider options. Work stays in the current checkout.

## Architecture
Keep React, FastAPI, SQLAlchemy, PostgreSQL/PostGIS, the SQL outbox, and account-scoped offline drafts. Replace silent mocks with honest errors. Implement cloud storage and optional external assistance as adapters; user content remains authoritative. Demo and production data must be visibly separate. No diagnosis, water-safety score, automatic social tagging, or invented institutional delivery.

## Implementation sequence
- [x] Restore routes/navigation; remove mock API success; retain reporting when offline; repair profile error handling and misleading claims.
- [ ] Complete organisation administration, registry ingestion, research contributions, persisted comparison stories, and source-linked retrieval.
- [x] Add multilingual report drafts and mapping assistance with optional Gemini and explicit external-processing consent; grounded summaries and evidence requests.
- [x] Add shared private Supabase storage, configurable email/push delivery and account recovery.
- [x] Add production validation, deployment blueprint, bootstrap command, environment examples, and free-service setup instructions.
- [ ] Run frontend/backend/browser verification; document the exact results and configuration-dependent gaps.

## Acceptance
Real failures stay failures. Reports and evidence survive restart. Scope and authorisation are checked server-side. Closure uses real support. Each UI route loads. Offline pending reports retry with stable identities. External adapters have contract tests and require real credentials before live verification. PostgreSQL, backup restore, cloud deployment and partner endpoints are only labelled verified after actual execution.

## External setup
Use existing GitHub and Render accounts, Neon PostgreSQL/PostGIS and Supabase private storage, Render free pilot compute, optional Gemini free tier and Mailjet HTTPS or Resend free tier. Account creation, DNS ownership, real source data and actual institutional recipients require the user's participation. Free plans do not promise continuous worker operation or production availability guarantees.

Local verification: frontend build, 16 frontend tests, 88 backend tests; two PostgreSQL tests require an external database. Eight browser scenarios passed across the restored-design run and a targeted account-navigation selector rerun. Real OSM basemap and device location are implemented. Registry download, cloud deployment, real provider delivery and partner endpoints remain pending. See LIVE_SETUP.md for the feature matrix.

## Sequential launch work — 3 October 2026

- User chose to omit external email delivery. In-app updates remain; email recovery and verification controls must clearly show unavailable. Do not provision Mailjet.
- Production boundary: block reserved demonstration-domain logins, invalidate their existing sessions on use, hide synthetic ORM records and reject reserved-domain registration. Preserve records; do not truncate tables.
- Registry: downloaded the actual OSM snapshot; 868 explicitly classified starter identities accepted from 4,908 raw features. Source snapshot, attribution and limitations committed under backend/registry. Import remains pending until the production launcher is deployed.
- Database: existing Render connection hostname identifies Neon, not Render Free Postgres or Supabase Database. Supabase is the private media provider. No credential values were logged.
- Startup: explicit ADOPT_EXISTING_SCHEMA=true permits only strict baseline adoption, followed by immutable migrations. No destructive reset. Disable this temporary flag after successful launch.
- Added /ready with actual database-table, migration-version and PostGIS checks. It does not claim live email, push, backups or partner connectivity.
- Pagination: SQL search/type filtering and page selection precede record aggregation for ordinary searches. Advanced history and distance filters still need further optimisation.
- Required user input: first administrator email and direct password entry in Render. Do not infer ownership from third-party account details.
- Remaining acceptance: actual production migration/import, admin, live push, off-site backup/restore, PostgreSQL concurrency checks, partner integrations, authority suggestions, multilingual validation and operational ownership.


## Verified launch and next batch — 4 October 2026

Production launch succeeded with python -m app.launch: migrations and PostGIS readiness passed; demo mode is false; 868 OSM starter features imported. Frontend remains on Vercel, backend on Render, database on Neon, media on Supabase. Temporary adoption and import flags were disabled after launch.

Complete-map API, demo-notification isolation, administrator unassigned-case routing with source provenance, organisation profile approval/revocation and explicit optional sharing handles are implemented. Existing presentation is retained. Verification: 108 backend tests passed, two PostgreSQL-specific tests skipped; 19 frontend tests and production build passed. Four targeted map/presentation browser scenarios reported passing; Windows server teardown needed interruption.

Still required: first administrator email and password entered directly in Render; real organisation/manager setup; documented profiles/partner endpoints; optional browser push credentials; separate-database concurrency and backup/restore checks. Email remains intentionally unconfigured at the user request.
