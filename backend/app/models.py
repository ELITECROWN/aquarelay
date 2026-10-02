"""Canonical relational model. JSON fields retain raw provenance without arbitrary execution."""
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from .db import Base

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def uid(prefix):
    return prefix + "-" + uuid4().hex

class Record:
    id = Column(String(80), primary_key=True)
    created_at = Column(String(40), default=utcnow, nullable=False, index=True)
    data = Column(JSON, default=dict, nullable=False)

class Organisation(Record, Base):
    __tablename__ = "organisations"
    name = Column(String(160), nullable=False)
    description = Column(Text, default="")
    contact = Column(String(200), default="")
    synthetic = Column(Boolean, default=False, nullable=False)

class User(Record, Base):
    __tablename__ = "users"
    email = Column(String(254), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(40), default="citizen", nullable=False)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True)
    preferences = Column(JSON, default=dict, nullable=False)

class Membership(Record, Base):
    __tablename__ = "memberships"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=False)
    role = Column(String(40), default="contributor", nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "organisation_id"),)

class LoginSession(Record, Base):
    __tablename__ = "sessions"
    token_hash = Column(String(64), unique=True, nullable=False)
    csrf_token = Column(String(100), nullable=False)
    user_id = Column(String(80), ForeignKey("users.id"), nullable=True)
    expires_at = Column(String(40), nullable=False)

class WaterBody(Record, Base):
    __tablename__ = "waterbodies"
    name = Column(String(160), nullable=False)
    aliases = Column(JSON, default=list, nullable=False)
    type = Column(String(32), nullable=False)
    locality = Column(String(160), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geometry = Column(JSON, default=dict, nullable=False)
    summary = Column(Text, default="")
    synthetic = Column(Boolean, default=False, nullable=False)

class MonitoringSite(Record, Base):
    __tablename__ = "monitoring_sites"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=True)

class Source(Record, Base):
    __tablename__ = "sources"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=True, index=True)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True)
    connector_id = Column(String(80), ForeignKey("connectors.id"), nullable=True)
    name = Column(String(200), nullable=False)
    kind = Column(String(40), default="dataset", nullable=False)
    url = Column(Text, default="")
    license = Column(String(120), default="")
    attribution = Column(Text, default="")
    observed_at = Column(String(40), nullable=True)
    received_at = Column(String(40), default=utcnow)
    source_updated_at = Column(String(40), nullable=True)
    state = Column(String(40), default="connected")
    synthetic = Column(Boolean, default=False, nullable=False)

class Observation(Record, Base):
    __tablename__ = "observations"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=False, index=True)
    external_id = Column(String(200), nullable=True)
    parameter = Column(String(100), nullable=False)
    value = Column(JSON, nullable=False)
    unit = Column(String(80), nullable=True)
    observed_at = Column(String(40), nullable=False, index=True)
    received_at = Column(String(40), default=utcnow)
    source_updated_at = Column(String(40), nullable=True)
    synthetic = Column(Boolean, default=False, nullable=False)
    __table_args__ = (UniqueConstraint("source_id", "external_id", "parameter", name="uq_source_observation"),)

class Biodiversity(Record, Base):
    __tablename__ = "biodiversity"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=False)
    common_name = Column(String(160), nullable=False)
    scientific_name = Column(String(160), default="")
    observed_at = Column(String(40), nullable=False)
    restricted = Column(Boolean, default=False, nullable=False)
    synthetic = Column(Boolean, default=False, nullable=False)

class Case(Record, Base):
    __tablename__ = "cases"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    state = Column(String(40), default="new", nullable=False)
    review_state = Column(String(40), default="unreviewed", nullable=False)
    delivery_state = Column(String(40), default="not_sent", nullable=False)
    observed_at = Column(String(40), nullable=False)
    synthetic = Column(Boolean, default=False, nullable=False)

class Report(Record, Base):
    __tablename__ = "reports"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    client_id = Column(String(100), nullable=False)
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False)
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=False, index=True)
    observation_type = Column(String(80), nullable=False)
    description = Column(Text, nullable=False)
    observed_at = Column(String(40), nullable=False)
    received_at = Column(String(40), default=utcnow)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    count_estimate = Column(JSON, nullable=True)
    language = Column(String(80), default="en")
    synthetic = Column(Boolean, default=False, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "client_id", name="uq_report_replay"),)

class Evidence(Record, Base):
    __tablename__ = "evidence"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=True, index=True)
    report_id = Column(String(80), ForeignKey("reports.id"), nullable=True)
    name = Column(String(200), nullable=False)
    caption = Column(Text, default="")
    original_path = Column(Text, nullable=False)
    public_path = Column(Text, nullable=False)
    sha256 = Column(String(64), nullable=False)
    mime_type = Column(String(80), nullable=False)
    size = Column(Integer, nullable=False)
    visibility = Column(String(32), default="private", nullable=False)
    synthetic = Column(Boolean, default=False, nullable=False)

class Event(Record, Base):
    __tablename__ = "events"
    sequence = Column(BigInteger, unique=True, nullable=False, index=True)
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=True, index=True)
    kind = Column(String(80), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    actor_id = Column(String(80), ForeignKey("users.id"), nullable=True)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=True)
    synthetic = Column(Boolean, default=False, nullable=False)

class Action(Record, Base):
    __tablename__ = "actions"
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=False, index=True)
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    completed_at = Column(String(40), nullable=False)
    evidence_id = Column(String(80), ForeignKey("evidence.id"), nullable=True)
    synthetic = Column(Boolean, default=False, nullable=False)

class Note(Record, Base):
    __tablename__ = "notes"
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=False)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=False)
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    private = Column(Boolean, default=True, nullable=False)

class EvidenceRequest(Record, Base):
    __tablename__ = "evidence_requests"
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=False)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=False)
    description = Column(Text, nullable=False)
    state = Column(String(32), default="open", nullable=False)
    synthetic = Column(Boolean, default=False, nullable=False)

class Subscription(Record, Base):
    __tablename__ = "subscriptions"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=True)
    name = Column(String(160), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_m = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "waterbody_id", name="uq_follow"),)

class Notification(Record, Base):
    __tablename__ = "notifications"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False, index=True)
    event_id = Column(String(80), ForeignKey("events.id"), nullable=False)
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False)
    case_id = Column(String(80), ForeignKey("cases.id"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    read = Column(Boolean, default=False, nullable=False)
    available_at = Column(String(40), default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_notification_dedup"),)

class Connector(Record, Base):
    __tablename__ = "connectors"
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=False)
    name = Column(String(160), nullable=False)
    kind = Column(String(40), default="http_json", nullable=False)
    state = Column(String(40), default="disabled", nullable=False)
    config = Column(JSON, default=dict, nullable=False)
    updated_at = Column(String(40), default=utcnow)
    last_attempt_at = Column(String(40), nullable=True)
    last_success_at = Column(String(40), nullable=True)
    last_observed_at = Column(String(40), nullable=True)
    error = Column(Text, nullable=True)

class MappingVersion(Record, Base):
    __tablename__ = "mapping_versions"
    connector_id = Column(String(80), ForeignKey("connectors.id"), nullable=True)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True)
    version = Column(Integer, default=1, nullable=False)
    schema_hash = Column(String(64), nullable=True)
    schema_fingerprint = Column(String(64), nullable=True)
    mapping = Column(JSON, default=dict, nullable=False)

class ImportRun(Record, Base):
    __tablename__ = "import_runs"
    connector_id = Column(String(80), ForeignKey("connectors.id"), nullable=True)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=True)
    mapping_version_id = Column(String(80), ForeignKey("mapping_versions.id"), nullable=True)
    source_hash = Column(String(64), nullable=True)
    state = Column(String(40), default="preview", nullable=False)
    approved_at = Column(String(40), nullable=True)

class Receipt(Record, Base):
    __tablename__ = "receipts"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=True)
    connector_id = Column(String(80), ForeignKey("connectors.id"), nullable=True)
    organisation_id = Column(String(80), ForeignKey("organisations.id"), nullable=True)
    external_id = Column(String(160), unique=True, nullable=True)
    kind = Column(String(40), default="fhir", nullable=False)
    state = Column(String(40), default="accepted", nullable=False)
    status = Column(String(40), default="accepted", nullable=False)

class Relationship(Record, Base):
    __tablename__ = "relationships"
    waterbody_id = Column(String(80), ForeignKey("waterbodies.id"), nullable=False, index=True)
    target_type = Column(String(40), nullable=False)
    target_id = Column(String(80), nullable=False)
    kind = Column(String(80), nullable=False)
    description = Column(Text, nullable=False)
    source_id = Column(String(80), ForeignKey("sources.id"), nullable=False)
    synthetic = Column(Boolean, default=False, nullable=False)

class Audit(Record, Base):
    __tablename__ = "audit_events"
    actor_id = Column(String(80), ForeignKey("users.id"), nullable=True)
    kind = Column(String(80), nullable=False)
    target_id = Column(String(80), nullable=True)

class Job(Record, Base):
    __tablename__ = "jobs"
    kind = Column(String(40), nullable=False)
    dedup_key = Column(String(200), unique=True, nullable=False)
    state = Column(String(32), default="pending", nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    available_at = Column(String(40), default=utcnow, nullable=False)
    locked_at = Column(String(40), nullable=True)
    error = Column(Text, nullable=True)
    completed_at = Column(String(40), nullable=True)

class Moderation(Record, Base):
    __tablename__ = "moderation"
    user_id = Column(String(80), ForeignKey("users.id"), nullable=False)
    target_type = Column(String(40), nullable=False)
    target_id = Column(String(80), nullable=False)
    reason = Column(Text, nullable=False)
    state = Column(String(40), default="submitted", nullable=False)
