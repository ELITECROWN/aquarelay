# AquaRelay: live setup and feature status

Launch region: Bengaluru. Existing accounts: GitHub and Render. The live frontend is https://aquarelay.vercel.app; FastAPI and the durable SQL worker run at https://aquarelay-api.onrender.com. PostgreSQL/PostGIS runs on Neon; Supabase provides the private evidence bucket. Same-origin frontend API routing handles browser sessions. No paid OpenAI subscription, Google Maps key or paid push provider is required.

**The website is live, with demo mode disabled and 868 source-linked OSM starter features imported. This is not a claim that all production acceptance checks are complete.** Cloud credentials, real delivery tests, PostgreSQL concurrency checks, backup restoration and institutional participation still need validation. Free Render compute sleeps and has an ephemeral filesystem; scheduled jobs resume from PostgreSQL after wake-up. Do not promise immediate notifications while it sleeps. Supabase free projects can pause after inactivity. See [Render free-service limits](https://render.com/docs/free) and [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

## What you need to do

1. Create a **free Supabase project**, preferably in a nearby region. Save its database password privately. In Database → Extensions enable PostGIS. In Storage create a bucket named `evidence` and keep it **private**. Do not add anonymous read/write policies. AquaRelay serves authorised media through its backend.
2. Open Supabase's Connect dialog. Choose the **session pooler, port 5432**, which supports IPv4. Copy its PostgreSQL URI into Render's `DATABASE_URL`, URL-encode special characters in the password, and add `?sslmode=require`. Do not use the transaction pooler for this deployment's migrations and long-lived sessions. See [connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. Get the project URL and server service-role key from Supabase settings. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Render only. The key bypasses storage policies; it must never be placed in browser variables, GitHub or chat.
4. Put this code in your GitHub repository. In Render choose **New → Blueprint** and select that repository. The root `render.yaml` defines the free service, build, start and health-check commands. Render service name availability may change the assigned URL.
5. Fill the secret fields requested by the blueprint. Set `PUBLIC_URL` and `CORS_ORIGINS` to the exact HTTPS URL Render assigns, without a trailing slash. Review `.env.production.example` for the complete environment list. `DEMO_MODE=false`, `COOKIE_SECURE=true` and shared storage are required by production startup.
6. Before first startup, add `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 14 characters. Startup creates the first administrator without synthetic records. After successful creation, **remove the bootstrap password and other bootstrap variables**. The free Render service does not provide an interactive shell, so this temporary environment setup avoids requiring a paid plan.
7. If the fetched starter snapshot exists, add `REGISTRY_STARTER_PATH=../fixtures/bengaluru-osm.json`. Import is idempotent and preserves existing identities. If the snapshot download has not succeeded, remove this variable and use the admin registry interface until the snapshot is available. The importer never invents incidents, environmental measurements or organisations.
8. Deploy. Check `/health` shows `demo_mode:false`, `/api/v1/config` shows PostgreSQL and shared storage, `/api/docs` loads, and refreshing `/explore`, `/registry`, `/account/recovery` and an incident URL does not return 404.
9. Sign in as administrator and open `/registry`. Create your real organisation directory. Have organisation staff register citizen accounts, then assign their email to the correct organisation and role. Create new water-body identities with the responsible organisation ID, or use `PUT /api/v1/admin/waterbodies/{id}/responsibility` in the authenticated API. Unassigned cases remain unassigned until this mapping is entered.
10. Upload a real image, submit a report, refresh and verify it is stored. Add evidence from a second account. Request evidence, acknowledge, investigate, add action records and close with supporting evidence. Save a dated comparison, follow the water body, confirm notifications, then restart the service and check that media and history survive.

## Free services and keys

| Capability | Free option | Values needed | What is still required |
|---|---|---|---|
| Database and media | [Supabase](https://supabase.com/pricing) free plan | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Project creation, private bucket, PostGIS, restore test; quotas apply |
| HTTPS hosting | Your [Render](https://render.com/docs/free) account | GitHub repository connection, exact public URL | Deployment and logs; free compute sleeps |
| Street map and device location | OpenStreetMap raster map and browser Geolocation | No API key | HTTPS or localhost; user grants location permission |
| Starter water-body identities | OSM Overpass snapshot | No API key | Successful snapshot fetch and review of mapped identities |
| Multilingual and schema assistance | [Google AI Studio / Gemini](https://ai.google.dev/gemini-api/docs/pricing) free quota | `GEMINI_API_KEY`, `GEMINI_MODEL` | Pick a model available on your free account and test it; free-tier submissions can be used for product improvement; explicit consent is built in |
| Recovery, verification, email alerts | [Resend](https://resend.com/blog/new-free-tier) free tier | `RESEND_API_KEY`, `EMAIL_FROM` | A [verified domain](https://resend.com/docs/dashboard/domains/introduction) with DNS access is needed to email arbitrary users. The test sender cannot replace domain verification. A domain may cost money if you do not already own one |
| Email without owning a domain | [Mailjet](https://dev.mailjet.com/docs/email-api/getting-started/send-first-email) HTTPS API | `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM` | Verified sender email; free 200/day and 6,000/month quota |
| Browser push | Standard Web Push / VAPID | `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Keys already generated in ignored `.env.push`; use your contact email for `VAPID_SUBJECT`; live browser consent/delivery test |
| Municipal/NGO/sensor APIs | Actual partner endpoints | Source HTTPS URL and authentication; recipient acknowledgement contract if applicable | Partner cooperation, publishing permission and mapping. No generic free API can manufacture institutional response |

No account keys are needed for local rules, cited retrieval, duplicate candidates, saved follows, in-app alerts or share-card generation. An account owner must create provider accounts/keys and grant deployment access; this checkout cannot create those identities on your behalf.

## Real map and Bengaluru registry

`/explore` now defaults to the real OSM street map. Click **Use my location** and allow the browser prompt. A blue marker shows the approximate device position and its accuracy; it is not continuously tracked or automatically published. Desktop positioning can be less precise than phone GPS. Location is separate from the registry: an empty registry does not make the street map fictional.

Keep visible OSM attribution, normal browser caching and Referer headers. Do not prefetch or cache OSM tiles for offline use. The application's service worker caches only its own public shell assets and excludes third-party tiles, API responses and evidence. Automated browser tests intercept tiles so they do not load community-funded map servers. For substantial traffic, configure a licensed alternative with `VITE_MAP_STYLE_URL` or `VITE_MAP_TILE_URL`; OSM tiles are best-effort, not an unlimited production SLA. See [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

The starter import uses a bounding box around Bengaluru: south 12.8, west 77.4, north 13.2, east 77.85. This is a **regional extent, not the official municipal boundary**. OSM records are community mapping, not a verified authority register. Feature centres are imported; exact boundaries, identity reconciliation, subtype and institutional responsibility require review. Each record retains its OSM ID, URL, tags, snapshot time and ODbL licence. Public attribution is required. Existing contributor records are never overwritten by starter import.

To fetch/review a new snapshot, from `backend`:

```text
.venv/Scripts/python.exe -m app.osm_registry --file ../fixtures/bengaluru-osm.json --fetch
```

This prints the count without altering a database. `--commit` imports into the explicitly configured database. Production startup imports the checked-in snapshot when `REGISTRY_STARTER_PATH` is set; it does not query Overpass on every page view. Preserve the snapshot licence when redistributing it.

## Every frozen MVP feature

**Implemented** means an application path exists; it does not mean a cloud service or institutional data source has been verified. **Configuration** means code needs real credentials/data. **Partial** identifies remaining work explicitly.

| # | Feature | Current implementation | Step needed for a live result |
|---|---|---|---|
| 1–2 | Fragmented-data problem; common living identity | Persistent source-linked SQL records and integration adapters | Import permitted datasets and reconcile them to registry IDs |
| 3 | Interactive map | Real OSM basemap, search, workflow markers, browser location | Publish HTTPS site; approve geolocation; load registry |
| 4 | Water-body passport | Identity, incidents, observations, biodiversity, organisations and sources | Populate real records; review starter identity and provenance |
| 5 | Historical timeline | Durable events, actions, dates and historical views | Exercise real incident lifecycle and keep records dated |
| 6 | Aquatic-life reporting | Reviewed citizen form, media, original text, counts, coordinates, idempotent sync | Test cloud upload and assign responsible organisations |
| 7 | Incident lifecycle | Review, scoped transitions, requests, action, closure/reopening | Assign managers and exercise transition permissions |
| 8 | Resolution proof | Closure validation and supporting records | Real inspection/action documents and evidence; do not claim ecological recovery solely from closure |
| 9 | Organisation history | Real directory administration, memberships, actions and linked sources | Verify who organisations are and document responsibility |
| 10 | Nearby and connected waters | Distance context and source-linked relationships | Enter documented connections; no spread prediction |
| 11 | What changed | Stored-event summaries linked to records | Follow, return and verify correct visit/date window; summary is rules-based |
| 12 | Follow water body | Durable follows; in-app, configured email and push jobs | Configure email/push and verify delivery; free host sleep affects timing |
| 13 | Follow area | Saved radius, matched events, removal | Test real location/radius and account isolation |
| 14 | Community evidence | Link a report to existing case and append media | Test second-account contributions and provenance |
| 15 | Duplicate grouping | Explainable time/type/location candidates and human-approved merge | Human review; candidate generation is rules-based, not an AI claim |
| 16 | AquaRelay Connect | CSV/XLSX/JSON, reviewed imports, quarantines, HTTP/webhook connectors | Real source URLs/authentication, units, timezone and identity mapping |
| 17 | AI Mapping Studio | Manual review, reusable mappings; optional Gemini column-name suggestions | Gemini configuration and explicit consent; confirm mappings and missing units |
| 18 | Integration health | Real connector state, sync/retry history, schema changes | Connect real systems; inspect authentication and quarantines |
| 19 | Standards | Scoped SensorThings/STAplus/FHIR export and structural checks | External validator/interoperability tests; full standards certification and clinical One Health integration are not implemented |
| 20 | Natural-language reporting | Local vocabulary drafts plus optional Gemini, original preserved | Confirm structured draft; live Gemini contract test with configured model |
| 21 | Multilingual reporting | Original-language text; limited local English/Hindi/Kannada vocabulary; Gemini multilingual extraction | Native-language quality review; full translated interface is not implemented |
| 22 | Missing evidence assistant | Record-linked workflow checklist and manager-reviewed request draft | Reviewer sends appropriate request; no automatic hazardous sampling instructions |
| 23 | Knowledge graph and retrieval | Relational entities/relationships and cited record search | Populate documented relations; arbitrary multi-hop question answering is not implemented |
| 24 | Sharing/public awareness | Factual cards, PNG downloads, captions, links and supported native share | HTTPS/share test; automatic Instagram publishing is not implemented or claimed |
| 25 | Authority tagging | No automatic tagging or fabricated official accounts | Administrator approval/revocation and optional share-caption selection implemented; obtain independently documented real accounts before approval |
| 26 | Before/after stories | Persisted distinct public photos, dated capture times and explanation | Managers save real comparable photos; dates are contributor assertions |
| 27 | Organisation workspace | Scoped incidents, review, evidence requests, notes, actions, connectors; new registry/field interface | Administrator verifies members and assigns organisation responsibility |
| 28 | Offline capture | Account-scoped IndexedDB drafts, stable retry, production shell cache | Real HTTPS production offline/reconnect test; no offline third-party map tile download |
| 29 | Public API/embed | Public privacy-filtered API, docs and water-body embed | Verify endpoint contract, pagination, CORS and external embedding |
| 30 | AI boundaries | Opt-in structuring/mapping; cited retrieval, rules for duplicates/change/checklists | No pollution prediction, safety scoring or causal diagnosis; test provider failure fallback |
| 31 | Roles | Citizen, volunteer/researcher, manager, platform admin with server checks | Real membership provisioning; organisation managers operate integrations |
| 32 | Main screens | Missing follow/developer/integration routes restored; registry and recovery pages added | Final hosted mobile, accessibility, offline and browser acceptance checks |

## Remaining production acceptance

- Run PostgreSQL tests using `POSTGRES_TEST_URL` pointing to a **disposable test database**, never the live project. These tests intentionally reset their test schema.
- Test cloud media upload/read/delete, live Gemini timeout/schema behavior, actual recovery emails and Web Push delivery. Adapter tests with mocks do not establish provider connectivity.
- Export PostgreSQL and private-bucket backups, restore them into a separate project, and prove a report, photo, comparison and action history survive. Free plans are not a backup strategy.
- Exercise abuse controls behind Render's proxy. Configure trusted proxy addresses deliberately; per-process rate limits are suitable for the single-service pilot, not a distributed high-volume deployment.
- Review privacy notice, retention, contact channel and moderation ownership before inviting the general public. Publish only data you have permission to redistribute.
- Institutional notification is not acknowledgement. Obtain a real recipient endpoint and replay/idempotency receipt contract, then test authentication, retries and acknowledgement separately.
- Complete the specifically marked partial features; do not relabel them complete because the main website deploys.

The deployment configuration is included in this source revision. Frontend and backend are deployed; readiness and registry endpoints have been verified. No production user data or external email was sent during implementation.

Email alternative: Mailjet's HTTPS API supports a verified sender email, with a free allowance of 200 messages/day and 6,000/month. Set MAILJET_API_KEY, MAILJET_SECRET_KEY and EMAIL_FROM in Render. Provider verification is required. Render free hosting blocks SMTP ports, so Gmail SMTP is unsuitable. See https://dev.mailjet.com/docs/email-api/getting-started/send-first-email and https://render.com/docs/free .

Map: real OpenStreetMap tiles, visible attribution and a device-location marker are implemented. Geolocation needs HTTPS or localhost, browser permission and device location services. Desktop location can be approximate. No map API key is required. Public tiles have usage limits; configure VITE_MAP_TILE_URL for a different provider when traffic grows. The 3 October OSM snapshot was imported: 868 explicitly classified features. These are starter identities, not 868 independently verified unique water bodies.



Local verification on 3 October 2026: production frontend build passed; 16 frontend tests passed; 88 backend tests passed, 2 PostgreSQL tests skipped. All eight browser scenarios passed across the restored-design run and a targeted account-navigation selector rerun. Browser server teardown on Windows required interruption after scenario results; public map tiles were intercepted during automation, and live tile connectivity/cloud delivery remain unverified. Local demo preview: http://localhost:5182/explore while the development servers are running; street map is real and registry fixtures are visibly synthetic.

Design constraint: preserve the existing PureFlow hero, section structure, animations, capsule navigation and tracking-card layout. Record-backed content replaces fabricated claims; no alternate landing-page redesign is included.

Live storage verification on 3 October 2026: Render service aquarelay-api deployed commit 6c84f2c with Supabase private storage. A tiny explicitly synthetic image uploaded successfully; its owner downloaded the exact original; anonymous original access and direct public bucket access were denied; deletion succeeded and subsequent owner download returned 410. Both agent-created verification images were removed. Backend regression suite: 91 passed, 2 PostgreSQL concurrency tests skipped. Historical storage verification preceded the production registry launch. Demo mode is now false; real admin provisioning, push setup, backup restore and remaining acceptance gaps are pending. The user chose to omit email delivery. Website design unchanged.



Latest verification (4 October 2026): frontend production build and 19 unit tests passed; backend 108 passed, two disposable-PostgreSQL tests skipped. Case routing preserves acknowledgement state, records assignment provenance and supports an unassigned queue. Administrator social-account review and revocation support explicit optional handle selection. These controls require a real administrator and documented organisations; no authority profiles were fabricated. Map API returns the complete registry independently of the 50-record list page. Earlier dated verification sections describe historical milestones.
