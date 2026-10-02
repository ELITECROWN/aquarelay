import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings2,
} from "lucide-react";
import { api } from "../api";
import { useSession } from "../session";
import {
  date,
  errorText,
  Gate,
  label,
  Loading,
  Notice,
  Pill,
  useRecord,
  WorkflowHeader,
} from "./workflowShared";

type Connector = {
  id: string;
  name: string;
  kind: string;
  state?: string;
  status?: string;
  paused?: boolean;
  synthetic?: boolean;
  last_attempt_at?: string;
  last_success_at?: string;
  last_observed_at?: string;
  error?: string;
  imported?: number;
  quarantined?: number;
  url?: string;
  timezone?: string;
  mapping?: Record<string, string>;
  units?: Record<string, string>;
  retry_history?: unknown[];
  next_retry_at?: string;
  poll_interval_minutes?: number | null;
  polling_enabled?: boolean;
  next_poll_at?: string;
  demo_scenario?: string;
};
type Run = {
  id: string;
  status?: string;
  state?: string;
  created_at?: string;
  error?: string;
  counts?: Record<string, number>;
  attempts?: number;
};
type Receipt = {
  id: string;
  waterbody_id?: string;
  status?: string;
  created_at?: string;
  received_at?: string;
  receipt_id?: string;
  recipient?: string;
  channel?: string;
  acknowledged?: boolean;
  message?: string;
  synthetic?: boolean;
  retry_history?: unknown[];
  data?: Record<string, unknown>;
  validation?: unknown;
  payload?: unknown;
};
type HandoffCapabilities = {
  local_demo: { available: boolean; name: string };
  institutional: {
    available: boolean;
    name: string | null;
    reason: string | null;
    supported_formats: string[];
    acknowledgement_contract: string;
  };
};
const managerRoles = ["manager", "admin", "reviewer"];
export default function IntegrationsPage() {
  const { id } = useParams();
  const { user, loading: sessionLoading } = useSession();
  const canManage = !!user && managerRoles.includes(user.role);
  const record = useRecord<
    | { items: Connector[] }
    | { connector: Connector; runs: Run[]; mappings?: unknown[] }
  >(id ? `/api/v1/connectors/${id}` : "/api/v1/connectors", canManage);
  const receipts = useRecord<{ items: Receipt[] }>(
    "/api/v1/receipts",
    canManage,
  );
  const capabilities = useRecord<HandoffCapabilities>(
    "/api/v1/handoff-capabilities",
    canManage,
  );
  const waters = useRecord<{
    items: { id: string; name: string; synthetic: boolean }[];
  }>("/api/v1/waterbodies?page_size=100", canManage);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<unknown>();
  const [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [kind, setKind] = useState("http_json");
  const [url, setUrl] = useState(""),
    [headers, setHeaders] = useState(""),
    [mapping, setMapping] = useState(
      '{\n  "site_name": "site_name",\n  "observed_at": "observed_at",\n  "water_temp": "temperature"\n}',
    ),
    [units, setUnits] = useState('{ "temperature": "degC" }'),
    [timezone, setTimezone] = useState("Asia/Kolkata");
  const [waterbody, setWaterbody] = useState(""),
    [pollInterval, setPollInterval] = useState("");
  const [recipient, setRecipient] = useState<"local_demo" | "institutional">(
      "local_demo",
    ),
    [receiptDetails, setReceiptDetails] = useState<Record<string, Receipt>>({});
  const queuedReceipt = receipts.data?.items.some((item) =>
    ["queued", "retrying"].includes(item.status || ""),
  );
  const selectedCapability = capabilities.data?.[recipient];
  useEffect(() => {
    if (
      capabilities.data &&
      !capabilities.data.local_demo.available &&
      capabilities.data.institutional.available
    )
      setRecipient("institutional");
  }, [capabilities.data]);
  useEffect(() => {
    setReceiptDetails({});
    setResult(undefined);
    setMessage("");
    setError("");
  }, [user?.id]);
  useEffect(() => {
    if (!queuedReceipt) return;
    const timer = window.setInterval(receipts.reload, 3000);
    return () => window.clearInterval(timer);
  }, [queuedReceipt]);
  const mutate = async (path: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api<unknown>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(response);
      setMessage(
        "Server response received. Inspect the recorded result below.",
      );
      record.reload();
      receipts.reload();
      return response;
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const connector =
    record.data && "connector" in record.data
      ? record.data.connector
      : undefined;
  useEffect(() => {
    if (connector) {
      setUrl(connector.url || "");
      setMapping(JSON.stringify(connector.mapping || {}, null, 2));
      setUnits(JSON.stringify(connector.units || {}, null, 2));
      setTimezone(connector.timezone || "");
      setPollInterval(
        connector.poll_interval_minutes
          ? String(connector.poll_interval_minutes)
          : "",
      );
    }
  }, [connector?.id]);
  const items = record.data && "items" in record.data ? record.data.items : [];
  const runs = record.data && "runs" in record.data ? record.data.runs : [];
  const exportStandard = async (standard: string) => {
    if (!waterbody) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<unknown>(
        `/api/v1/standards/${waterbody}/${standard}`,
      );
      setResult(response);
      const blob = new Blob([JSON.stringify(response, null, 2)], {
          type: "application/json",
        }),
        href = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `aquarelay-${waterbody}-${standard}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(href), 500);
      setMessage(
        "Supported standards export generated. Inspect its validation statement and synthetic labels.",
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const inspectReceipt = async (receiptId: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await api<Receipt>(`/api/v1/receipts/${receiptId}`);
      setReceiptDetails((previous) => ({ ...previous, [receiptId]: response }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  if (sessionLoading) return <Loading />;
  if (!canManage)
    return (
      <div className="wf-page">
        <WorkflowHeader
          eyebrow="Interoperability"
          title="Sources & integrations"
          description="Connect information while preserving its source and date."
        />
        <Gate manager />
      </div>
    );
  return (
    <div className="wf-page">
      {id && (
        <Link className="wf-back" to="/integrations">
          <ArrowLeft size={16} />
          All integrations
        </Link>
      )}
      <WorkflowHeader
        eyebrow="Interoperability"
        title={
          connector?.name ||
          (id ? "Connector configuration" : "Sources & integration health")
        }
        description="Approved mappings, recorded attempts and honest source freshness."
      >
        <Link className="wf-button" to="/integrations/import">
          <Database size={17} />
          Import a file
        </Link>
        {!id && (
          <button
            className="wf-button secondary"
            onClick={() => setCreate((previous) => !previous)}
          >
            <Plus size={16} />
            Add connector
          </button>
        )}
      </WorkflowHeader>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {record.error && (
        <Notice error>
          {record.error}
          <button className="wf-text-button" onClick={record.reload}>
            Retry
          </button>
        </Notice>
      )}
      {create && (
        <form
          className="wf-panel"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await mutate("/api/v1/connectors", { name, kind });
            if (response) {
              setCreate(false);
              setName("");
            }
          }}
        >
          <h2>New approved connector</h2>
          <div className="wf-form-grid">
            <label className="wf-field">
              Source name
              <input
                required
                minLength={3}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="wf-field">
              Connector adapter
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="http_json">HTTP JSON</option>
                <option value="sensorthings">SensorThings subset</option>
              </select>
            </label>
          </div>
          <p className="wf-muted">
            External credentials and a permitted public endpoint must be
            configured before a sync can succeed.
          </p>
          <button className="wf-button" disabled={busy}>
            Create connector
          </button>
        </form>
      )}
      {record.loading ? (
        <Loading />
      ) : !id ? (
        <section className="wf-panel">
          <div className="wf-section-head">
            <h2>Connected sources</h2>
            <Pill>{items.length} sources</Pill>
          </div>
          {items.length ? (
            <div className="wf-table-wrap">
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Health</th>
                    <th>Last attempt / success</th>
                    <th>Latest observation</th>
                    <th>Records</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const health =
                      item.status ||
                      item.state ||
                      (item.paused ? "disabled" : "configured");
                    return (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/integrations/${item.id}`}>
                            <strong>{item.name}</strong>
                          </Link>
                          <small>
                            {label(item.kind)}
                            {item.synthetic ? " · Synthetic demo source" : ""}
                          </small>
                        </td>
                        <td>
                          <Pill
                            tone={
                              health === "error"
                                ? "red"
                                : health === "stale" || health === "configured"
                                  ? "amber"
                                  : ""
                            }
                          >
                            {label(health)}
                          </Pill>
                          {item.error && (
                            <small className="wf-small-error">
                              {item.error}
                            </small>
                          )}
                        </td>
                        <td>
                          <small>Attempt: {date(item.last_attempt_at)}</small>
                          <small>Success: {date(item.last_success_at)}</small>
                        </td>
                        <td>{date(item.last_observed_at)}</td>
                        <td>
                          <small>{item.imported ?? 0} imported</small>
                          <small>{item.quarantined ?? 0} quarantined</small>
                        </td>
                        <td>
                          <Link
                            className="wf-text-button"
                            to={`/integrations/${item.id}`}
                          >
                            Inspect
                            <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="wf-empty">
              No sources are configured for your organisation. Import a file or
              create a connector to begin.
            </p>
          )}
        </section>
      ) : (
        connector && (
          <div className="wf-case-layout">
            <div className="wf-case-main">
              <section className="wf-panel">
                <div className="wf-section-head">
                  <h2>Connection & health</h2>
                  <Pill
                    tone={
                      (connector.status || connector.state) === "error"
                        ? "red"
                        : "amber"
                    }
                  >
                    {label(connector.status || connector.state)}
                  </Pill>
                </div>
                <dl className="wf-record-details">
                  <dt>Adapter</dt>
                  <dd>{label(connector.kind)}</dd>
                  <dt>Source schedule</dt>
                  <dd>
                    {connector.polling_enabled
                      ? `Every ${connector.poll_interval_minutes} minutes`
                      : "Manual sync; polling not enabled"}
                  </dd>
                  <dt>Next scheduled poll</dt>
                  <dd>{date(connector.next_poll_at)}</dd>
                  <dt>Next permitted retry</dt>
                  <dd>{date(connector.next_retry_at)}</dd>
                  <dt>Last attempted sync</dt>
                  <dd>{date(connector.last_attempt_at)}</dd>
                  <dt>Last successful sync</dt>
                  <dd>{date(connector.last_success_at)}</dd>
                  <dt>Last source observation</dt>
                  <dd>{date(connector.last_observed_at)}</dd>
                  <dt>Imported / quarantined</dt>
                  <dd>
                    {connector.imported ?? 0} / {connector.quarantined ?? 0}
                  </dd>
                </dl>
                {connector.error && <Notice error>{connector.error}</Notice>}
                {connector.kind === "demo_fixture" && (
                  <div className="wf-synthetic">
                    <strong>Demo scenario · synthetic source</strong>
                    <p>
                      Controlled failure and recovery change the actual adapter
                      result. They do not simulate a real environmental event.
                    </p>
                    <div className="wf-button-grid">
                      <button
                        className="wf-button secondary"
                        disabled={busy}
                        onClick={() =>
                          mutate(`/api/v1/connectors/${id}/scenario`, {
                            state: "failure",
                          })
                        }
                      >
                        Demo scenario: fail source
                      </button>
                      <button
                        className="wf-button secondary"
                        disabled={busy}
                        onClick={() =>
                          mutate(`/api/v1/connectors/${id}/scenario`, {
                            state: "recovered",
                          })
                        }
                      >
                        Demo scenario: recover source
                      </button>
                    </div>
                  </div>
                )}
                <div className="wf-button-grid">
                  <button
                    className="wf-button secondary"
                    disabled={busy || connector.kind === "file"}
                    onClick={() => mutate(`/api/v1/connectors/${id}/test`)}
                  >
                    <CheckCircle2 size={16} />
                    Test connection
                  </button>
                  <button
                    className="wf-button"
                    disabled={busy || connector.kind === "file"}
                    onClick={() => mutate(`/api/v1/connectors/${id}/sync`)}
                  >
                    <RefreshCw size={16} />
                    Sync / safe retry
                  </button>
                  <button
                    className="wf-button secondary"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        `/api/v1/connectors/${id}/${connector.state === "paused" ? "configure" : "pause"}`,
                      )
                    }
                  >
                    {connector.state === "paused" ? (
                      <Play size={16} />
                    ) : (
                      <Pause size={16} />
                    )}{" "}
                    {connector.state === "paused" ? "Resume" : "Pause"}
                  </button>
                </div>
                <p className="wf-muted">
                  {connector.kind === "file"
                    ? "File connectors are updated by importing another file with this source identity. "
                    : ""}
                  A successful request records delivery to the source adapter.
                  Source data may still be outdated. Manual retries use recorded
                  backoff.{" "}
                  {connector.polling_enabled
                    ? "Scheduled source polling is enabled using the recorded interval."
                    : "Source polling is disabled until an interval and approved mapping are configured."}
                </p>
              </section>
              <section className="wf-panel">
                <h2>Sync & retry history</h2>
                {connector.retry_history?.length ? (
                  <details>
                    <summary>
                      Recorded retry attempts ({connector.retry_history.length})
                    </summary>
                    <pre className="wf-code">
                      {JSON.stringify(connector.retry_history, null, 2)}
                    </pre>
                  </details>
                ) : null}
                {runs.length ? (
                  runs.map((run) => (
                    <article className="wf-record" key={run.id}>
                      <RefreshCw size={18} />
                      <div>
                        <strong>{run.id}</strong>
                        <Pill tone={run.status === "failed" ? "red" : ""}>
                          {label(run.status || run.state)}
                        </Pill>
                        <small>
                          {date(run.created_at)}
                          {run.attempts ? ` · Attempt ${run.attempts}` : ""}
                        </small>
                        {run.error && (
                          <p className="wf-small-error">{run.error}</p>
                        )}
                        {["preview", "transformed"].includes(
                          run.state || "",
                        ) && (
                          <Link
                            className="wf-text-button"
                            to={`/integrations/import?run=${run.id}`}
                          >
                            Review mapping & approve
                            <ArrowRight size={14} />
                          </Link>
                        )}
                        {run.counts && (
                          <pre className="wf-code">
                            {JSON.stringify(run.counts, null, 2)}
                          </pre>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="wf-muted">No attempted syncs are recorded.</p>
                )}
              </section>
            </div>
            <aside>
              {connector.synthetic && (
                <div className="wf-synthetic">Synthetic demo source</div>
              )}
              {connector.kind === "file" ? (
                <section className="wf-panel">
                  <h3>Reusable file mapping</h3>
                  <p>
                    Import another file using this connector to reuse its source
                    identity and review schema changes.
                  </p>
                  <Link
                    className="wf-button"
                    to={`/integrations/import?connector=${id}`}
                  >
                    Import another file
                    <ArrowRight size={16} />
                  </Link>
                  <pre className="wf-code">
                    {JSON.stringify(
                      {
                        mapping: connector.mapping,
                        units: connector.units,
                        timezone: connector.timezone,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </section>
              ) : (
                <form
                  className="wf-panel"
                  onSubmit={(event) => {
                    event.preventDefault();
                    try {
                      const parsedMapping = JSON.parse(mapping),
                        parsedUnits = JSON.parse(units),
                        parsedHeaders = headers.trim()
                          ? JSON.parse(headers)
                          : undefined;
                      void mutate(`/api/v1/connectors/${id}/configure`, {
                        url,
                        mapping: parsedMapping,
                        units: parsedUnits,
                        timezone,
                        poll_interval_minutes: pollInterval
                          ? Number(pollInterval)
                          : null,
                        ...(parsedHeaders ? { headers: parsedHeaders } : {}),
                      });
                    } catch {
                      setError(
                        "Mapping, units and headers must contain valid JSON objects.",
                      );
                    }
                  }}
                >
                  <h3>
                    <Settings2 size={19} />
                    Connection configuration
                  </h3>
                  <label className="wf-field">
                    Public HTTPS endpoint
                    <input
                      required={connector.kind !== "demo_fixture"}
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder={
                        connector.url || "https://source.example/observations"
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Field mapping draft
                    <textarea
                      rows={5}
                      value={mapping}
                      onChange={(event) => setMapping(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <label className="wf-field">
                    Explicit units
                    <textarea
                      rows={2}
                      value={units}
                      onChange={(event) => setUnits(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <label className="wf-field">
                    Source timezone
                    <input
                      required
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    />
                  </label>
                  <label className="wf-field">
                    Polling interval in minutes (optional)
                    <input
                      type="number"
                      min="1"
                      max="10080"
                      value={pollInterval}
                      onChange={(event) => setPollInterval(event.target.value)}
                      placeholder="Leave blank for manual sync"
                    />
                    <small>
                      Polling starts only after a source mapping is approved.
                      Source observation dates remain separate from sync dates.
                    </small>
                  </label>
                  <label className="wf-field">
                    Replacement request headers (optional)
                    <textarea
                      rows={3}
                      value={headers}
                      onChange={(event) => setHeaders(event.target.value)}
                      placeholder={'{"Authorization":"Bearer …"}'}
                      spellCheck={false}
                    />
                    <small>
                      Credentials remain on the server and are redacted in
                      responses. Leave blank to retain existing headers.
                    </small>
                  </label>
                  <button className="wf-button" disabled={busy}>
                    Save configuration for review
                  </button>
                  <p className="wf-muted">
                    Endpoint redirects and private-network targets are checked
                    server-side. A connector never executes uploaded code. After
                    changing mappings, test the source and approve its preview
                    before syncing.
                  </p>
                </form>
              )}
            </aside>
          </div>
        )
      )}
      <section className="wf-panel">
        <div className="wf-section-head">
          <div>
            <p className="wf-eyebrow">Interoperability</p>
            <h2>Supported standards & local receiver</h2>
          </div>
        </div>
        <p>
          A SensorThings 1.1 subset with supported STAplus metadata and a narrow
          FHIR R4 4.0.1 environmental Bundle. Validation is scoped structural
          checking; full profile and terminology conformance are not claimed.
        </p>
        <div className="wf-standards-row">
          <label className="wf-field">
            Water body
            <select
              value={waterbody}
              onChange={(event) => setWaterbody(event.target.value)}
            >
              <option value="">Choose a record</option>
              {waters.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.synthetic ? " · Synthetic" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="wf-button secondary"
            disabled={!waterbody || busy}
            onClick={() => exportStandard("fhir")}
          >
            <Download size={16} />
            FHIR Bundle
          </button>
          <button
            className="wf-button secondary"
            disabled={!waterbody || busy}
            onClick={() => exportStandard("sensorthings")}
          >
            <Download size={16} />
            SensorThings
          </button>
        </div>
        <div className="wf-standards-row">
          <label className="wf-field">
            Handoff recipient
            <select
              value={recipient}
              onChange={(event) =>
                setRecipient(
                  event.target.value as "local_demo" | "institutional",
                )
              }
              disabled={capabilities.loading || !!capabilities.error}
            >
              <option
                value="local_demo"
                disabled={!capabilities.data?.local_demo.available}
              >
                Local demo receiver
                {capabilities.data && !capabilities.data.local_demo.available
                  ? " · Disabled"
                  : ""}
              </option>
              <option
                value="institutional"
                disabled={!capabilities.data?.institutional.available}
              >
                {capabilities.data?.institutional.name ||
                  "Configured institutional recipient"}
                {capabilities.data && !capabilities.data.institutional.available
                  ? " · Unavailable"
                  : ""}
              </option>
            </select>
          </label>
          <button
            className="wf-button"
            disabled={!waterbody || busy || !selectedCapability?.available}
            onClick={() =>
              mutate(`/api/v1/handoffs/${waterbody}`, {
                recipient,
                format: "fhir",
                client_id: crypto.randomUUID(),
              })
            }
          >
            <Send size={16} />
            {recipient === "local_demo"
              ? "Send to demo receiver"
              : `Send to ${selectedCapability?.name || "configured recipient"}`}
          </button>
        </div>
        {capabilities.loading && (
          <p className="wf-muted" role="status">
            Checking configured handoff recipients…
          </p>
        )}
        {capabilities.error && (
          <Notice error>
            Recipient configuration could not be checked: {capabilities.error}
            <button className="wf-text-button" onClick={capabilities.reload}>
              Retry recipient check
            </button>
          </Notice>
        )}
        {capabilities.data && !capabilities.data.institutional.available && (
          <p className="wf-muted">
            Institutional handoff unavailable:{" "}
            {capabilities.data.institutional.reason ||
              "No recipient is configured for this organisation."}
          </p>
        )}
        <p className="wf-muted">
          {recipient === "local_demo"
            ? "The local receiver is a demonstration service. It is not a municipality, hospital or live institutional connection."
            : `The server selects ${selectedCapability?.name || "the recipient"} from your organisation’s configured directory. This adapter sends the supported FHIR Bundle only.`}{" "}
          HTTP acceptance records delivery. Organisation acknowledgement is
          shown only when an explicit receipt matches this handoff.
        </p>
        <h3>Persisted handoff receipts</h3>
        {receipts.error && <Notice error>{receipts.error}</Notice>}
        {receipts.data?.items.length ? (
          receipts.data.items.map((receipt) => (
            <details className="wf-receipt" key={receipt.id}>
              <summary>
                <span>
                  <strong>{receipt.id}</strong>
                  <small>
                    {date(receipt.created_at || receipt.received_at)} ·{" "}
                    {receipt.waterbody_id}
                  </small>
                  <small>
                    {receipt.recipient || label(receipt.channel)}
                    {receipt.synthetic ? " · Synthetic data" : ""} ·{" "}
                    {receipt.acknowledged
                      ? "Explicit acknowledgement received"
                      : "Organisation acknowledgement not received"}
                  </small>
                </span>
                <Pill>{label(receipt.status || "received")}</Pill>
              </summary>
              {receipt.message && <p>{receipt.message}</p>}
              <button
                className="wf-button secondary"
                disabled={busy}
                onClick={() => inspectReceipt(receipt.id)}
              >
                Inspect persisted payload & validation
              </button>
              <pre className="wf-code">
                {JSON.stringify(receiptDetails[receipt.id] || receipt, null, 2)}
              </pre>
            </details>
          ))
        ) : (
          <p className="wf-muted">
            No receipts have been stored for this organisation.
          </p>
        )}
      </section>
      {result !== undefined && (
        <section className="wf-panel">
          <h2>Last server result</h2>
          {typeof result === "object" &&
            result !== null &&
            "run_id" in result && (
              <Link
                className="wf-button"
                to={`/integrations/import?run=${String((result as { run_id: unknown }).run_id)}`}
              >
                Review the source preview
                <ArrowRight size={16} />
              </Link>
            )}
          <pre className="wf-code">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
