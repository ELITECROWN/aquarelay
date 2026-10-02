# AquaRelay implementation plan

Goal: implement the approved civic freshwater registry and incident workflow, with durable interoperability, public history, and honest synthetic demonstrations.

The starting workspace is empty, has no Git repository, and contains no engineering instructions. This is a new modular monolith. The supplied product brief is the binding specification; its explicit direction to implement autonomously supersedes additional design-approval stages.

## Decisions and module boundaries

- React + TypeScript + Vite, Tailwind, Lucide, TanStack Query, Radix dialogs, MapLibre. Warm off-white/forest/sage application shell; responsive map/list and contextual passport.
- FastAPI/Pydantic/SQLAlchemy/Alembic; PostgreSQL/PostGIS for Compose. SQLite is an explicit local development/test fallback, never browser persistence. Both store all authoritative records server-side.
- Cookie sessions, hashed passwords, CSRF for mutations, organisation membership checks. Distinct seeded citizen and manager identities; credentials documented only for demo.
- Persistent files under `STORAGE_PATH`. Image derivatives strip EXIF. Original uploads remain protected.
- SQL durable outbox/jobs, deduplicated notifications, committed-event SSE with polling fallback. IndexedDB account-scoped drafts retain client IDs.
- Synthetic water geometries and contextual district GeoJSON use a neutral MapLibre background by default. External basemap styles are environment-configured; no public geocoder autocomplete.
- Scoped SensorThings/STAplus and FHIR demonstrations claim only the structural checks actually run. No patient/diagnostic resources or invented standard codes.
- Manual mapping and rules-based assistance work without AI. Any optional external delivery is unavailable until configured.

## Shared backend contract

Python package: `backend/app`. Foundation owns `db.py`, `models.py`, `auth.py`, `core.py`, `main.py`, `seed.py`, migrations, dependencies, worker. Integration module owns `integrations.py`, `standards.py`, integration tests and docs. Routers mounted under `/api/v1`.

Foundation publishes `Base`, `SessionLocal`, `get_db`, `engine` from db; `require_user`, `require_manager`, `current_user` from auth; and SQLAlchemy classes User, Organisation, Membership, WaterBody, Source, Observation, Biodiversity, Case, Report, Evidence, Event, Action, EvidenceRequest, Subscription, Notification, Connector, MappingVersion, ImportRun, Receipt, Relationship, Audit, Job. Integration storage classes may use JSON `data` fields with dedicated identity/index columns. Integration agent coordinates exact fields with foundation.

Shared helpers: `utcnow()` UTC ISO string, `uid(prefix)` stable unique string, `emit_event(db, waterbody_id, case_id, kind, title, description, actor_id, source_id=None)` inserts event and durable job within caller transaction. Event serialization fields id/waterbody_id/case_id/kind/title/description/created_at/source_id/synthetic. All demo fixtures and their exports are synthetic.

Frontend uses `api<T>(path, options?)` from `src/api.ts`, credentials included and automatic CSRF header for mutations. Paths start `/api/v1`. `useSession()` from `src/session.tsx` returns `{user, loading, refresh}`, user shape `{id,name,email,role,organisation_id,csrf_token}`. `useToast()` from `src/ui.tsx`; common `Badge`, `Empty`, `PageHeader`, `Modal`, `formatDate`. Domain interfaces from `src/types.ts`.

Routes and response shapes:
- GET `/config`: demo_mode, capabilities. GET `/auth/session`: `{user: User|null, csrf_token}`. POST `/auth/login` email/password; logout; register. Session mutations enforce CSRF.
- GET `/waterbodies?q=&type=&state=&availability=&start=&end=&lat=&lon=&radius=&page=&page_size=`: `{items,total}`. WaterBody fields id,name,aliases,type,locality,latitude,longitude,geometry,summary,synthetic,case_count,latest_observed_at,source_count,case_state,data_state; optional distance_m.
- GET `/waterbodies/:id?as_of=&since=`: `{waterbody,events,observations,biodiversity,cases,actions,sources,relationships,nearby,organisations,changes}`.
- GET `/cases` `{items,total}`; GET `/cases/:id` `{case,reports,evidence,events,actions,evidence_requests,delivery}`. Case fields id,waterbody_id,waterbody_name,title,description,state,review_state,delivery_state,organisation_id,created_at,observed_at,synthetic.
- POST `/evidence` multipart file + synthetic + caption => evidence object id/name/url/created_at. POST `/reports` JSON client_id, waterbody_id, observation_type, observed_at (with timezone), latitude,longitude,description,count_estimate,language,evidence_ids,related_case_id,synthetic => `{report,case_id}`. Same client ID is replay-safe.
- POST `/cases/:id/transition` state,reason,outcome?,completed_at?,evidence_id?,supporting_record?; POST `/cases/:id/actions` title,description,completed_at,evidence_id?; POST `/cases/:id/notes` text,private; POST `/cases/:id/requests` description; POST `/cases/:id/review` review_state,reason. Authenticated `/workspace` => assigned cases/private notes.
- GET `/following` `{waterbodies,areas}`; POST/DELETE `/following/:waterbody_id`; POST `/areas` name,latitude,longitude,radius_m; GET `/notifications` `{items,unread}`; POST `/notifications/:id/read`; GET/PUT `/preferences`.
- GET `/organisations` `{items}` and detail. GET `/events/stream` SSE. Public paginated actions/sources; `/embed/:id` public HTML. GET `/cases/:id/export` privacy-filtered synthetic-labelled JSON.
- Integration module: `/connectors`, `/imports/preview` multipart file, `/imports/:id/transform` mapping,unit,timezone; `/imports/:id/approve`; `/connectors/:id/test|sync|pause|configure`; `/standards/:waterbody_id/fhir|sensorthings`; POST `/handoffs/:waterbody_id`, GET `/receipts`; POST `/demo/receiver`; signed `/webhooks/:connector_id`. Integration agent publishes exact supplemental contract to workflow UI agent.

## Working slices and acceptance

1. Registry/auth/map/passport: deterministic 7-water-body seed, source provenance, historical case, biodiversity, nearby distances versus documented connections. Verify API privacy and map/list selection.
2. Reporting/cases: file persistence, review wizard, related-case choice, organisation permissions, audited transitions, action and closure outcome requirements. Verify replay, forbidden citizen mutations and private notes.
3. Imports/integrations: CSV/XLSX/JSON preview/manual mapping, missing unit/timezone and ambiguous-site quarantine, template versions/replay, secure HTTP/SensorThings connector, actual failures/retries, scoped standards export and persisted demo receipt. Verify mapping, replay, webhook signature and standards structure.
4. Follows/live/offline/share: durable outbox worker, notification dedup/preferences, reconnecting SSE and polling, IndexedDB drafts/media with explicit sync, dated watermarked PNG square/story share cards. Verify two sessions, uploads and offline retry.
5. Relationships/API/refinement: supporting sources, record-grounded changed summaries, OpenAPI/embed, full docs/runbook, error/empty/capability states, desktop/tablet/mobile screenshot review.

Tests: pytest backend; Vitest utility/components; Playwright connected golden journey, permissions, mobile/list navigation, generated share files, uploads and following. Build with TypeScript. Verify disk/server restart persistence; Compose database restart if Docker engine is available. Record unrun checks honestly.

## Files and ownership

Root implementer: frontend scaffolding, shared UI/API/types/session, shell, Explore/Map/Passport/Landing/Following/Notifications/Organisations/Developers/Settings, global CSS, Compose, browser tests, final integration and visual QA.

Backend implementer: foundation backend and test suite. Integration implementer: integration/standards module, tests/contracts/docs. Workflow UI implementer: `src/features/ReportPage.tsx`, `IncidentPage.tsx`, `WorkspacePage.tsx`, `IntegrationsPage.tsx`, `ImportPage.tsx`, `ShareModal.tsx`, `offline.ts`, `public/sw.js`; never edit root-owned shared files without coordination.

## Verification ledger

- Initial inspection: empty workspace; no existing application to preserve.

## Final implementation decisions

All five slices are implemented as one connected application. The final API contract and examples are in `API.md`, the schema and privacy rules in `DATA_DICTIONARY.md`, transport/mapping contracts in `CONNECTOR_CONTRACTS.md`, and precise interoperability scope in `SUPPORTED_STANDARDS.md`.

- Production configuration uses PostgreSQL/PostGIS and persistent Compose volumes. Direct Windows execution uses actual server-side SQLite and disk files. The Docker engine was unavailable on this host; runtime PostgreSQL/container checks remain explicitly unverified rather than replaced by SQLite assertions.
- Closure records retain an immutable category, explanation, actor/organisation, completion date and traceable support. Subsequent merges, corrections or reopening preserve the earlier dated snapshot.
- Report review remains per report; case workflow and recipient delivery remain separate. Institutional delivery is configured server-side and only a bound recipient receipt can establish acknowledgement.
- Optional AI is absent in this configuration. Rules-based mapping, related-case candidates and cited event summaries work without model credentials and cannot authorise mutations.
- Public event cursors resume within a browser tab; event bursts coalesce, older in-flight responses receive a trailing refresh, and the 30-second fallback remains available. A failed map chunk is contained within the map panel so public records/navigation and global offline retries remain usable.
- The final independent review, browser/visual evidence, test counts and unrun checks are recorded in `REVIEW.md`, `UI_WORKFLOW_REPORT.md` and `TEST_RESULTS.md`. No destructive seed reset was used.
