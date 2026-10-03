import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { api } from "../api";
import { useSession } from "../session";
import {
  errorText,
  Gate,
  Loading,
  Notice,
  Pill,
  useRecord,
  WorkflowHeader,
} from "./workflowShared";

type Row = Record<string, unknown>;
type MappingSettings = {
  mapping: Record<string, string>;
  units?: Record<string, string>;
  timezone?: string;
  waterbody_id?: string;
  parameter_map?: Record<string, string>;
};
type Preview = {
  id: string;
  columns: string[];
  rows: Row[];
  suggestions:
    | Record<string, string>
    | { source: string; destination: string }[];
  issues: unknown[];
  schema_changed?: boolean;
  synthetic?: boolean;
  total_rows?: number;
  filename?: string;
  state?: string;
  records?: Row[];
  counts?: Record<string, number>;
  mapping_version_id?: string;
  mapping_settings?: MappingSettings;
};
type Transformed = {
  records: Row[];
  counts: Record<string, number>;
  issues: unknown[];
  mapping_version?: string;
  mapping_version_id?: string;
};
type Results = {
  counts?: Record<string, number>;
  imported?: number | Row[];
  rejected?: number | Row[];
  duplicate?: number | Row[];
  unresolved?: number | Row[];
  mapping_version?: string;
  mapping_version_id?: string;
  connector_id?: string;
  source_id?: string;
  id?: string;
};
type MappingConnector = {
  id: string;
  name: string;
  mapping?: Record<string, string>;
  units?: Record<string, string>;
  timezone?: string;
  waterbody_id?: string;
  parameter_map?: Record<string, string>;
  mapping_approved?: boolean;
};
const destinations = [
  ["", "Keep raw / not mapped"],
  ["site_name", "Water-body reference"],
  ["waterbody_id", "Water-body ID"],
  ["observed_at", "Observation time"],
  ["source_updated_at", "Source update time"],
  ["temperature", "Water temperature"],
  ["ph", "pH"],
  ["dissolved_oxygen", "Dissolved oxygen"],
  ["external_id", "Source record ID"],
  ["parameter", "Parameter name"],
  ["value", "Measurement value"],
  ["unit", "Measurement unit"],
  ["latitude", "Latitude"],
  ["longitude", "Longitude"],
  ["photo", "Evidence reference (retained, not fetched)"],
];
const displayIssue = (issue: unknown) =>
  typeof issue === "string" ? issue : JSON.stringify(issue);
const count = (value: number | Row[] | undefined) =>
  Array.isArray(value) ? value.length : (value ?? 0);
export default function ImportPage() {
  const { user, loading: sessionLoading } = useSession();
  const manager =
    !!user && ["manager", "admin", "reviewer"].includes(user.role);
  const [params] = useSearchParams();
  const runId = params.get("run");
  const persisted = useRecord<Preview>(
    `/api/v1/imports/${runId}`,
    manager && !!runId,
  );
  const waters = useRecord<{
    items: { id: string; name: string; synthetic: boolean }[];
  }>("/api/v1/waterbodies?page_size=100", manager);
  const connectors = useRecord<{ items: MappingConnector[] }>(
    "/api/v1/connectors",
    manager,
  );
  const [preview, setPreview] = useState<Preview>(),
    [transformed, setTransformed] = useState<Transformed>(),
    [results, setResults] = useState<Results>();
  const [file, setFile] = useState<File>(),
    [connector, setConnector] = useState(params.get("connector") || ""),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [units, setUnits] = useState<Record<string, string>>({}),
    [timezone, setTimezone] = useState(""),
    [waterbody, setWaterbody] = useState(""),
    [synthetic, setSynthetic] = useState(false),
    [datasetLabel, setDatasetLabel] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false),
    [parameterMap, setParameterMap] = useState("{}");
  const activeStep = results ? 3 : transformed ? 2 : preview ? 1 : 0;
  const [externalConsent,setExternalConsent]=useState(false),[mappingMode,setMappingMode]=useState('Field-name rules');
  useEffect(() => {
    if (!persisted.data) return;
    const saved = persisted.data;
    setPreview(saved);
    const settings = saved.mapping_settings;
    setMapping(
      settings?.mapping ||
        (Array.isArray(saved.suggestions)
          ? Object.fromEntries(
              saved.suggestions.map((item) => [item.source, item.destination]),
            )
          : saved.suggestions || {}),
    );
    if (settings) {
      setUnits(settings.units || {});
      setTimezone(settings.timezone || "");
      setWaterbody(settings.waterbody_id || "");
      setParameterMap(JSON.stringify(settings.parameter_map || {}, null, 2));
    }
    if (saved.state === "approved") setResults(saved as Results);
    if (saved.state === "transformed")
      setTransformed({
        records: saved.records || [],
        counts: saved.counts || {},
        issues: saved.issues || [],
        mapping_version_id: saved.mapping_version_id,
      });
  }, [persisted.data]);
  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("synthetic", String(synthetic));
      body.append("label", datasetLabel || file.name);
      if (connector) body.append("connector_id", connector);
      const response = await api<Preview>("/api/v1/imports/preview", {
        method: "POST",
        body,
      });
      setPreview(response);
      const suggested = Array.isArray(response.suggestions)
        ? Object.fromEntries(
            response.suggestions.map((item) => [item.source, item.destination]),
          )
        : response.suggestions || {};
      const approved = connectors.data?.items.find(
        (item) => item.id === connector && item.mapping_approved,
      );
      setMapping(
        approved?.mapping
          ? Object.fromEntries(
              response.columns.map((column) => [
                column,
                approved.mapping?.[column] || suggested[column] || "",
              ]),
            )
          : suggested,
      );
      if (approved) {
        setUnits(approved.units || {});
        setTimezone(approved.timezone || "");
        setWaterbody(approved.waterbody_id || "");
        setParameterMap(JSON.stringify(approved.parameter_map || {}, null, 2));
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const transform = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      let approvedParameters: Record<string, string>;
      try {
        approvedParameters = JSON.parse(parameterMap);
      } catch {
        throw new Error("Parameter mappings must contain a valid JSON object.");
      }
      const response = await api<Transformed>(
        `/api/v1/imports/${preview.id}/transform`,
        {
          method: "POST",
          body: JSON.stringify({
            mapping: Object.fromEntries(
              Object.entries(mapping).filter(([, destination]) => destination),
            ),
            units,
            timezone,
            parameter_map: approvedParameters,
            ...(waterbody ? { waterbody_id: waterbody } : {}),
          }),
        },
      );
      setTransformed(response);
      setAccepted(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const approve = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<Results>(
        `/api/v1/imports/${preview.id}/approve`,
        { method: "POST", body: JSON.stringify({ approved: true }) },
      );
      setResults(response);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setPreview(undefined);
    setTransformed(undefined);
    setResults(undefined);
    setMapping({});
    setUnits({});
    setTimezone("");
    setWaterbody("");
    setError("");
    setFile(undefined);
  };
  if (sessionLoading) return <Loading />;
  if (!manager)
    return (
      <div className="wf-page">
        <WorkflowHeader
          eyebrow="Data contribution"
          title="Import & mapping studio"
          description="Connect a dataset without losing its original meaning."
        />
        <Gate manager />
      </div>
    );
  return (
    <div className="wf-page">
      <Link className="wf-back" to="/integrations">
        <ArrowLeft size={16} />
        Sources & integration health
      </Link>
      <WorkflowHeader
        eyebrow="Data contribution"
        title="Import & mapping studio"
        description="Preview the source, make explicit mapping decisions and approve the resulting records."
      >
        <Pill>Rules-based assistance</Pill>
      </WorkflowHeader>
      <ol className="wf-stepper wf-import-stepper" aria-label="Import steps">
        {[
          "Upload source",
          "Map & resolve",
          "Preview & approve",
          "Inspect results",
        ].map((name, index) => (
          <li
            key={name}
            className={
              index === activeStep
                ? "active"
                : index < activeStep
                  ? "complete"
                  : ""
            }
            aria-current={index === activeStep ? "step" : undefined}
          >
            <span>{index < activeStep ? <Check size={15} /> : index + 1}</span>
            <p>{name}</p>
          </li>
        ))}
      </ol>
      {error && <Notice error>{error}</Notice>}
      {persisted.error && <Notice error>{persisted.error}</Notice>}
      {runId && persisted.loading && <Loading />}
      {!preview && (
        <div className="wf-report-layout">
          <form className="wf-panel" onSubmit={upload}>
            <h2>Choose your source file</h2>
            <p className="wf-muted">
              CSV, XLSX or JSON. Original values are preserved; formulas and
              macros are never executed.
            </p>
            <label className="wf-upload">
              <Upload size={30} />
              <strong>
                {file ? file.name : "Select a spreadsheet or JSON file"}
              </strong>
              <span>Files up to 5 MB · maximum 2,000 rows</span>
              <input
                type="file"
                required
                accept=".csv,.xlsx,.json"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected && selected.size > 5 * 1024 * 1024) {
                    setError("Files must be 5 MB or smaller.");
                    setFile(undefined);
                    return;
                  }
                  setFile(selected);
                  setError("");
                }}
              />
            </label>
            <label className="wf-field">
              Dataset identity
              <input
                value={datasetLabel}
                onChange={(event) => setDatasetLabel(event.target.value)}
                placeholder={file?.name || "Filename used if left blank"}
              />
              <small>
                Keep the same identity across reuploads to detect duplicate
                source records.
              </small>
            </label>
            <label className="wf-field">
              Reusable connector (optional)
              <select
                value={connector}
                onChange={(event) => setConnector(event.target.value)}
              >
                <option value="">New file import</option>
                {connectors.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small>
                Changed schemas are checked against approved mapping versions.
              </small>
            </label>
            <label className="wf-check">
              <input
                type="checkbox"
                checked={synthetic}
                onChange={(event) => setSynthetic(event.target.checked)}
              />
              This file contains synthetic demonstration data
            </label>
            <button
              className="wf-button"
              disabled={!file || busy}
              type="submit"
            >
              {busy ? "Reading source…" : "Preview source"}
              <ArrowRight size={16} />
            </button>
          </form>
          <aside className="wf-panel">
            <FileSpreadsheet size={27} />
            <h3>A mapping is a decision</h3>
            <a className="wf-text-button" href="/api/v1/imports/sample/xlsx">
              Download synthetic NGO XLSX example
            </a>
            <p>
              Field names can suggest a destination, but units, timezones and
              water-body identity must be approved by you.
            </p>
            <p>
              Ambiguous rows are held with a reason. Replaying the same source
              record preserves its identity and does not create another
              observation.
            </p>
            <a
              className="wf-text-button"
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
            >
              Inspect the API contract
              <ArrowRight size={16} />
            </a>
          </aside>
        </div>
      )}
      {preview && !results && (
        <>
          <div className="wf-section-head">
            <div>
              <Pill>{file?.name || preview.filename || "Source file"}</Pill>
              <span className="wf-muted"> · Import {preview.id}</span>
              {preview.synthetic && <Pill>Synthetic demo dataset</Pill>}
            </div>
            <button className="wf-text-button" disabled={busy} onClick={reset}>
              Choose another file
            </button>
          </div>
          {preview.schema_changed && (
            <Notice>
              The source schema changed. Review every mapping before approving
              this version.
            </Notice>
          )}
          <section className="wf-panel">
            <div className="wf-section-head">
              <h2>Original source preview</h2>
              <Pill>{preview.total_rows ?? preview.rows.length} rows</Pill>
            </div>
            <div className="wf-table-wrap">
              <table className="wf-table">
                <thead>
                  <tr>
                    {preview.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((row, index) => (
                    <tr key={index}>
                      {preview.columns.map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 8 && (
              <p className="wf-muted">Showing the first 8 source rows.</p>
            )}
          </section>
          {!transformed && (
            <form className="wf-panel" onSubmit={transform}>
              <h2>Review field mappings</h2>
              {connectors.data?.items.find((item) => item.id === connector)
                ?.mapping_approved && (
                <Notice>
                  The approved source mapping, units and timezone were loaded.
                  Review each decision; changed source columns remain manually
                  editable.
                </Notice>
              )}
              <p className="wf-muted">
                These suggestions use field-name rules. All fields remain
                manually editable.
              </p>
              <label className="wf-field"><span><input type="checkbox" checked={externalConsent} onChange={e=>setExternalConsent(e.target.checked)}/> Allow column names to be sent to Google Gemini. Free-tier prompts may be used to improve products. Dataset rows are excluded.</span></label>
              <button type="button" className="wf-button secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await api<{mapping:Record<string,string>;assistance:string}>('/api/v1/assistance/mapping-draft',{method:'POST',body:JSON.stringify({columns:preview.columns,external_ai_consent:externalConsent})});setMapping(previous=>({...previous,...result.mapping}));setMappingMode(result.assistance);setTransformed(undefined);setAccepted(false);}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Suggest mappings for review</button><p className="wf-muted">{mappingMode}. Units, timezone and water-body identity still require your approval.</p>
              <div className="wf-table-wrap">
                <table className="wf-table wf-mapping-table">
                  <thead>
                    <tr>
                      <th>Source field</th>
                      <th>Sample value</th>
                      <th>Approved destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.columns.map((column) => (
                      <tr key={column}>
                        <td>
                          <strong>{column}</strong>
                        </td>
                        <td>{String(preview.rows[0]?.[column] ?? "—")}</td>
                        <td>
                          <select
                            aria-label={`Destination for ${column}`}
                            value={mapping[column] || ""}
                            onChange={(event) =>
                              setMapping((previous) => ({
                                ...previous,
                                [column]: event.target.value,
                              }))
                            }
                          >
                            {destinations.map(([value, name]) => (
                              <option key={value} value={value}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="wf-form-grid">
                <label className="wf-field">
                  Temperature unit
                  <select
                    value={units.temperature || ""}
                    onChange={(event) =>
                      setUnits((previous) => ({
                        ...previous,
                        temperature: event.target.value,
                      }))
                    }
                  >
                    <option value="">Not specified — do not infer</option>
                    <option value="degC">Degrees Celsius (degC)</option>
                    <option value="Cel">Degrees Celsius (Cel)</option>
                    <option value="degF">Degrees Fahrenheit (degF)</option>
                  </select>
                  <small>
                    Only approved, supported conversions are applied.
                  </small>
                </label>
                <label className="wf-field">
                  pH unit
                  <select
                    value={units.ph || ""}
                    onChange={(event) =>
                      setUnits((previous) => ({
                        ...previous,
                        ph: event.target.value,
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="1">Dimensionless (1)</option>
                  </select>
                </label>
                <label className="wf-field">
                  Dissolved oxygen unit
                  <select
                    value={units.dissolved_oxygen || ""}
                    onChange={(event) =>
                      setUnits((previous) => ({
                        ...previous,
                        dissolved_oxygen: event.target.value,
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="mg/L">Milligrams per litre (mg/L)</option>
                  </select>
                </label>
                <label className="wf-field">
                  Source timezone
                  <input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="For example: Asia/Kolkata"
                  />
                  <small>
                    Required for source timestamps that lack a UTC offset.
                  </small>
                </label>
                <label className="wf-field">
                  Explicit water body for every row (optional)
                  <select
                    value={waterbody}
                    onChange={(event) => setWaterbody(event.target.value)}
                  >
                    <option value="">
                      Match each source site; quarantine ambiguity
                    </option>
                    {waters.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Choose only if you confirm every row belongs to this water
                    body.
                  </small>
                </label>
              </div>
              {Object.values(mapping).includes("parameter") && (
                <label className="wf-field">
                  Explicit source parameter meanings
                  <textarea
                    rows={3}
                    value={parameterMap}
                    onChange={(event) => setParameterMap(event.target.value)}
                    placeholder={'{"source_temperature_name":"temperature"}'}
                    spellCheck={false}
                  />
                  <small>
                    Map source values to temperature, ph or dissolved_oxygen
                    only. Ambiguous abbreviations are not inferred.
                  </small>
                </label>
              )}
              {preview.issues?.length > 0 && (
                <div className="wf-issues">
                  <h3>Source issues to review</h3>
                  <ul>
                    {preview.issues.map((issue, index) => (
                      <li key={index}>{displayIssue(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="wf-button" disabled={busy} type="submit">
                {busy ? "Validating mappings…" : "Preview transformed records"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {transformed && (
            <section className="wf-panel">
              <div className="wf-section-head">
                <h2>Transformed records</h2>
                <button
                  className="wf-button secondary"
                  disabled={busy}
                  onClick={() => setTransformed(undefined)}
                >
                  Edit mapping
                </button>
              </div>
              <div className="wf-result-counts">
                {Object.entries(transformed.counts || {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <strong>{value}</strong>
                      <span>{key.replaceAll("_", " ")}</span>
                    </div>
                  ),
                )}
              </div>
              {transformed.issues?.length > 0 && (
                <div className="wf-issues">
                  <h3>Held or rejected records</h3>
                  <ul>
                    {transformed.issues.map((issue, index) => (
                      <li key={index}>{displayIssue(issue)}</li>
                    ))}
                  </ul>
                  <p>
                    These issues are preserved with the source rows. Fix the
                    mapping or approve only the admissible records.
                  </p>
                </div>
              )}
              <pre className="wf-code wf-transform-preview">
                {JSON.stringify(transformed.records?.slice(0, 8), null, 2)}
              </pre>
              <label className="wf-check">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                I reviewed the water-body identities, units, times and
                unresolved records.
              </label>
              <Notice>
                Approval writes admissible observations to the server. Original
                values, source IDs and this mapping decision remain attached to
                the import.
              </Notice>
              <button
                className="wf-button"
                disabled={busy || !accepted || !transformed.counts?.ready}
                onClick={approve}
              >
                {busy ? "Importing records…" : "Approve & import"}
                <Check size={16} />
              </button>
              {!transformed.counts?.ready && (
                <p className="wf-small-error">
                  No admissible records. Edit the mapping to resolve blocking
                  issues.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {results && (
        <section className="wf-panel wf-import-result">
          <CheckCircle2 size={35} />
          <p className="wf-eyebrow">Server result</p>
          <h2>Import processed</h2>
          <p>
            Counts below come from the persisted import run. Duplicate records
            were preserved without creating another observation.
          </p>
          <div className="wf-result-counts">
            {["imported", "rejected", "duplicate", "unresolved"].map((key) => (
              <div key={key}>
                <strong>
                  {results.counts?.[key] ??
                    count(
                      results[
                        key as keyof Pick<
                          Results,
                          "imported" | "rejected" | "duplicate" | "unresolved"
                        >
                      ],
                    )}
                </strong>
                <span>{key}</span>
              </div>
            ))}
          </div>
          <dl className="wf-record-details">
            <dt>Import ID</dt>
            <dd>{results.id || preview?.id}</dd>
            <dt>Mapping version</dt>
            <dd>
              {results.mapping_version_id ||
                results.mapping_version ||
                transformed?.mapping_version_id ||
                transformed?.mapping_version ||
                "See stored run details below"}
            </dd>
            <dt>Dataset</dt>
            <dd>
              {preview?.synthetic
                ? "Synthetic demonstration"
                : "Organisation source"}
            </dd>
          </dl>
          <div className="wf-button-grid">
            {waterbody && (
              <Link className="wf-button" to={`/waterbodies/${waterbody}`}>
                View water-body passport
                <ArrowRight size={16} />
              </Link>
            )}
            <Link
              className="wf-button secondary"
              to={
                results.connector_id
                  ? `/integrations/${results.connector_id}`
                  : "/integrations"
              }
            >
              Inspect integration health & mapping version
            </Link>
            <button className="wf-button secondary" onClick={reset}>
              Import another file
            </button>
          </div>
          <details>
            <summary>Stored result details</summary>
            <pre className="wf-code">{JSON.stringify(results, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}
