# AquaRelay canonical data dictionary

All records have stable prefixed IDs, created_at and a JSON data extension field. Foreign keys connect authoritative identities; JSON retains approved configuration, original values and versioned context. Seeded records and every derived export are synthetic. Times are UTC ISO values.

| Entity/table | Core fields and relationships | Meaning / privacy |
|---|---|---|
| User / users | email unique, name, password_hash, role, organisation_id, preferences | Contacts and password hashes never appear in public responses. |
| Organisation / organisations | name, description, contact, synthetic, verification/source metadata | Directory contact is deliberately published; synthetic groups claim no official status. |
| Membership / memberships | user_id, organisation_id, role; unique pair | Server authorisation uses membership and assigned organisation. |
| LoginSession / sessions | token_hash unique, csrf_token, user_id, expires_at | Opaque cookie secret stays outside public APIs; hashes persisted server-side. |
| WaterBody / waterbodies | name, aliases, type, locality, latitude, longitude, GeoJSON geometry, summary, synthetic | Shared registry identity. PostGIS geog/geom generated fields are indexed. No environmental health score. |
| MonitoringSite / monitoring_sites | waterbody_id, name, coordinates, source_id | Source-backed sampling-site identity; PostGIS point index. |
| Source / sources | waterbody_id optional, organisation_id, connector_id optional, name, kind, URL, license, attribution, observed_at, received_at, source_updated_at, state | Multisite sources also join passports through observations/events. URL secrets are redacted. Connected does not imply current. |
| Observation / observations | waterbody_id, source_id, external_id, parameter, value, unit, observed_at, received_at, source_updated_at, synthetic | Unique source/external ID/parameter; explicit units and timezone. Prior corrections remain preserved/quarantined. |
| Biodiversity / biodiversity | waterbody_id, source_id, common/scientific names, observed_at, restricted, synthetic | Public output is water-body level; no restricted precise locations. |
| Case / cases | waterbody_id, organisation_id, title, description, state, review_state, delivery_state, observed_at, synthetic | Case work is separate from report review/delivery. JSON retains closure metadata, merge trail and reopening requests. |
| Report / reports | user_id, client_id, waterbody_id, case_id, type, original description, observed/received time, approximate position, count_estimate, language, synthetic | Unique user/client ID. Original authorship and case ID preserved through merge; reporter/coordinates filtered publicly. JSON review state/history: submitted, needs_information, accepted_for_investigation, duplicate, rejected. |
| Evidence / evidence | owner user_id, case_id/report_id optional, name/caption, private/public paths, sha256, MIME, size, visibility, synthetic | Private originals and sanitised public media. Deleted files have durable governance/audit records. Hash is integrity only. |
| Event / events | unique sequence, waterbody_id, case_id optional, kind, title, description, actor_id, source_id optional, synthetic | Append-only public dated history. Event data contains immutable transition/closure context; actor contacts excluded. |
| Action / actions | case_id, waterbody_id, organisation_id, title, description, completed_at, evidence_id optional, synthetic | An organisation-recorded activity; no automatic restoration inference. |
| Note / notes | case_id, organisation_id, user_id, text, private | Private notes are organisation-scoped and excluded from passports/export/embed/SSE. |
| EvidenceRequest / evidence_requests | case_id, organisation_id, description, state, synthetic | An authorised reviewer request; no automatically invented scientific protocol. |
| Subscription / subscriptions | user_id, waterbody_id optional, saved-area name/center/radius | Unique user/waterbody pair; area follows are explicit, without continuous tracking. |
| Notification / notifications | user_id, event_id unique per user, waterbody_id, case_id, title, description, read, available_at | Persistent in-app deliveries. JSON digest event IDs preserve links; available_at implements quiet/daily scheduling. |
| Connector / connectors | organisation_id, name, kind, state, server-only config, attempts/success/observed dates, error | Secrets are server-side/redacted. Polling requires approved mapping. Demo fixture source is individually labelled. |
| MappingVersion / mapping_versions | connector_id, organisation_id, version, schema_hash/fingerprint, mapping, approval data | Versioned manual decisions; units/timezone are explicit and changed schemas require review. |
| ImportRun / import_runs | connector_id, organisation_id, source_id, mapping_version_id, source_hash, state, approved_at | Retains raw/transformed records, row issues and actual counts. |
| Receipt / receipts | waterbody_id, connector_id/organisation_id optional, unique nullable external_id, kind, state/status, payload/validation metadata | Queued/delivered/failed and received receipts are distinct. Demo receiver does not imply authority acknowledgement. |
| Relationship / relationships | waterbody_id, typed target_id/type, kind, description, mandatory source_id, synthetic | Source-backed edges; nearby distance is never a hydrological connection. |
| Audit / audit_events | actor_id, kind, target_id, reason/context data | Restricted operational audit for transitions, review, merge corrections, governance and imports. |
| Job / jobs | kind, unique dedup_key, state, attempts, available_at, locked_at, completed_at, error, payload data | Durable notification, handoff, connector and file-removal outbox; bounded retry and lease recovery. |
| Moderation / moderation | user_id, target_type/id, reason, state | Signed-in abuse submissions; no fabricated moderation resolution. |

Report review and delivery states are intentionally independent of case state. Stored workflow values are new, acknowledged, investigating, action_in_progress, closed and reopened, with an optional under_review stage; new is an open case. Outcome categories are action_documented_completed, closed_without_confirmed_cause, duplicate_case and no_further_action_recorded. Explanations, organisation attribution, dates and case-owned supporting records are required for closure.
