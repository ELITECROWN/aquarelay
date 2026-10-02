# AquaRelay connector contracts

All routes are under `/api/v1`. Organisation managers/reviewers use session cookies and `X-CSRF-Token` for mutations. Connector and import ownership is enforced server-side. Signed webhooks use their own HMAC authentication. Credentials live only in protected server-side configuration: connector database configuration or the institutional directory in API/worker environment settings. Responses omit credential values. Credential query parameters are rejected before DNS lookup. Use protected headers for API keys; never paste them into URLs or dataset fields.

## Reviewed imports

`POST /imports/preview` is multipart: `file`, optional `connector_id`, `label`, and `synthetic`. CSV must be UTF-8 with headers. JSON is an array of objects or `{ "records": [...] }`. XLSX uses the first worksheet, literal cells and unique headers. XLSM, XLS, macros and formulas are rejected. Limits: 5 MiB compressed upload, 40 MiB XLSX expanded content, 2,000 rows, 100 columns, 16,000 characters per cell. The source rows and source hash are retained in a durable ImportRun; uploaded text is never executed. Remote photo references are retained as data and are not fetched or promoted to evidence automatically.

Response includes `id`, `columns`, `rows`, `suggestions`, `records`, `issues`, `schema_changed`, and `synthetic`. Suggestions use exact documented field names and are labelled **Rules-based assistance**. Units, timezone, abbreviated parameter meanings and site identity are never inferred.

`POST /imports/:id/transform`:

```json
{
  "mapping": {"external_id":"external_id","site_name":"site_name","observed_at":"observed_at","water_temp":"temperature","ph_level":"ph"},
  "units": {"temperature":"degC","ph":"1"},
  "timezone": "Asia/Kolkata",
  "waterbody_id": null,
  "parameter_map": {}
}
```

Mapping keys are **source fields**; values are canonical destinations. Supported destinations: `external_id`, `site_name`, `waterbody_id`, `observed_at`, `source_updated_at`, `temperature`, `ph`, `dissolved_oxygen`, `parameter`, `value`, `unit`, `latitude`, `longitude`, `photo`. Generic `parameter`/`value` requires a supported parameter or explicit `parameter_map`. Units: temperature `degC`/`Cel`/`°C` or `degF`/`[degF]`/`°F`; pH `1`; dissolved oxygen `mg/L`. Approved Fahrenheit values convert to Celsius with the conversion, original value and original unit preserved. Source timestamps normalize to UTC; timezone-free times require an explicit IANA timezone. Ambiguous/nonexistent daylight-saving times need an explicit offset.

`POST /imports/:id/approve` commits only ready rows, quarantines unresolved/rejected rows, and retains row-level reasons. Preview and transform do not change observations. Approval is immutable and replay safe. `GET /imports/:id` reloads a persisted run. Counts are rows: `imported`, `duplicate`, `rejected`, `unresolved`, `ready`, `total`.

File dataset identity is the organisation plus dataset `label` (filename default). Reupload the same dataset under the same label or pass its connector ID. Each canonical observation is unique by source + external event ID + parameter. Without an external event ID, a stable hash of the entire original row is used. A changed value for an existing event is quarantined for correction review; historical observations are preserved. A changed schema requires review and a newly approved mapping version before automated sync.

## HTTP JSON and SensorThings connectors

`GET /connectors` returns `{items}`. `POST /connectors` accepts `{name,kind,url?}` with `kind` `http_json`, `sensorthings`, `file`, or the individually labelled `demo_fixture` simulation. `GET /connectors/:id` includes connector health, durable runs and mapping versions. `POST /connectors/:id/configure` accepts URL, allowed credential headers (`Authorization`, `X-API-Key`), webhook secret, mapping settings, `stale_after_hours` (default 72), and optional `poll_interval_minutes` (1–10,080; null disables polling).

Only public HTTPS port 443 is permitted. DNS must resolve exclusively to public addresses. The transport connects to the checked IP while using the original hostname for TLS SNI/certificate verification, preventing a second DNS lookup from reaching a private address. Proxy environment variables are not used. Every redirect is resolved and checked again; maximum three redirects. Credential headers are sent only to the original hostname. Timeout is eight seconds; responses are bounded to 5 MiB. No arbitrary code, subprocess, HTTP method or network port is user-configurable.

HTTP JSON requires an array of objects or `{records:[...]}`. SensorThings accepts expanded `Observations` in `{value:[...]}` with Datastream/Sensor/ObservedProperty/FeatureOfInterest, or the documented AquaRelay Datastream snapshot. Navigation URLs are never followed. Unsupported parameters remain unresolved until explicitly mapped.

`POST /connectors/:id/test` actually fetches the source and saves a reviewable preview; it does not imply imported observations. Approve that preview to establish a mapping. `sync` requires the approved mapping and matching schema. `pause` prevents sync/webhook intake; reconfigure to resume. `test`/`sync` report `{ok,error?,connector,preview?,run?}`. Failed fetches persist `state:error`, an error, last attempt and retry history. Manual sync enforces exponential retry backoff (15 seconds doubling, capped at one hour). Configured polling runs through durable SQL jobs: the worker queues due connectors only after mapping approval, skips paused/disabled sources and deduplicates pending work. The mapping approver must still hold organisation permissions. Failed jobs retry with worker backoff, while the connector also enforces its next permitted attempt; retry history records actual fetch failures. The health response shows the next poll and retry dates. Last successful sync and latest source observation remain distinct. Older timestamps produce `stale` health without erasing observations.

The `demo_fixture` adapter is available only in DEMO_MODE. It reads an internal synthetic dataset and never bypasses HTTPS restrictions for a remote URL. Its source name and responses identify a **Demo scenario**. Test, map and approve it before sync/polling. `POST /connectors/:id/scenario` with `{state:"failure"}` causes the next attempt to fail and records the actual failed attempt; `{state:"recovered"}` restores the synthetic adapter and explicitly resets its simulation retry delay. Run Test/Sync to verify recovery. Existing measurements remain intact and repeated source event IDs become duplicates. This local simulation is not a live sensor, municipality or government integration.

## Signed webhooks

`POST /webhooks/:connector_id` expects raw JSON `{event_id,records}`. Signature headers:

```
X-AquaRelay-Timestamp: <Unix seconds>
X-AquaRelay-Signature: sha256=<HMAC_SHA256(secret, timestamp + "." + raw_body)>
```

Five-minute timestamp window; constant-time signature comparison. Receipt identity is connector + event ID. Exact replay returns the same receipt and run, while changed payloads under the same event ID return 409. Webhooks retain a reviewable preview and do not bypass approval or create authoritative observations on receipt.

## Standards handoffs and local receiver

Public `GET /standards/:waterbody_id/fhir` returns an actual FHIR JSON Bundle. `sensorthings` returns a documented entity snapshot. `POST /handoffs/:waterbody_id` accepts `{format:"fhir"|"sensorthings",client_id?}` and queues a durable SQL job. Worker processing persists a separate local receiver receipt and marks delivery; `acknowledged:false` distinguishes payload delivery from organisational response. `GET /receipts` and `GET /receipts/:id` show durable results and retained payloads. Authenticated `POST /demo/receiver` validates and stores an actual supported payload. All receiver routes are disabled outside DEMO_MODE. There is no claimed municipality, hospital or other live recipient.

## Configured institutional delivery adapter

Operators may configure `HANDOFF_RECIPIENTS_JSON` in server/worker environments. It maps an organisation ID to one approved recipient. It is not a public or browser URL-fetch feature; user payloads cannot select arbitrary destinations or credentials. Example configuration (reserved example address is a placeholder):

```json
{"org-reedwatch":{"name":"Configured institutional recipient","url":"https://recipient.example/fhir","headers":{"Authorization":"Bearer <server-secret>"},"contract":"aquarelay-handoff-v1","idempotency_supported":true}}
```

Keep the same configuration on API and worker processes. Store real secrets through the deployment's protected environment/secrets mechanism; never commit them. Allowed credential headers are Authorization and X-API-Key. Public capability responses and receipts omit recipient URLs and credentials. `GET /handoff-capabilities` is organisation-scoped and reports `local_demo` and `institutional` availability, display name and supported formats.

`POST /handoffs/:waterbody_id` accepts `{recipient:"institutional",format:"fhir",client_id:"unique-client-handoff-id"}`. This queues the existing durable handoff job with a privacy-filtered supported FHIR Bundle snapshot. Missing/invalid configuration returns 503 while standards export remains available. The adapter supports FHIR R4 only; local demo handoffs also support the documented SensorThings snapshot. In DEMO_MODE an omitted recipient keeps the local demo path; outside DEMO_MODE it selects the configured institutional path.

The server validates public HTTPS/443 before queueing and again during delivery, connects to the checked IP with original-host TLS certificate verification, limits transport timeout to eight seconds and response/payload size to 5 MiB, and revalidates every 307/308 redirect. Institutional POST redirects must remain on the same recipient hostname; other redirect statuses are errors. Proxy environment variables are not used. A queued recipient configuration change fails that attempt instead of silently moving its payload to another destination.

The recipient must honour the stable `Idempotency-Key` header, which equals the AquaRelay handoff receipt ID. Five bounded worker attempts use persisted job backoff; failures retain a `retrying`/`failed` receipt, attempt history and an explicit error. A successful 2xx response produces a stored institutional delivery receipt; `receipt_id` from the JSON body or `X-Receipt-ID` header is retained when provided. When the endpoint supplies no external ID, the receipt explicitly keeps it null rather than inventing one. Local transport success cannot guarantee the external system honours idempotency; operators must verify that recipient contract before enabling it.

HTTP acceptance remains `delivered` with `acknowledged:false`. An acknowledgement is recognised only from the configured endpoint's explicit versioned JSON receipt bound to the same Idempotency-Key:

```json
{"contract":"aquarelay-handoff-v1","idempotency_key":"rec-handoff-...","receipt_id":"remote-delivery-123","acknowledgement":{"status":"acknowledged","receipt_id":"remote-ack-123","received_at":"2026-10-02T06:30:00Z"}}
```

This records the configured recipient's assertion of acknowledgement, including its receipt ID and timestamp; it does not claim an independent audit of a human response or a partnership. An arbitrary `acknowledged:true`, a mismatched key, missing fields or an invalid timezone does not count as acknowledgement. Tests substitute only the remote network boundary; no live institutional endpoint was contacted during verification.

The fixture files under `fixtures/` are invented demonstration data released CC0. They intentionally omit temperature units and timezone. Map temperature to `degC`, pH to `1`, and timezone to `Asia/Kolkata` to resolve the synthetic import.
