# Supported standards and validation boundaries

AquaRelay uses its SQL canonical model as the source of truth and explicit versioned adapters. Imports and exports do not diagnose water condition or add a patient, diagnosis, clinical interpretation, invented LOINC code, or incident state to FHIR status.

## FHIR R4 4.0.1

Environmental demonstration exports use a `Bundle` with `type:collection`, deterministic UUID full URLs, one `Location`, numeric environmental `Observation` resources, and one `Provenance` per Observation. Observation.subject references the Location, effectiveDateTime is observed time, issued/Provenance.recorded preserve receipt time. Source event identifiers and source references are retained. `status:final` means the source measurement is available as a finalized measurement record; it says nothing about incident closure, review or water safety. Synthetic resources carry explicit `meta.tag` provenance and measurement notes.

Parameter coding uses the clearly local system `https://aquarelay.example/CodeSystem/environmental-parameters`; this is a vocabulary identifier in a reserved example domain, not a claimed globally registered terminology. Supported numeric units are UCUM `Cel`, `1`, and `mg/L`. No external terminology mapping is asserted.

`check_fhir()` checks the supported Bundle shape, unique fullUrl values, selected mandatory fields, finite quantities, coordinate ranges and internal reference resolution. Its result says `level:structural-subset`, `fhir_version:4.0.1`, `full_validation:false`. Export headers and persisted receiver receipts repeat that boundary. **The HL7 Java validator, profile validation, full invariant validation and terminology validation have not run.** An accepted receiver receipt proves the local subset check and persistence, not full FHIR conformance or recipient acknowledgement.

The server-configured institutional delivery adapter POSTs this same supported Bundle to an operator-approved public HTTPS endpoint through the durable handoff outbox. The `aquarelay-handoff-v1` delivery/acknowledgement receipt contract is local application JSON metadata, **not a FHIR standard or clinical workflow status**. No live recipient, endorsement or interoperability certification is implied by having the adapter. The exact configuration, idempotency and acknowledgement boundaries are documented in `CONNECTOR_CONTRACTS.md`.

Official references consulted: [FHIR R4 Observation](https://hl7.org/fhir/R4/observation.html), [Location](https://hl7.org/fhir/R4/location.html), [Provenance](https://hl7.org/fhir/R4/provenance.html), [Bundle](https://hl7.org/fhir/R4/bundle.html).

## OGC SensorThings API 1.1 subset

The export is a **supported entity snapshot**, not a complete SensorThings API service. It preserves Thing, Location, Datastream, Sensor (source procedure, without asserting a real instrument), ObservedProperty, Observation and FeatureOfInterest. Datastreams group source/parameter/unit and contain the required unitOfMeasurement object and observationType. Observations retain numeric result, phenomenonTime, resultTime, source event IDs, Datastream relationship and FeatureOfInterest. Geometry is GeoJSON longitude/latitude. The import adapter requires expanded relationships and never fetches arbitrary navigation links.

The local coding system identifies supported environmental parameters. Unrecognized property definitions/names require explicit operator mapping. Local structural/roundtrip checks cover the supported fields and links. No OGC CITE service conformance suite, full CRUD navigation surface, OData query semantics, historical location operations, tasking or MQTT support is advertised.

## STAplus 1.0 metadata subset

Datastream `Party` metadata preserves an explicitly provided custodian and role; `License` preserves an explicit reuse definition URI. Synthetic fixtures use an institutional fixture custodian and CC0 license. Real source records receive no invented owner or license. This is Party/License semantics support only. Complete STAplus authentication, entity control information, Campaign, ObservationGroup, Relation and ownership administration requirements are outside the claim.

Official references consulted: [OGC SensorThings API Part 1: Sensing 1.1](https://docs.ogc.org/is/18-088/18-088.html), [OGC STAplus 1.0](https://docs.ogc.org/is/22-022r1/22-022r1.html).
