# Integration implementation and verification

Implemented in `backend/app/integrations.py` and `backend/app/standards.py`. Authoritative records are SQL-backed; there is no browser-only integration state.

## Working local capabilities

- CSV, XLSX and JSON source preview; exact-name rules-based suggestions; explicit manual mappings, units, timezone and unique water-body identity; transformed previews; immutable approval with row counts and quarantine reasons.
- Versioned mappings and schema fingerprints, stable dataset identities, source event IDs, raw payload references, original values and approved conversion provenance. Replays preserve a single observation; conflicting source corrections are quarantined and prior observations remain.
- Protected XLSX parsing without formulas/macros, limits on uploads/expanded workbooks/rows/cells, and a formula-neutralization helper for future CSV value exports. The downloadable fixture CSV contains authored literals only.
- Organisation-scoped connector/import/receipt endpoints and credential redaction. Public HTTPS fetching validates every DNS answer and redirect, rejects private/reserved/multicast addresses, pins the checked IP with the original TLS hostname, rejects credential query strings, avoids proxy environment variables, bounds responses and timeouts, and limits credential forwarding to the original host.
- HTTP JSON and expanded SensorThings source adapters. Test connection retains a source preview; manual and durable scheduled sync require an approved mapping and unchanged schema. Configurable SQL-backed polling is disabled until approved; pause and exponential retry/backoff are enforced. Actual failures, source observation date, last success, quarantines and retry history remain separate.
- Signed HMAC webhooks with a five-minute timestamp window and connector/event replay receipts. Incoming events retain a reviewable preview and do not bypass mapping approval.
- Actual FHIR R4 4.0.1 Location/Observation/Provenance collection Bundle exports, scoped SensorThings 1.1 entity snapshots and STAplus 1.0 public Party/License semantics. Explicit supplied ownership role and reuse terms are retained; authentication identifiers are excluded from public metadata. Structural checks are labelled as a subset.
- Local demo receiver actually validates and persists payload receipts. SQL handoff jobs persist a receiver receipt before marking delivery. `acknowledged:false` keeps delivery distinct from an organisation's response.
- Server-configured institutional FHIR delivery through the same durable outbox, public HTTPS/443 checked-IP/TLS transport, same-origin redirect revalidation, bounded responses and stable idempotency keys. Server-held recipient URLs and headers are omitted from browser responses. Missing configuration leaves export available and delivery unavailable. HTTP acceptance persists a delivery receipt; only a versioned acknowledgement receipt bound to the original request changes acknowledgement status.
- Individually labelled `demo_fixture` source with an explicit Demo scenario fail/recover control. The failure follows the same durable source history/backoff paths, and recovery replays stable synthetic event IDs. It is disabled outside DEMO_MODE and never changes live URL-fetch restrictions.
- Authenticated downloadable synthetic CSV/JSON/XLSX samples at `/imports/sample/:format`; source-and-license details in `docs/CONNECTOR_CONTRACTS.md`.

## Checks run

On 2 October 2026, from the backend directory:

```powershell
.venv/Scripts/python -m pytest tests/test_integration_units.py tests/test_integrations_api.py tests/test_institutional_handoffs.py -q
```

Latest owned-suite result: **41 passed**, one upstream Starlette/AnyIO BlockingPortal deprecation warning. Coverage includes missing units/timezones, explicit conversion, ambiguous sites, nonfinite values, source update dates, duplicate CSV headers, macro/formula rejection, query credentials, private URLs, private redirects, checked-IP/TLS hostname pinning, malformed standards payloads, supported entity links, explicit STAplus metadata, approval and import replay, correction quarantine/schema change, scoped permissions, redaction, actual failure/backoff/recovery/stale status, XLSX fixture download/import, webhook replay, standards receipt persistence and durable polling/handoff replay. Seven outgoing adapter regressions additionally verify missing/blocked configuration, server credential privacy, actual persisted job success/failure/recovery, remote receipt IDs, stable replay keys, explicit acknowledgement binding, private redirect rejection, supported FHIR content type and bounded responses.

The complete backend command `.venv/Scripts/python -m pytest -q` was rerun after the outgoing adapter changes: **68 passed, 2 skipped**, one upstream deprecation warning. The PostgreSQL commit-order and PostGIS missing/provided-geometry tests require `POSTGRES_TEST_URL` and a running dedicated PostgreSQL test database, which were unavailable. Earlier development failures in assistance/foundation and shared login-limiter fixture isolation were reported and resolved; there are no failing tests in the latest observed full run.

Windows sandbox-created temporary directories were inaccessible to SQLite, so these persisted-database tests ran through the approved escalated command with the project's virtual environment. No live remote endpoint or external credential was required.

## Deliberate limits

- Full HL7 Java/profile/invariant/terminology validation and OGC CITE service conformance did **not** run. The structural validators and receiver explicitly state `full_validation:false`.
- SensorThings output is an entity snapshot, not a full OData/CRUD/MQTT/tasking service. STAplus supports public Party/License metadata only, not complete ownership administration, Campaign or ObservationGroup services.
- Live network integrations require operator configuration and credentials. Their transport uses safe public HTTPS, while automated tests replace only the external network boundary. No live institutional recipient was contacted. The recipient must independently implement the declared idempotency contract; local success cannot certify remote behaviour. The internal source demo is a labelled simulation, not a real instrument or institution.
- Source corrections remain quarantined for review; no unattended overwrite or invented environmental interpretation occurs. Photo URLs remain source references and are never automatically fetched as evidence.
- Docker/PostGIS container restart persistence, deployment, external receiver acknowledgement and complete UI/browser journeys are verified by the root implementation workflow, not asserted by this report.

References and supported fields are documented in `docs/SUPPORTED_STANDARDS.md`; exact API shapes and source limits are in `docs/CONNECTOR_CONTRACTS.md`.
