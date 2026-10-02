import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { Modal, useToast } from "../ui";
import { date, errorText, label, Notice, useRecord } from "./workflowShared";
import { aggregateReviewLabel } from "./shareLabels";

type Water = {
  id: string;
  name: string;
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
  recordKind?: "case" | "action";
}
function wrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maximumLines = 6,
) {
  const words = text.split(/\s+/);
  let line = "",
    count = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      context.fillText(line, x, y + count * lineHeight);
      count++;
      line = word;
      if (count >= maximumLines - 1) break;
    } else line = next;
  }
  context.fillText(line, x, y + count * lineHeight);
  return y + (count + 1) * lineHeight;
}
export default function ShareModal({
  open,
  onClose,
  waterbody,
  caseRecord,
  sourceAttribution,
  recordKind = "case",
}: ShareModalProps) {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null,
  );
  const toast = useToast();
  const [format, setFormat] = useState<"square" | "story">("square"),
    [caption, setCaption] = useState(""),
    [blob, setBlob] = useState<Blob>(),
    [error, setError] = useState("");
  const [snapshotAt, setSnapshotAt] = useState(() => new Date().toISOString()),
    [captionEdited, setCaptionEdited] = useState(false);
  const sources = useRecord<{
    waterbody: { id: string };
    sources: { id: string; name: string; attribution?: string }[];
  }>(`/api/v1/waterbodies/${waterbody.id}`, open);
  const attribution =
    sourceAttribution ||
    (sources.data?.waterbody.id === waterbody.id && sources.data.sources.length
      ? sources.data.sources
          .slice(0, 2)
          .map(
            (source) => `${source.attribution || source.name} (${source.id})`,
          )
          .join("; ")
      : `AquaRelay public record ${caseRecord?.id || waterbody.id}`);
  const synthetic = !!waterbody.synthetic || !!caseRecord?.synthetic;
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
    recordKind === "action"
      ? "Organisation-submitted action record"
      : caseRecord
        ? aggregateReviewLabel(reviewStates)
        : "Public water-body record";
  const update = caseRecord
    ? caseRecord.outcome || caseRecord.title
    : "Explore its recorded history, observations and documented actions.";
  const timestamp =
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
  const finalCaption = `${synthetic ? "[SYNTHETIC DEMO — fictional data]\n" : ""}${caption}\n${reviewLabel}.\nSource: ${attribution}. Snapshot generated ${date(snapshotAt)} (Asia/Kolkata).${publicUrl ? `\n${permalink}` : "\nLocal demonstration; public address is not configured."}`;
  useEffect(() => {
    if (open) {
      setCaptionEdited(false);
      setSnapshotAt(new Date().toISOString());
      setError("");
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
    drawing.width = 1080;
    drawing.height = format === "story" ? 1920 : 1080;
    const context = drawing.getContext("2d");
    if (!context) {
      setError(
        "This browser cannot generate PNG cards. Copy the caption and permalink instead.",
      );
      return;
    }
    const height = drawing.height,
      inset = 82,
      width = drawing.width - inset * 2;
    context.fillStyle = "#F6F7F2";
    context.fillRect(0, 0, 1080, height);
    context.fillStyle = "#183B30";
    context.fillRect(0, 0, 1080, 22);
    context.font = "500 34px Arial, sans-serif";
    context.fillText("AquaRelay", inset, 106);
    if (synthetic) {
      context.fillStyle = "#DCE9AC";
      context.fillRect(inset, 146, width, 65);
      context.fillStyle = "#183B30";
      context.font = "bold 29px Arial, sans-serif";
      context.fillText("SYNTHETIC DEMO · FICTIONAL RECORD", inset + 24, 190);
    }
    const headingY = synthetic ? 270 : 226;
    context.fillStyle = "#183B30";
    context.font =
      format === "story"
        ? "500 66px Arial, sans-serif"
        : "500 54px Arial, sans-serif";
    const afterHeading = wrappedText(
      context,
      waterbody.name,
      inset,
      headingY,
      width,
      format === "story" ? 79 : 64,
      2,
    );
    context.fillStyle = "#DCE8ED";
    const surfaceTop =
      format === "story" ? afterHeading + 100 : afterHeading + 28;
    const surfaceHeight = format === "story" ? 490 : 170;
    context.fillRect(inset, surfaceTop, width, surfaceHeight);
    context.strokeStyle = "#7D9EAA";
    context.lineWidth = 3;
    for (let row = 0; row < (format === "story" ? 8 : 3); row++) {
      context.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const y =
          surfaceTop + 40 + row * 47 + Math.sin(x / 100 + row * 0.7) * 9;
        if (x === 0) context.moveTo(inset + x, y);
        else context.lineTo(inset + x, y);
      }
      context.stroke();
    }
    context.fillStyle = "#183B30";
    context.font =
      format === "story"
        ? "500 37px Arial, sans-serif"
        : "500 33px Arial, sans-serif";
    const afterUpdate = wrappedText(
      context,
      update,
      inset,
      surfaceTop + surfaceHeight + 65,
      width,
      45,
      format === "story" ? 4 : 2,
    );
    context.font = "500 26px Arial, sans-serif";
    context.fillStyle = "#654922";
    wrappedText(context, reviewLabel, inset, afterUpdate + 25, width, 35, 2);
    if (caseRecord) {
      context.fillStyle = "#183B30";
      context.font = "26px Arial, sans-serif";
      context.fillText(
        `Case work: ${label(caseRecord.state)}`,
        inset,
        afterUpdate + 92,
      );
    }
    const footer = height - 195;
    context.fillStyle = "#5E6D65";
    context.font = "22px Arial, sans-serif";
    context.fillText(
      timestamp
        ? `Record: ${date(timestamp)} · Snapshot: ${date(snapshotAt)}`
        : `Snapshot generated ${date(snapshotAt)}`,
      inset,
      footer,
    );
    context.font = "21px Arial, sans-serif";
    wrappedText(
      context,
      `Source: ${attribution}`,
      inset,
      footer + 36,
      width,
      27,
      2,
    );
    context.font = "21px Arial, sans-serif";
    wrappedText(
      context,
      publicUrl
        ? permalink
        : `Local demo · public address not configured · ${path}`,
      inset,
      footer + 98,
      width,
      27,
      2,
    );
    context.fillStyle = "#E4EBDF";
    context.fillRect(0, height - 54, 1080, 54);
    context.fillStyle = "#183B30";
    context.font = "22px Arial, sans-serif";
    context.fillText(
      synthetic
        ? "DEMO SNAPSHOT · No claim of water safety or ecological recovery"
        : "Dated snapshot · Read the current source record for updates",
      inset,
      height - 19,
    );
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
    reviewLabel,
    update,
    timestamp,
    permalink,
    synthetic,
    attribution,
    snapshotAt,
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
              aria-pressed={format === "story"}
              onClick={() => setFormat("story")}
            >
              Story · 1080 × 1920
            </button>
          </div>
          <canvas
            ref={setCanvasElement}
            className={`wf-share-preview ${format}`}
            aria-label={`${synthetic ? "Synthetic demo " : ""}${format} share card preview`}
          />
          <button
            className="wf-button wf-full"
            disabled={!blob}
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
                disabled={!blob}
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
