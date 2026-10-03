import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Download,
  FileText,
  MessageSquare,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api";
import { useSession } from "../session";
import ShareModal from "./ShareModal";
import ResolutionStory from './ResolutionStory';
import {
  date,
  errorText,
  label,
  Loading,
  Notice,
  Pill,
  useRecord,
  WorkflowHeader,
} from "./workflowShared";

type Item = {
  id: string;
  title?: string;
  description?: string;
  text?: string;
  created_at?: string;
  observed_at?: string;
  completed_at?: string;
  name?: string;
  url?: string;
  caption?: string;
  synthetic?: boolean;
  actor_name?: string;
  organisation_name?: string;
  organisation_id?: string;
  actor_organisation_name?: string;
  source_id?: string;
  case_id?: string;
  private?: boolean;
  language?: string;
  count_estimate?: string | number;
  evidence_id?: string;
  outcome?: string;
  state?: string;
  mime_type?: string;
  derivative_notice?: string;
  review_state?: string;
  review_history?: Record<string, unknown>[];
};
type CaseRecord = {
  id: string;
  waterbody_id: string;
  waterbody_name: string;
  title: string;
  description: string;
  state: string;
  review_state: string;
  delivery_state: string;
  organisation_id?: string;
  created_at: string;
  observed_at: string;
  synthetic: boolean;
  outcome?: string;
  outcome_category?: string;
  completed_at?: string;
  supporting_record?: string;
  merged_into?: string;
  merge_history?: Record<string, unknown>[];
  reopening_requests?: {
    id: string;
    reason: string;
    state: string;
    created_at: string;
  }[];
};
type Detail = {
  case: CaseRecord;
  reports: Item[];
  evidence: Item[];
  events: Item[];
  actions: Item[];
  evidence_requests: Item[];
  delivery: Item[] | Record<string, unknown>;
  notes?: Item[];
  merged_cases?: CaseRecord[];
};
const nextStates: Record<string, string[]> = {
  new: ["acknowledged", "under_review"],
  open: ["acknowledged"],
  under_review: ["acknowledged", "investigating"],
  acknowledged: ["investigating"],
  investigating: ["action_in_progress", "closed"],
  action_in_progress: ["investigating", "closed"],
  closed: ["reopened"],
  reopened: ["investigating", "acknowledged"],
};
const outcomeCategories: Record<string, string> = {
  action_documented_completed: "Action documented as completed",
  closed_without_confirmed_cause: "Closed without a confirmed cause",
  duplicate_case: "Duplicate case",
  no_further_action_recorded: "No further action recorded",
};
export default function IncidentPage() {
  const { id } = useParams();
  const { user } = useSession();
  const record = useRecord<Detail>(`/api/v1/cases/${id}`);
  const relatedCases = useRecord<{ items: CaseRecord[] }>(
    "/api/v1/cases?page_size=100",
  );
  const [share, setShare] = useState(false),
    [form, setForm] = useState("transition"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [state, setState] = useState(""),
    [reason, setReason] = useState(""),
    [outcome, setOutcome] = useState(""),
    [outcomeCategory, setOutcomeCategory] = useState(""),
    [completion, setCompletion] = useState(""),
    [evidenceId, setEvidenceId] = useState(""),
    [supporting, setSupporting] = useState("");
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [privateNote, setPrivateNote] = useState(false),
    [review, setReview] = useState("reviewed");
  const [shareAction, setShareAction] = useState<Item>(),
    [abuseReason, setAbuseReason] = useState(""),
    [moderationId, setModerationId] = useState("");
  const [reportReviewId, setReportReviewId] = useState(""),
    [reportReviewState, setReportReviewState] = useState(
      "accepted_for_investigation",
    ),
    [reportReason, setReportReason] = useState(""),
    [mergeTarget, setMergeTarget] = useState(""),
    [reopenReason, setReopenReason] = useState(""),
    [reopenId, setReopenId] = useState("");
  if (record.loading) return <Loading />;
  if (record.error || !record.data)
    return (
      <div className="wf-page">
        <Notice error>{record.error || "Incident not found."}</Notice>
        <button className="wf-button secondary" onClick={record.reload}>
          Retry
        </button>
      </div>
    );
  const detail = record.data,
    incident = detail.case,
    canManage =
      !!user &&
      ["manager", "admin", "reviewer"].includes(user.role) &&
      user.organisation_id === incident.organisation_id;
  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let path = "transition",
        body: Record<string, unknown> = { state, reason };
      if (form === "transition" && state === "closed")
        body = {
          ...body,
          outcome_category: outcomeCategory,
          outcome,
          completed_at: new Date(completion).toISOString(),
          evidence_id: evidenceId || undefined,
          supporting_record: supporting || undefined,
        };
      if (form === "action") {
        path = "actions";
        body = {
          title,
          description,
          completed_at: new Date(completion).toISOString(),
          evidence_id: evidenceId || undefined,
        };
      }
      if (form === "note") {
        path = "notes";
        body = { text: description, private: privateNote };
      }
      if (form === "request") {
        path = "requests";
        body = { description };
      }
      if (form === "review") {
        path = "review";
        body = { review_state: review, reason };
      }
      if (form === "merge") {
        path = incident.merged_into ? "unmerge" : "merge";
        body = {
          reason,
          ...(incident.merged_into ? {} : { target_case_id: mergeTarget }),
        };
      }
      await api(`/api/v1/cases/${id}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Update saved to the case history.");
      setReason("");
      setTitle("");
      setDescription("");
      setState("");
      record.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const exportCase = async () => {
    try {
      const result = await api(`/api/v1/cases/${id}/export`);
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `aquarelay-${id}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(href), 500);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <div className="wf-page">
      <Link className="wf-back" to={`/waterbodies/${incident.waterbody_id}`}>
        <ArrowLeft size={16} />
        Water body passport
      </Link>
      <WorkflowHeader
        eyebrow={`Incident · ${incident.id}`}
        title={incident.title}
        description={incident.waterbody_name}
      >
        <button
          className="wf-button secondary"
          onClick={() => {
            setShareAction(undefined);
            setShare(true);
          }}
        >
          <Share2 size={17} />
          Share update
        </button>
      </WorkflowHeader>
      {incident.synthetic && (
        <div className="wf-synthetic">
          Synthetic demo case · events and evidence are demonstration records.
        </div>
      )}
      <div className="wf-status-strip">
        <div>
          <small>Case-level review</small>
          <Pill tone={incident.review_state === "unreviewed" ? "amber" : ""}>
            {incident.review_state === "unreviewed"
              ? "Case summary not yet reviewed"
              : label(incident.review_state)}
          </Pill>
        </div>
        <div>
          <small>Case work</small>
          <Pill tone={incident.state === "closed" ? "" : "blue"}>
            {label(incident.state)}
          </Pill>
        </div>
        <div>
          <small>Handoff delivery</small>
          <Pill tone={incident.delivery_state === "failed" ? "red" : ""}>
            {label(incident.delivery_state)}
          </Pill>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {incident.merged_into && (
        <Notice>
          This case was linked as a reviewed duplicate of{" "}
          <Link to={`/incidents/${incident.merged_into}`}>
            {incident.merged_into}
          </Link>
          . Its original reports and source IDs are preserved.
        </Notice>
      )}
      {detail.merged_cases?.length ? (
        <section className="wf-panel">
          <h2>Reviewed duplicate links</h2>
          <p className="wf-muted">
            Each original case remains accessible. Reports and attachments below
            retain their original case identity.
          </p>
          {detail.merged_cases.map((item) => (
            <Link
              className="wf-text-button"
              key={item.id}
              to={`/incidents/${item.id}`}
            >
              {item.title} · {item.id}
              <ArrowRight size={14} />
            </Link>
          ))}
        </section>
      ) : null}
      {incident.merge_history?.length ? (
        <details className="wf-panel">
          <summary>Duplicate decision & correction trail</summary>
          <pre className="wf-code">
            {JSON.stringify(incident.merge_history, null, 2)}
          </pre>
        </details>
      ) : null}
      <div className="wf-case-layout">
        <div className="wf-case-main">
          <section className="wf-panel">
            <h2>The recorded observation</h2>
            <p className="wf-preserve">{incident.description}</p>
            <div className="wf-meta-row">
              <span>Observed {date(incident.observed_at)}</span>
              <span>Received {date(incident.created_at)}</span>
            </div>
            <p className="wf-muted">
              A reported observation does not establish its cause. Review,
              response and delivery are separate records.
            </p>
            <Link
              className="wf-button secondary"
              to={`/report?waterbody=${incident.waterbody_id}&related_case=${incident.id}`}
            >
              Add an observation or evidence
              <ArrowRight size={16} />
            </Link>
          </section>
          <section className="wf-panel">
            <div className="wf-section-head">
              <h2>Case history</h2>
              <Pill>{detail.events.length} recorded events</Pill>
            </div>
            <ol className="wf-timeline">
              {detail.events.map((item) => (
                <li key={item.id}>
                  <span className="wf-timeline-dot" />
                  <small>
                    {date(item.created_at)} · {item.id}
                  </small>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  {(item.actor_name ||
                    item.organisation_name ||
                    item.actor_organisation_name) && (
                    <small>
                      Recorded by{" "}
                      {item.actor_name ||
                        item.organisation_name ||
                        item.actor_organisation_name}
                    </small>
                  )}
                  {item.source_id && <small>Source {item.source_id}</small>}
                </li>
              ))}
            </ol>
            {!detail.events.length && (
              <p className="wf-muted">No case events are recorded.</p>
            )}
          </section>
          <section className="wf-panel">
            <h2>Reports & original statements</h2>
            {detail.reports.map((item) => (
              <article className="wf-record" key={item.id}>
                <div className="wf-section-head">
                  <strong>{item.id}</strong>
                  <small>{date(item.observed_at)}</small>
                </div>
                <p className="wf-preserve">{item.description}</p>
                <small>
                  Original language: {item.language || "not supplied"}
                  {item.count_estimate !== undefined &&
                  item.count_estimate !== ""
                    ? ` · Estimated count: ${item.count_estimate}`
                    : ""}
                </small>
                {item.synthetic && <Pill>Synthetic demo report</Pill>}
                <Pill
                  tone={
                    !item.review_state || item.review_state === "submitted"
                      ? "amber"
                      : ""
                  }
                >
                  {!item.review_state || item.review_state === "submitted"
                    ? "Community report — not yet reviewed"
                    : label(item.review_state)}
                </Pill>
                {item.case_id && (
                  <small>
                    Original case:{" "}
                    <Link to={`/incidents/${item.case_id}`}>
                      {item.case_id}
                    </Link>
                  </small>
                )}
                {item.review_history?.length ? (
                  <details>
                    <summary>Review & correction history</summary>
                    <pre className="wf-code">
                      {JSON.stringify(item.review_history, null, 2)}
                    </pre>
                  </details>
                ) : null}
                {canManage && (
                  <button
                    className="wf-text-button"
                    onClick={() => {
                      setReportReviewId(item.id);
                      setReportReason("");
                    }}
                  >
                    Review this report
                  </button>
                )}
                {canManage && reportReviewId === item.id && (
                  <form
                    className="wf-report-review-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        await api(`/api/v1/reports/${item.id}/review`, {
                          method: "POST",
                          body: JSON.stringify({
                            review_state: reportReviewState,
                            reason: reportReason,
                          }),
                        });
                        setReportReviewId("");
                        setMessage(`Report ${item.id} review recorded.`);
                        record.reload();
                      } catch (err) {
                        setError(errorText(err));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label className="wf-field">
                      Review decision
                      <select
                        value={reportReviewState}
                        onChange={(event) =>
                          setReportReviewState(event.target.value)
                        }
                      >
                        <option value="submitted">
                          Submitted / not yet reviewed
                        </option>
                        <option value="needs_information">
                          Needs information
                        </option>
                        <option value="accepted_for_investigation">
                          Accepted for investigation
                        </option>
                        <option value="duplicate">Duplicate report</option>
                        <option value="rejected">Rejected with reason</option>
                      </select>
                    </label>
                    <label className="wf-field">
                      Decision reason
                      <textarea
                        required
                        minLength={8}
                        rows={3}
                        value={reportReason}
                        onChange={(event) =>
                          setReportReason(event.target.value)
                        }
                      />
                    </label>
                    <p className="wf-muted">
                      Acceptance for investigation records a review decision; it
                      does not confirm a scientific cause.
                    </p>
                    <button className="wf-button" disabled={busy}>
                      Save report review
                    </button>
                  </form>
                )}
              </article>
            ))}
          </section>
          <section className="wf-panel">
            <h2>Evidence</h2>
            {detail.evidence.length ? (
              <div className="wf-evidence-grid">
                {detail.evidence.map((item) => (
                  <figure key={item.id}>
                    {item.url &&
                      (item.mime_type?.startsWith("video/") ? (
                        <video controls src={item.url} />
                      ) : (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          <img
                            src={item.url}
                            alt={
                              item.caption || item.name || "Reporter evidence"
                            }
                            loading="lazy"
                          />
                        </a>
                      ))}
                    <figcaption>
                      <strong>{item.name}</strong>
                      <small>
                        {item.caption || "Reporter-provided evidence"} ·{" "}
                        {date(item.created_at)}
                      </small>
                      {item.synthetic && (
                        <Pill>Synthetic demonstration evidence</Pill>
                      )}
                      <small>Evidence ID: {item.id}</small>
                      {item.derivative_notice && (
                        <small>{item.derivative_notice}</small>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="wf-muted">
                No attachments are recorded. You can add evidence to this case.
              </p>
            )}
          </section>
          <section className="wf-panel">
            <h2>Documented actions & outcome</h2>
            {detail.actions.map((item) => (
              <article className="wf-record" key={item.id}>
                <ClipboardList size={20} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <small>
                    Completion recorded: {date(item.completed_at)} · Action{" "}
                    {item.id}
                  </small>
                  {item.evidence_id && (
                    <small>Supporting evidence: {item.evidence_id}</small>
                  )}
                  <small>
                    Reported by{" "}
                    {item.organisation_name ||
                      item.organisation_id ||
                      "Assigned organisation"}{" "}
                    · Organisation-submitted activity record
                  </small>
                  <button
                    className="wf-text-button"
                    onClick={() => {
                      setShareAction(item);
                      setShare(true);
                    }}
                  >
                    Share this action
                    <Share2 size={14} />
                  </button>
                </div>
              </article>
            ))}
            {incident.outcome && (
              <div className="wf-outcome">
                <strong>
                  {outcomeCategories[incident.outcome_category || ""] ||
                    "Outcome category not recorded"}
                </strong>
                <p>{incident.outcome}</p>
                <p>Completed {date(incident.completed_at)}</p>
                <small>
                  Supporting record:{" "}
                  {incident.supporting_record ||
                    "See case evidence and history"}
                </small>
              </div>
            )}
            {!detail.actions.length && !incident.outcome && (
              <p className="wf-muted">
                No action or completion outcome is recorded.
              </p>
            )}
            <p className="wf-muted">
              Action completion does not establish ecological recovery or water
              safety. Organisation-submitted completion remains separate from an
              independently recorded follow-up.
            </p>
          </section>
          <ResolutionStory id={incident.id} photos={detail.evidence} canManage={canManage} />
          <section className="wf-panel">
            <h2>Public notes</h2>
            {detail.notes
              ?.filter((item) => !item.private)
              .map((item) => (
                <article className="wf-record" key={item.id}>
                  <MessageSquare size={18} />
                  <div>
                    <p>{item.text}</p>
                    <small>
                      {date(item.created_at)} · {item.id}
                    </small>
                  </div>
                </article>
              ))}
            {!detail.notes?.filter((item) => !item.private).length && (
              <p className="wf-muted">No public notes recorded.</p>
            )}
          </section>
          <section className="wf-panel">
            <details className="wf-moderation">
              <summary>Report a privacy or content concern</summary>
              {user ? (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      const result = await api<{ id: string; state: string }>(
                        "/api/v1/moderation",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            target_type: "case",
                            target_id: incident.id,
                            reason: abuseReason,
                          }),
                        },
                      );
                      setModerationId(result.id);
                      setAbuseReason("");
                    } catch (err) {
                      setError(errorText(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="wf-field">
                    Concern to be reviewed
                    <textarea
                      required
                      minLength={8}
                      rows={4}
                      value={abuseReason}
                      onChange={(event) => setAbuseReason(event.target.value)}
                    />
                  </label>
                  <button className="wf-button secondary" disabled={busy}>
                    Submit concern
                  </button>
                  {moderationId && (
                    <Notice>
                      Concern recorded as {moderationId}. A moderation decision
                      has not yet been made.
                    </Notice>
                  )}
                </form>
              ) : (
                <p>
                  <Link
                    to={`/login?next=${encodeURIComponent(location.pathname)}`}
                  >
                    Sign in
                  </Link>{" "}
                  to submit a content concern for review.
                </p>
              )}
            </details>
          </section>
        </div>
        <aside>
          <section className="wf-panel">
            <h3>Evidence requests</h3>
            {detail.evidence_requests.length ? (
              detail.evidence_requests.map((item) => (
                <article className="wf-record" key={item.id}>
                  <p>{item.description}</p>
                  <small>
                    {date(item.created_at)} · {item.id}
                  </small>
                </article>
              ))
            ) : (
              <p className="wf-muted">No open evidence requests recorded.</p>
            )}
            <p className="wf-muted">
              Contribute only from safe, publicly accessible places. Field
              sampling requires approved training and procedures.
            </p>
          </section>
          <section className="wf-panel">
            <h3>Recipient & delivery</h3>
            <p>
              {incident.organisation_id
                ? `Assigned organisation: ${incident.organisation_id}`
                : "No connected recipient"}
            </p>
            <Pill>{label(incident.delivery_state)}</Pill>
            <p className="wf-muted">
              Delivery and recipient acknowledgement are distinct. A downloaded
              case export does not notify an organisation.
            </p>
            <button className="wf-button secondary" onClick={exportCase}>
              <Download size={16} />
              Export public case
            </button>
          </section>
          {incident.state === "closed" && (
            <section className="wf-panel">
              <h3>Request reopening review</h3>
              <p className="wf-muted">
                New information can be reviewed by the assigned organisation.
                The documented closure stays in the history until an authorised
                decision is recorded.
              </p>
              {user ? (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      const result = await api<{ id: string; state: string }>(
                        `/api/v1/cases/${incident.id}/reopen-request`,
                        {
                          method: "POST",
                          body: JSON.stringify({ reason: reopenReason }),
                        },
                      );
                      setReopenId(result.id);
                      setReopenReason("");
                      record.reload();
                    } catch (err) {
                      setError(errorText(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="wf-field">
                    New information or reason
                    <textarea
                      required
                      minLength={8}
                      rows={4}
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                    />
                  </label>
                  <button className="wf-button secondary" disabled={busy}>
                    Request review
                  </button>
                  {reopenId && (
                    <Notice>
                      Request {reopenId} saved; awaiting organisation review.
                      This case remains closed.
                    </Notice>
                  )}
                </form>
              ) : (
                <Link
                  className="wf-button secondary"
                  to={`/login?next=${encodeURIComponent(location.pathname)}`}
                >
                  Sign in to request review
                </Link>
              )}
              {incident.reopening_requests?.map((item) => (
                <article className="wf-record" key={item.id}>
                  <p>{item.reason}</p>
                  <small>
                    {item.id} · {label(item.state)} · {date(item.created_at)}
                  </small>
                </article>
              ))}
            </section>
          )}
          {canManage ? (
            <section className="wf-panel wf-manage">
              <div className="wf-section-head">
                <h3>Organisation workspace</h3>
                <ShieldCheck size={20} />
              </div>
              <p className="wf-muted">
                Updates are attributed to your account and organisation.
              </p>
              <div
                className="wf-tabs"
                role="tablist"
                aria-label="Case handling"
              >
                {[
                  ["transition", "Case state"],
                  ["review", "Review"],
                  ["action", "Action"],
                  ["note", "Note"],
                  ["request", "Request"],
                  ["merge", "Duplicate review"],
                ].map(([value, name]) => (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={form === value}
                    onClick={() => {
                      setForm(value);
                      setError("");
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <form onSubmit={submitUpdate}>
                {form === "transition" && (
                  <>
                    <label className="wf-field">
                      Next case state
                      <select
                        required
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                      >
                        <option value="">Choose allowed transition</option>
                        {(nextStates[incident.state] || []).map((value) => (
                          <option key={value} value={value}>
                            {label(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wf-field">
                      Reason
                      <textarea
                        required
                        minLength={5}
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    {state === "closed" && (
                      <>
                        <label className="wf-field">
                          Outcome category
                          <select
                            required
                            value={outcomeCategory}
                            onChange={(event) =>
                              setOutcomeCategory(event.target.value)
                            }
                          >
                            <option value="">
                              Choose documented outcome category
                            </option>
                            <option value="action_documented_completed">
                              Action documented as completed
                            </option>
                            <option value="closed_without_confirmed_cause">
                              Closed without a confirmed cause
                            </option>
                            <option value="duplicate_case">
                              Duplicate case
                            </option>
                            <option value="no_further_action_recorded">
                              No further action recorded
                            </option>
                          </select>
                        </label>
                        <label className="wf-field">
                          Outcome explanation
                          <textarea
                            required
                            minLength={8}
                            rows={4}
                            value={outcome}
                            onChange={(event) => setOutcome(event.target.value)}
                            placeholder="Explain the documented outcome and its limits."
                          />
                        </label>
                        <label className="wf-field">
                          Completion date
                          <input
                            required
                            type="datetime-local"
                            value={completion}
                            onChange={(event) =>
                              setCompletion(event.target.value)
                            }
                          />
                        </label>
                        <label className="wf-field">
                          Supporting evidence
                          <select
                            value={evidenceId}
                            onChange={(event) =>
                              setEvidenceId(event.target.value)
                            }
                          >
                            <option value="">
                              Choose evidence, or use an action below
                            </option>
                            {detail.evidence.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name || item.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="wf-field">
                          Traceable action record
                          <select
                            required={!evidenceId}
                            value={supporting}
                            onChange={(event) =>
                              setSupporting(event.target.value)
                            }
                          >
                            <option value="">Choose an action</option>
                            {detail.actions.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} · {item.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Notice>
                          Closure preserves the earlier record. Supporting
                          evidence or an action record and completion date are
                          required.
                        </Notice>
                      </>
                    )}
                  </>
                )}
                {form === "review" && (
                  <>
                    <label className="wf-field">
                      Case-level review
                      <select
                        value={review}
                        onChange={(event) => setReview(event.target.value)}
                      >
                        <option value="reviewed">
                          Accepted for investigation
                        </option>
                        <option value="needs_evidence">
                          Needs information
                        </option>
                        <option value="rejected">Rejected with reason</option>
                        <option value="unreviewed">
                          Submitted / not yet reviewed
                        </option>
                      </select>
                    </label>
                    <label className="wf-field">
                      Review reason
                      <textarea
                        required
                        minLength={5}
                        rows={4}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    <p className="wf-muted">
                      Acceptance for investigation is not scientific
                      confirmation.
                    </p>
                  </>
                )}
                {form === "action" && (
                  <>
                    <label className="wf-field">
                      Action title
                      <input
                        required
                        minLength={5}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </label>
                    <label className="wf-field">
                      Description
                      <textarea
                        required
                        minLength={10}
                        rows={4}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </label>
                    <label className="wf-field">
                      Completion date
                      <input
                        required
                        type="datetime-local"
                        value={completion}
                        onChange={(event) => setCompletion(event.target.value)}
                      />
                    </label>
                    <label className="wf-field">
                      Supporting attachment
                      <select
                        value={evidenceId}
                        onChange={(event) => setEvidenceId(event.target.value)}
                      >
                        <option value="">None supplied</option>
                        {detail.evidence.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name || item.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {form === "merge" && (
                  <>
                    <label className="wf-field">
                      {incident.merged_into
                        ? "Correct the existing duplicate link"
                        : "Reviewed duplicate target"}
                      {incident.merged_into ? (
                        <span>
                          Currently linked to{" "}
                          <Link to={`/incidents/${incident.merged_into}`}>
                            {incident.merged_into}
                          </Link>
                        </span>
                      ) : (
                        <select
                          required
                          value={mergeTarget}
                          onChange={(event) =>
                            setMergeTarget(event.target.value)
                          }
                        >
                          <option value="">
                            Select another case for this water body
                          </option>
                          {relatedCases.data?.items
                            .filter(
                              (item) =>
                                item.id !== incident.id &&
                                item.waterbody_id === incident.waterbody_id &&
                                item.organisation_id ===
                                  incident.organisation_id &&
                                !item.merged_into,
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} · {item.id}
                              </option>
                            ))}
                        </select>
                      )}
                    </label>
                    <label className="wf-field">
                      Reviewer reason
                      <textarea
                        required
                        minLength={8}
                        rows={4}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                    <Notice>
                      {incident.merged_into
                        ? "This records a correction and restores this case as separate. Earlier merge decisions remain in the audit trail."
                        : "This preserves original report, evidence and case IDs. A duplicate decision does not establish a scientific cause."}
                    </Notice>
                  </>
                )}
                {["note", "request"].includes(form) && (
                  <label className="wf-field">
                    {form === "note" ? "Note text" : "Evidence request"}
                    <textarea
                      required
                      minLength={5}
                      rows={5}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                )}
                {form === "note" && (
                  <label className="wf-check">
                    <input
                      type="checkbox"
                      checked={privateNote}
                      onChange={(event) => setPrivateNote(event.target.checked)}
                    />
                    Private organisation note
                  </label>
                )}
                {form === "request" && (
                  <><p className="wf-muted">
                    Use an approved checklist. Do not request hazardous sampling
                    or unsafe field activity.
                  </p><button type="button" className="wf-button secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await api<{suggestions:{description:string;record_ids:string[]}[]}>(`/api/v1/cases/${incident.id}/evidence-checklist`);if(result.suggestions.length)setDescription(result.suggestions.map(s=>s.description+' (Records: '+s.record_ids.join(', ')+')').join('\n'));else setMessage('No missing items detected by the workflow checklist. Review the case before requesting additional evidence.');}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Draft request from recorded gaps</button></>
                )}
                <button
                  className="wf-button"
                  disabled={busy || (form === "transition" && !state)}
                  type="submit"
                >
                  {busy ? "Saving…" : "Record update"}
                  <FileText size={16} />
                </button>
              </form>
            </section>
          ) : (
            <section className="wf-panel">
              <h3>Follow the documented response</h3>
              <p className="wf-muted">
                Only authorised organisation members can record case decisions.
                You can contribute a related observation.
              </p>
              <Link
                className="wf-button secondary"
                to={`/waterbodies/${incident.waterbody_id}`}
              >
                Open water body
              </Link>
            </section>
          )}
        </aside>
      </div>
      <ShareModal
        recordKind={shareAction ? "action" : "case"}
        open={share}
        onClose={() => setShare(false)}
        waterbody={{
          id: incident.waterbody_id,
          name: incident.waterbody_name,
          synthetic: incident.synthetic,
        }}
        caseRecord={
          shareAction
            ? {
                ...incident,
                report_review_states: detail.reports.map(
                  (report) => report.review_state || "submitted",
                ),
                title: shareAction.title || "Action documented",
                outcome: shareAction.title,
                observed_at: shareAction.completed_at,
                completed_at: shareAction.completed_at,
              }
            : {
                ...incident,
                report_review_states: detail.reports.map(
                  (report) => report.review_state || "submitted",
                ),
              }
        }
        sourceAttribution={
          shareAction
            ? `Action ${shareAction.id}; organisation ${shareAction.organisation_name || shareAction.organisation_id || incident.organisation_id}`
            : `Case ${incident.id}; original report ${detail.reports[0]?.id || "not recorded"}`
        }
      />
    </div>
  );
}
