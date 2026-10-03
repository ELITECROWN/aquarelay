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
Use existing GitHub and Render accounts, Supabase free PostgreSQL/storage, Render free pilot compute, optional Gemini free tier and Mailjet HTTPS or Resend free tier. Account creation, DNS ownership, real source data and actual institutional recipients require the user's participation. Free plans do not promise continuous worker operation or production availability guarantees.

Local verification: frontend build, 16 frontend tests, 88 backend tests; two PostgreSQL tests require an external database. Eight browser scenarios passed across the restored-design run and a targeted account-navigation selector rerun. Real OSM basemap and device location are implemented. Registry download, cloud deployment, real provider delivery and partner endpoints remain pending. See LIVE_SETUP.md for the feature matrix.
