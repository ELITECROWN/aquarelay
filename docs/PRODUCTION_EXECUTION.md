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


## Regional registry and browser-tab logo — 4 October 2026

Deployed commit 71dd79a. Imported 1,474 explicitly classified OSM starter
features in the east-bank Sodepur–Barrackpore coverage box and 12 in Potheri.
Live map response verified: 2,354 total, 2,354 returned, truncated=false.
Public searches and the actual live Potheri map were verified. The Potheri
Lake passport retains a provisional identity warning and three independent
source records; no incident or authority assignment was invented. See
backend/registry/README.md for source timestamps, geographic scope and exclusions.
The one-time REGISTRY_STARTER_PATHS setting was cleared after import.

Chrome-compatible SVG favicon uses the existing amber wave mark; deployed HTML
links it and the live asset responds 200 with image/svg+xml. Page layout and
styles are retained. Validation: 113 backend tests passed, two PostgreSQL tests
skipped; 19 frontend tests and production build passed.

## Authority contacts and customer sharing — 4 October 2026

Added eight source-linked public offices covering Bengaluru, Sodepur–Barrackpore
and Potheri. Directory search accepts locality and office names. Passport and
map selection expose regional contact candidates separately from assigned
responders. Each contact has address, email, telephone, citations and a checked
date. Exact water-body ownership/ward jurisdiction and agency participation are
not verified; Khardah explicitly retains its older-source warning. Directory
seeding is idempotent and never creates cases or institutional user accounts.

Instagram Story and WhatsApp Status PNG exports are 1080 × 1920; square remains
1080 × 1080. Templates retain the AquaRelay mark, record status, source and
review disclaimer. Users download/share manually. Removed public developer/API
navigation and screen; application backend endpoints remain. Professional menu
entries are limited to organisation users/admins. Original website layout retained.

Validation: 115 backend tests passed, two PostgreSQL tests skipped; 23 frontend
tests passed; production build passed. Two isolated browser scenarios passed
(contact search/passport/menu and actual downloaded PNG dimensions). Windows
browser runner was interrupted after successful scenarios because teardown hung.
Saved share screenshots are synthetic QA examples, not real environmental reports.

## Identity enrichment and readability — 4 October 2026

The imported registry contains 2,354 feature identities, not necessarily 2,354
unique physical water bodies. Original accepted snapshots contain 2,101 missing
names (including the separately reviewed Potheri Lake identity). No new local
water-body names could be established from those tags. Existing mapped and
reviewed names are preserved. Only importer-generated Unnamed placeholders are
replaced with descriptive type + nearby locality + feature-centre coordinates.
These labels are explicitly not official names. Mapped aliases and available
seasonal/intermittent, access, operator and description tags are exposed in a
source-linked Identity & location panel; absent depth, area, ownership and current
water-quality details remain marked unrecorded.

Locality context uses 1,468 named OpenStreetMap nodes. Their coordinates and
public tags were retrieved from the official OSM nodes API after tags-only
Overpass output and coordinate-query timeouts. The committed snapshot records
endpoint, retrieval date, selection snapshot time, ODbL licence and attribution.
Only place points within 2 km are matched; straight-line distance is approximate
and does not establish a street address or jurisdiction. 2,059 original unnamed
features have a nearby mapped place. The rest use region and coordinates.

The one-time, versioned production enrichment preserves existing reviewed names,
never creates observations/cases or authority assignments, and retains original
OSM source tags. It runs after optional imports during production launch.

UI refinements retain the current theme, layout and component shapes: darker
headings and secondary text, stronger panel/form outlines, keyboard focus rings,
subtle hover/press/reveal motion, and reduced-motion overrides. QA screenshots
use synthetic fixtures. Validation: 117 backend tests passed, 2 PostgreSQL tests
skipped; 23 frontend tests and production build passed. Browser validation covers
identity information, border/text styles, mobile overflow and reduced motion.

## Water-body reporting, map pin and submitted-report sharing — 4 October 2026

The Explore selection panel now includes Report here. Water-body passport Report
links remain. ReportPage loads the exact selected record separately from its
searchable first-page list, fixing deep links for registry records outside the
initial 100 results. The login return URL preserves the selected water body.

The reporting map uses the configured real basemap, a fixed centre pin, drag/tap
and keyboard-arrow positioning. Coordinates update the report/draft payload;
they do not change the registry feature's identity or centre. Device geolocation
is optional and manual coordinates remain available. A failed map chunk is
contained so the report form stays usable. Decorative Explore guidance no longer
intercepts marker clicks.

A successfully synced submission can open Share my report directly from its
success screen. The card uses that individual report's stored description,
observation date and review state, even when it joins an existing case. It links
to the incident and retains synthetic labels where relevant. Existing Instagram
Story / WhatsApp Status 1080x1920 PNG exports and square format are reused;
posting is manual. Local pending drafts do not claim successful submission or
expose this success sharing flow.

Validation: 23 frontend unit tests and production build passed. Isolated browser
journey verified marker-to-report navigation, exact-record prefill despite an
empty first-page list, changed map coordinates in the actual POST, successful
submission and both portrait downloads. A separate map-chunk failure scenario
verified manual entry and wizard continuation. Windows runner teardown requires
interruption after scenario results; screenshots use synthetic QA fixtures.

### 4 October 2026 — Classic intro and Bengaluru default view

Removed the floating custom cursor. The opening animation now uses a white
background, existing wave logo and pale 0–100 numerals. These are decorative
intro progress, not a claim that remote data has loaded. Reduced-motion visitors
skip it and the completed intro is remembered for the tab session.

Explore opens at Bengaluru city scale without fitting the national registry.
Panning, zooming, location selection and searching other areas remain available;
nonempty searches fit their results. Passport maps retain their existing fit.

Validation: production build and 23 frontend unit tests passed. Browser checks
passed for white intro progression/completion, reduced-motion skip, Bengaluru
street-tile viewport and keyboard panning, plus reporting and sharing regression.

### 4 October 2026 — Fullscreen scroll gallery

The homepage image corridor now spans the viewport without an outer border,
rounded frame or shadow. A 300vh track pins the 100dvh stage while page scrolling
advances images; the following content remains reachable through normal scroll.
External scroll control disables duplicate wheel/drag offsets. Reduced motion
uses a static, single-viewport gallery. Existing photos and page content remain.

Validation: production build, 23 unit tests and desktop/mobile browser checks
passed. Browser checks cover edge-to-edge dimensions, absent outer borders and
corner radius, pinned positioning and image-transform progression.

### 4 October 2026 — Scan remediation

1. Decorative WebGL initialization now fails safely without unmounting the app.
2. Water background and pointer trail skip reduced-motion requests.
3. Pending report retries use the durable draft, including completed upload IDs.
   Pending submissions cannot be edited through Back/Save draft. Server replay
   compares a canonical payload fingerprint and rejects changed submissions with
   409; pre-fingerprint records use stored-field/evidence comparisons.
4. Explicit related cases are fetched directly rather than relying on first 100.
5. Bengaluru default applies once; clearing a search preserves the viewport.
6. Illustrative restoration footage no longer carries a LIVE caption.
7. Landing regression uses the fullscreen gallery selector.

Validation: production build and 23 frontend unit tests passed. Backend suite
119 passed, 2 dedicated PostgreSQL checks skipped; foundation checks rerun after
legacy-replay handling (22 passed). Targeted browser checks passed for WebGL
failure, reduced motion, landing/tracking, report/map/share flow, chunk fallback,
explicit case beyond the first page, and search-clear viewport preservation.

Remaining deployment capabilities require configuration rather than UI claims:
GEMINI_API_KEY and GEMINI_MODEL on Render for opt-in AI; VAPID keys and a mailto
support contact for Web Push; an agreed recipient endpoint/credentials and
organisation ownership for external authority handoff. Email remains deliberately
disabled per owner preference. Full standards conformance and dedicated live-like
PostgreSQL concurrency verification remain separate production validation work.
