import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { Modal, useToast } from "../ui";
import { date, errorText, label, Notice, useRecord } from "./workflowShared";
import { aggregateReviewLabel } from "./shareLabels";
import {selectedSocialHandles,type SocialAccount} from './socialAccounts';
import {drawShareCard,type CardFormat} from './shareCard';
import {loadShareMap} from './shareMap';

type Water = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  locality?: string;
  synthetic?: boolean;
  summary?: string;
  latest_observed_at?: string;
  sources?: { name: string }[];
};
type Case = {
  id: string;
  title: string;
  state: string;
  review_state: string;
  synthetic?: boolean;
  observed_at?: string;
  created_at?: string;
  completed_at?: string;
  outcome?: string;
  report_review_states?: string[];
};
export interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  waterbody: Water;
  caseRecord?: Case;
  sourceAttribution?: string;
  reportRecord?: {id:string;description:string;observed_at:string;review_state:string};
  recordKind?: "case" | "action";
}
export default function ShareModal({
  open,
  onClose,
  waterbody,
  caseRecord,
  sourceAttribution,
  reportRecord,
  recordKind = "case",
}: ShareModalProps) {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  );
  const toast = useToast();
  const [format, setFormat] = useState<CardFormat>("instagram"),
    [caption, setCaption] = useState(""),
    [blob, setBlob] = useState<Blob>(),
    [error, setError] = useState("");
  const [snapshotAt, setSnapshotAt] = useState(() => new Date().toISOString()),
    [captionEdited, setCaptionEdited] = useState(false);
  const [selectedAccounts,setSelectedAccounts]=useState<string[]>([]);
  const accounts=useRecord<{items:SocialAccount[]}>(`/api/v1/waterbodies/${waterbody.id}/social-accounts`,open);
  const approvedAccounts=accounts.loading||accounts.error?[]:accounts.data?.items||[];
  const chosenHandles=selectedSocialHandles(approvedAccounts,selectedAccounts);
  const sources = useRecord<{
    waterbody: Water;
    sources: { id: string; name: string; attribution?: string }[];
  }>(`/api/v1/waterbodies/${waterbody.id}`, open);
  const attribution =
    sourceAttribution ||
    (sources.data?.waterbody.id === waterbody.id && sources.data.sources.length
      ? sources.data.sources
          .slice(0, 2)
          .map(
            (source) => `${source.attribution || source.name}`,
          )
          .join("; ")
      : `AquaRelay public record ${caseRecord?.id || waterbody.id}`);
  const synthetic = !!waterbody.synthetic || !!caseRecord?.synthetic;
  const mapWater=sources.data?.waterbody.id===waterbody.id?sources.data.waterbody:waterbody;
  const [mapImage,setMapImage]=useState<HTMLCanvasElement>();
  const [mapError,setMapError]=useState('');
  const [mapRetry,setMapRetry]=useState(0);
  useEffect(()=>{
    if(!open)return;
    let active=true;setMapImage(undefined);setMapError('');
    if(mapWater.latitude===undefined||mapWater.longitude===undefined){if(sources.error||sources.data)setMapError('Lake coordinates could not be loaded. Reopen the share card after refreshing the record.');return;}
    void loadShareMap(mapWater.latitude,mapWater.longitude).then(image=>{if(active)setMapImage(image);}).catch(err=>{if(active)setMapError(errorText(err));});
    return()=>{active=false;};
  },[open,waterbody.id,mapWater.latitude,mapWater.longitude,mapRetry,sources.error,sources.data]);
  const reviews = useRecord<{
    case: { id: string };
    reports: { review_state?: string }[];
  }>(
    `/api/v1/cases/${caseRecord?.id}`,
    open && !!caseRecord && recordKind === "case",
  );
  const reviewStates =
    caseRecord?.report_review_states ||
    (reviews.data?.case.id === caseRecord?.id
      ? reviews.data?.reports.map(
          (report) => report.review_state || "submitted",
        )
      : undefined);
  const reviewLabel =
    reportRecord ? aggregateReviewLabel([reportRecord.review_state]) : recordKind === "action"
      ? "Organisation-submitted action record"
      : caseRecord
        ? aggregateReviewLabel(reviewStates)
        : "Public water-body record";
  const update = reportRecord ? reportRecord.description : caseRecord
    ? caseRecord.outcome || caseRecord.title
    : "Explore its recorded history, observations and documented actions.";
  const timestamp =
    reportRecord?.observed_at ||
    caseRecord?.completed_at ||
    caseRecord?.observed_at ||
    waterbody.latest_observed_at ||
    caseRecord?.created_at;
  const path = caseRecord
    ? `/incidents/${caseRecord.id}`
    : `/waterbodies/${waterbody.id}`;
  const configuredOrigin = (
    import.meta.env.VITE_PUBLIC_URL || location.origin
  ).replace(/\/$/, "");
  const permalink = `${configuredOrigin}${path}`;
  let publicUrl = false;
  try {
    const parsed = new URL(configuredOrigin);
    publicUrl =
      parsed.protocol === "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
      !parsed.hostname.endsWith(".local");
  } catch {
    /* local preview */
  }
  const finalCaption = `${synthetic ? "[SYNTHETIC DEMO — fictional data]\n" : ""}${caption}${chosenHandles.length?'\nSelected handles: '+chosenHandles.join(' '):''}\n${reviewLabel}.\nSource: ${attribution}. Snapshot generated ${date(snapshotAt)} (Asia/Kolkata).${publicUrl ? `\n${permalink}` : "\nLocal demonstration; public address is not configured."}`;
  useEffect(() => {
    if (open) {
      setCaptionEdited(false);
      setSnapshotAt(new Date().toISOString());
      setError("");
      setSelectedAccounts([]);
    }
  }, [open, waterbody.id, caseRecord?.id, update]);
  useEffect(() => {
    if (open && !captionEdited)
      setCaption(
        `${waterbody.name}: ${update}\n${timestamp ? `Recorded ${date(timestamp)}.` : "No observation date is recorded."} This dated snapshot does not establish water safety or a cause. See the live record for current status.`,
      );
  }, [open, waterbody.id, caseRecord?.id, update, timestamp, captionEdited]);
  useEffect(() => {
    if (!open || !canvasElement) return;
    setBlob(undefined);
    const drawing = canvasElement;
    try {
      drawShareCard(drawing,format,{name:waterbody.name,mapImage,locality:mapWater.locality,update,reviewLabel,kind:reportRecord?"report":undefined,status:reportRecord?(reportRecord.review_state==='submitted'?'Awaiting review':label(reportRecord.review_state)):caseRecord?(caseRecord.state==='closed'?'Resolved':label(caseRecord.state)):'Public water-body record',attribution,recordDate:timestamp?date(timestamp):'',snapshotDate:date(snapshotAt),url:publicUrl?new URL(permalink).host:'Local preview',synthetic});
    } catch(err){setError(errorText(err));return;}
    try {
      // Fixed-size, locally drawn cards avoid waiting for the browser's idle
      // canvas encoder, which can stall after a long reporting session.
      const encoded = drawing.toDataURL("image/png").split(",")[1];
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index);
      setBlob(new Blob([bytes], { type: "image/png" }));
    } catch (err) {
      setError(`PNG generation failed: ${errorText(err)}`);
    }
  }, [
    open,
    canvasElement,
    format,
    waterbody.id,
    waterbody.name,
    caseRecord?.id,
    caseRecord?.state,
    reportRecord?.id,
    reportRecord?.review_state,
    reviewLabel,
    update,
    timestamp,
    permalink,
    synthetic,
    attribution,
    snapshotAt,
    mapImage,
    mapWater.locality,
  ]);
  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the caption or permalink below.",
      );
    }
  };
  const download = () => {
    if (!blob) return;
    const href = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `aquarelay-${caseRecord?.id || waterbody.id}-${format}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 500);
    toast("PNG downloaded. It is a dated snapshot.");
  };
  const nativeShare = async () => {
    try {
      const file = blob
        ? new File([blob], `aquarelay-${format}.png`, { type: "image/png" })
        : undefined;
      const data =
        file && navigator.canShare?.({ files: [file] })
          ? { files: [file], title: waterbody.name, text: finalCaption }
          : {
              title: waterbody.name,
              text: finalCaption,
              ...(publicUrl ? { url: permalink } : {}),
            };
      await navigator.share(data);
      toast("Share opened. Publication is not confirmed.");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError"))
        setError(errorText(err));
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Share a factual update">
      <p className="wf-muted">
        Generate a dated card that links back to the record. Previously exported
        images remain snapshots.
      </p>
      {error && <Notice error>{error}</Notice>}
      {mapError&&<Notice error>{mapError}<button type="button" onClick={()=>setMapRetry(value=>value+1)}>Retry location map</button></Notice>}
      {!mapImage&&!mapError&&<p role="status">Loading the lake’s location map…</p>}
      <div className="wf-share-layout">
        <div>
          <div className="wf-tabs" aria-label="Card format">
            <button
              aria-pressed={format === "square"}
              onClick={() => setFormat("square")}
            >
              Square · 1080 × 1080
            </button>
            <button
              aria-pressed={format === "instagram"}
              onClick={() => setFormat("instagram")}
            >
              Instagram Story · 1080 × 1920
            </button>
            <button aria-pressed={format === "whatsapp"} onClick={() => setFormat("whatsapp")}>WhatsApp Status · 1080 × 1920</button>
          </div>
          <canvas
            ref={setCanvasElement}
            className={`wf-share-preview ${format === "square" ? "square" : "story"}`}
            aria-label={`${synthetic ? "Synthetic demo " : ""}${format} share card preview`}
          />
          <button
            className="wf-button wf-full"
            disabled={!blob||!mapImage}
            onClick={download}
          >
            <Download size={17} />
            Download {format} PNG
          </button>
        </div>
        <div>
          <label className="wf-field">
            Editable caption
            <textarea
              rows={8}
              value={caption}
              onChange={(event) => {
                setCaptionEdited(true);
                setCaption(event.target.value);
              }}
            />
            <small>
              Edited captions are your statements. The platform does not
              validate added claims.
              {synthetic ? " The synthetic demo label is always included." : ""}
            </small>
          </label>
          <p className="wf-muted">
            Included with your caption: {reviewLabel}. Source: {attribution}.
            The recorded review label and date are appended automatically.
          </p>
          {synthetic && (
            <div className="wf-synthetic">
              [SYNTHETIC DEMO — fictional data]
            </div>
          )}
          <label className="wf-field">
            Permalink
            <input readOnly value={permalink} />
          </label>
          {!publicUrl && (
            <Notice>
              A public address is not configured. This link opens the local
              demonstration; no public QR is generated.
            </Notice>
          )}
          {(accounts.loading||!!accounts.error||approvedAccounts.length>0)&&<div className="info-panel">
            <h3>Optional organisation handles</h3>
            <p className="wf-muted">Profiles reviewed by a platform administrator against the linked source. Choose up to five; selected handles are appended to your caption.</p>
            {accounts.loading&&<p>Loading reviewed profiles…</p>}
            {accounts.error&&<Notice error>{accounts.error}</Notice>}
            {!accounts.loading&&!accounts.error&&!approvedAccounts.length&&<p>No reviewed account is recorded for this water body.</p>}
            {approvedAccounts.map(account=><div key={account.id}>
              <label><input type="checkbox" checked={selectedAccounts.includes(account.id)} disabled={!selectedAccounts.includes(account.id)&&selectedAccounts.length>=5} onChange={event=>setSelectedAccounts(previous=>event.target.checked?[...previous,account.id]:previous.filter(id=>id!==account.id))}/> {account.organisation_name} · @{account.handle} ({account.platform})</label>
              <p className="fine-print"><a href={account.account_url} target="_blank" rel="noreferrer">Profile</a> · <a href={account.verification_source} target="_blank" rel="noreferrer">Verification source</a> · Reviewed {date(account.verified_at)}</p>
            </div>)}
          </div>}
          <div className="wf-button-grid">
            <button
              className="wf-button secondary"
              onClick={() => copy(finalCaption, "Caption copied.")}
            >
              <Copy size={16} />
              Copy caption
            </button>
            <button
              className="wf-button secondary"
              onClick={() => copy(permalink, "Permalink copied.")}
            >
              <Copy size={16} />
              Copy link
            </button>
            {typeof navigator.share === "function" && (
              <button
                className="wf-button"
                onClick={nativeShare}
                disabled={!blob||!mapImage}
              >
                <Share2 size={16} />
                Open share sheet
              </button>
            )}
            <a
              className="wf-button secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(finalCaption)}`}
            >
              Share on X<ExternalLink size={15} />
            </a>
            <a
              className="wf-button secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(finalCaption)}`}
            >
              Open WhatsApp
              <ExternalLink size={15} />
            </a>
          </div>
          <p className="wf-muted">
            For Instagram or WhatsApp Status, save the story image and post it
            with your caption. Native sharing is available only where the
            browser supports it.
          </p>
        </div>
      </div>
    </Modal>
  );
}
