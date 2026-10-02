"""Explicit versioned export adapters, with deliberately scoped structural checks.

These functions do not claim FHIR profile/terminology or complete OGC service conformance.
"""
from collections import defaultdict
from datetime import datetime, timezone
import math
import uuid

LOCAL_SYSTEM = "https://aquarelay.example/CodeSystem/environmental-parameters"
SYNTHETIC_SYSTEM = "https://aquarelay.example/CodeSystem/data-origin"
MEASUREMENT = "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement"


def _id(value):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "aquarelay:" + str(value)))


def _ref(value):
    return "urn:uuid:" + _id(value)


def _meta(synthetic):
    return {"tag": [{"system": SYNTHETIC_SYSTEM, "code": "synthetic" if synthetic else "source-record", "display": "Synthetic demo fixture" if synthetic else "Source record"}]}


def build_fhir(waterbody, observations):
    """FHIR R4 4.0.1 collection: environmental Location/Observation/Provenance."""
    location = {"resourceType": "Location", "id": _id(waterbody.id), "meta": _meta(waterbody.synthetic),
                "name": waterbody.name, "description": "Synthetic demonstration geography" if waterbody.synthetic else "Registered water-body location",
                "mode": "instance", "position": {"longitude": waterbody.longitude, "latitude": waterbody.latitude}}
    entries = [{"fullUrl": _ref(waterbody.id), "resource": location}]
    for record in observations:
        if not isinstance(record.value, (int, float)) or isinstance(record.value, bool) or not math.isfinite(record.value):
            continue
        observation = {"resourceType": "Observation", "id": _id(record.id), "meta": _meta(record.synthetic),
                       "identifier": [{"system": "https://aquarelay.example/source-events", "value": str(record.external_id or record.id)}],
                       "status": "final", "code": {"coding": [{"system": LOCAL_SYSTEM, "code": record.parameter, "display": record.parameter.replace("_", " ")}],
                       "text": "Environmental " + record.parameter.replace("_", " ")}, "subject": {"reference": _ref(waterbody.id)},
                       "effectiveDateTime": record.observed_at, "issued": record.received_at,
                       "valueQuantity": {"value": record.value, "unit": record.unit, "system": "http://unitsofmeasure.org", "code": record.unit},
                       "note": [{"text": "Synthetic demo measurement; no clinical interpretation." if record.synthetic else "Source measurement; no clinical interpretation."}]}
        provenance = {"resourceType": "Provenance", "id": _id("provenance:" + record.id), "meta": _meta(record.synthetic),
                      "target": [{"reference": _ref(record.id)}], "recorded": record.received_at,
                      "agent": [{"who": {"identifier": {"system": "https://aquarelay.example/software", "value": "AquaRelay versioned environmental adapter"}}}],
                      "entity": [{"role": "source", "what": {"identifier": {"system": "https://aquarelay.example/sources", "value": record.source_id or "source-unavailable"},
                      "display": "Original source event " + str(record.external_id or record.id)}}]}
        entries.extend([{"fullUrl": _ref(record.id), "resource": observation}, {"fullUrl": _ref("provenance:" + record.id), "resource": provenance}])
    return {"resourceType": "Bundle", "id": _id("bundle:" + waterbody.id), "meta": _meta(waterbody.synthetic), "type": "collection", "entry": entries}


def _check_fhir(payload):
    """Own subset checks only: required fields, numeric values and contained references."""
    errors = []
    if not isinstance(payload, dict) or payload.get("resourceType") != "Bundle" or payload.get("type") != "collection":
        return {"valid": False, "level": "structural-subset", "fhir_version": "4.0.1", "errors": ["Expected a collection Bundle"], "full_validation": False}
    entries = payload.get("entry", [])
    refs = {x.get("fullUrl") for x in entries}
    if len(refs) != len(entries) or None in refs:
        errors.append("Bundle entries must have unique fullUrl values")
    types = set()
    for entry in entries:
        resource = entry.get("resource", {})
        kind = resource.get("resourceType")
        types.add(kind)
        if kind not in {"Location", "Observation", "Provenance"}:
            errors.append("Unsupported resource type")
        if not resource.get("id"):
            errors.append("Missing resource id")
        if kind == "Location":
            pos = resource.get("position", {})
            if not resource.get("name") or not isinstance(pos.get("latitude"), (int, float)) or not isinstance(pos.get("longitude"), (int, float)):
                errors.append("Location requires name and numeric position")
            elif not -90 <= pos["latitude"] <= 90 or not -180 <= pos["longitude"] <= 180:
                errors.append("Location coordinate range invalid")
        if kind == "Observation":
            if resource.get("status") not in {"registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"}:
                errors.append("Observation status is invalid")
            if not resource.get("code", {}).get("coding") or not resource.get("effectiveDateTime"):
                errors.append("Observation requires coded parameter and observation time")
            if resource.get("subject", {}).get("reference") not in refs:
                errors.append("Observation subject must resolve in Bundle")
            value = resource.get("valueQuantity", {}).get("value")
            if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
                errors.append("Observation quantity must be finite")
        if kind == "Provenance":
            if not resource.get("recorded") or not resource.get("agent") or not resource.get("target"):
                errors.append("Provenance requires target, recorded and agent")
            for target in resource.get("target", []):
                if target.get("reference") not in refs:
                    errors.append("Provenance target must resolve in Bundle")
    if not {"Location", "Observation", "Provenance"}.issubset(types):
        errors.append("Environmental export requires Location, Observation and Provenance")
    return {"valid": not errors, "level": "structural-subset", "fhir_version": "4.0.1", "errors": errors, "full_validation": False,
            "statement": "AquaRelay structural checks only. No HL7 validator, profile, invariant or terminology validation was run."}


def check_fhir(payload):
    try:
        return _check_fhir(payload)
    except (TypeError, AttributeError, KeyError, ValueError):
        return {"valid": False, "level": "structural-subset", "fhir_version": "4.0.1", "full_validation": False,
                "errors": ["Malformed resource, collection or field structure"]}


def build_sensorthings(waterbody, observations):
    """SensorThings 1.1 entity snapshot with STAplus 1.0 Party/License links."""
    thing = {"@iot.id": waterbody.id, "name": waterbody.name, "description": "Registered water body",
             "properties": {"synthetic": waterbody.synthetic, "waterbody_id": waterbody.id}}
    location = {"@iot.id": "loc:" + waterbody.id, "name": waterbody.name, "description": "Synthetic geography" if waterbody.synthetic else "Registered location",
                "encodingType": "application/geo+json", "location": {"type": "Point", "coordinates": [waterbody.longitude, waterbody.latitude]}}
    thing["Locations"] = [location]
    foi = {"@iot.id": "foi:" + waterbody.id, "name": waterbody.name, "description": "Water body referenced by source observation",
           "encodingType": "application/geo+json", "feature": location["location"], "properties": {"waterbody_id": waterbody.id, "synthetic": waterbody.synthetic}}
    groups = defaultdict(list)
    for record in observations:
        groups[(record.source_id, record.parameter, record.unit)].append(record)
    streams, sensors, properties, parties, licenses = [], [], [], [], []
    for (source, parameter, unit), records in groups.items():
        stream_id = _id(f"{waterbody.id}:{source}:{parameter}:{unit}")
        sensor = {"@iot.id": "sensor:" + str(source), "name": "Source record procedure", "description": "Import adapter preserves source measurements; instrument identity is not asserted",
                  "encodingType": "text/plain", "metadata": "Source reference " + str(source)}
        prop = {"@iot.id": parameter, "name": parameter.replace("_", " "), "description": "Explicit mapped environmental parameter", "definition": LOCAL_SYSTEM + "#" + parameter}
        symbol = "°C" if unit == "Cel" else unit
        stream = {"@iot.id": stream_id, "name": waterbody.name + " · " + parameter.replace("_", " "), "description": "Preserved source measurements",
                  "unitOfMeasurement": {"name": "degree Celsius" if unit == "Cel" else "dimensionless" if unit == "1" else unit,
                  "symbol": symbol, "definition": "http://unitsofmeasure.org"}, "observationType": MEASUREMENT,
                  "Thing": {"@iot.id": waterbody.id}, "Sensor": sensor, "ObservedProperty": prop, "Observations": []}
        metadata = records[0].data or {}
        owner = metadata.get("owner")
        supplied_party = metadata.get("staplus_party") or {}
        if supplied_party.get("role") in {"individual", "institutional"} or owner or all(r.synthetic for r in records):
            party = {"@iot.id": "party:" + str(source), "role": supplied_party.get("role", "institutional")}
            display_name = supplied_party.get("displayName") or owner or ("Synthetic source fixture custodian" if all(r.synthetic for r in records) else None)
            if display_name:
                party["displayName"] = display_name
            parties.append(party)
            stream["Party"] = party
        license_uri = metadata.get("license")
        supplied_license = metadata.get("staplus_license") or {}
        if supplied_license.get("definition") or license_uri or all(r.synthetic for r in records):
            license_record = {"@iot.id": "license:" + stream_id, "name": supplied_license.get("name") or ("CC0 synthetic fixtures" if not license_uri and not supplied_license.get("definition") and all(r.synthetic for r in records) else "Source reuse terms"),
                              "definition": supplied_license.get("definition") or license_uri or "https://creativecommons.org/publicdomain/zero/1.0/"}
            if supplied_license.get("attributionText"):
                license_record["attributionText"] = supplied_license["attributionText"]
            licenses.append(license_record)
            stream["License"] = license_record
        for record in records:
            stream["Observations"].append({"@iot.id": record.external_id or record.id, "phenomenonTime": record.observed_at,
                 "resultTime": record.received_at, "result": record.value, "Datastream": {"@iot.id": stream_id},
                 "FeatureOfInterest": foi, "parameters": {"synthetic": record.synthetic, "source_id": record.source_id,
                 "aquarelay_id": record.id}})
        streams.append(stream)
        sensors.append(sensor)
        properties.append(prop)
    return {"Things": [thing], "Locations": [location], "Datastreams": streams, "Sensors": sensors,
            "ObservedProperties": properties, "FeaturesOfInterest": [foi], "Parties": parties, "Licenses": licenses,
            "aquarelay": {"adapter": "SensorThings 1.1 / STAplus 1.0 scoped entity snapshot", "synthetic": waterbody.synthetic,
            "validation": "Structural subset checks only; no complete OGC service conformance claim."}}


def _sensorthings_rows(payload):
    """Accept expanded numeric Observations or this module's Datastream snapshot.

    Navigation URLs are never followed. Every entity relationship must be supplied.
    """
    expanded = []
    if isinstance(payload, dict) and "Datastreams" in payload:
        for stream in payload["Datastreams"]:
            for observation in stream.get("Observations", []):
                expanded.append((observation, stream))
    elif isinstance(payload, dict) and isinstance(payload.get("value"), list):
        expanded = [(x, x.get("Datastream", {})) for x in payload["value"]]
    else:
        raise ValueError("SensorThings adapter requires expanded Observations or Datastreams")
    rows = []
    for observation, stream in expanded:
        if not isinstance(stream, dict) or not isinstance(observation, dict):
            raise ValueError("Invalid SensorThings entity")
        prop = stream.get("ObservedProperty", {})
        definition = prop.get("definition", "")
        parameter = definition.split("#")[-1] if definition.startswith(LOCAL_SYSTEM + "#") else prop.get("name")
        # Unknown definitions/names require an approved parameter mapping later.
        foi = observation.get("FeatureOfInterest", {})
        thing = stream.get("Thing", {})
        waterbody_id = foi.get("properties", {}).get("waterbody_id") or thing.get("properties", {}).get("waterbody_id") or thing.get("@iot.id")
        unit = stream.get("unitOfMeasurement", {}).get("symbol")
        if not stream.get("@iot.id") or not prop or not stream.get("Sensor") or not foi:
            raise ValueError("Expanded SensorThings Datastream, Sensor, ObservedProperty and FeatureOfInterest links are required")
        rows.append({"external_id": str(observation.get("@iot.id", "")), "waterbody_id": str(waterbody_id or ""),
                     "site_name": foi.get("name") or thing.get("name"), "parameter": parameter, "value": observation.get("result"),
                     "unit": "Cel" if unit == "°C" else unit, "observed_at": observation.get("phenomenonTime"),
                     "source_updated_at": observation.get("resultTime"), "synthetic": observation.get("parameters", {}).get("synthetic", False),
                     "sensorthings": {"datastream_id": stream.get("@iot.id"), "feature_of_interest_id": foi.get("@iot.id"),
                         "observed_property": prop, "sensor": stream.get("Sensor"), "party": stream.get("Party"), "license": stream.get("License")}})
    return rows


def sensorthings_rows(payload):
    try:
        return _sensorthings_rows(payload)
    except (TypeError, AttributeError, KeyError) as exc:
        raise ValueError("Malformed SensorThings entity or relationship structure") from exc
