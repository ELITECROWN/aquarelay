# AquaRelay API v1

The running FastAPI specification is `/api/openapi.json`; interactive docs are `/api/docs` and `/api/redoc`. Local development uses `http://localhost:8000`. The Vite app proxies `/api` to that server. In Compose, the frontend and API share port 8000.

## Public reads

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/waterbodies?page=1&page_size=20` | Paginated registry; supports `q`, `type`, `state`, `availability`, `start`, `end`, and optional coordinate/radius filters. |
| `GET /api/v1/waterbodies/{id}?as_of=2026-05-20` | Passport with events, observations, sources, actions, cases, biodiversity and sourced relationships. Date cutoffs do not substitute future closure details. |
| `GET /api/v1/cases?page=1&page_size=20` | Paginated public case records. |
| `GET /api/v1/cases/{id}` | Original reports, public evidence, actions, public notes, requests and workflow history. |
| `GET /api/v1/actions?page=1&page_size=20` | Paginated documented activities. |
| `GET /api/v1/sources?page=1&page_size=20` | Paginated source metadata. |
| `GET /api/v1/sources/{id}` | Source origin, attribution, licence, dates and current operational status. |
| `GET /api/v1/organisations/{id}` | Published contact, contributed sources, responsibilities and actions. |
| `GET /api/v1/events?after={cursor}` | Committed events after a server cursor. |
| `GET /api/v1/events/stream?after={cursor}` | SSE updates, heartbeat and reconnection; honours both the query cursor and `Last-Event-ID`. |
| `GET /api/v1/embed/{id}` | Working read-only HTML card; synthetic labels remain visible. |
| `GET /api/v1/standards/{id}/fhir` | Documented FHIR R4 4.0.1 demonstration Bundle. |
| `GET /api/v1/standards/{id}/sensorthings` | Scoped SensorThings/STAplus entity snapshot. |

Pagination bounds and parameter types are authoritative in OpenAPI. A synthetic sample response is saved in `api-examples/waterbodies.json`. The sample is an actual public API response, with `synthetic:true`, not a claim about real geography.

```powershell
Invoke-RestMethod 'http://localhost:8000/api/v1/waterbodies?page=1&page_size=2'
Invoke-RestMethod 'http://localhost:8000/api/v1/cases/case-historical'
```

## Authenticated operations

`GET /auth/session` supplies an anonymous or authenticated CSRF token. Login/register rotate the session. Cookie-authenticated mutations require `X-CSRF-Token` and an allowed Origin; the signed webhook adapter uses its own HMAC contract instead. Sessions use HttpOnly cookies; production HTTPS requires `COOKIE_SECURE=true`.

Citizens can submit `/reports`, upload `/evidence`, follow `/following/{waterbody_id}`, save `/areas`, manage `/preferences`, read notifications and request reopening. Report retries retain the same client ID and do not create another report. The related-case candidate endpoint gives bounded reasons rather than merging records.

Organisation managers can review individual reports; record case transitions, notes, requests and actions; approve/correct duplicate links; import datasets; manage their connectors; and request configured handoffs. Every mutation checks membership and record ownership on the server. Closing requires a supported category, explanation, completion date and a case-owned supporting evidence/action record.

Connector, import, webhook, standards-validation and institutional receipt contracts are documented in `CONNECTOR_CONTRACTS.md` and `SUPPORTED_STANDARDS.md`. Example response fields and complete request schemas are generated in OpenAPI.

## Privacy and errors

Public responses omit private notes, reporter contact information, protected originals, restricted species coordinates and credentials. Public derivatives strip image metadata; video derivatives also remove audio. Governed evidence redaction/deletion is audited. Source links redact credential query fields.

The API returns 401 for required authentication, 403 for organisation/ownership/CSRF failures, 404 for absent records, 409 for conflicting replay/configuration, 422 for invalid data, 429 for rate/backoff limits and 503 for unavailable configured capabilities. Public reads and sign-in are rate limited. Errors do not fabricate a successful delivery or a scientific conclusion.
