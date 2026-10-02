import { Radio, ShieldAlert, CheckCircle, AlertTriangle } from "lucide-react";

const FEED_ITEMS = [
  {
    lake: "Lake Bellandur",
    status: "Toxic Effluent Detected",
    level: "Critical",
    authority: "State Pollution Control Board",
    action: "Automated Escalation Dispatched",
    time: "2m ago",
  },
  {
    lake: "Reedwater Nature Reserve",
    status: "Algal Bloom Expansion",
    level: "Warning",
    authority: "National Catchment Board",
    action: "Water Sampling Task Created",
    time: "8m ago",
  },
  {
    lake: "Silver Bay Estuary",
    status: "Hydrocarbon Film Reported",
    level: "Critical",
    authority: "Environmental Police & Coast Guard",
    action: "Containment Squad Alerted",
    time: "14m ago",
  },
  {
    lake: "Emerald Basin Reservoir",
    status: "Normal Baseline (WQI 89)",
    level: "Safe",
    authority: "Clean Water Bureau",
    action: "Automated Telemetry Verified",
    time: "19m ago",
  },
  {
    lake: "Cascade River Inlet",
    status: "High Turbidity Spike (88 NTU)",
    level: "Warning",
    authority: "Watershed Directorate",
    action: "Automated Sensor Alert Sent",
    time: "25m ago",
  },
];

export default function LakeHealthTicker() {
  return (
    <div className="lake-health-ticker-container" aria-label="Real-time water health dispatch feed">
      <div className="ticker-label">
        <span className="ticker-radar-dot" />
        <Radio size={14} className="text-rose-600 animate-pulse" />
        <span>LIVE LAKE WATCH</span>
      </div>

      <div className="ticker-scroll-track">
        <div className="ticker-items-row">
          {FEED_ITEMS.concat(FEED_ITEMS).map((item, idx) => {
            const isCritical = item.level === "Critical";
            const isWarning = item.level === "Warning";
            return (
              <div key={`${item.lake}-${idx}`} className="ticker-chip">
                <span className="ticker-chip-indicator">
                  {isCritical ? (
                    <ShieldAlert size={13} className="text-rose-500" />
                  ) : isWarning ? (
                    <AlertTriangle size={13} className="text-amber-500" />
                  ) : (
                    <CheckCircle size={13} className="text-emerald-500" />
                  )}
                </span>
                <strong className="ticker-lake-name">{item.lake}</strong>
                <span className="ticker-pipe">·</span>
                <span className="ticker-status">{item.status}</span>
                <span className="ticker-arrow">→</span>
                <span className="ticker-authority">{item.authority}</span>
                <span className="ticker-badge-action">[{item.action}]</span>
                <small className="ticker-time">{item.time}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
