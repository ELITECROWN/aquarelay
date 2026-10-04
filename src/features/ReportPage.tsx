import ShareModal from "./ShareModal";
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  FileImage,
  LocateFixed,
  MapPin,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { useSession } from "../session";
import { api } from '../api';
import {
  canRetryDraft,
  listDrafts,
  removeDraft,
  saveDraft,
  syncDraft,
  type LocalDraft,
  type ReportValues,
} from "./offline";
import {
  date,
  errorText,
  Gate,
  Loading,
  Notice,
  Pill,
  useRecord,
  WorkflowHeader,
} from "./workflowShared";

const ObservationMap=lazy(()=>import("./ObservationMap"));

class ObservationMapBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<Notice>Map could not be loaded. Select a water body and enter the observation coordinates below; the report form remains available.</Notice>:this.props.children;}
}

type Water = {
  id: string;
  name: string;
  locality: string;
  latitude: number;
  longitude: number;
  synthetic: boolean;
};
type Case = {
  id: string;
  waterbody_id: string;
  title: string;
  state: string;
  observed_at: string;
};
type CandidateResponse = {
  items: { case: Case; reasons: string[]; time_difference_seconds: number }[];
  assistance: string;
};
const steps = ["Place & time", "Observation", "Evidence & links", "Review"];
const types = [
  ["fish_mortality", "Dead or distressed fish"],
  ["aquatic_organisms", "Other aquatic organisms"],
  ["foam", "Foam"],
  ["odour", "Unusual odour"],
  ["oil_film", "Oil-like surface film"],
  ["water_colour", "Unusual water colour"],
  ["suspected_discharge", "Suspected discharge"],
  ["waste_dumping", "Waste dumping"],
  ["habitat_damage", "Habitat damage"],
  ["unsure", "Unsure"],
];
const localNow = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const initial: ReportValues = {
  waterbody_id: "",
  observation_type: "",
  observed_at: "",
  latitude: 0,
  longitude: 0,
  description: "",
  count_estimate: "",
  language: "English",
  synthetic: false,
};
export default function ReportPage() {
  const { user, loading: sessionLoading } = useSession();
  const [params] = useSearchParams();
  const [waterSearch,setWaterSearch]=useState("");
  const [sharing,setSharing]=useState(false);
  const waters = useRecord<{ items: Water[] }>(
    `/api/v1/waterbodies?page_size=100&q=${encodeURIComponent(waterSearch)}`,
  );
  const cases = useRecord<{ items: Case[] }>("/api/v1/cases?page_size=100");
  const [step, setStep] = useState(0),
    [values, setValues] = useState<ReportValues>(()=>({...initial,observation_type:types.some(([key])=>key===params.get("type")) ? params.get("type")! : ""})),
    [observedLocal, setObservedLocal] = useState(localNow);
  const [media, setMedia] = useState<File[]>([]),
    [drafts, setDrafts] = useState<LocalDraft[]>([]),
    [current, setCurrent] = useState<LocalDraft>();
  const [externalConsent,setExternalConsent]=useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [submitted, setSubmitted] = useState<LocalDraft>();
  const requestedWaterId=params.get("waterbody") || params.get("waterbody_id") || "";
  const requestedCaseId=params.get("related_case") || "";
  const selectedCase=useRecord<{case:Case}>(`/api/v1/cases/${encodeURIComponent(requestedCaseId)}`,!!requestedCaseId);
  const selectedWaterId=submitted?.values.waterbody_id || values.waterbody_id || requestedWaterId;
  const selectedWater=useRecord<{waterbody:Water}>(`/api/v1/waterbodies/${encodeURIComponent(selectedWaterId)}`,!!selectedWaterId);
  const submittedRecord=useRecord<{case:Case & {review_state:string;synthetic:boolean};reports:{id:string;description:string;observed_at:string;review_state:string}[]}>(`/api/v1/cases/${submitted?.caseId}`,!!submitted?.caseId);
  const submittedReport=submittedRecord.data?.reports.find(report=>report.id===submitted?.reportId);
  const [online, setOnline] = useState(navigator.onLine);
  const observedDate = observedLocal ? new Date(observedLocal) : undefined;
  const observedISO =
    observedDate && Number.isFinite(observedDate.getTime())
      ? observedDate.toISOString()
      : "";
  const candidateParams = new URLSearchParams({
    waterbody_id: values.waterbody_id,
    observed_at: observedISO,
    type: values.observation_type,
    latitude: String(values.latitude),
    longitude: String(values.longitude),
  });
  const candidates = useRecord<CandidateResponse>(
    `/api/v1/reports/candidates?${candidateParams}`,
    !!user &&
      !!values.waterbody_id &&
      !!values.observation_type &&
      !!observedISO &&
      step >= 2,
  );
  const update = (
    field: keyof ReportValues,
    value: string | number | boolean,
  ) => setValues((previous) => ({ ...previous, [field]: value }));
  const reloadDrafts = async () => {
    if (user) {
      try {
        setDrafts(await listDrafts(user.id));
      } catch (err) {
        setError(errorText(err));
      }
    }
  };
  useEffect(() => {
    setDrafts([]);
    setCurrent(undefined);
    setSubmitted(undefined);
    setValues({...initial,observation_type:types.some(([key])=>key===params.get("type")) ? params.get("type")! : ""});
    setSharing(false);
    setMedia([]);
    if (user) void reloadDrafts();
  }, [user?.id]);
  const results = (Array.isArray(waters.data) ? waters.data : waters.data?.items) || [];
  const waterList=selectedWater.data?.waterbody&&!results.some(w=>w.id===selectedWater.data!.waterbody.id)?[selectedWater.data.waterbody,...results]:results;
  const caseResults = (Array.isArray(cases.data) ? cases.data : cases.data?.items) || [];
  const caseList=selectedCase.data?.case&&!caseResults.some(c=>c.id===selectedCase.data!.case.id)?[selectedCase.data.case,...caseResults]:caseResults;
  const candidateList = candidates.data?.items || [];

  useEffect(() => {
    const id = params.get("waterbody") || params.get("waterbody_id");
    const water = waterList.find((item) => item.id === id);
    if (water && !values.waterbody_id)
      setValues((previous) => ({
        ...previous,
        waterbody_id: water.id,
        latitude: water.latitude,
        longitude: water.longitude,
        synthetic: water.synthetic,
        related_case_id: params.get("related_case") || undefined,
      }));
  }, [waters.data, selectedWater.data, params, user?.id]);
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void reloadDrafts();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("aquarelay-drafts-changed", reloadDrafts);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("aquarelay-drafts-changed", reloadDrafts);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user?.id]);
  const water = waterList.find(
    (item) => item.id === values.waterbody_id,
  );
  const suggested = candidateList.map((item) => item.case) || [];
  const explicitlySelected = caseList.find(
    (item) =>
      item.id === values.related_case_id &&
      item.waterbody_id === values.waterbody_id,
  );
  const related =
    explicitlySelected &&
    !suggested.some((item) => item.id === explicitlySelected.id)
      ? [explicitlySelected, ...suggested]
      : suggested;
  const validate = () => {
    if (
      step === 0 &&
      (!values.waterbody_id ||
        !observedLocal ||
        !Number.isFinite(values.latitude) ||
        !Number.isFinite(values.longitude) ||
        Math.abs(values.latitude) > 90 ||
        Math.abs(values.longitude) > 180)
    )
      return "Select a registered water body and a valid observation time and position.";
    if (step === 0 && new Date(observedLocal).getTime() > Date.now() + 60000)
      return "Observation time cannot be in the future.";
    if (
      step === 1 &&
      (!values.observation_type || values.description.trim().length < 10)
    )
      return "Choose an observation and describe what you saw in at least 10 characters.";
    return "";
  };
  const draftValue = (status: LocalDraft["status"]): LocalDraft => ({
    id: current?.id || `report-${crypto.randomUUID()}`,
    accountId: user!.id,
    status,
    updatedAt: new Date().toISOString(),
    values: {
      ...values,
      observed_at: new Date(observedLocal).toISOString(),
      related_case_id: values.related_case_id || undefined,
    },
    media,
    evidenceIds: current?.evidenceIds || [],
  });
  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const draft = await saveDraft(draftValue("draft"));
      setCurrent(draft);
      setMessage("Draft saved on this device. It has not been submitted.");
      await reloadDrafts();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const persisted=current&&canRetryDraft(current,user.id)?(await listDrafts(user.id)).find(d=>d.id===current.id):undefined;
      if(current&&canRetryDraft(current,user.id)&&!persisted)throw new Error('The pending report is unavailable on this device. Refresh before retrying.');
      const draft = persisted || await saveDraft(draftValue("pending"));
      setCurrent(draft);
      if (!navigator.onLine) {
        setMessage(
          "Saved as pending on this device. The server has not received this report.",
        );
        await reloadDrafts();
        return;
      }
      const result = await syncDraft(draft, user.id);
      setSubmitted(result);
      await reloadDrafts();
    } catch (err) {
      setError(errorText(err));
      await reloadDrafts();
    } finally {
      setBusy(false);
    }
  };
  const retry = async (draft: LocalDraft) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const result = await syncDraft(draft, user.id);
      setSubmitted(result);
      await reloadDrafts();
    } catch (err) {
      setError(errorText(err));
      await reloadDrafts();
    } finally {
      setBusy(false);
    }
  };
  const resume = (draft: LocalDraft) => {
    setCurrent(draft);
    setValues(draft.values);
    setMedia(draft.media);
    const observed = new Date(draft.values.observed_at);
    setObservedLocal(
      new Date(observed.getTime() - observed.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
    setStep(0);
    setMessage("Local draft restored. Review before submitting.");
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable. Enter approximate coordinates manually.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((previous) => ({
          ...previous,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setMessage(
          "Device location selected. Check that it describes where you observed the event.",
        );
      },
      () =>
        setError(
          "Location was not available. Select a water body or enter coordinates manually.",
        ),
      { timeout: 10000 },
    );
  };
  if (sessionLoading) return <Loading />;
  if (!user)
    return (
      <div className="wf-page">
        <WorkflowHeader
          eyebrow="Community contribution"
          title="Report an observation"
          description="Add what you saw to the water body’s recorded history."
        />
        <Gate />
      </div>
    );
  if (submitted)
    return (
      <div className="wf-page wf-narrow">
        <div className="wf-panel wf-success glass-panel">
          <CheckCircle2 size={42} className="text-rose-600" />
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "6px 14px", borderRadius: "20px", color: "#065f46", fontSize: "12px", fontWeight: "650", margin: "14px 0" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            Community Report Saved · Awaiting Review
          </div>
          <h1>Your observation is on record.</h1>
          <p>
            Your community report and uploaded evidence are stored. Review status, organisation response and delivery receipts are recorded separately on the incident timeline.
          </p>
          <dl className="wf-record-details">
            <dt>Report ID</dt>
            <dd>{submitted.reportId}</dd>
            <dt>Case ID</dt>
            <dd>{submitted.caseId}</dd>
            <dt>Evidence uploaded</dt>
            <dd>{submitted.evidenceIds.length} file(s)</dd>
            <dt>Observation time</dt>
            <dd>{date(submitted.values.observed_at)}</dd>
          </dl>
          <Link className="wf-button" to={`/incidents/${submitted.caseId}`}>
            View incident <ArrowRight size={17} />
          </Link>
          <button className="wf-button secondary" disabled={!submittedReport||!selectedWater.data} onClick={()=>setSharing(true)}><Share2 size={17}/> Share my report</button>
          {submittedRecord.error&&<Notice error>{submittedRecord.error}<button onClick={submittedRecord.reload}>Retry loading report</button></Notice>}
          {selectedWater.error&&<Notice error>{selectedWater.error}<button onClick={selectedWater.reload}>Retry loading water body</button></Notice>}
          {submittedReport&&selectedWater.data&&submittedRecord.data&&<ShareModal open={sharing} onClose={()=>setSharing(false)} waterbody={selectedWater.data.waterbody} caseRecord={submittedRecord.data.case} reportRecord={submittedReport} sourceAttribution="Community-submitted observation"/>}
          <button
            className="wf-button secondary"
            onClick={() => {
              setSharing(false);
              setSubmitted(undefined);
              setCurrent(undefined);
              setValues(initial);
              setMedia([]);
              setStep(0);
            }}
          >
            Report another lake observation
          </button>
        </div>
      </div>
    );
  return (
    <div className="wf-page">
      <WorkflowHeader
        eyebrow="Community observations"
        title="Report an observation"
        description="Record what you saw, preserve evidence and follow the documented response."
      >
        <Pill tone={online ? "" : "amber"}>
          {online ? "Online" : "Offline · saved locally"}
        </Pill>
      </WorkflowHeader>
      <div className="wf-report-layout">
        <section className="wf-panel wf-report-main">
          <ol className="wf-stepper" aria-label="Report steps">
            {steps.map((name, index) => (
              <li
                key={name}
                className={
                  index === step ? "active" : index < step ? "complete" : ""
                }
                aria-current={index === step ? "step" : undefined}
              >
                <span>{index < step ? <Check size={15} /> : index + 1}</span>
                <p>{name}</p>
              </li>
            ))}
          </ol>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {current&&canRetryDraft(current,user.id)&&<Notice>This submission is locked for safe retry. Retry sends the original saved observation and resumes completed uploads. Start a new report after this submission is acknowledged.</Notice>}
          <div className="wf-form-body">
            {step === 0 && (
              <>
                <h2>Where and when?</h2>
                <p className="wf-muted">
                  Use the water body’s position as a starting point, then adjust
                  it if needed.
                </p>
                {waters.error && (
                  <Notice error>
                    {waters.error} Existing local drafts can still be opened
                    below.
                  </Notice>
                )}
                <label className="wf-field">Search water bodies by name or place<input type="search" maxLength={120} value={waterSearch} onChange={e=>setWaterSearch(e.target.value)} placeholder="Search Bengaluru, Sodepur, Potheri or a water-body name"/></label>
                <label className="wf-field">
                  Water body
                  <select
                    value={values.waterbody_id}
                    onChange={(event) => {
                      const selected = waterList.find(
                        (item) => item.id === event.target.value,
                      );
                      if (selected)
                        setValues((previous) => ({
                          ...previous,
                          waterbody_id: selected.id,
                          latitude: selected.latitude,
                          longitude: selected.longitude,
                          synthetic: selected.synthetic,
                          related_case_id: undefined,
                        }));
                    }}
                  >
                    <option value="">Choose a registered water body</option>
                    {waterList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.locality}
                      </option>
                    ))}
                    {values.waterbody_id && !water && (
                      <option value={values.waterbody_id}>
                        {values.waterbody_id} · from local draft
                      </option>
                    )}
                  </select>
                </label>
                {water&&<ObservationMapBoundary><Suspense fallback={<Loading/>}><ObservationMap position={{latitude:values.latitude,longitude:values.longitude}} onChange={position=>setValues(previous=>({...previous,...position}))}/></Suspense></ObservationMapBoundary>}
                {selectedWater.error&&<Notice error>{selectedWater.error}</Notice>}
                <div className="wf-form-grid">
                  <label className="wf-field">
                    Observed at
                    <input
                      type="datetime-local"
                      value={observedLocal}
                      onChange={(event) => setObservedLocal(event.target.value)}
                    />
                    <small>
                      Timezone:{" "}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}. Upload
                      time is stored separately.
                    </small>
                  </label>
                  <div className="wf-field">
                    Approximate position
                    <button
                      className="wf-button secondary"
                      type="button"
                      onClick={locate}
                    >
                      <LocateFixed size={16} />
                      Use my location (optional)
                    </button>
                  </div>
                  <label className="wf-field">
                    Latitude
                    <input
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      value={values.latitude}
                      onChange={(event) =>
                        update("latitude", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className="wf-field">
                    Longitude
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={values.longitude}
                      onChange={(event) =>
                        update("longitude", Number(event.target.value))
                      }
                    />
                  </label>
                </div>
                {water?.synthetic && (
                  <Notice>
                    This is a synthetic demo water body. Your report and shared
                    cards will carry a demo label.
                  </Notice>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <h2>What did you observe?</h2>
                <div className="wf-observation-grid">
                  {types.map(([value, name]) => (
                    <label
                      key={value}
                      className={`wf-choice ${values.observation_type === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="observation"
                        value={value}
                        checked={values.observation_type === value}
                        onChange={() => update("observation_type", value)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
                <label className="wf-field">
                  Describe what you saw
                  <textarea
                    rows={5}
                    value={values.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    placeholder="Describe the location and visible observation. It is fine to be unsure."
                  />
                  <small>
                    Your original statement is preserved. Do not include contact
                    details or identify private individuals.
                  </small>
                </label>
                <div className="wf-form-grid">
                  <label className="wf-field">
                    Approximate count or range (optional)
                    <input
                      value={values.count_estimate}
                      onChange={(event) =>
                        update("count_estimate", event.target.value)
                      }
                      placeholder="For example: 5–10, about 20, unsure"
                    />
                    <small>Stored as an estimate, including your range.</small>
                  </label>
                  <label className="wf-field">
                    Original language
                    <input
                      value={values.language}
                      onChange={(event) =>
                        update("language", event.target.value)
                      }
                      placeholder="Language of your original statement"
                    />
                  </label>
                </div>
                <button type="button" className="wf-button secondary" disabled={busy || values.description.length < 8 || !navigator.onLine} onClick={async()=>{
                  setBusy(true);setError('');try {
                    const result=await api<{draft:Record<string,string>;issues:string[]}>('/api/v1/assistance/report-draft',{method:'POST',body:JSON.stringify({original_text:values.description,language:values.language,external_ai_consent:externalConsent})});
                    setValues(previous=>({...previous,observation_type:result.draft.observation_type||previous.observation_type,count_estimate:result.draft.count_estimate||previous.count_estimate}));
                    setMessage('Draft suggestions applied for your review. '+(result.draft.additional_observations?'Also mentioned: '+result.draft.additional_observations+'. ':'')+result.issues.join(' '));
                  } catch(e){setError(errorText(e));}finally{setBusy(false);}
                }}>Suggest structured fields from my statement</button>
                <p className="wf-muted">Local vocabulary assistance for English, Hindi and Kannada. Review the observation and count before confirming. Your original text stays unchanged.</p>
                <label className="wf-field"><span><input type="checkbox" checked={externalConsent} onChange={e=>setExternalConsent(e.target.checked)}/> Allow my statement to be sent to Google Gemini if configured. Google's free tier may use submitted data to improve products. Photos and account details are excluded.</span></label>
              </>
            )}
            {step === 2 && (
              <>
                <h2>Evidence and related records</h2>
                <label className="wf-upload">
                  <CloudUpload size={28} />
                  <strong>Add photographs or video</strong>
                  <span>
                    Images: JPEG, PNG, WebP up to 10 MB · MP4 up to 20 MB and 60
                    seconds · up to 10 files
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    onChange={(event) => {
                      const files = [...(event.target.files || [])];
                      if (
                        files.some(
                          (file) =>
                            file.size >
                            (file.type.startsWith("video/") ? 20 : 10) *
                              1024 *
                              1024,
                        )
                      ) {
                        setError(
                          "Images must be 10 MB or smaller; videos must be 20 MB or smaller.",
                        );
                        return;
                      }
                      if (files.length + media.length > 10) {
                        setError(
                          "A report supports at most 10 evidence files.",
                        );
                        return;
                      }
                      setError("");
                      setMedia((previous) => [...previous, ...files]);
                    }}
                  />
                </label>
                {media.length > 0 && (
                  <ul className="wf-file-list">
                    {media.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <FileImage size={19} />
                        <div>
                          <strong>{file.name}</strong>
                          <small>
                            {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                            {values.synthetic
                              ? "Demo evidence"
                              : "Reporter evidence"}
                          </small>
                        </div>
                        <button
                          aria-label={`Remove ${file.name}`}
                          className="wf-icon-button"
                          disabled={!!current?.evidenceIds.length}
                          onClick={() =>
                            setMedia((previous) =>
                              previous.filter((_, item) => item !== index),
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="wf-muted">
                  Public image derivatives remove EXIF. Public MP4 derivatives
                  remove metadata and audio; private originals remain protected.
                </p>
                <h3>Could this be related to an existing case?</h3>
                {related.some(
                  (item) =>
                    item.id === values.related_case_id &&
                    item.state === "closed",
                ) && (
                  <Notice>
                    This case is closed. New evidence is preserved for
                    organisation review; only an authorised reviewer can decide
                    to reopen it.
                  </Notice>
                )}
                <p className="wf-muted">
                  These candidates use observation type, a seven-day time window
                  and a one-kilometre distance rule where positions are
                  recorded. You choose whether to link; reports are never
                  silently merged.
                </p>
                <label className="wf-choice">
                  <input
                    type="radio"
                    checked={!values.related_case_id}
                    onChange={() => update("related_case_id", "")}
                  />
                  Create a separate case
                </label>
                {candidates.loading && (
                  <p className="wf-muted" role="status">
                    Checking recorded cases against location, time and type
                    rules…
                  </p>
                )}
                {candidates.error && (
                  <Notice error>
                    Related-case comparison is unavailable: {candidates.error}{" "}
                    You can still choose a separate report or your explicitly
                    selected case.
                  </Notice>
                )}
                {related.map((item) => (
                  <label className="wf-choice" key={item.id}>
                    <input
                      type="radio"
                      checked={values.related_case_id === item.id}
                      onChange={() => update("related_case_id", item.id)}
                    />
                    <span>
                      {item.title}
                      <small>
                        {date(item.observed_at)} · {item.state}
                      </small>
                      <small>
                        {candidateList
                          .find((candidate) => candidate.case.id === item.id)
                          ?.reasons.join(" · ") ||
                          "You explicitly selected this case from its public record; it is not an automatic duplicate suggestion."}
                      </small>
                    </span>
                  </label>
                ))}
                {!related.length &&
                  !candidates.loading &&
                  !candidates.error && (
                    <p className="wf-muted">
                      No potentially related cases satisfy the current location,
                      time and type rules.
                    </p>
                  )}
              </>
            )}
            {step === 3 && (
              <>
                <h2>Review your contribution</h2>
                <Pill tone="amber">Community report — not yet reviewed</Pill>
                <dl className="wf-review">
                  <dt>Water body</dt>
                  <dd>{water?.name || values.waterbody_id}</dd>
                  <dt>Observed</dt>
                  <dd>{date(new Date(observedLocal).toISOString())}</dd>
                  <dt>Position</dt>
                  <dd>
                    {values.latitude}, {values.longitude}
                  </dd>
                  <dt>Observation</dt>
                  <dd>
                    {
                      types.find(
                        (item) => item[0] === values.observation_type,
                      )?.[1]
                    }
                  </dd>
                  <dt>Original statement</dt>
                  <dd className="wf-preserve">{values.description}</dd>
                  <dt>Original language</dt>
                  <dd>{values.language || "Not specified"}</dd>
                  <dt>Estimated count</dt>
                  <dd>{values.count_estimate || "Not supplied"}</dd>
                  <dt>Evidence</dt>
                  <dd>
                    {media.length} file{media.length !== 1 ? "s" : ""}
                    {values.synthetic ? " · synthetic demonstration" : ""}
                  </dd>
                  <dt>Case choice</dt>
                  <dd>
                    {values.related_case_id
                      ? `Add to case ${values.related_case_id}`
                      : "Create a separate case"}
                  </dd>
                </dl>
                <Notice>
                  By submitting, you contribute a public observation and
                  evidence. A report records what was observed; it does not
                  confirm contamination, causation or water safety.
                </Notice>
              </>
            )}
          </div>
          <footer className="wf-form-footer">
            <button
              className="wf-button secondary"
              disabled={busy || !!current && canRetryDraft(current,user.id)}
              onClick={save}
            >
              <Save size={16} />
              Save draft
            </button>
            <div>
              {step > 0 && (
                <button
                  className="wf-button ghost"
                  disabled={busy || !!current && canRetryDraft(current,user.id)}
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  className="wf-button"
                  onClick={() => {
                    const issue = validate();
                    setError(issue);
                    if (!issue) {
                      setStep(step + 1);
                      setMessage("");
                    }
                  }}
                >
                  Continue
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button className="wf-button" disabled={busy} onClick={submit}>
                  {busy
                    ? "Saving & uploading…"
                    : online
                      ? "Submit observation"
                      : "Save pending report"}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </footer>
        </section>
        <aside className="wf-report-aside">
          <div className="wf-panel"><h3>Recorded response</h3><p>Submission creates a community observation for organisation review. External delivery and acknowledgement are shown only when recorded. A report does not establish cause or water safety.</p></div>
          <div className="wf-panel">
            <MapPin size={24} />
            <h3>Observe from a safe place</h3>
            <p>
              Stay in publicly accessible places. Do not enter the water, touch
              dead wildlife, approach hazardous discharge, or trespass to
              collect evidence.
            </p>
            <p>
              Sampling belongs to trained participants following an approved
              procedure.
            </p>
          </div>
          <div className="wf-panel">
            <h3>Your drafts on this device</h3>
            <p className="wf-muted">
              Text and media are scoped to your account. Browser storage may be
              cleared or fill up. Sign out hides your drafts from other
              accounts.
            </p>
            {!drafts.length && <p>No saved drafts yet.</p>}
            {drafts.map((draft) => (
              <div className="wf-draft" key={draft.id}>
                <div>
                  <strong>
                    {waterList.find(
                      (item) => item.id === draft.values.waterbody_id,
                    )?.name || "Observation draft"}
                  </strong>
                  <Pill
                    tone={
                      draft.status === "failed"
                        ? "red"
                        : draft.status === "synced"
                          ? ""
                          : "amber"
                    }
                  >
                    {draft.status}
                  </Pill>
                </div>
                <small>{date(draft.updatedAt)}</small>
                {draft.error && <p className="wf-small-error">{draft.error}</p>}
                <div className="wf-draft-actions">
                  {draft.status === "draft" && (
                    <button onClick={() => resume(draft)}>Open draft</button>
                  )}
                  {canRetryDraft(draft, user.id) && (
                    <button
                      disabled={busy || !online}
                      onClick={() => retry(draft)}
                    >
                      Sync now
                    </button>
                  )}
                  {draft.status === "synced" && (
                    <Link to={`/incidents/${draft.caseId}`}>
                      View saved report
                    </Link>
                  )}
                  <button
                    aria-label="Delete local draft"
                    onClick={async () => {
                      try {
                        await removeDraft(draft.id, user.id);
                        await reloadDrafts();
                        if (current?.id === draft.id) setCurrent(undefined);
                      } catch (err) {
                        setError(errorText(err));
                      }
                    }}
                  >
                    Remove local copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
